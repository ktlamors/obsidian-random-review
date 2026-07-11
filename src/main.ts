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
  DEFAULT_SETTINGS,
} from "./constants";
import { RandomReviewSettingTab } from "./settings";
import { extractNotes } from "./note-extractor";
import { ReviewView } from "./review-view";

export default class RandomReviewPlugin extends Plugin {
  settings!: RandomReviewSettings;

  async onload(): Promise<void> {
    await this.loadSettings();

    this.addSettingTab(new RandomReviewSettingTab(this.app, this));

    this.registerView(
      VIEW_TYPE_RANDOM_REVIEW,
      (leaf: WorkspaceLeaf) => new ReviewView(leaf)
    );

    this.addCommand({
      id: "start-review",
      name: "启动随机复习",
      callback: () => {
        void this.startReview();
      },
    });

    this.addRibbonIcon("dice", "随机复习", () => {
      void this.startReview();
    });

    this.registerEvent(
      this.app.workspace.on("file-menu", (menu, file) => {
        if (file instanceof TFolder) {
          menu.addItem((item) => {
            item
              .setTitle("从此文件夹随机抽取")
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

    console.log(`${PLUGIN_NAME} plugin loaded`);
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
    for (const profile of Object.values(this.settings.profiles)) {
      if (profile.propertyFilters) fixCount(profile.propertyFilters);
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
      this.settings.showNavigationBar
    );
  }
}
