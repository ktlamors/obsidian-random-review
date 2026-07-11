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
      const frontmatterTags = cache.frontmatter?.tags;
      if (frontmatterTags) {
        if (Array.isArray(frontmatterTags)) {
          frontmatterTags.forEach((t: string) =>
            fileTags.push(String(t).replace(/^#/, ""))
          );
        } else if (typeof frontmatterTags === "string") {
          fileTags.push(frontmatterTags.replace(/^#/, ""));
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
  if (settings.propertyFilters.length > 0) {
    const validFilters = settings.propertyFilters.filter(
      (f) => f.key !== "" && f.value !== ""
    );

    if (validFilters.length > 0) {
      // 为每个条件独立筛选并抽取
      const resultSet = new Set<TFile>();

      validFilters.forEach((filter) => {
        // 数量为 0 则跳过此条件
        if (filter.count <= 0) return;

        // 筛选匹配此条件的笔记
        const matched = files.filter((file) => {
          const cache = app.metadataCache.getFileCache(file);
          if (!cache?.frontmatter) return false;

          const actualValue = cache.frontmatter[filter.key];
          if (actualValue === undefined || actualValue === null) return false;

          const actualStr = String(actualValue);
          switch (filter.operator) {
            case "equals":
              return actualStr === filter.value;
            case "contains":
              return actualStr.includes(filter.value);
            case "not-equals":
              return actualStr !== filter.value;
            default:
              return false;
          }
        });

        // 随机选取此条件指定数量的笔记
        const shuffled = fisherYatesShuffle([...matched]);
        const picked = shuffled.slice(0, filter.count);

        // 加入结果集（自动去重）
        picked.forEach((f) => resultSet.add(f));
      });

      files = [...resultSet];
    }
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
  if (settings.propertyFilters.length === 0) {
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
