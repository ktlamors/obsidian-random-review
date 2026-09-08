import { ItemView, WorkspaceLeaf, Notice, TFile } from "obsidian";
import type RandomReviewPlugin from "./main";
import { getLang } from "./i18n";
import { QuizStorage } from "./quiz-storage";
import { HistoryStorage, HistoryEntry } from "./history-storage";
import type { AnswerRecord } from "./constants";

export const VIEW_TYPE_QUIZ_HISTORY = "quiz-history-view";

/** 取每个文件在该组记录中最新的一条 */
function latestByFile(records: AnswerRecord[]): Map<string, AnswerRecord> {
  const map = new Map<string, AnswerRecord>();
  records.forEach((r) => {
    const cur = map.get(r.filePath);
    if (!cur || r.timestamp >= cur.timestamp) map.set(r.filePath, r);
  });
  return map;
}

export class QuizHistoryView extends ItemView {
  private plugin: RandomReviewPlugin;
  private wrongOnly: boolean = false;

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
    void this.render();
  }

  async onClose(): Promise<void> {}

  setData(_queue: TFile[], _currentIndex: number): void {
    void this.render();
  }

  async refresh(): Promise<void> {
    await this.render();
  }

  private async render(): Promise<void> {
    if (!this.contentEl) return;
    this.contentEl.empty();

    const t = getLang(this.plugin.settings.language);

    // ── 工具栏 ──
    const toolbar = this.contentEl.createDiv("quiz-history-toolbar");

    const wrongLabel = toolbar.createEl("label", {
      cls: "quiz-history-wrong-toggle",
    });
    const wrongBox = wrongLabel.createEl("input", { type: "checkbox" });
    wrongBox.checked = this.wrongOnly;
    wrongBox.addEventListener("change", () => {
      this.wrongOnly = wrongBox.checked;
      void this.render();
    });
    wrongLabel.createSpan().setText(t.showWrongOnly);

    const quizStorage = new QuizStorage(this.plugin);
    const historyStorage = new HistoryStorage(this.plugin);
    const records = await quizStorage.load();
    const histories = await historyStorage.load();

    // 全量错题：全局每个文件最新作答为错误
    const globalWrong = wrongPaths(records);

    const allWrongBtn = toolbar.createEl("button", {
      text: t.reviewAllWrong,
      cls: "quiz-history-review-btn quiz-history-allwrong",
    });
    allWrongBtn.setAttr("aria-label", t.reviewAllWrong);
    allWrongBtn.disabled = globalWrong.length === 0;
    allWrongBtn.addEventListener("click", () => {
      const date = new Date().toISOString().slice(5, 10);
      void this.plugin.startWrongReview(
        globalWrong,
        `${t.reviewAllWrong} ${date}`,
        null
      );
    });

    if (records.length === 0) {
      this.contentEl.createEl("p", {
        text: t.quizStatsNoHistory,
        cls: "quiz-history-empty",
      });
      return;
    }

    // 数据组装：答题记录按 historyId 归属
    const byId = new Map(histories.map((h) => [h.id, h]));
    const grouped = new Map<string | null, AnswerRecord[]>();
    records.forEach((r) => {
      const key = r.historyId && byId.has(r.historyId) ? r.historyId : null;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(r);
    });

    let hasAny = false;

    // 有答题记录的抽取历史（按 load 顺序，最新的在前）
    for (const h of histories) {
      const groupRecords = grouped.get(h.id);
      if (!groupRecords || groupRecords.length === 0) continue;
      hasAny = true;
      this.renderHistoryGroup(h, groupRecords, globalWrong, t);
    }

    // 未归属任何抽取历史（错题复习直接会话 / 旧数据）
    const orphan = grouped.get(null);
    if (orphan && orphan.length > 0) {
      hasAny = true;
      this.renderOrphanGroup(orphan, globalWrong, t);
    }

    if (!hasAny) {
      this.contentEl.createEl("p", {
        text: t.quizStatsNoHistory,
        cls: "quiz-history-empty",
      });
    }
  }

  private renderHistoryGroup(
    history: HistoryEntry,
    groupRecords: AnswerRecord[],
    globalWrong: string[],
    t: ReturnType<typeof getLang>
  ): void {
    const wrongSet = new Set(globalWrong);
    // 该历史中出现在全量错题集里的文件
    const histWrong = new Set(
      groupRecords
        .map((r) => r.filePath)
        .filter((p) => wrongSet.has(p))
    );

    if (this.wrongOnly && histWrong.size === 0) return;

    const latest = latestByFile(groupRecords);
    const stats = this.statsOf(Array.from(latest.values()));

    const header = this.contentEl.createDiv("quiz-history-group-header");
    header.createSpan("quiz-history-group-time").setText(history.name);
    header.createSpan("quiz-history-group-count").setText(
      `${latest.size} ${t.quizStatsTotal}`
    );

    const meta = header.createDiv("quiz-history-group-meta");
    meta.createSpan().setText(t.quizScore(stats.correct, stats.incorrect, stats.skipped));

    const wrongBtn = header.createEl("button", {
      text: t.reviewWrong,
      cls: "quiz-history-review-btn quiz-history-wrongbtn",
    });
    wrongBtn.disabled = histWrong.size === 0;
    wrongBtn.addEventListener("click", () => {
      void this.plugin.startWrongReview(
        Array.from(histWrong),
        `${history.name} · ${t.reviewWrong}`,
        history.id
      );
    });

    const list = this.contentEl.createDiv("quiz-history-list");
    groupRecords.forEach((r) => {
      const isLatest = latest.get(r.filePath) === r;
      const isWrong = wrongSet.has(r.filePath);
      if (this.wrongOnly && !isWrong) return;
      this.renderRow(list, r, isLatest, t);
    });
  }

  private renderOrphanGroup(
    orphan: AnswerRecord[],
    globalWrong: string[],
    t: ReturnType<typeof getLang>
  ): void {
    const header = this.contentEl.createDiv("quiz-history-group-header");
    header.createSpan("quiz-history-group-time").setText(t.orphanHistoryLabel);

    const latest = latestByFile(orphan);
    const stats = this.statsOf(Array.from(latest.values()));
    header.createSpan("quiz-history-group-count").setText(
      `${latest.size} ${t.quizStatsTotal}`
    );

    const wrongSet = new Set(globalWrong);
    const list = this.contentEl.createDiv("quiz-history-list");
    latest.forEach((r) => {
      const isWrong = wrongSet.has(r.filePath);
      if (this.wrongOnly && !isWrong) return;
      this.renderRow(list, r, true, t);
    });
    void stats;
  }

  private renderRow(
    list: HTMLElement,
    r: AnswerRecord,
    isLatest: boolean,
    t: ReturnType<typeof getLang>
  ): void {
    const item = list.createDiv("quiz-history-item");
    const mark = r.correct === true ? "✓" : r.correct === false ? "✗" : "⊘";
    const markEl = item.createSpan("quiz-history-mark");
    markEl.setText(mark);
    if (r.correct === true) markEl.setAttr("data-correct", "true");
    else if (r.correct === false) markEl.setAttr("data-correct", "false");

    item.createSpan("quiz-history-file").setText(
      r.filePath.split("/").pop() || r.filePath
    );
    item.createSpan("quiz-history-time").setText(
      r.durationMs > 0 ? `${Math.round(r.durationMs / 1000)}s` : "—"
    );
    item.createSpan("quiz-history-ts").setText(
      new Date(r.timestamp).toLocaleTimeString()
    );

    if (!isLatest) {
      item.addClass("quiz-history-stale");
    } else {
      const reviewBtn = item.createEl("button", {
        text: t.quizReview,
        cls: "quiz-history-review-btn",
      });
      reviewBtn.addEventListener("click", () => {
        const file = this.app.vault.getAbstractFileByPath(r.filePath);
        if (!(file instanceof TFile)) {
          new Notice(getLang(this.plugin.settings.language).historyNotesMissing);
          return;
        }
        void this.app.workspace.openLinkText(r.filePath, "", "split");
      });
    }
  }

  private statsOf(records: AnswerRecord[]): {
    correct: number;
    incorrect: number;
    skipped: number;
  } {
    let correct = 0;
    let incorrect = 0;
    let skipped = 0;
    records.forEach((r) => {
      if (r.correct === true) correct++;
      else if (r.correct === false) incorrect++;
      else skipped++;
    });
    return { correct, incorrect, skipped };
  }
}

/** 全局错题集合：每个文件最新作答为 false 的文件路径 */
export function wrongPaths(records: AnswerRecord[]): string[] {
  const latest = latestByFile(records);
  const out: string[] = [];
  latest.forEach((r, path) => {
    if (r.correct === false) out.push(path);
  });
  return out;
}
