import { ItemView, WorkspaceLeaf, Notice } from "obsidian";
import type RandomReviewPlugin from "./main";
import { HistoryStorage, HistoryEntry } from "./history-storage";
import { getLang } from "./i18n";

export const HISTORY_VIEW_TYPE = "extraction-history-view";

export class HistorySidebarView extends ItemView {
  private plugin: RandomReviewPlugin;
  private storage: HistoryStorage;

  constructor(leaf: WorkspaceLeaf, plugin: RandomReviewPlugin) {
    super(leaf);
    this.plugin = plugin;
    this.storage = new HistoryStorage(plugin);
  }

  getViewType(): string {
    return HISTORY_VIEW_TYPE;
  }

  getDisplayText(): string {
    return getLang(this.plugin.settings.language).tabHistory;
  }

  getIcon(): string {
    return "clock";
  }

  async onOpen(): Promise<void> {
    await this.render();
  }

  async onClose(): Promise<void> {}

  async refresh(): Promise<void> {
    await this.render();
  }

  private async render(): Promise<void> {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass("random-review-history-panel");

    const t = getLang(this.plugin.settings.language);
    const entries = await this.storage.load();

    if (entries.length === 0) {
      container.createEl("p", {
        text: t.historyEmpty,
        cls: "quiz-history-empty",
      });
      return;
    }

    const list = container.createDiv("quiz-history-list");
    entries.forEach((entry) => {
      const item = list.createDiv("quiz-history-item");

      const nameSpan = item.createSpan("quiz-history-file");
      nameSpan.setText(entry.name);
      item.createSpan("quiz-history-time").setText(
        `${entry.noteCount} ${t.historyCount.toLowerCase()}`
      );

      const loadBtn = item.createEl("button", {
        text: t.historyLoad,
        cls: "quiz-history-review-btn",
      });
      loadBtn.addEventListener("click", () => {
        void this.loadHistory(entry);
      });

      const renameBtn = item.createEl("button", {
        text: t.historyRename,
        cls: "quiz-history-review-btn",
      });
      renameBtn.addEventListener("click", () => {
        this.startRename(nameSpan, entry);
      });

      const delBtn = item.createEl("button", {
        text: t.historyDelete,
        cls: "quiz-history-review-btn",
      });
      delBtn.addEventListener("click", () => {
        void this.deleteEntry(entry.id);
      });
    });
  }

  private async loadHistory(entry: HistoryEntry): Promise<void> {
    await this.plugin.loadHistoryEntry(entry);
  }

  private startRename(nameSpan: HTMLElement, entry: HistoryEntry): void {
    nameSpan.empty();
    const input = nameSpan.createEl("input", {
      cls: "quiz-history-rename-input",
      type: "text",
    });
    input.value = entry.name;
    input.select();

    let saved = false;
    const save = async (): Promise<void> => {
      if (saved) return;
      saved = true;
      const val = input.value.trim();
      if (val && val !== entry.name) {
        await this.storage.rename(entry.id, val);
      }
      this.plugin.notifyHistoryChanged();
    };

    input.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        void save();
      } else if (e.key === "Escape") {
        e.preventDefault();
        this.plugin.notifyHistoryChanged();
      }
    });
    input.addEventListener("blur", () => {
      void save();
    });
    input.focus();
  }

  private async deleteEntry(id: string): Promise<void> {
    const t = getLang(this.plugin.settings.language);
    if (!confirm(t.historyDeleteConfirm)) return;
    await this.storage.remove(id);
    this.plugin.notifyHistoryChanged();
    new Notice(t.historyDeleted);
  }
}
