export const VIEW_TYPE_RANDOM_REVIEW = "random-review-view";

export const PLUGIN_NAME = "Random Review";

export type PropertyOperator = "equals" | "contains" | "not-equals";

/** 条件组内的一条属性条件（同组条件之间为 AND） */
export interface PropertyCondition {
  key: string;
  value: string;
  operator: PropertyOperator;
}

/** 一组属性条件：组内全部满足才匹配，不同组之间为 OR */
export interface PropertyGroup {
  conditions: PropertyCondition[];
  count: number;
}

/** 旧版扁平属性筛选（v≤1.1.2 存档），仅用于迁移 */
export interface LegacyPropertyFilter {
  key: string;
  value: string;
  operator: PropertyOperator;
  count: number;
}

/** 每个目标文件夹的独立配置 */
export interface FolderProfile {
  excludeFolders: string[];
  includeTags: string[];
  excludeTags: string[];
  propertyGroups: PropertyGroup[];
  pickCount: number;
  randomOrder: boolean;
}

export interface RandomReviewSettings {
  // 当前选中的文件夹
  folderPath: string;

  // 界面语言
  language: "zh" | "en";

  // 当前工作配置
  excludeFolders: string[];
  includeTags: string[];
  excludeTags: string[];
  propertyGroups: PropertyGroup[];
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
  propertyGroups: [],
  pickCount: 10,
  randomOrder: true,
};

export const DEFAULT_SETTINGS: RandomReviewSettings = {
  folderPath: "",
  language: "zh",
  excludeFolders: [],
  includeTags: [],
  excludeTags: [],
  propertyGroups: [],
  pickCount: 10,
  randomOrder: true,
  answerDefaultCollapsed: true,
  showNavigationBar: true,
  profiles: {},
};
