import {
  ItemView,
  WorkspaceLeaf,
  TFile,
  MarkdownRenderer,
  Notice,
  MarkdownView,
} from "obsidian";
import { VIEW_TYPE_RANDOM_REVIEW } from "./constants";

export class ReviewView extends ItemView {
  private queue: TFile[] = [];
  private currentIndex: number = 0;
  private answerVisible: boolean = false;
  private boundHandleKeydown = this.handleKeydown.bind(this);

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

  private answerDefaultCollapsed: boolean = true;
  private showNavBar: boolean = true;
  private isEditing: boolean = false;
  private editingFile: TFile | null = null;

  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
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

    this.exitBtn = topRight.createEl("button", {
      text: "✕",
      cls: "random-review-exit-btn",
    });
    this.exitBtn.addEventListener("click", () => this.closeView());

    // 内容区
    this.noteContentEl = container.createDiv("random-review-content");

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
          this.editBtn.setText("编辑原笔记");
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
      this.editBtn.setText("关闭原笔记");
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
    this.editBtn.setText("编辑原笔记");
  }

  async startReview(
    queue: TFile[],
    answerDefaultCollapsed: boolean,
    showNavBar: boolean
  ): Promise<void> {
    this.queue = queue;
    this.currentIndex = 0;
    this.answerDefaultCollapsed = answerDefaultCollapsed;
    this.showNavBar = showNavBar;

    this.answerVisible = !answerDefaultCollapsed;

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
    this.topBarEl.addClass("random-review-hidden");
    this.noteContentEl.empty();
    this.noteContentEl.createDiv("random-review-empty");
    const emptyDiv = this.noteContentEl.querySelector(".random-review-empty");
    if (emptyDiv) {
      emptyDiv.createEl("p", { text: "没有符合条件的笔记 😕" });
      emptyDiv.createEl("p", { text: "请在设置中调整筛选条件后重新启动" });
    }
    this.prevBtn.disabled = true;
    this.nextBtn.disabled = true;
    this.toggleAnswerBtn.addClass("random-review-hidden");
  }

  private async renderNote(index: number): Promise<void> {
    if (index < 0 || index >= this.queue.length) return;

    this.currentIndex = index;
    const file = this.queue[index];

    const exists = await this.app.vault.adapter.exists(file.path);
    if (!exists) {
      new Notice(`笔记 "${file.basename}" 已被删除，自动跳过`);
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
    } catch (err) {
      this.noteContentEl.empty();
      this.noteContentEl.createDiv("random-review-error");
      const errDiv = this.noteContentEl.querySelector(".random-review-error");
      if (errDiv) {
        errDiv.createEl("p", { text: `无法读取笔记: ${file.basename}` });
        errDiv.createEl("p", { text: String(err) });
      }
      this.updateUIState();
    }
  }

  private applyAnswerState(): void {
    // 用 CSS class 控制答案显示，避免 inline style
    if (this.answerVisible) {
      this.noteContentEl.removeClass("random-review-hide-answers");
      this.noteContentEl.addClass("random-review-show-answers");
    } else {
      this.noteContentEl.removeClass("random-review-show-answers");
      this.noteContentEl.addClass("random-review-hide-answers");
    }

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
      this.answerVisible ? "隐藏答案" : "显示答案"
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
      new Notice("已完成本轮复习！可在设置中调整后重新启动");
      return;
    }

    await this.renderNote(newIndex);
  }

  private toggleAnswer(): void {
    this.answerVisible = !this.answerVisible;
    this.applyAnswerState();
    this.updateUIState();
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
}
