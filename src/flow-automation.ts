import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { spawn, type ChildProcess } from "node:child_process";
import net from "node:net";
import path from "node:path";
import fs from "node:fs/promises";

const FLOW_URL = "https://flow.google.com/";
const PROFILE_DIR = path.resolve(".flow-profile");
const DOWNLOAD_DIR = path.resolve(".flow-downloads");
const INSPECTION_FILE = path.resolve(".flow-inspection.json");
const INSPECTION_SCREENSHOT = path.resolve(".flow-inspection.png");
const SETTINGS_INSPECTION_FILE = path.resolve(".flow-settings-inspection.json");
const SETTINGS_INSPECTION_SCREENSHOT = path.resolve(".flow-settings-inspection.png");

function browserExecutable(): string | undefined {
  const configured = process.env.FLOW_BROWSER_EXECUTABLE;
  return configured && configured.trim() ? configured : undefined;
}

async function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Não foi possível obter uma porta local."));
        return;
      }
      const port = address.port;
      server.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}

type InteractiveElement = {
  tag: string;
  role: string | null;
  type: string | null;
  text: string;
  ariaLabel: string | null;
  title: string | null;
  placeholder: string | null;
  name: string | null;
  id: string | null;
  contentEditable: boolean;
  disabled: boolean;
  visible: boolean;
};

type SettingsInspection = {
  url: string;
  title: string;
  timestamp: string;
  dialogs: string[];
  menus: string[];
  interactiveElements: InteractiveElement[];
};

export type FlowInspection = {
  url: string;
  title: string;
  timestamp: string;
  model: string | null;
  settings: string[];
  editorFound: boolean;
  uploadInputFound: boolean;
  candidateGenerateButtons: string[];
  policyError: string | null;
  interactiveElements: InteractiveElement[];
  creator?: {
    promptEditorFound: boolean;
    promptEditorAriaLabel: string | null;
    generationButtonFound: boolean;
    generationButtonDisabled: boolean | null;
    settingsButtonFound: boolean;
    addElementsButtonFound: boolean;
  };
};

export class FlowAutomation {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private browserProcess: ChildProcess | null = null;

  async start() {
    await fs.mkdir(PROFILE_DIR, { recursive: true });
    await fs.mkdir(DOWNLOAD_DIR, { recursive: true });

    const executablePath = browserExecutable();

    if (!executablePath) {
      throw new Error(
        "Chrome/Chromium não foi encontrado. Defina FLOW_BROWSER_EXECUTABLE ou execute pelo run.bat/run.sh."
      );
    }

    const port = await findFreePort();

    this.browserProcess = spawn(
      executablePath,
      [
        `--remote-debugging-port=${port}`,
        `--user-data-dir=${PROFILE_DIR}`,
        "--no-first-run",
        "--no-default-browser-check",
        FLOW_URL,
      ],
      {
        detached: false,
        stdio: "ignore",
        windowsHide: false,
      }
    );

    this.browserProcess.once("exit", () => {
      this.browserProcess = null;
    });

    const endpoint = `http://127.0.0.1:${port}`;
    let lastError: unknown;

    for (let attempt = 0; attempt < 30; attempt++) {
      try {
        this.browser = await chromium.connectOverCDP(endpoint);
        break;
      } catch (error) {
        lastError = error;
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    }

    if (!this.browser) {
      this.browserProcess?.kill();
      this.browserProcess = null;
      throw new Error(
        `Não foi possível conectar ao Chrome iniciado pelo projeto. ${String(lastError ?? "")}`
      );
    }

    this.context = this.browser.contexts()[0] ?? null;
    if (!this.context) {
      await this.browser.close();
      this.browser = null;
      throw new Error("O Chrome iniciou, mas nenhuma sessão foi disponibilizada.");
    }

    this.page =
      this.context.pages().find((candidate) => candidate.url().startsWith("http")) ??
      this.context.pages()[0] ??
      (await this.context.newPage());

    return this.page;
  }

  private getPage(): Page {
    if (!this.page) throw new Error("Flow browser is not started.");
    return this.page;
  }

  async open(url = FLOW_URL) {
    const page = this.getPage();
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);
    return page;
  }

