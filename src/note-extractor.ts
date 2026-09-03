import { App, Notice, TFile } from "obsidian";
import type { RandomReviewSettings } from "./constants";

/**
 * 根据设置从 valut 中筛选并随机抽取笔记。
 * 返回符合条件的 TFile 数组。
 */
export function extractNotes(
  app: App,
  settings: RandomReviewSettings
): TFile[] {
  // 1. 获取所有 markdown 文件
  let files = app.vault.getMarkdownFiles();

  // 2. 按文件夹筛选
  if (settings.folderPath) {
    const normalizedPath = settings.folderPath.replace(/^\/+|\/+$/g, "");
    files = files.filter((file) => {
      const dir = file.path.substring(0, file.path.lastIndexOf("/"));
      return dir === normalizedPath || file.path.startsWith(normalizedPath + "/");
    });
  }

  // 3. 排除子文件夹
  if (settings.excludeFolders.length > 0) {
    files = files.filter((file) => {
      return !settings.excludeFolders.some((exclude) => {
        const normalized = exclude.replace(/^\/+|\/+$/g, "");
        return file.path.startsWith(normalized + "/");
      });
    });
  }

  // 4. 按标签筛选
  if (settings.includeTags.length > 0 || settings.excludeTags.length > 0) {
    files = files.filter((file) => {
      const cache = app.metadataCache.getFileCache(file);
      if (!cache) return settings.includeTags.length === 0;

      // 收集文件中的所有标签
      const fileTags: string[] = [];

      // 从内容标签获取
      if (cache.tags) {
        cache.tags.forEach((t) => {
          const tagName = t.tag.replace(/^#/, "");
          fileTags.push(tagName);
        });
      }

      // 从 frontmatter tags 获取
      const frontmatter = cache.frontmatter as Record<string, unknown> | null | undefined;
      if (frontmatter) {
        const tags = frontmatter.tags;
        if (Array.isArray(tags)) {
          tags.forEach((t) => fileTags.push(String(t).replace(/^#/, "")));
        } else if (typeof tags === "string") {
          fileTags.push(tags.replace(/^#/, ""));
        }
      }

      // includeTags: OR 逻辑 — 至少匹配一个
      if (settings.includeTags.length > 0) {
        const hasIncludeTag = settings.includeTags.some((tag) =>
          fileTags.includes(tag)
        );
        if (!hasIncludeTag) return false;
      }

      // excludeTags: 如果有排除标签则过滤
      if (settings.excludeTags.length > 0) {
        const hasExcludeTag = settings.excludeTags.some((tag) =>
          fileTags.includes(tag)
        );
        if (hasExcludeTag) return false;
      }

      return true;
    });
  }

  // 5. 按属性分别抽取（OR 逻辑，每个条件独立抽题后合并）
  // 5. 按属性组抽取（组内 AND，组间 OR，每组独立数量）
  if (settings.propertyGroups.length > 0) {
    const resultSet = new Set<TFile>();

    settings.propertyGroups.forEach((group) => {
      // 数量为 0 或没有完整条件则跳过此组
      if (group.count <= 0) return;
      const conditions = group.conditions.filter(
        (c) => c.key !== "" && c.value !== ""
      );
      if (conditions.length === 0) return;

      // 筛选满足组内全部条件（AND）的笔记
      const matched = files.filter((file) => {
        const cache = app.metadataCache.getFileCache(file);
        if (!cache?.frontmatter) return false;

        const frontmatter = cache.frontmatter as Record<string, unknown>;
        return conditions.every((cond) => {
          const actualValue = frontmatter[cond.key];
          if (actualValue === undefined || actualValue === null) return false;

          const actualStr = String(actualValue);
          switch (cond.operator) {
            case "equals":
              return actualStr === cond.value;
            case "contains":
              return actualStr.includes(cond.value);
            case "not-equals":
              return actualStr !== cond.value;
            default:
              return false;
          }
        });
      });

      // 随机选取此组指定数量的笔记，加入结果集（自动去重）
      const picked = fisherYatesShuffle([...matched]).slice(0, group.count);
      picked.forEach((f) => resultSet.add(f));
    });

    files = [...resultSet];
  }

  // 6. 检查是否有候选笔记
  if (files.length === 0) {
    new Notice("没有符合条件的笔记，请检查设置");
    return [];
  }

  // 7. 最终随机排列
  if (settings.randomOrder) {
    files = fisherYatesShuffle([...files]);
  }

  // 8. 若未设置属性筛选，使用全局抽取数量
  if (settings.propertyGroups.length === 0) {
    if (files.length < settings.pickCount) {
      new Notice(`只有 ${files.length} 篇符合条件的笔记`);
    }
    files = files.slice(0, settings.pickCount);
  }

  return files;
}

/**
 * Fisher-Yates 洗牌算法
 */
function fisherYatesShuffle<T>(array: T[]): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}
