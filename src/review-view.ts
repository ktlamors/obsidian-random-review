import {
  ItemView,
  WorkspaceLeaf,
  TFile,
  MarkdownRenderer,
  Notice,
  MarkdownView,
} from "obsidian";
import { VIEW_TYPE_RANDOM_REVIEW } from "./constants";
import { getLang, Language } from "./i18n";
import type RandomReviewPlugin from "./main";
import { ExportModal } from "./export-modal";
import { QuizStorage } from "./quiz-storage";
import { QuizHistoryView, VIEW_TYPE_QUIZ_HISTORY } from "./quiz-history-view";
import { HISTORY_VIEW_TYPE } from "./history-sidebar-view";

export class ReviewView extends ItemView {
  private queue: TFile[] = [];
  private currentIndex: number = 0;
  private answerVisible: boolean = false;
  private boundHandleKeydown = this.handleKeydown.bind(this);
  private boundHandleLinkClick = this.handleLinkClick.bind(this);
  private plugin: RandomReviewPlugin;

  private topBarEl!: HTMLElement;
  private noteContentEl!: HTMLElement;
  private navBarEl!: HTMLElement;
  private titleEl!: HTMLElement;
  private positionEl!: HTMLElement;
  private prevBtn!: HTMLButtonElement;
  private nextBtn!: HTMLButtonElement;
  private toggleAnswerBtn!: HTMLButtonElement;
  private exitBtn!: HTMLButtonElement;
  private editBtn!: HTMLButtonElement;
  private historyBtn!: HTMLButtonElement;
  private extractionHistoryBtn!: HTMLButtonElement;
  private exportBtn!: HTMLButtonElement;

  private answerDefaultCollapsed: boolean = true;
  private showNavBar: boolean = true;
  private language: Language = "zh";
  private extractionName: string = "";
  /** 当前复习会话对应的抽取历史 id（从历史加载时设置，用于去重检测） */
  historyId: string | null = null;
  private isEditing: boolean = false;
  private editingFile: TFile | null = null;

  // ── 测试模式 ──
  private quizStorage!: QuizStorage;
  private noteStartTime: number = 0;
  private currentSessionId: string = "";
  private timerInterval: number | null = null;
  private quizToolbarEl!: HTMLElement;
  private timerEl!: HTMLElement;
  private correctBtn!: HTMLButtonElement;
  private wrongBtn!: HTMLButtonElement;
  private skipBtn!: HTMLButtonElement;
  private scoreEl!: HTMLElement;

  constructor(leaf: WorkspaceLeaf, plugin: RandomReviewPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return VIEW_TYPE_RANDOM_REVIEW;
  }

  getDisplayText(): string {
    return this.extractionName || "Random Review";
  }

  /** 名称变化后让 Obsidian 重新读取 getDisplayText 刷新标签页标题 */
  private refreshTabTitle(): void {
    const leaf = this.leaf as unknown as { updateHeader?: () => void };
    if (leaf && typeof leaf.updateHeader === "function") {
      leaf.updateHeader();
    }
  }

  getIcon(): string {
    return "dice";
  }

