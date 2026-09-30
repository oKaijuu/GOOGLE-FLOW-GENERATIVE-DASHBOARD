import { chromium, type BrowserContext, type Page } from "playwright";
import path from "node:path";
import fs from "node:fs/promises";

const FLOW_URL = "https://flow.google.com/";
const PROFILE_DIR = path.resolve(".flow-profile");
const DOWNLOAD_DIR = path.resolve(".flow-downloads");

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
  private context: BrowserContext | null = null;
  private page: Page | null = null;

  async start() {
    await fs.mkdir(PROFILE_DIR, { recursive: true });
    await fs.mkdir(DOWNLOAD_DIR, { recursive: true });

    this.context = await chromium.launchPersistentContext(PROFILE_DIR, {
      headless: false,
      acceptDownloads: true,
      viewport: { width: 1440, height: 1000 },
    });

    this.page = this.context.pages()[0] ?? await this.context.newPage();
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
    await this.context?.close();
    this.context = null;
    this.page = null;
  }
}
