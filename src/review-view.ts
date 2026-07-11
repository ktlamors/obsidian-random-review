import { ItemView, WorkspaceLeaf, TFile, MarkdownRenderer, Notice } from "obsidian";
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
  private editLeaf: WorkspaceLeaf | null = null;

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

    const topRight = this.topBarEl.createDiv();
    topRight.style.display = "flex";
    topRight.style.alignItems = "center";
    topRight.style.gap = "8px";

    this.editBtn = topRight.createEl("button", {
      text: "编辑原笔记",
      cls: "random-review-edit-btn",
    });
    this.editBtn.addEventListener("click", () => this.toggleEditLeaf());

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
    this.prevBtn.addEventListener("click", () => this.navigate(-1));

    this.positionEl = this.navBarEl.createSpan("random-review-position");

    this.nextBtn = this.navBarEl.createEl("button", {
      text: "下一题 →",
      cls: "random-review-nav-btn",
    });
    this.nextBtn.addEventListener("click", () => this.navigate(1));

    this.toggleAnswerBtn = this.navBarEl.createEl("button", {
      text: "显示答案",
      cls: "random-review-toggle-btn",
    });
    this.toggleAnswerBtn.addEventListener("click", () => this.toggleAnswer());

    // 键盘事件
    this.containerEl.addEventListener("keydown", this.boundHandleKeydown);
  }

  async onClose(): Promise<void> {
    this.containerEl.removeEventListener("keydown", this.boundHandleKeydown);
    // 关闭编辑侧边栏
    if (this.editLeaf) {
      this.editLeaf.detach();
      this.editLeaf = null;
    }
  }

  /**
   * 切换右侧编辑侧边栏
   */
  private async toggleEditLeaf(): Promise<void> {
    if (this.editLeaf) {
      // 关闭侧边栏
      this.editLeaf.detach();
      this.editLeaf = null;
      this.editBtn.setText("编辑原笔记");
    } else {
      // 打开侧边栏编辑当前笔记
      const file = this.queue[this.currentIndex];
      if (!file) return;

      const leaf = this.app.workspace.getRightLeaf(false);
      if (!leaf) return;
      this.editLeaf = leaf;
      await this.editLeaf.openFile(file, { active: true });
      this.editBtn.setText("关闭原笔记");
    }
  }

  /**
   * 由外部调用，设置笔记队列并开始复习
   */
  async startReview(
    queue: TFile[],
    answerDefaultCollapsed: boolean,
    showNavBar: boolean
  ): Promise<void> {
    this.queue = queue;
    this.currentIndex = 0;
    this.answerDefaultCollapsed = answerDefaultCollapsed;
    this.showNavBar = showNavBar;

    // 设置答案初始状态
    this.answerVisible = !answerDefaultCollapsed;

    // 更新导航栏显示
    this.navBarEl.style.display = showNavBar ? "flex" : "none";

    if (queue.length === 0) {
      this.renderEmptyState();
      return;
    }

    await this.renderNote(0);
  }

  /**
   * 渲染空状态
   */
  private renderEmptyState(): void {
    this.topBarEl.style.display = "none";
    this.noteContentEl.empty();
    this.noteContentEl.createDiv("random-review-empty");
    const emptyDiv = this.noteContentEl.querySelector(".random-review-empty");
    if (emptyDiv) {
      emptyDiv.createEl("p", { text: "没有符合条件的笔记 😕" });
      emptyDiv.createEl("p", { text: "请在设置中调整筛选条件后重新启动" });
    }
    this.prevBtn.disabled = true;
    this.nextBtn.disabled = true;
    this.toggleAnswerBtn.style.display = "none";
  }

  /**
   * 渲染指定位置的笔记
   */
  private async renderNote(index: number): Promise<void> {
    if (index < 0 || index >= this.queue.length) return;

    this.currentIndex = index;
    const file = this.queue[index];

    // 检查文件是否仍然存在
    const exists = await this.app.vault.adapter.exists(file.path);
    if (!exists) {
      new Notice(`笔记 "${file.basename}" 已被删除，自动跳过`);
      this.queue.splice(index, 1);
      if (this.queue.length === 0) {
        this.renderEmptyState();
        return;
      }
      // 跳到下一篇（或上一篇如果在末尾）
      const newIndex = Math.min(index, this.queue.length - 1);
      await this.renderNote(newIndex);
      return;
    }

    // 读取并渲染笔记内容
    try {
      const content = await this.app.vault.read(file);
      this.titleEl.setText(file.basename);
      this.topBarEl.style.display = "flex";

      // 清空并渲染 Markdown
      this.noteContentEl.empty();
      const markdownContainer = this.noteContentEl.createDiv("markdown-preview-view");
      await MarkdownRenderer.render(
        this.app,
        content,
        markdownContainer,
        file.path,
        this
      );

      // 应用答案可见性状态
      this.applyAnswerState();

      // 如果编辑侧边栏已打开，同步切换到新笔记
      if (this.editLeaf) {
        await this.editLeaf.openFile(file, { active: false });
      }

      // 更新位置指示器和按钮状态
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

  /**
   * 应用答案折叠/展开状态到 DOM
   */
  private applyAnswerState(): void {
    // 直接操控 .callout-content 元素的显示状态（绕过 CSS class 依赖）
    const contents = this.noteContentEl.querySelectorAll(".callout-content");
    contents.forEach((el) => {
      if (el instanceof HTMLElement) {
        el.style.display = this.answerVisible ? "" : "none";
      }
    });

    // 同步更新 callout 的 is-collapsed class（保持折叠箭头图标一致）
    const callouts = this.noteContentEl.querySelectorAll(".callout");
    callouts.forEach((el) => {
      if (el instanceof HTMLElement) {
        if (this.answerVisible) {
          el.classList.remove("is-collapsed");
        } else {
          el.classList.add("is-collapsed");
        }
      }
    });
  }

  /**
   * 更新导航栏按钮状态
   */
  private updateUIState(): void {
    this.prevBtn.disabled = this.currentIndex <= 0;
    this.nextBtn.disabled = this.currentIndex >= this.queue.length - 1;
    this.positionEl.setText(
      `${this.currentIndex + 1} / ${this.queue.length}`
    );
    this.toggleAnswerBtn.setText(
      this.answerVisible ? "隐藏答案" : "显示答案"
    );

    // 只有一篇笔记时隐藏导航按钮
    const singleNote = this.queue.length <= 1;
    this.navBarEl.style.display = singleNote ? "none" : (this.showNavBar ? "flex" : "none");
  }

  /**
   * 上一题 / 下一题
   */
  private async navigate(delta: number): Promise<void> {
    const newIndex = this.currentIndex + delta;

    if (newIndex < 0) {
      return; // 已在第一篇，不能往前
    }

    if (newIndex >= this.queue.length) {
      // 已到最后一篇，询问是否重新抽取
      new Notice("已完成本轮复习！可在设置中调整后重新启动");
      return;
    }

    await this.renderNote(newIndex);
  }

  /**
   * 切换显示/隐藏答案
   */
  private toggleAnswer(): void {
    this.answerVisible = !this.answerVisible;
    this.applyAnswerState();
    this.updateUIState();
  }

  /**
   * 键盘快捷键处理
   */
  private handleKeydown(event: KeyboardEvent): void {
    // 如果焦点在输入框中，不处理
    const target = event.target as HTMLElement;
    if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;

    switch (event.key) {
      case "ArrowRight":
      case " ":
        event.preventDefault();
        this.navigate(1);
        break;
      case "ArrowLeft":
        event.preventDefault();
        this.navigate(-1);
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

  /**
   * 关闭视图
   */
  private closeView(): void {
    this.leaf.detach();
  }
}
