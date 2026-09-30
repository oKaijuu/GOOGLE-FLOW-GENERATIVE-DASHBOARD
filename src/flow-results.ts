import fs from "node:fs/promises";
import path from "node:path";
import type { Page } from "playwright";
import { FlowAutomation } from "./flow-automation.js";

const RESULTS_INSPECTION_FILE = path.resolve(".flow-results-inspection.json");
const RESULTS_SCREENSHOT = path.resolve(".flow-results-inspection.png");
const DOWNLOAD_DIR = path.resolve(".flow-downloads");

type ResultImage = {
  src: string | null;
  alt: string | null;
  width: number;
  height: number;
};

type DownloadControl = {
  ariaLabel: string | null;
  title: string | null;
  text: string;
};

export type FlowResultsInspection = {
  url: string;
  title: string;
  timestamp: string;
  images: ResultImage[];
  downloadControls: DownloadControl[];
  promptMatches: number;
};

function downloadButtonSelector() {
  return [
    'button:visible[aria-label*="download" i]',
    'button:visible[aria-label*="baixar" i]',
    'button:visible[title*="download" i]',
    'button:visible[title*="baixar" i]',
    'a:visible[aria-label*="download" i]',
    'a:visible[aria-label*="baixar" i]',
    'a:visible[title*="download" i]',
    'a:visible[title*="baixar" i]',
  ].join(",");
}

export class FlowResults {
  constructor(private readonly flow: FlowAutomation) {}

  private page(): Page {
    return this.flow.getPage();
  }

  async inspect(prompt?: string): Promise<FlowResultsInspection> {
    const page = this.page();
    await page.waitForTimeout(1200);

    const images = await page.locator("img:visible").evaluateAll((elements) =>
      elements.map((element) => {
        const image = element as HTMLImageElement;
        return {
          src: image.currentSrc || image.src || null,
          alt: image.alt || null,
          width: image.naturalWidth || image.width,
          height: image.naturalHeight || image.height,
        };
      })
    );

    const controls = page.locator(downloadButtonSelector());
    const downloadControls = await controls.evaluateAll((elements) =>
      elements.map((element) => ({
        ariaLabel: element.getAttribute("aria-label"),
        title: element.getAttribute("title"),
        text: (element.textContent || "").replace(/\s+/g, " ").trim(),
      }))
    );

    const promptMatches = prompt
      ? await page.getByText(prompt, { exact: false }).filter({ visible: true }).count()
      : 0;

    const result: FlowResultsInspection = {
      url: page.url(),
      title: await page.title().catch(() => ""),
      timestamp: new Date().toISOString(),
      images,
      downloadControls,
      promptMatches,
    };

    await fs.writeFile(
      RESULTS_INSPECTION_FILE,
      JSON.stringify(result, null, 2),
      "utf8"
    );
    await page.screenshot({ path: RESULTS_SCREENSHOT, fullPage: true });

    return result;
  }

  async downloadExisting(prompt?: string) {
    const page = this.page();
    await fs.mkdir(DOWNLOAD_DIR, { recursive: true });
    await page.waitForTimeout(1200);

    let controls = page.locator(downloadButtonSelector()).filter({ visible: true });

    if (prompt) {
      const promptMatches = page
        .getByText(prompt, { exact: false })
        .filter({ visible: true });

      if ((await promptMatches.count()) === 0) {
        throw new Error(
          "O prompt informado não foi encontrado no projeto. Nenhuma imagem foi baixada."
        );
      }

      let scoped = promptMatches.first();
      let foundScopedControls = false;

      for (let level = 0; level < 8; level++) {
        const parent = scoped.locator("xpath=..");
        const candidate = parent.locator(downloadButtonSelector()).filter({
          visible: true,
        });

        if ((await candidate.count()) > 0) {
          controls = candidate;
          foundScopedControls = true;
          break;
        }

        scoped = parent;
      }

      if (!foundScopedControls) {
        throw new Error(
          "A geração foi encontrada, mas o botão de download não foi localizado no card correspondente."
        );
      }
    }

    if ((await controls.count()) === 0) {
      await this.inspect(prompt);
      throw new Error(
        "Nenhum controle de download visível foi encontrado. " +
          "O diagnóstico foi salvo em .flow-results-inspection.json e .flow-results-inspection.png."
      );
    }

    const downloaded: string[] = [];
    const initialCount = await controls.count();

    for (let index = 0; index < initialCount && downloaded.length < 20; index++) {
      if (index >= await controls.count()) break;

      const control = controls.nth(index);
      const downloadPromise = page.waitForEvent("download", { timeout: 10000 });

      await control.click();
      const download = await downloadPromise;
      const filename =
        download.suggestedFilename() || "flow-" + (downloaded.length + 1) + ".png";
      const destination = path.join(DOWNLOAD_DIR, filename);

      await download.saveAs(destination);
      downloaded.push(destination);
    }

    return {
      downloaded,
      count: downloaded.length,
      directory: DOWNLOAD_DIR,
      timestamp: new Date().toISOString(),
    };
  }
}
