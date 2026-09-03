import {
  Plugin,
  WorkspaceLeaf,
  Notice,
  TFolder,
  Command,
} from "obsidian";
import {
  VIEW_TYPE_RANDOM_REVIEW,
  RandomReviewSettings,
  PropertyGroup,
  LegacyPropertyFilter,
  DEFAULT_SETTINGS,
} from "./constants";
import { RandomReviewSettingTab } from "./settings";
import { extractNotes } from "./note-extractor";
import { ReviewView } from "./review-view";
import { getLang } from "./i18n";

/** Obsidian 内部设置管理器的最小接口（未在公开类型中暴露） */
interface SettingManager {
  open(): Promise<void>;
  openTabById(id: string): Promise<void>;
}

type LegacyStoredData = Partial<RandomReviewSettings> & {
  propertyFilters?: LegacyPropertyFilter[];
  profiles?: Record<
    string,
    RandomReviewSettings["profiles"][string] & { propertyFilters?: LegacyPropertyFilter[] }
  >;
};

/** 把旧版扁平属性筛选（v≤1.1.2）迁移为条件组：每个旧条件单独成组，组间仍为 OR */
function migrateLegacyPropertyFilters(holder: {
  propertyGroups?: PropertyGroup[];
  propertyFilters?: LegacyPropertyFilter[];
}): void {
  if (!Array.isArray(holder.propertyGroups)) {
    holder.propertyGroups = (holder.propertyFilters ?? [])
      .filter((f) => f.key && f.value)
      .map((f) => ({
        conditions: [
          {
            key: f.key,
            value: f.value,
            operator:
              f.operator === "contains" || f.operator === "not-equals"
                ? f.operator
                : "equals",
          },
        ],
        count: f.count ?? 0,
      }));
  }
  delete holder.propertyFilters;
}

export default class RandomReviewPlugin extends Plugin {
  settings!: RandomReviewSettings;
  private ribbonIcon!: HTMLElement;
  private startCommand!: Command;

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
  }

  private registerStartCommand(): void {
    this.startCommand = this.addCommand({
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
      const setting = (this.app as unknown as { setting: SettingManager }).setting;
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
    if (this.startCommand) {
      this.startCommand.name = getLang(this.settings.language).startReview;
    }
    this.ribbonIcon?.setAttribute(
      "aria-label",
      getLang(this.settings.language).ribbonTooltip
    );
  }

  onunload(): void {}

  async loadSettings(): Promise<void> {
    const raw = (await this.loadData()) as LegacyStoredData | null;
    const data = raw ?? {};

    // 迁移旧版存档：顶层与每个文件夹档案的扁平 propertyFilters → 条件组
    migrateLegacyPropertyFilters(data);
    const profiles = data.profiles;
    if (profiles) {
      for (const path of Object.keys(profiles)) {
        migrateLegacyPropertyFilters(profiles[path]);
      }
    }

    this.settings = Object.assign({}, DEFAULT_SETTINGS, data);

    if (!this.settings.profiles) {
      this.settings.profiles = {};
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
