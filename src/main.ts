import {
  Plugin,
  WorkspaceLeaf,
  Notice,
  TFolder,
} from "obsidian";
import {
  VIEW_TYPE_RANDOM_REVIEW,
  PLUGIN_NAME,
  RandomReviewSettings,
  FolderProfile,
  DEFAULT_SETTINGS,
} from "./constants";
import { RandomReviewSettingTab } from "./settings";
import { extractNotes } from "./note-extractor";
import { ReviewView } from "./review-view";
import { getLang } from "./i18n";

export default class RandomReviewPlugin extends Plugin {
  settings!: RandomReviewSettings;
  private ribbonIcon!: HTMLElement;

  async onload(): Promise<void> {
    await this.loadSettings();

    this.addSettingTab(new RandomReviewSettingTab(this.app, this));

    this.registerView(
      VIEW_TYPE_RANDOM_REVIEW,
      (leaf: WorkspaceLeaf) => new ReviewView(leaf)
    );

    this.registerStartCommand();
    this.registerRibbonIcon();
    this.registerFolderMenu();

    console.log(`${PLUGIN_NAME} plugin loaded`);
  }

  private registerStartCommand(): void {
    this.addCommand({
      id: "start-review",
      name: getLang(this.settings.language).startReview,
      callback: () => {
        void this.startReview();
      },
    });
  }

  private registerRibbonIcon(): void {
    this.ribbonIcon = this.addRibbonIcon(
      "dice",
      getLang(this.settings.language).ribbonTooltip,
      () => {
        void this.startReview();
      }
    );

    this.ribbonIcon.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      const setting = (this.app as any).setting;
      void setting.open();
      void setting.openTabById(this.manifest.id);
    });
  }

  private registerFolderMenu(): void {
    this.registerEvent(
      this.app.workspace.on("file-menu", (menu, file) => {
        if (file instanceof TFolder) {
          menu.addItem((item) => {
            item
              .setTitle(getLang(this.settings.language).folderMenu)
              .setIcon("dice")
              .onClick(() => {
                this.settings.folderPath = file.path;
                void this.saveSettings();
                void this.startReview();
              });
          });
        }
      })
    );
  }

  /** 语言切换后刷新命令名与 Ribbon 提示 */
  refreshUIStrings(): void {
    if (typeof this.removeCommand === "function") {
      this.removeCommand("start-review");
    }
    this.registerStartCommand();
    this.ribbonIcon?.setAttribute(
      "aria-label",
      getLang(this.settings.language).ribbonTooltip
    );
  }

  onunload(): void {
    console.log(`${PLUGIN_NAME} plugin unloaded`);
  }

  async loadSettings(): Promise<void> {
    const data = (await this.loadData()) as Partial<RandomReviewSettings> | null;
    this.settings = Object.assign({}, DEFAULT_SETTINGS, data ?? {});

    if (!this.settings.profiles) {
      this.settings.profiles = {};
    }

    const fixCount = (filters: { count?: number }[]): void => {
      for (const f of filters) {
        if (f.count === undefined) f.count = 0;
      }
    };
    fixCount(this.settings.propertyFilters);
    for (const profile of Object.values<FolderProfile>(this.settings.profiles)) {
      if (profile.propertyFilters.length > 0) fixCount(profile.propertyFilters);
    }

    await this.saveSettings();
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  async startReview(): Promise<void> {
    if (!this.settings.folderPath) {
      new Notice("请先在设置中指定目标文件夹");
      return;
    }

    const queue = extractNotes(this.app, this.settings);
    if (queue.length === 0) return;

    const { workspace } = this.app;

    let leaf: WorkspaceLeaf;
    const existing = workspace.getLeavesOfType(VIEW_TYPE_RANDOM_REVIEW);
    if (existing.length > 0) {
      leaf = existing[0];
    } else {
      leaf = workspace.getLeaf("tab");
    }

    await leaf.setViewState({
      type: VIEW_TYPE_RANDOM_REVIEW,
      active: true,
    });

    const view = leaf.view as ReviewView;
    await view.startReview(
      queue,
      this.settings.answerDefaultCollapsed,
      this.settings.showNavigationBar,
      this.settings.language
    );
  }
}
