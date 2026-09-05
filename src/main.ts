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
  FolderProfile,
  NamedProfile,
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

type LegacyProfileRecord = Record<
  string,
  FolderProfile & { propertyFilters?: LegacyPropertyFilter[] }
>;

type LegacyStoredData = Partial<Omit<RandomReviewSettings, "profiles">> & {
  propertyFilters?: LegacyPropertyFilter[];
  profiles?: LegacyProfileRecord | NamedProfile[];
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
      (leaf: WorkspaceLeaf) => new ReviewView(leaf, this)
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

  onunload(): void {
    // 退出前把当前工作区写回激活档案（best-effort 持久化）
    this.syncWorkingToActiveProfile();
    void this.saveData(this.settings);
  }

  async loadSettings(): Promise<void> {
    const raw = (await this.loadData()) as LegacyStoredData | null;
    const data = raw ?? {};

    // 迁移旧版存档：顶层扁平 propertyFilters → 条件组
    migrateLegacyPropertyFilters(data);
    // 迁移旧版按文件夹键的档案 → 命名档案数组
    data.profiles = this.migrateProfiles(data.profiles);

    this.settings = Object.assign({}, DEFAULT_SETTINGS, data);

    if (!Array.isArray(this.settings.profiles)) {
      this.settings.profiles = [];
    }
    if (this.settings.activeProfileId == null) {
      this.settings.activeProfileId = null;
    }

    await this.saveSettings();
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  // ──────────────────────────────────────────
  // 命名档案
  // ──────────────────────────────────────────

  getActiveProfile(): NamedProfile | null {
    return (
      this.settings.profiles.find((p) => p.id === this.settings.activeProfileId) ??
      null
    );
  }

  /** 把当前工作区字段写回激活档案（自动保存） */
  private syncWorkingToActiveProfile(): void {
    const active = this.getActiveProfile();
    if (!active) return;
    active.folderPath = this.settings.folderPath;
    active.excludeFolders = [...this.settings.excludeFolders];
    active.includeTags = [...this.settings.includeTags];
    active.excludeTags = [...this.settings.excludeTags];
    active.propertyGroups = this.settings.propertyGroups.map((g) => ({
      count: g.count,
      conditions: g.conditions.map((c) => ({ ...c })),
    }));
    active.pickCount = this.settings.pickCount;
    active.randomOrder = this.settings.randomOrder;
  }

  /** 切换到某档案：先把当前工作区写回原档案，再载入新档案并设为激活 */
  applyProfile(profile: NamedProfile): void {
    this.syncWorkingToActiveProfile();
    this.settings.folderPath = profile.folderPath;
    this.settings.excludeFolders = [...profile.excludeFolders];
    this.settings.includeTags = [...profile.includeTags];
    this.settings.excludeTags = [...profile.excludeTags];
    this.settings.propertyGroups = profile.propertyGroups.map((g) => ({
      count: g.count,
      conditions: g.conditions.map((c) => ({ ...c })),
    }));
    this.settings.pickCount = profile.pickCount;
    this.settings.randomOrder = profile.randomOrder;
    this.settings.activeProfileId = profile.id;
  }

  /** 取消选中档案：先把当前工作区写回原档案，再清空选中 */
  clearActiveProfile(): void {
    this.syncWorkingToActiveProfile();
    this.settings.activeProfileId = null;
  }

  /** 用当前工作区字段另存为一个新档案，并设为激活 */
  createProfile(name: string): NamedProfile {
    const profile: NamedProfile = {
      id: this.generateId(),
      name,
      folderPath: this.settings.folderPath,
      excludeFolders: [...this.settings.excludeFolders],
      includeTags: [...this.settings.includeTags],
      excludeTags: [...this.settings.excludeTags],
      propertyGroups: this.settings.propertyGroups.map((g) => ({
        count: g.count,
        conditions: g.conditions.map((c) => ({ ...c })),
      })),
      pickCount: this.settings.pickCount,
      randomOrder: this.settings.randomOrder,
    };
    this.settings.profiles.push(profile);
    this.settings.activeProfileId = profile.id;
    return profile;
  }

  deleteProfile(id: string): void {
    this.settings.profiles = this.settings.profiles.filter((p) => p.id !== id);
    if (this.settings.activeProfileId === id) {
      this.settings.activeProfileId = null;
    }
  }

  private generateId(): string {
    return (
      Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
    );
  }

  /** 旧版 profiles 是 Record<folder, FolderProfile>，转成命名档案数组 */
  private migrateProfiles(
    raw: LegacyProfileRecord | NamedProfile[] | undefined
  ): NamedProfile[] {
    if (Array.isArray(raw)) return raw;
    const result: NamedProfile[] = [];
    if (raw && typeof raw === "object") {
      for (const folderPath of Object.keys(raw)) {
        const p = raw[folderPath];
        migrateLegacyPropertyFilters(p);
        result.push({
          id: this.generateId(),
          name: folderPath.split("/").pop() || folderPath,
          folderPath,
          excludeFolders: p.excludeFolders ?? [],
          includeTags: p.includeTags ?? [],
          excludeTags: p.excludeTags ?? [],
          propertyGroups: p.propertyGroups ?? [],
          pickCount: p.pickCount ?? 10,
          randomOrder: p.randomOrder ?? true,
        });
      }
    }
    return result;
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