  async openProject(projectUrl: string) {
    if (!/^https:\/\/flow\.google\.com\/project\/[a-z0-9-]+(?:\/.*)?$/i.test(projectUrl)) {
      throw new Error("URL de projeto do Flow inválida.");
    }

    return this.open(projectUrl);
  }

  private async ensureCreatorOpen() {
    const page = this.getPage();

    // O Flow pode carregar o projeto alguns segundos depois do goto.
    await page.waitForTimeout(1500);

    const hasComposer = async () => {
      const settings =
        (await page.locator('button[aria-label="Configurações"]').count()) > 0;
      const prompt =
        (await page.locator('[contenteditable="true"]').count()) > 0;
      const generation =
        (await page.locator('button[aria-label="Iniciar geração"]').count()) > 0;

      return settings || (prompt && generation);
    };

    if (await hasComposer()) return;

    // Não dependa do idioma da interface. O projeto pode estar em português,
    // onde "Start Creating" não existe.
    const candidates = page.getByRole("button").filter({
      hasText: /start creating|começar a criar|começar|criar|create/i,
    });

    const candidateCount = await candidates.count();

    for (let i = 0; i < candidateCount; i++) {
      const candidate = candidates.nth(i);

      if (!(await candidate.isVisible().catch(() => false))) continue;
      if (await candidate.isDisabled().catch(() => false)) continue;

      const label =
        (await candidate.getAttribute("aria-label").catch(() => null)) ||
        (await candidate.textContent().catch(() => "")) ||
        "";

      // Evita clicar em ações secundárias que apenas contenham "criar".
      if (
        !/start creating|começar a criar|começar|create|criar/i.test(label) ||
        /projeto|project|personagem|character|avatar|arquivo|file/i.test(label)
      ) {
        continue;
      }

      await candidate.click();
      await page.waitForTimeout(2000);

      if (await hasComposer()) return;
    }

    // Gera um diagnóstico útil em vez de afirmar que "Start Creating" é
    // necessariamente o controle usado pela versão atual do Flow.
    const elements = await this.collectInteractiveElements(page);
    const visibleControls = elements
      .filter((element) => element.tag === "button" || element.role === "button")
      .slice(0, 40)
      .map((element) => ({
        text: element.text,
        ariaLabel: element.ariaLabel,
        title: element.title,
      }));

    await fs.writeFile(
      INSPECTION_FILE,
      JSON.stringify(
        {
          url: page.url(),
          title: await page.title().catch(() => ""),
          timestamp: new Date().toISOString(),
          reason: "creator-not-detected",
          visibleControls,
        },
        null,
        2
      ),
      "utf8"
    );

    await page.screenshot({ path: INSPECTION_SCREENSHOT, fullPage: true });

    throw new Error(
      "Não foi possível detectar o compositor do Flow. " +
        "A tela atual foi salva em .flow-inspection.json e .flow-inspection.png."
    );
  }

  private async collectInteractiveElements(page: Page): Promise<InteractiveElement[]> {
    return page.evaluate(() => {
      const selector = [
        "button",
        "a[href]",
        "input",
        "textarea",
        '[contenteditable="true"]',
        '[role="button"]',
        '[role="combobox"]',
        '[role="menuitem"]',
        '[role="tab"]',
        '[role="option"]',
        '[role="radio"]',
        '[role="switch"]',
      ].join(",");

      return Array.from(document.querySelectorAll(selector))
        .filter((element) => {
          const html = element as HTMLElement;
          const style = window.getComputedStyle(html);
          const rect = html.getBoundingClientRect();
          return (
            style.display !== "none" &&
            style.visibility !== "hidden" &&
            rect.width > 0 &&
            rect.height > 0
          );
        })
        .map((element) => {
          const html = element as HTMLElement;
          const input = element as HTMLInputElement;
          const role =
            element.getAttribute("role") || html.getAttribute("aria-role");

          return {
            tag: element.tagName.toLowerCase(),
            role,
            type: input.type || null,
            text: (html.innerText || html.textContent || "")
              .replace(/\s+/g, " ")
              .trim(),
            ariaLabel: element.getAttribute("aria-label"),
            title: element.getAttribute("title"),
            placeholder: input.getAttribute("placeholder"),
            name: input.getAttribute("name"),
            id: input.id || null,
            contentEditable: html.isContentEditable,
            disabled: "disabled" in input ? Boolean(input.disabled) : false,
            visible: true,
          };
        });
    });
  }