  async onOpen(): Promise<void> {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass("random-review-container");

    // 顶部栏
    this.topBarEl = container.createDiv("random-review-topbar");
    this.titleEl = this.topBarEl.createSpan("random-review-title");

    const topRight = this.topBarEl.createDiv("random-review-topright");

    this.editBtn = topRight.createEl("button", {
      text: getLang(this.language).editNote,
      cls: "random-review-edit-btn",
    });
    this.editBtn.addEventListener("click", () => {
      void this.toggleEditLeaf();
    });

    this.historyBtn = topRight.createEl("button", {
      text: getLang(this.language).quizViewHistory,
      cls: "random-review-edit-btn",
    });
    this.historyBtn.addEventListener("click", () => {
      this.openHistoryView();
    });

    this.exportBtn = topRight.createEl("button", {
      text: getLang(this.language).exportNote,
      cls: "random-review-edit-btn",
    });
    this.exportBtn.addEventListener("click", () => {
      this.openExportModal();
    });

    this.extractionHistoryBtn = topRight.createEl("button", {
      text: getLang(this.language).btnExtractionHistory,
      cls: "random-review-edit-btn",
    });
    this.extractionHistoryBtn.addEventListener("click", () => {
      void this.openExtractionHistory();
    });

    this.exitBtn = topRight.createEl("button", {
      text: "✕",
      cls: "random-review-exit-btn",
    });
    this.exitBtn.addEventListener("click", () => this.closeView());

    // 内容区
    this.noteContentEl = container.createDiv("random-review-content");
    // 让内容区可接收焦点，使键盘事件能冒泡到容器上的 keydown 监听
    this.noteContentEl.setAttr("tabindex", "-1");
    // 自定义视图不会自动拦截内部链接点击，需自行委托处理
    this.noteContentEl.addEventListener("click", this.boundHandleLinkClick);

    // 底部导航栏
    this.navBarEl = container.createDiv("random-review-navbar");

    this.prevBtn = this.navBarEl.createEl("button", {
      text: "← 上一题",
      cls: "random-review-nav-btn",
    });
    this.prevBtn.addEventListener("click", () => {
      void this.navigate(-1);
    });

    this.positionEl = this.navBarEl.createSpan("random-review-position");

    this.nextBtn = this.navBarEl.createEl("button", {
      text: "下一题 →",
      cls: "random-review-nav-btn",
    });
    this.nextBtn.addEventListener("click", () => {
      void this.navigate(1);
    });

    this.toggleAnswerBtn = this.navBarEl.createEl("button", {
      text: "显示答案",
      cls: "random-review-toggle-btn",
    });
    this.toggleAnswerBtn.addEventListener("click", () => this.toggleAnswer());

    // 测试模式工具栏
    this.quizToolbarEl = this.navBarEl.createDiv("random-review-quiz-toolbar");
    this.timerEl = this.quizToolbarEl.createSpan("random-review-quiz-timer");
    this.correctBtn = this.quizToolbarEl.createEl("button", {
      cls: "random-review-quiz-btn quiz-correct",
    });
    this.correctBtn.addEventListener("click", () => { void this.markAnswer(true); });
    this.wrongBtn = this.quizToolbarEl.createEl("button", {
      cls: "random-review-quiz-btn quiz-wrong",
    });
    this.wrongBtn.addEventListener("click", () => { void this.markAnswer(false); });
    this.skipBtn = this.quizToolbarEl.createEl("button", {
      cls: "random-review-quiz-btn quiz-skip",
    });
    this.skipBtn.addEventListener("click", () => { void this.markAnswer(null); });
    this.scoreEl = this.quizToolbarEl.createSpan("random-review-quiz-score");
    this.updateQuizVisibility();

    // 键盘事件
    this.containerEl.addEventListener("keydown", this.boundHandleKeydown);

    // 监听布局变化，检测编辑分屏是否被手动关闭
    this.registerEvent(
      this.app.workspace.on("layout-change", () => {
        if (!this.isEditing || !this.editingFile) return;
        const stillOpen = this.app.workspace
          .getLeavesOfType("markdown")
          .some((l) => {
            const view = l.view;
            return view instanceof MarkdownView && view.file === this.editingFile;
          });
        if (!stillOpen) {
          this.isEditing = false;
          this.editingFile = null;
          this.editBtn.setText(getLang(this.language).editNote);
        }
      })
    );

    // 监听文件修改，编辑保存后自动刷新显示
    this.registerEvent(
      this.app.vault.on("modify", (file) => {
        if (!(file instanceof TFile)) return;
        const current = this.queue[this.currentIndex];
        if (current && file.path === current.path) {
          void this.renderNote(this.currentIndex);
        }
      })
    );
  }

  async onClose(): Promise<void> {
    this.containerEl.removeEventListener("keydown", this.boundHandleKeydown);
    this.noteContentEl.removeEventListener("click", this.boundHandleLinkClick);
    if (this.isEditing) this.closeEditPane();
    this.stopQuizTimer();
  }

  private async toggleEditLeaf(): Promise<void> {
    if (this.isEditing) {
      this.closeEditPane();
    } else {
      const file = this.queue[this.currentIndex];
      if (!file) return;

      const leaf = this.app.workspace.getLeaf("split");
      await leaf.openFile(file);
      this.editingFile = file;
      this.isEditing = true;
      this.editBtn.setText(getLang(this.language).closeNote);
    }
  }

