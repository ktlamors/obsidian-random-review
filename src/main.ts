import {
  Plugin,
  WorkspaceLeaf,
  Notice,
  TFolder,
  Command,
  TFile,
  Menu,
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
import { QuizHistoryView, VIEW_TYPE_QUIZ_HISTORY } from "./quiz-history-view";
import { HistorySidebarView, HISTORY_VIEW_TYPE } from "./history-sidebar-view";
import {
  HistoryStorage,
  HistoryEntry,
  HISTORY_STORAGE_KEY,
} from "./history-storage";
import { QUIZ_STORAGE_KEY } from "./quiz-storage";
import { ProfilePickModal } from "./profile-pick-modal";
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
  private settingTab!: RandomReviewSettingTab;

  async onload(): Promise<void> {
    await this.loadSettings();

    this.settingTab = new RandomReviewSettingTab(this.app, this);
    this.addSettingTab(this.settingTab);

    this.registerView(
      VIEW_TYPE_RANDOM_REVIEW,
      (leaf: WorkspaceLeaf) => new ReviewView(leaf, this)
    );
    this.registerView(
      VIEW_TYPE_QUIZ_HISTORY,
      (leaf: WorkspaceLeaf) => new QuizHistoryView(leaf, this)
    );
    this.registerView(
      HISTORY_VIEW_TYPE,
      (leaf: WorkspaceLeaf) => new HistorySidebarView(leaf, this)
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
    this.ribbonIcon = this.addRibbonIcon("dice", getLang(this.settings.language).ribbonTooltip, () => {});

    // 左键抽取；右键弹菜单。自行绑定 click 并忽略非主键，
    // 避免右键松开时被当作点击而误触发一次抽取
    this.ribbonIcon.addEventListener("click", (e) => {
      if (e.button !== 0) return;
      void this.startReview();
    });

    this.ribbonIcon.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.showRibbonMenu(e);
    });
  }

  /** 右键 Ribbon 图标弹出的功能菜单 */
  private showRibbonMenu(e: MouseEvent): void {
    const t = getLang(this.settings.language);
    const menu = new Menu();
    menu.addItem((item) =>
      item
        .setTitle(t.menuSelectProfileExtract)
        .setIcon("dice")
        .onClick(() => this.openProfilePick())
    );
    menu.addItem((item) =>
      item
        .setTitle(t.menuExtractionControl)
        .setIcon("settings")
        .onClick(() => {
          void this.openSettingsAt("extraction");
        })
    );
    menu.addItem((item) =>
      item
        .setTitle(t.menuQuizHistory)
        .setIcon("clock")
        .onClick(() => this.openQuizHistorySidebar())
    );
    menu.addItem((item) =>
      item
        .setTitle(t.menuExtractionHistory)
        .setIcon("history")
        .onClick(() => {
          void this.openExtractionHistorySidebar();
        })
    );
    menu.showAtMouseEvent(e);
  }

  /** 无档案时引导去抽取控制建档；有档案则弹出选择框后抽取 */
  private openProfilePick(): void {
    if (this.settings.profiles.length === 0) {
      new Notice(getLang(this.settings.language).noProfileTip);
      void this.openSettingsAt("extraction");
      return;
    }
    new ProfilePickModal(this.app, this).open();
  }

  /** 打开设置页并切换到指定选项卡 */
  private async openSettingsAt(
    key: "general" | "extraction" | "quiz" | "history"
  ): Promise<void> {
    this.settingTab?.activateTab(key);
    const setting = (this.app as unknown as { setting: SettingManager }).setting;
    await setting.open();
    await setting.openTabById(this.manifest.id);
  }

  /** 在右侧边栏打开历史答题视图 */
  private openQuizHistorySidebar(): void {
    const { workspace } = this.app;
    const existing = workspace.getLeavesOfType(VIEW_TYPE_QUIZ_HISTORY);
    let leaf: WorkspaceLeaf;
    if (existing.length > 0) {
      leaf = existing[0];
    } else {
      leaf = workspace.getRightLeaf(false)!;
      void leaf.setViewState({ type: VIEW_TYPE_QUIZ_HISTORY, active: true });
    }
    void workspace.revealLeaf(leaf);
  }

  /** 在右侧边栏打开抽取历史视图并刷新 */
  private async openExtractionHistorySidebar(): Promise<void> {
    const { workspace } = this.app;
    const existing = workspace.getLeavesOfType(HISTORY_VIEW_TYPE);
    let leaf: WorkspaceLeaf;
    if (existing.length > 0) {
      leaf = existing[0];
    } else {
      leaf = workspace.getRightLeaf(false)!;
      void leaf.setViewState({ type: HISTORY_VIEW_TYPE, active: true });
    }
    void workspace.revealLeaf(leaf);
    const view = leaf.view;
    if (view instanceof HistorySidebarView) {
      void view.refresh();
    }
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

  /** 抽取历史数据变更后，同步刷新侧边栏视图与设置页历史选项卡 */
  notifyHistoryChanged(): void {
    this.app.workspace.getLeavesOfType(HISTORY_VIEW_TYPE).forEach((leaf) => {
      const view = leaf.view;
      if (view instanceof HistorySidebarView) {
        void view.refresh();
      }
    });
    this.refreshQuizHistoryViews();
    this.settingTab?.refreshHistoryView();
  }

  /** 有新的答题记录后，刷新已打开的答题历史视图 */
  refreshQuizHistoryViews(): void {
    this.app.workspace.getLeavesOfType(VIEW_TYPE_QUIZ_HISTORY).forEach((leaf) => {
      const view = leaf.view;
      if (view instanceof QuizHistoryView) {
        void view.refresh();
      }
    });
  }

  /** 按给定笔记路径集合在中间工作区新开复习标签页；无有效文件返回 null */
  private async openReviewQueue(
    paths: string[],
    title: string,
    historyId: string | null
  ): Promise<boolean> {
    const files: TFile[] = [];
    for (const p of paths) {
      const f = this.app.vault.getAbstractFileByPath(p);
      if (f instanceof TFile) files.push(f);
    }
    if (files.length === 0) return false;

    const { workspace } = this.app;
    const leaf = workspace.getLeaf("tab");
    await leaf.setViewState({ type: VIEW_TYPE_RANDOM_REVIEW, active: true });
    await workspace.revealLeaf(leaf);
    const view = leaf.view as ReviewView;
    await view.startReview(
      files,
      this.settings.answerDefaultCollapsed,
      this.settings.showNavigationBar,
      this.settings.language,
      { title, historyId }
    );
    return true;
  }

  /** 错题复习：paths 为错题文件路径列表 */
  async startWrongReview(
    paths: string[],
    title: string,
    historyId: string | null
  ): Promise<void> {
    const ok = await this.openReviewQueue(paths, title, historyId);
    if (!ok) new Notice(getLang(this.settings.language).historyNotesMissing);
  }

  /** 从抽取历史加载复习：已打开则提示并激活，否则在中间工作区新开标签页 */
  async loadHistoryEntry(entry: HistoryEntry): Promise<void> {
    const t = getLang(this.settings.language);

    const { workspace } = this.app;
    const alreadyOpen = workspace
      .getLeavesOfType(VIEW_TYPE_RANDOM_REVIEW)
      .find((l) => {
        const v = l.view;
        return v instanceof ReviewView && v.historyId === entry.id;
      });
    if (alreadyOpen) {
      new Notice(t.historyAlreadyOpen);
      await workspace.revealLeaf(alreadyOpen);
      return;
    }

    const ok = await this.openReviewQueue(entry.files, entry.name, entry.id);
    new Notice(ok ? t.historyLoaded : t.historyNotesMissing);
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
    const leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE_RANDOM_REVIEW)[0];
    if (leaf?.view instanceof ReviewView) {
      leaf.view.refreshUIText();
    }
  }

  onunload(): void {
    // 退出前把当前工作区写回激活档案（best-effort 持久化）
    this.syncWorkingToActiveProfile();
    void this.saveSettings();
  }

  async loadSettings(): Promise<void> {
    const raw = (await this.loadData()) as LegacyStoredData | null;
    const data: Record<string, unknown> = raw ?? {};

    // quizData / extractionHistory 由 QuizStorage、HistoryStorage 独立管理，
    // 不要并入 settings，否则 settings 会残留过期副本并在下次保存时覆盖它们
    delete data[QUIZ_STORAGE_KEY];
    delete data[HISTORY_STORAGE_KEY];

    // 迁移旧版存档：顶层扁平 propertyFilters → 条件组
    migrateLegacyPropertyFilters(data);
    // 迁移旧版按文件夹键的档案 → 命名档案数组
    data.profiles = this.migrateProfiles(
      data.profiles as unknown as NamedProfile[] | undefined
    );

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
    const raw = (await this.loadData()) as Record<string, unknown> | null;
    const data: Record<string, unknown> = { ...this.settings };
    // 保留 Storage 独立管理的键，避免本次设置保存覆盖其真实内容
    const quizData = raw?.[QUIZ_STORAGE_KEY];
    const historyData = raw?.[HISTORY_STORAGE_KEY];
    if (quizData !== undefined) data[QUIZ_STORAGE_KEY] = quizData;
    if (historyData !== undefined) data[HISTORY_STORAGE_KEY] = historyData;
    await this.saveData(data);
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

    // 保存抽取历史（列表相同则去重复用其 id），并把本次会话归属到该历史
    const historyStorage = new HistoryStorage(this);
    const title = this.buildHistoryTitle();
    const historyId = await historyStorage.add(queue, title);
    this.notifyHistoryChanged();

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
      this.settings.language,
      { title, historyId }
    );
  }

  /** 新抽取历史的默认标题：档案名 + MM-DD */
  private buildHistoryTitle(): string {
    const profileName =
      this.getActiveProfile()?.name ?? this.settings.folderPath ?? "未知";
    const dateStr = new Date().toISOString().slice(5, 10);
    return `${profileName} - ${dateStr}`;
  }
}
