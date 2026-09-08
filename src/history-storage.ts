import type RandomReviewPlugin from "./main";
import type { TFile } from "obsidian";

export interface HistoryEntry {
  id: string;
  name: string;
  date: string;
  noteCount: number;
  files: string[];
}

export const HISTORY_STORAGE_KEY = "extractionHistory";

const STORAGE_KEY = HISTORY_STORAGE_KEY;

export class HistoryStorage {
  private plugin: RandomReviewPlugin;

  constructor(plugin: RandomReviewPlugin) {
    this.plugin = plugin;
  }

  async load(): Promise<HistoryEntry[]> {
    const raw = (await this.plugin.loadData()) as Record<string, unknown> | null;
    if (!raw || !raw[STORAGE_KEY]) return [];
    const entries = (raw[STORAGE_KEY] as HistoryEntry[]) ?? [];
    return entries;
  }

  async save(entries: HistoryEntry[]): Promise<void> {
    const raw = (await this.plugin.loadData()) as Record<string, unknown> | null;
    const data: Record<string, unknown> = raw ?? {};
    data[STORAGE_KEY] = entries;
    await this.plugin.saveData(data);
  }

  /**
   * 保存一次抽取。若文件列表与既有记录完全相同则复用其 id，不重复记录；
   * 若名称重复则追加递增编号。返回该抽取历史记录的 id。
   */
  async add(files: TFile[], baseName: string): Promise<string> {
    const entries = await this.load();
    const fileList = files.map((f) => f.path).sort();
    const identical = entries.find(
      (e) =>
        e.files.length === fileList.length &&
        e.files.slice().sort().every((p, i) => p === fileList[i])
    );
    if (identical) return identical.id;

    const name = this.uniqueName(entries, baseName);
    const id = this.generateId();
    entries.unshift({
      id,
      name,
      date: new Date().toISOString(),
      noteCount: files.length,
      files: fileList,
    });
    if (entries.length > 100) entries.pop();
    await this.save(entries);
    return id;
  }

  /** 生成不与现有名称冲突的名称，冲突时追加 (2)、(3)… */
  private uniqueName(entries: HistoryEntry[], baseName: string): string {
    if (!entries.some((e) => e.name === baseName)) return baseName;
    let n = 2;
    while (entries.some((e) => e.name === `${baseName} (${n})`)) n++;
    return `${baseName} (${n})`;
  }

  async rename(id: string, newName: string): Promise<void> {
    const entries = await this.load();
    const hit = entries.find((e) => e.id === id);
    if (hit) {
      const taken = entries.some(
        (e) => e.id !== id && e.name === newName.trim()
      );
      hit.name = taken ? this.uniqueName(entries, newName.trim()) : newName.trim();
    }
    await this.save(entries);
  }

  async remove(id: string): Promise<void> {
    const entries = await this.load();
    await this.save(entries.filter((e) => e.id !== id));
  }

  private generateId(): string {
    return (
      Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
    );
  }
}