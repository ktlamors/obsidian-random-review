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

/** 命名档案：一份带名字和文件夹的筛选规则快照 */
export interface NamedProfile extends FolderProfile {
  id: string;
  name: string;
  folderPath: string;
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

  // 当前激活的命名档案 id（自动保存目标）
  activeProfileId: string | null;

  // 所有命名档案
  profiles: NamedProfile[];
}

/** 新建档案时的默认筛选字段 */
export const DEFAULT_PROFILE: FolderProfile = {
  excludeFolders: [],
  includeTags: [],
  excludeTags: [],
  propertyGroups: [],
  pickCount: 10,
  randomOrder: true,
};

export const DEFAULT_SETTINGS: RandomReviewSettings = {  folderPath: "",
  language: "zh",
  excludeFolders: [],
  includeTags: [],
  excludeTags: [],
  propertyGroups: [],
  pickCount: 10,
  randomOrder: true,
  answerDefaultCollapsed: true,
  showNavigationBar: true,
  activeProfileId: null,
  profiles: [],
};
