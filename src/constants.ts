export const VIEW_TYPE_RANDOM_REVIEW = "random-review-view";

export const PLUGIN_NAME = "Random Review";

export interface PropertyFilter {
  key: string;
  value: string;
  operator: "equals" | "contains" | "not-equals";
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