  private closeEditPane(): void {
    const leaves = this.app.workspace.getLeavesOfType("markdown");
    for (const leaf of leaves) {
      const view = leaf.view;
      if (view instanceof MarkdownView && view.file === this.editingFile) {
        leaf.detach();
        break;
      }
    }
    this.isEditing = false;
    this.editingFile = null;
    this.editBtn.setText(getLang(this.language).editNote);
  }

  async startReview(
    queue: TFile[],
    answerDefaultCollapsed: boolean,
    showNavBar: boolean,
    language: Language,
    meta: { title: string; historyId: string | null }
  ): Promise<void> {
    this.queue = queue;
    this.currentIndex = 0;
    this.answerDefaultCollapsed = answerDefaultCollapsed;
    this.showNavBar = showNavBar;
    this.language = language;

    // 抽取历史的保存与命名由入口（main）负责，此处仅绑定标题与会话归属
    this.historyId = meta.historyId;
    this.extractionName = meta.title;
    this.refreshTabTitle();

    this.answerVisible = !answerDefaultCollapsed;
    this.updateUIText();

    // 测试模式初始化
    this.quizStorage = new QuizStorage(this.plugin);
    this.currentSessionId =
      Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    void this.quizStorage.saveSession(this.currentSessionId, queue.length);
    this.updateQuizVisibility();
    await this.updateQuizDisplay();

    if (showNavBar) {
      this.navBarEl.removeClass("random-review-hidden");
    } else {
      this.navBarEl.addClass("random-review-hidden");
    }

    if (queue.length === 0) {
      this.renderEmptyState();
      return;
    }

    await this.renderNote(0);
  }

  private renderEmptyState(): void {
    const t = getLang(this.language);
    this.topBarEl.addClass("random-review-hidden");
    this.noteContentEl.empty();
    this.noteContentEl.createDiv("random-review-empty");
    const emptyDiv = this.noteContentEl.querySelector(".random-review-empty");
    if (emptyDiv) {
      emptyDiv.createEl("p", { text: t.emptyTitle });
      emptyDiv.createEl("p", { text: t.emptyDesc });
    }
    this.prevBtn.disabled = true;
    this.nextBtn.disabled = true;
    this.toggleAnswerBtn.addClass("random-review-hidden");

    // 空状态下也要可响应 Esc 关闭
    this.noteContentEl.focus();
  }

  refreshUIText(): void {
    this.updateUIText();
  }

  private updateUIText(): void {
    const t = getLang(this.language);
    this.editBtn.setText(this.isEditing ? t.closeNote : t.editNote);
    this.historyBtn.setText(t.quizViewHistory);
    this.exportBtn.setText(t.exportNote);
    this.extractionHistoryBtn.setText(t.btnExtractionHistory);
    this.prevBtn.setText(t.previous);
    this.nextBtn.setText(t.next);
    this.toggleAnswerBtn.setText(t.showAnswer);
    this.correctBtn.setText(t.quizCorrectShortcut);
    this.wrongBtn.setText(t.quizIncorrectShortcut);
    this.skipBtn.setText(t.quizSkipShortcut);
  }

