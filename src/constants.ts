export const VIEW_TYPE_RANDOM_REVIEW = "random-review-view";

export const PLUGIN_NAME = "Random Review";

export interface PropertyFilter {
  key: string;
  value: string;
  operator: "equals" | "contains" | "not-equals";
  count: number; // 此条件下抽取的数量，0 表示使用全局 pickCount
}

export interface RandomReviewSettings {
  folderPath: string;
  excludeFolders: string[];
  includeTags: string[];
  excludeTags: string[];
  propertyFilters: PropertyFilter[];
  pickCount: number;
  randomOrder: boolean;
  answerDefaultCollapsed: boolean;
  showNavigationBar: boolean;
}

export const DEFAULT_SETTINGS: RandomReviewSettings = {
  folderPath: "",
  excludeFolders: [],
  includeTags: [],
  excludeTags: [],
  propertyFilters: [],
  pickCount: 10,
  randomOrder: true,
  answerDefaultCollapsed: true,
  showNavigationBar: true,
};
