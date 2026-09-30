import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { spawn, type ChildProcess } from "node:child_process";
import net from "node:net";
import path from "node:path";
import fs from "node:fs/promises";

const FLOW_URL = "https://flow.google.com/";
const PROFILE_DIR = path.resolve(".flow-profile");
const DOWNLOAD_DIR = path.resolve(".flow-downloads");

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

export type FlowInspection = {
  url: string;
  title: string;
  model: string | null;
  settings: string[];
  editorFound: boolean;
  uploadInputFound: boolean;
  candidateGenerateButtons: string[];
  policyError: string | null;
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

    // O Chrome é iniciado como um navegador normal, com um perfil separado.
    // Não são aplicadas flags de stealth, alteração de User-Agent ou manipulação
    // de navigator.webdriver. O usuário faz o login manualmente nesta sessão.
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
      this.context.pages().find((candidate) =>
        candidate.url().startsWith("http")
      ) ??
      this.context.pages()[0] ??
      (await this.context.newPage());

    return this.page;
  }

  private getPage(): Page {
    if (!this.page) throw new Error("Flow browser is not started.");
    return this.page;
  }

  async open() {
    const page = this.getPage();
    await page.goto(FLOW_URL, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);
    return page;
  }

  async inspect(): Promise<FlowInspection> {
    const page = this.getPage();

    const model = await page
      .locator("span.settings-summary, .model-select-trigger-content")
      .first()
      .textContent()
      .catch(() => null);

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

    const buttonTexts = await page.locator("button").allTextContents();
    const candidateGenerateButtons = buttonTexts
      .map((x) => x.replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .filter((x) => /gerar|generate|criar|create|enviar|send/i.test(x));

    const policyError = await page
      .locator("div.error-text, div.error-header")
      .first()
      .textContent()
      .catch(() => null);

    return {
      url: page.url(),
      title: await page.title(),
      model: model?.trim() || null,
      settings: [...new Set(settings.map((x) => x.trim()).filter(Boolean))],
      editorFound,
      uploadInputFound,
      candidateGenerateButtons: [...new Set(candidateGenerateButtons)],
      policyError: policyError?.trim() || null,
    };
  }

  async close() {
    // Disconnect from Chrome without forcing the user's browser session closed.
    await this.browser?.close();
    this.browser = null;
    this.context = null;
    this.page = null;
    this.browserProcess = null;
  }
}