  private async collectInspection(page: Page): Promise<FlowInspection> {
    const interactiveElements = await this.collectInteractiveElements(page);

    const model =
      (await page
        .locator("span.settings-summary, .model-select-trigger-content")
        .first()
        .textContent()
        .catch(() => null))?.trim() || null;

    const settings = await page
      .locator(
        "span.settings-summary, span.toggle-text, span.mat-button-toggle-label-content"
      )
      .allTextContents();

    const editorFound =
      (await page.locator("flow-rich-text-editor").count()) > 0 ||
      (await page.locator('[contenteditable="true"]').count()) > 0 ||
      (await page.locator("textarea").count()) > 0;

    const uploadInputFound =
      (await page.locator('input[type="file"]').count()) > 0;

    const buttonTexts = await page
      .locator("button, [role='button']")
      .allTextContents();

    const candidateGenerateButtons = buttonTexts
      .map((x) => x.replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .filter((x) =>
        /gerar|generate|criar|create|enviar|send|run|start creating/i.test(x)
      );

    const policyError =
      (
        await page
          .locator(
            "div.error-text, div.error-header, [role='alert'], [aria-live='assertive']"
          )
          .first()
          .textContent()
          .catch(() => null)
      )?.trim() || null;

    const generationButton = page.locator('button[aria-label="Iniciar geração"]').first();
    const settingsButton = page.locator('button[aria-label="Configurações"]').first();
    const addElementsButton = page.locator(
      'button[aria-label="Adicionar elementos à caixa de comando"]'
    ).first();
    const promptEditor = page.locator('[contenteditable="true"]').first();

    const result: FlowInspection = {
      url: page.url(),
      title: await page.title().catch(() => ""),
      timestamp: new Date().toISOString(),
      model,
      settings: [...new Set(settings.map((x) => x.trim()).filter(Boolean))],
      editorFound,
      uploadInputFound,
      candidateGenerateButtons: [...new Set(candidateGenerateButtons)],
      policyError,
      interactiveElements,
      creator: {
        promptEditorFound: (await promptEditor.count()) > 0,
        promptEditorAriaLabel:
          (await promptEditor.getAttribute("aria-label").catch(() => null)) || null,
        generationButtonFound: (await generationButton.count()) > 0,
        generationButtonDisabled:
          (await generationButton.count()) > 0
            ? await generationButton.isDisabled().catch(() => null)
            : null,
        settingsButtonFound: (await settingsButton.count()) > 0,
        addElementsButtonFound: (await addElementsButton.count()) > 0,
      },
    };

    await fs.writeFile(INSPECTION_FILE, JSON.stringify(result, null, 2), "utf8");
    await page.screenshot({ path: INSPECTION_SCREENSHOT, fullPage: true });

    return result;
  }

  async inspect(): Promise<FlowInspection> {
    return this.collectInspection(this.getPage());
  }

  async inspectCreator(): Promise<FlowInspection> {
    const page = this.getPage();
    const startCreating = page.getByRole("button", {
      name: /start creating/i,
    }).first();

    if ((await startCreating.count()) === 0) {
      throw new Error(
        'O botão "Start Creating" não foi encontrado. Execute o inspect normal para verificar a tela atual.'
      );
    }

    await startCreating.click();
    await page.waitForTimeout(2000);

    return this.collectInspection(page);
  }

  async generateImage(options: {
    prompt: string;
    model?: "Nano Banana 2" | "Nano Banana Pro";
    aspectRatio?: "16:9" | "4:3" | "1:1" | "3:4" | "9:16";
    quantity?: 1 | 2 | 3 | 4;
  }) {
    const page = this.getPage();

    if (!options.prompt.trim()) {
      throw new Error("O prompt não pode estar vazio.");
    }

    await this.ensureCreatorOpen();

    const settingsButton = page.locator('button[aria-label="Configurações"]').first();
    await settingsButton.waitFor({ state: "visible", timeout: 10000 });
    await settingsButton.click();

    const saveButton = page.getByRole("button", { name: "Salvar", exact: true }).last();
    await saveButton.waitFor({ state: "visible", timeout: 10000 });

    // O painel precisa estar completamente aberto antes de alterar qualquer
    // opção. Os controles são radios no DOM atual do Flow.
    const imageAspectRadios = page
      .getByRole("radio")
      .filter({ visible: true })
      .filter({ hasText: /^(16:9|4:3|1:1|3:4|9:16)$/ });

    const imageQuantityRadios = page
      .getByRole("radio")
      .filter({ visible: true })
      .filter({ hasText: /^x[1-4]$/ });

    if (options.aspectRatio) {
      const aspect = imageAspectRadios
        .filter({ hasText: options.aspectRatio })
        .first();

      await aspect.waitFor({ state: "visible", timeout: 5000 });
      await aspect.click();
      await page.waitForTimeout(250);

      if (!(await aspect.isChecked().catch(() => false))) {
        throw new Error(`O Flow não confirmou a proporção "${options.aspectRatio}" como selecionada.`);
      }
    }

    if (options.quantity) {
      const quantity = imageQuantityRadios
        .filter({ hasText: `x${options.quantity}` })
        .first();

      await quantity.waitFor({ state: "visible", timeout: 5000 });
      await quantity.click();
      await page.waitForTimeout(250);

      if (!(await quantity.isChecked().catch(() => false))) {
        throw new Error(`O Flow não confirmou a quantidade x${options.quantity} como selecionada.`);
      }
    }

    if (options.model) {
      const modelButton = page
        .locator('button[aria-label="Modelo padrão de geração de imagens"]')
        .first();

      await modelButton.waitFor({ state: "visible", timeout: 5000 });
      await modelButton.click();

      const modelOption = page
        .getByText(options.model, { exact: true })
        .filter({ visible: true })
        .last();

      await modelOption.waitFor({ state: "visible", timeout: 5000 });
      await modelOption.click();
      await page.waitForTimeout(400);
    }

    // Só fecha o painel depois que todos os valores foram confirmados.
    await saveButton.click();
    await page.waitForTimeout(750);

    const promptEditor = page.locator('[contenteditable="true"]').first();

    if ((await promptEditor.count()) === 0) {
      throw new Error("Editor de prompt não encontrado.");
    }

    await promptEditor.click();
    await promptEditor.fill(options.prompt);

    const generateButton = page.locator('button[aria-label="Iniciar geração"]').first();

    if ((await generateButton.count()) === 0) {
      throw new Error('Botão "Iniciar geração" não encontrado.');
    }

    await page.waitForTimeout(250);

    if (await generateButton.isDisabled()) {
      throw new Error(
        'O botão "Iniciar geração" continua desabilitado depois de preencher o prompt.'
      );
    }

    await generateButton.click();

    return {
      started: true,
      prompt: options.prompt,
      model: options.model ?? null,
      aspectRatio: options.aspectRatio ?? null,
      quantity: options.quantity ?? null,
      url: page.url(),
      timestamp: new Date().toISOString(),
    };
  }

  async inspectSettings(): Promise<SettingsInspection> {
    const page = this.getPage();
    await this.ensureCreatorOpen();
    const settingsButton = page.locator('button[aria-label="Configurações"]').first();

    if ((await settingsButton.count()) === 0) {
      throw new Error(
        'O compositor do Flow foi aberto, mas o botão "Configurações" não apareceu.'
      );
    }

    await settingsButton.click();
    await page.waitForTimeout(500);

    const result: SettingsInspection = {
      url: page.url(),
      title: await page.title().catch(() => ""),
      timestamp: new Date().toISOString(),
      dialogs: await page.locator('[role="dialog"]').allTextContents(),
      menus: await page.locator('[role="menu"]').allTextContents(),
      interactiveElements: await this.collectInteractiveElements(page),
    };

    await fs.writeFile(
      SETTINGS_INSPECTION_FILE,
      JSON.stringify(result, null, 2),
      "utf8"
    );

    await page.screenshot({
      path: SETTINGS_INSPECTION_SCREENSHOT,
      fullPage: true,
    });

    await page.keyboard.press("Escape").catch(() => undefined);

    return result;
  }

  async close() {
    await this.browser?.close();
    this.browser = null;
    this.context = null;
    this.page = null;
    this.browserProcess = null;
  }
}
