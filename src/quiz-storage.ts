import type RandomReviewPlugin from "./main";
import type { AnswerRecord, QuizTimerStopMode } from "./constants";

const STORAGE_KEY = "quizData";

interface QuizStorageData {
  results: AnswerRecord[];
  lastSessionAt: string;
  /** 最近的 session 列表，用于 resume */
  sessions: { sessionId: string; startedAt: string; noteCount: number }[];
}

export class QuizStorage {
  private plugin: RandomReviewPlugin;

  constructor(plugin: RandomReviewPlugin) {
    this.plugin = plugin;
  }

  async load(): Promise<AnswerRecord[]> {
    const raw = (await this.plugin.loadData()) as Record<string, unknown> | null;
    if (!raw || !raw[STORAGE_KEY]) return [];
    const data = raw[STORAGE_KEY] as QuizStorageData;
    return data.results ?? [];
  }

  async loadSessions(): Promise<QuizStorageData["sessions"]> {
    const raw = (await this.plugin.loadData()) as Record<string, unknown> | null;
    if (!raw || !raw[STORAGE_KEY]) return [];
    const data = raw[STORAGE_KEY] as QuizStorageData;
    return data.sessions ?? [];
  }

  async saveSession(sessionId: string, noteCount: number): Promise<void> {
    const results = await this.load();
    const raw = (await this.plugin.loadData()) as Record<string, unknown> | null;
    const data: Record<string, unknown> = raw ?? {};
    const stored = (data[STORAGE_KEY] as QuizStorageData | undefined) ?? {
      results: [],
      lastSessionAt: new Date().toISOString(),
      sessions: [],
    };
    stored.lastSessionAt = new Date().toISOString();
    stored.sessions = [
      { sessionId, startedAt: new Date().toISOString(), noteCount },
      ...stored.sessions.filter((s) => s.sessionId !== sessionId),
    ].slice(0, 50); // 最多保留 50 个 session 元数据
    stored.results = results;
    data[STORAGE_KEY] = stored;
    await this.plugin.saveData(data);
  }

  async append(record: AnswerRecord): Promise<AnswerRecord[]> {
    const results = await this.load();
    results.push(record);
    const trimmed =
      results.length > 1000
        ? results.slice(results.length - 1000)
        : results;
    await this.save(trimmed);
    return trimmed;
  }

  async save(results: AnswerRecord[]): Promise<void> {
    const raw = (await this.plugin.loadData()) as Record<string, unknown> | null;
    const data: Record<string, unknown> = raw ?? {};
    const stored = (data[STORAGE_KEY] as QuizStorageData | undefined) ?? {
      results: [],
      lastSessionAt: new Date().toISOString(),
      sessions: [],
    };
    stored.results = results;
    stored.lastSessionAt = new Date().toISOString();
    data[STORAGE_KEY] = stored;
    await this.plugin.saveData(data);
  }

  async clear(): Promise<void> {
    const raw = (await this.plugin.loadData()) as Record<string, unknown> | null;
    if (!raw) return;
    delete raw[STORAGE_KEY];
    await this.plugin.saveData(raw);
  }

  getStats(filePath?: string): {
    total: number;
    correct: number;
    incorrect: number;
    skipped: number;
    avgTime: number;
  } {
    const results = this.plugin.settings.answerHistory;
    const filtered = filePath
      ? results.filter((r) => r.filePath === filePath)
      : results;
    const total = filtered.length;
    const correct = filtered.filter((r) => r.correct === true).length;
    const incorrect = filtered.filter((r) => r.correct === false).length;
    const skipped = filtered.filter((r) => r.correct === null).length;
    const answered = filtered.filter((r) => r.durationMs > 0);
    const avgTime =
      answered.length > 0
        ? answered.reduce((sum, r) => sum + r.durationMs, 0) / answered.length
        : 0;
    return { total, correct, incorrect, skipped, avgTime };
  }
}
