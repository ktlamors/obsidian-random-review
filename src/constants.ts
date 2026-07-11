export const VIEW_TYPE_RANDOM_REVIEW = "random-review-view";

export const PLUGIN_NAME = "Random Review";

export interface PropertyFilter {
  key: string;
  value: string;
  operator: "equals" | "contains" | "not-equals";
  count: number;
}

/** 每个目标文件夹的独立配置 */
export interface FolderProfile {
  excludeFolders: string[];
  includeTags: string[];
  excludeTags: string[];
  propertyFilters: PropertyFilter[];
  pickCount: number;
  randomOrder: boolean;
}

export interface RandomReviewSettings {
  // 当前选中的文件夹
  folderPath: string;

  // 当前工作配置
  excludeFolders: string[];
  includeTags: string[];
  excludeTags: string[];
  propertyFilters: PropertyFilter[];
  pickCount: number;
  randomOrder: boolean;

  // 全局显示设置
  answerDefaultCollapsed: boolean;
  showNavigationBar: boolean;

  // 按文件夹保存的配置档案：key = 文件夹路径
  profiles: Record<string, FolderProfile>;
}

/** 新建文件夹时的默认筛选配置 */
export const DEFAULT_PROFILE: FolderProfile = {
  excludeFolders: [],
  includeTags: [],
  excludeTags: [],
  propertyFilters: [],
  pickCount: 10,
  randomOrder: true,
};

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
  profiles: {},
};
