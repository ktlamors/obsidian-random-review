import { App, Modal, Notice, Setting, TFile } from "obsidian";
import type RandomReviewPlugin from "./main";
import { buildExport, ExportFormat, ExportNote, PluginInfo } from "./exporter";
import { getLang } from "./i18n";

type Scope = "queue" | "current";
type Destination = "vault" | "download";

export class ExportModal extends Modal {
  private plugin: RandomReviewPlugin;
  private queue: TFile[];
  private currentIndex: number;
  private t: ReturnType<typeof getLang>;

  private exportScope: Scope = "queue";
  private format: ExportFormat = "html";
  private destination: Destination = "vault";
  private filename = "";
  private answerCollapsed = true;
  private includeAnswers = true;
  private includeRules = true;
  private includeNoteTitle = true;
  private includeProperties = false;

  constructor(app: App, plugin: RandomReviewPlugin, queue: TFile[], currentIndex: number) {
    super(app);
    this.plugin = plugin;
    this.queue = queue;
    this.currentIndex = currentIndex;
    this.t = getLang(plugin.settings.language);
    this.filename = this.defaultFilename();
  }

  private defaultFilename(): string {
    const now = new Date();
    const pad = (n: number): string => String(n).padStart(2, "0");
    const stamp =
      `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
      `-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    return `random-review-${stamp}`;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("random-review-export-modal");

    new Setting(contentEl).setName(this.t.exportModalTitle).setHeading();

    new Setting(contentEl)
      .setName(this.t.exportScope)
      .addDropdown((dd) => {
        dd.addOption("queue", this.t.exportScopeQueue);
        dd.addOption("current", this.t.exportScopeCurrent);
        dd.setValue(this.exportScope);
        dd.onChange((v) => (this.exportScope = v as Scope));
      });

    new Setting(contentEl)
      .setName(this.t.exportFormat)
      .addDropdown((dd) => {
        dd.addOption("html", this.t.exportFormatHtml);
        dd.addOption("md", this.t.exportFormatMd);
        dd.addOption("txt", this.t.exportFormatTxt);
        dd.addOption("docx", this.t.exportFormatDocx);
        dd.setValue(this.format);
        dd.onChange((v) => (this.format = v as ExportFormat));
      });

    new Setting(contentEl)
      .setName(this.t.exportDestination)
      .addDropdown((dd) => {
        dd.addOption("vault", this.t.exportDestinationVault);
        dd.addOption("download", this.t.exportDestinationDownload);
        dd.setValue(this.destination);
        dd.onChange((v) => (this.destination = v as Destination));
      });

    new Setting(contentEl)
      .setName(this.t.exportFilename)
      .addText((text) => {
        text.setPlaceholder(this.defaultFilename());
        text.setValue(this.filename);
        text.onChange((v) => (this.filename = v));
      });

    new Setting(contentEl)
      .setName(this.t.exportAnswerCollapsed)
      .setDesc(this.t.exportAnswerCollapsedDesc)
      .addToggle((tg) =>
        tg.setValue(this.answerCollapsed).onChange((v) => (this.answerCollapsed = v))
      );

    new Setting(contentEl)
      .setName(this.t.exportIncludeAnswers)
      .addToggle((tg) =>
        tg.setValue(this.includeAnswers).onChange((v) => (this.includeAnswers = v))
      );

    new Setting(contentEl)
      .setName(this.t.exportIncludeRules)
      .addToggle((tg) =>
        tg.setValue(this.includeRules).onChange((v) => (this.includeRules = v))
      );

    new Setting(contentEl)
      .setName(this.t.exportNoteTitle)
      .addToggle((tg) =>
        tg.setValue(this.includeNoteTitle).onChange((v) => (this.includeNoteTitle = v))
      );

    new Setting(contentEl)
      .setName(this.t.exportNoteProperties)
      .addToggle((tg) =>
        tg.setValue(this.includeProperties).onChange((v) => (this.includeProperties = v))
      );

    new Setting(contentEl).addButton((btn) =>
      btn
        .setButtonText(this.t.exportConfirm)
        .setCta()
        .onClick(() => {
          void this.doExport();
        })
    );
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private async readNotes(): Promise<ExportNote[]> {
    const files =
      this.exportScope === "current"
        ? [this.queue[this.currentIndex]].filter(Boolean)
        : this.queue;

    return Promise.all(
      files.map(async (file) => ({
        title: file.basename,
        content: await this.app.vault.read(file),
      }))
    );
  }

  private buildPluginInfo(): PluginInfo {
    const manifest = this.plugin.manifest;
    const authorUrl = manifest.authorUrl ?? "";
    return {
      name: manifest.name,
      version: manifest.version,
      author: manifest.author,
      authorUrl,
      githubUrl: authorUrl ? `${authorUrl}/obsidian-random-review` : "",
    };
  }

  private buildRulesSummary(): string {
    const s = this.plugin.settings;
    const t = this.t;
    const tags =
      s.includeTags.length > 0 ? s.includeTags.join(", ") : t.rulesNone;
    return [
      `${t.rulesFolder}: ${s.folderPath || t.rulesNone}`,
      `${t.rulesPickCount}: ${s.pickCount}`,
      `${t.rulesTags}: ${tags}`,
      `${t.rulesPropertyGroups}: ${s.propertyGroups.length}`,
    ].join(" · ");
  }

  private async doExport(): Promise<void> {
    const notes = await this.readNotes();
    if (notes.length === 0) {
      new Notice(this.t.exportEmpty);
      return;
    }

    const baseName = this.filename.trim() || this.defaultFilename();

    try {
      const result = await buildExport(
        {
          notes,
          format: this.format,
          pluginInfo: this.buildPluginInfo(),
          includeAnswers: this.includeAnswers,
          includeRules: this.includeRules,
          answerCollapsed: this.answerCollapsed,
          rulesSummary: this.buildRulesSummary(),
          includeNoteTitle: this.includeNoteTitle,
          includeProperties: this.includeProperties,
        },
        baseName
      );

      if (this.destination === "vault") {
        const path = result.filename;
        if (result.isBinary) {
          await this.app.vault.createBinary(path, result.content as ArrayBuffer);
        } else {
          await this.app.vault.create(path, result.content as string);
        }
        new Notice(this.t.exportSuccess(path));
      } else {
        this.download(result);
        new Notice(this.t.exportDownloaded);
      }

      this.close();
    } catch (err) {
      new Notice(this.t.exportFailed(String(err)));
    }
  }

  private download(result: { filename: string; mimeType: string; content: string | ArrayBuffer; isBinary: boolean }): void {
    const blob = result.isBinary
      ? new Blob([result.content as ArrayBuffer], { type: result.mimeType })
      : new Blob([result.content as string], { type: result.mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = result.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