  private async renderNote(index: number): Promise<void> {
    if (index < 0 || index >= this.queue.length) return;

    this.currentIndex = index;
    const file = this.queue[index];

    const exists = await this.app.vault.adapter.exists(file.path);
    if (!exists) {
      new Notice(getLang(this.language).deletedSkip(file.basename));
      this.queue.splice(index, 1);
      if (this.queue.length === 0) {
        this.renderEmptyState();
        return;
      }
      const newIndex = Math.min(index, this.queue.length - 1);
      await this.renderNote(newIndex);
      return;
    }

    this.stopQuizTimer();

    try {
      const content = await this.app.vault.read(file);
      this.titleEl.setText(file.basename);
      this.topBarEl.removeClass("random-review-hidden");

      this.noteContentEl.empty();
      const markdownContainer = this.noteContentEl.createDiv("markdown-preview-view");
      await MarkdownRenderer.render(
        this.app,
        content,
        markdownContainer,
        file.path,
        this
      );

      this.applyAnswerState();

      // 测试模式：新题计时开始
      if (this.plugin.settings.quizEnabled) {
        this.noteStartTime = Date.now();
        this.startQuizTimer();
        await this.updateQuizDisplay();
      }

      // 如果编辑面板已打开，同步切换到新笔记
      if (this.isEditing) {
        const leaves = this.app.workspace.getLeavesOfType("markdown");
        for (const leaf of leaves) {
          const view = leaf.view;
          if (view instanceof MarkdownView && view.file === this.editingFile) {
            await leaf.openFile(file, { active: false });
            this.editingFile = file;
            break;
          }
        }
      }

      this.updateUIState();

      // 渲染完成后把焦点放回内容区（编辑分屏打开时不抢焦点），
      // 保证键盘快捷键持续生效
      if (!this.isEditing) {
        this.noteContentEl.focus();
      }
    } catch (err) {
      this.noteContentEl.empty();
      this.noteContentEl.createDiv("random-review-error");
      const errDiv = this.noteContentEl.querySelector(".random-review-error");
      if (errDiv) {
        errDiv.createEl("p", { text: getLang(this.language).readFailed(file.basename) });
        errDiv.createEl("p", { text: String(err) });
      }
      this.updateUIState();
    }
  }

  private applyAnswerState(): void {
    // 直接操控 .callout-content 的 display，绕过 CSS class 依赖。
    // CSS class 方案曾被 a176445 引入，但因 display:unset 与 Obsidian 内置
    // .callout.is-collapsed 规则冲突而失效（cf67613 已验证此方案可靠）。
    const contents = this.noteContentEl.querySelectorAll(".callout-content");
    contents.forEach((el) => {
      if (el.instanceOf(HTMLElement)) {
        el.style.display = this.answerVisible ? "" : "none";
      }
    });

    // 同步更新 callout 的 is-collapsed class，保持折叠箭头图标一致
    const callouts = this.noteContentEl.querySelectorAll(".callout");
    callouts.forEach((el) => {
      if (this.answerVisible) {
        el.classList.remove("is-collapsed");
      } else {
        el.classList.add("is-collapsed");
      }
    });
  }

  private updateUIState(): void {
    this.prevBtn.disabled = this.currentIndex <= 0;
    this.nextBtn.disabled = this.currentIndex >= this.queue.length - 1;
    this.positionEl.setText(
      `${this.currentIndex + 1} / ${this.queue.length}`
    );
    this.toggleAnswerBtn.setText(
      this.answerVisible
        ? getLang(this.language).hideAnswer
        : getLang(this.language).showAnswer
    );

    const singleNote = this.queue.length <= 1;
    if (singleNote || !this.showNavBar) {
      this.navBarEl.addClass("random-review-hidden");
    } else {
      this.navBarEl.removeClass("random-review-hidden");
    }
  }

  private async navigate(delta: number): Promise<void> {
    const newIndex = this.currentIndex + delta;

    if (newIndex < 0) return;

    if (newIndex >= this.queue.length) {
      new Notice(getLang(this.language).completed);
      return;
    }

    // 测试模式：离开时如果计时器还在跑且模式为 navigate，先记录跳过
    if (
      this.plugin.settings.quizEnabled &&
      this.plugin.settings.quizTimerStopMode === "navigate" &&
      this.noteStartTime > 0
    ) {
      const file = this.queue[this.currentIndex];
      if (file) {
        const durationMs = Date.now() - this.noteStartTime;
        await this.quizStorage.append({
          filePath: file.path,
          sessionId: this.currentSessionId,
          timestamp: new Date().toISOString(),
          durationMs,
          correct: null,
          stoppedBy: "navigate",
          historyId: this.historyId,
        });
        await this.updateQuizDisplay();
        this.plugin.refreshQuizHistoryViews();
      }
    }

    this.stopQuizTimer();
    await this.renderNote(newIndex);
  }

  private toggleAnswer(): void {
    const wasHidden = !this.answerVisible;
    this.answerVisible = !this.answerVisible;
    this.applyAnswerState();
    this.updateUIState();

    // 测试模式：答案显示时停止计时
    if (
      wasHidden &&
      this.answerVisible &&
      this.plugin.settings.quizEnabled &&
      this.plugin.settings.quizTimerStopMode === "answer"
    ) {
      this.stopQuizTimer();
    }
  }

