export type Language = "zh" | "en";

const zh = {
  // 插件入口
  startReview: "启动随机复习",
  ribbonTooltip: "随机复习",
  folderMenu: "从此文件夹随机抽取",

  // 设置页顶部
  tabGeneral: "通用",
  tabExtraction: "抽取控制",
  languageSetting: "语言",
  languageDesc: "设置界面显示语言",
  pluginIntroTitle: "插件介绍",
  pluginIntro: "从指定文件夹随机抽取笔记，支持标签和属性筛选，在全屏视图中逐篇浏览，用折叠 callout 显示/隐藏答案。适合闪卡复习、随机浏览和测验模拟。",
  usageTitle: "使用方法",
  usageItems: [
    "在「抽取控制」中选择目标文件夹并配置筛选条件",
    "通过命令面板、Ribbon 图标或右键文件夹启动复习",
    "用 ← → 或空格切换笔记，按 A 显示/隐藏答案，Esc 退出",
  ],

  // 抽取控制
  noteFilterHeading: "笔记筛选",
  targetFolder: "目标文件夹",
  targetFolderDesc: "从中抽取笔记的文件夹，切换时自动保存当前配置",
  selectFolder: "— 请选择 —",
  profileHeading: "历史配置档案",
  profileDesc: "点击切换配置，右键删除",
  profileHint: "右键点击档案标签可删除",
  excludeFoldersHeading: "排除文件夹",
  needTargetFirst: "请先选择目标文件夹",
  excludeFoldersDesc: "以下文件夹内的笔记不会被抽取",
  remove: "移除",
  addExcludeFolder: "+ 添加排除文件夹",
  includeTags: "包含标签",
  includeTagsDesc: "只抽取包含以下任一标签的笔记（每行一个，# 号可选）",
  excludeTags: "排除标签",
  excludeTagsDesc: "排除包含以下任一标签的笔记（每行一个）",
  propertyFilterHeading: "属性筛选",
  propertyFilterDesc: "按属性分别抽取，各条件独立匹配（OR），合并后随机排列",
  propertyKey: "属性名",
  propertyValue: "属性值",
  propertyCount: "数量",
  addPropertyFilter: "+ 添加属性筛选",
  extractionRuleHeading: "抽取规则",
  pickCount: "抽取数量",
  pickCountDesc: "未设置属性筛选时的默认抽取数量",
  randomOrder: "随机排列",
  displayHeading: "显示设置",
  answerDefaultCollapsed: "答案默认折叠",
  showNavigationBar: "显示导航栏",

  // 复习视图
  editNote: "编辑原笔记",
  closeNote: "关闭原笔记",
  previous: "← 上一题",
  next: "下一题 →",
  showAnswer: "显示答案",
  hideAnswer: "隐藏答案",
  exit: "✕",
  emptyTitle: "没有符合条件的笔记 😕",
  emptyDesc: "请在设置中调整筛选条件后重新启动",
  deletedSkip: (name: string) => `笔记 "${name}" 已被删除，自动跳过`,
  readFailed: (name: string) => `无法读取笔记: ${name}`,
  completed: "已完成本轮复习！可在设置中调整后重新启动",
};

const en = {
  // 插件入口
  startReview: "Start Random Review",
  ribbonTooltip: "Random Review",
  folderMenu: "Random pick from this folder",

  // 设置页顶部
  tabGeneral: "General",
  tabExtraction: "Extraction Control",
  languageSetting: "Language",
  languageDesc: "Set the display language of the interface",
  pluginIntroTitle: "About",
  pluginIntro: "Randomly pick notes from a folder with tag and property filtering, browse them one by one in a fullscreen view, and show/hide answers via folded callouts. Ideal for flashcard review, random browsing, and quiz simulation.",
  usageTitle: "Usage",
  usageItems: [
    "In \"Extraction Control\", pick a target folder and configure filters",
    "Launch the review via the command palette, the ribbon icon, or the folder context menu",
    "Use ← → or Space to switch notes, press A to show/hide the answer, and Esc to exit",
  ],

  // 抽取控制
  noteFilterHeading: "Note Filtering",
  targetFolder: "Target Folder",
  targetFolderDesc: "Folder to pick notes from; settings auto-save per folder",
  selectFolder: "— Select —",
  profileHeading: "Saved Profiles",
  profileDesc: "Click to switch, right-click to delete",
  profileHint: "Right-click a profile tag to delete",
  excludeFoldersHeading: "Excluded Folders",
  needTargetFirst: "Please select a target folder first",
  excludeFoldersDesc: "Notes in these folders will not be picked",
  remove: "Remove",
  addExcludeFolder: "+ Add excluded folder",
  includeTags: "Include Tags",
  includeTagsDesc: "Only pick notes with any of these tags (one per line, # optional)",
  excludeTags: "Exclude Tags",
  excludeTagsDesc: "Exclude notes with any of these tags (one per line)",
  propertyFilterHeading: "Property Filtering",
  propertyFilterDesc: "Pick separately per property (OR), then shuffle the merged result",
  propertyKey: "Property name",
  propertyValue: "Property value",
  propertyCount: "Count",
  addPropertyFilter: "+ Add property filter",
  extractionRuleHeading: "Extraction Rules",
  pickCount: "Pick Count",
  pickCountDesc: "Default number of notes when no property filters are set",
  randomOrder: "Random Order",
  displayHeading: "Display",
  answerDefaultCollapsed: "Collapse Answers by Default",
  showNavigationBar: "Show Navigation Bar",

  // 复习视图
  editNote: "Edit Note",
  closeNote: "Close Note",
  previous: "← Previous",
  next: "Next →",
  showAnswer: "Show Answer",
  hideAnswer: "Hide Answer",
  exit: "✕",
  emptyTitle: "No notes match the filters 😕",
  emptyDesc: "Adjust the filters in settings and restart",
  deletedSkip: (name: string) => `Note "${name}" was deleted; skipped automatically`,
  readFailed: (name: string) => `Failed to read note: ${name}`,
  completed: "Round complete! Adjust settings and restart to review again",
};

export const translations: Record<Language, typeof zh> = { zh, en };

export function getLang(language: Language): typeof zh {
  return translations[language] ?? zh;
}
