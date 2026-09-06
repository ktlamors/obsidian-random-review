import { ItemView, WorkspaceLeaf, TFile } from "obsidian";
import type RandomReviewPlugin from "./main";
import { getLang } from "./i18n";

interface SessionGroup {
  sessionId: string;
  startedAt: string;
  records: { filePath: string; correct: boolean | null; durationMs: number; timestamp: string }[];
}

export const VIEW_TYPE_QUIZ_HISTORY = "quiz-history-view";

export class QuizHistoryView extends ItemView {
  private plugin: RandomReviewPlugin;
  private queue: TFile[] = [];
  private currentIndex: number = 0;

  constructor(leaf: WorkspaceLeaf, plugin: RandomReviewPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return VIEW_TYPE_QUIZ_HISTORY;
  }

  getDisplayText(): string {
    return getLang(this.plugin.settings.language).quizStatsTitle;
  }

  getIcon(): string {
    return "clock";
  }

  async onOpen(): Promise<void> {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass("random-review-quiz-history-panel");
    this.contentEl = container.createDiv("quiz-history-content");
  }

  async onClose(): Promise<void> {}

  setData(queue: TFile[], currentIndex: number): void {
    this.queue = queue;
    this.currentIndex = currentIndex;
    this.render();
  }

  private render(): void {
    if (!this.contentEl) return;
    this.contentEl.empty();

    const t = getLang(this.plugin.settings.language);
    const records = this.plugin.settings.answerHistory ?? [];

    if (records.length === 0) {
      this.contentEl.createEl("p", {
        text: t.quizStatsNoHistory,
        cls: "quiz-history-empty",
      });
      return;
    }

    const groups = this.groupBySession(records);
    groups.forEach((g) => {
      const header = this.contentEl.createDiv("quiz-history-group-header");
      header.createSpan("quiz-history-group-time").setText(
        new Date(g.startedAt).toLocaleString()
      );
      header.createSpan("quiz-history-group-count").setText(
        `${g.records.length} ${t.quizStatsTotal}`
      );

      const list = this.contentEl.createDiv("quiz-history-list");
      g.records.forEach((r) => {
        const item = list.createDiv("quiz-history-item");
        const time = r.durationMs > 0 ? `${Math.round(r.durationMs / 1000)}s` : "—";
        const mark = r.correct === true ? "✓" : r.correct === false ? "✗" : "⊘";
        const markEl = item.createSpan("quiz-history-mark");
        markEl.setText(mark);
        if (r.correct === true) markEl.setAttr("data-correct", "true");
        else if (r.correct === false) markEl.setAttr("data-correct", "false");

        item.createSpan("quiz-history-file").setText(
          r.filePath.split("/").pop() || r.filePath
        );
        item.createSpan("quiz-history-time").setText(time);
        item.createSpan("quiz-history-ts").setText(
          new Date(r.timestamp).toLocaleTimeString()
        );

        const reviewBtn = item.createEl("button", {
          text: t.quizReview,
          cls: "quiz-history-review-btn",
        });
        reviewBtn.addEventListener("click", () => {
          const file = this.queue.find(f => f.path === r.filePath);
          if (file) {
            void this.app.workspace.openLinkText(r.filePath, this.queue[this.currentIndex]?.path ?? "", "split");
          }
        });
      });
    });
  }

  private groupBySession(records: { sessionId: string; timestamp: string; filePath: string; correct: boolean | null; durationMs: number }[]): SessionGroup[] {
    const map = new Map<string, SessionGroup>();
    records.forEach((r) => {
      if (!map.has(r.sessionId)) {
        map.set(r.sessionId, {
          sessionId: r.sessionId,
          startedAt: r.timestamp,
          records: [],
        });
      }
      map.get(r.sessionId)!.records.push(r);
    });
    return Array.from(map.values()).sort((a, b) =>
      b.startedAt.localeCompare(a.startedAt)
    );
  }
}