  private handleLinkClick(event: MouseEvent): void {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement | null;
    const link = target?.closest("a.internal-link") as HTMLAnchorElement | null;
    if (!link) return;

    const href = link.getAttribute("data-href") ?? link.getAttribute("href");
    const file = this.queue[this.currentIndex];
    if (!href || !file) return;

    event.preventDefault();
    event.stopPropagation();
    void this.app.workspace.openLinkText(href, file.path, "split");
  }

  private handleKeydown(event: KeyboardEvent): void {
    const target = event.target as HTMLElement;
    if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;

    switch (event.key) {
      case "ArrowRight":
      case " ":
        event.preventDefault();
        void this.navigate(1);
        break;
      case "ArrowLeft":
        event.preventDefault();
        void this.navigate(-1);
        break;
      case "a":
      case "A":
        event.preventDefault();
        this.toggleAnswer();
        break;
      case "j":
      case "J":
        if (this.plugin.settings.quizEnabled) {
          event.preventDefault();
          void this.markAnswer(true);
        }
        break;
      case "k":
      case "K":
        if (this.plugin.settings.quizEnabled) {
          event.preventDefault();
          void this.markAnswer(false);
        }
        break;
      case "Escape":
        event.preventDefault();
        this.closeView();
        break;
    }
  }

  private closeView(): void {
    this.leaf.detach();
  }

  // ── 测试模式 ──

  private startQuizTimer(): void {
    this.stopQuizTimer();
    if (!this.plugin.settings.quizEnabled) return;
    this.timerInterval = window.setInterval(() => {
      const elapsed = Date.now() - this.noteStartTime;
      const mins = Math.floor(elapsed / 60000);
      const secs = Math.floor((elapsed % 60000) / 1000);
      if (this.timerEl) {
        this.timerEl.setText(
          `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
        );
      }
    }, 1000);
  }

  private stopQuizTimer(): void {
    if (this.timerInterval !== null) {
      window.clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  private updateQuizVisibility(): void {
    const enabled = this.plugin.settings.quizEnabled;
    if (enabled) {
      this.quizToolbarEl.removeClass("random-review-hidden");
    } else {
      this.quizToolbarEl.addClass("random-review-hidden");
    }
  }

  private async updateQuizDisplay(): Promise<void> {
    if (!this.plugin.settings.quizEnabled) return;
    const stats = await this.quizStorage.getStats({
      sessionId: this.currentSessionId,
    });
    this.scoreEl.setText(
      getLang(this.language).quizScore(stats.correct, stats.incorrect, stats.skipped)
    );
  }

  async markAnswer(correct: boolean | null): Promise<void> {
    if (!this.plugin.settings.quizEnabled) return;
    const file = this.queue[this.currentIndex];
    if (!file) return;
    const durationMs = Date.now() - this.noteStartTime;
    const stoppedBy: "answer" | "mark" | "navigate" = correct !== null ? "mark" : "navigate";
    const record = {
      filePath: file.path,
      sessionId: this.currentSessionId,
      timestamp: new Date().toISOString(),
      durationMs,
      correct,
      stoppedBy,
      historyId: this.historyId,
    };
    await this.quizStorage.append(record);
    await this.updateQuizDisplay();
    // 记录已变，通知答题历史视图刷新
    this.plugin.refreshQuizHistoryViews();
    // 标记后自动下一题
    void this.navigate(1);
  }

  private openHistoryView(): void {
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
    const view = leaf.view;
    if (view instanceof QuizHistoryView) {
      view.setData(this.queue, this.currentIndex);
    }
  }

  private async openExtractionHistory(): Promise<void> {
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
    if (view && "refresh" in view && typeof (view as unknown as { refresh: () => Promise<void> }).refresh === "function") {
      await (view as unknown as { refresh: () => Promise<void> }).refresh();
    }
  }

  private openExportModal(): void {
    new ExportModal(
      this.app,
      this.plugin,
      this.queue,
      this.currentIndex
    ).open();
  }
}
