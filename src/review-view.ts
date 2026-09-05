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
  private exportBtn!: HTMLButtonElement;

  private answerDefaultCollapsed: boolean = true;
  private showNavBar: boolean = true;
  private language: Language = "zh";
  private isEditing: boolean = false;
  private editingFile: TFile | null = null;

  constructor(leaf: WorkspaceLeaf, plugin: RandomReviewPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return VIEW_TYPE_RANDOM_REVIEW;
  }

  getDisplayText(): string {
    return "Random Review";
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
      text: "编辑原笔记",
      cls: "random-review-edit-btn",
    });
    this.editBtn.addEventListener("click", () => {
      void this.toggleEditLeaf();
    });

    this.exportBtn = topRight.createEl("button", {
      text: "导出",
      cls: "random-review-edit-btn",
    });
    this.exportBtn.addEventListener("click", () => {
      this.openExportModal();
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
    language: Language
  ): Promise<void> {
    this.queue = queue;
    this.currentIndex = 0;
    this.answerDefaultCollapsed = answerDefaultCollapsed;
    this.showNavBar = showNavBar;
    this.language = language;

    this.answerVisible = !answerDefaultCollapsed;
    this.updateUIText();

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

  private updateUIText(): void {
    const t = getLang(this.language);
    this.editBtn.setText(this.isEditing ? t.closeNote : t.editNote);
    this.exportBtn.setText(t.exportNote);
    this.prevBtn.setText(t.previous);
    this.nextBtn.setText(t.next);
    this.toggleAnswerBtn.setText(t.showAnswer);
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

    await this.renderNote(newIndex);
  }

  private toggleAnswer(): void {
    this.answerVisible = !this.answerVisible;
    this.applyAnswerState();
    this.updateUIState();
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
      case "Escape":
        event.preventDefault();
        this.closeView();
        break;
    }
  }

  private closeView(): void {
    this.leaf.detach();
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
