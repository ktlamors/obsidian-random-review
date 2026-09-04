export type Language = "zh" | "en";

const zh = {
  // 插件入口
  startReview: "启动随机复习",
  ribbonTooltip: "随机复习",
  folderMenu: "从此文件夹随机抽取",

  // 设置页顶部
  tabGeneral: "通用",
  tabExtraction: "抽取控制",
  languageSetting: "语言【Language】",
  languageDesc: "设置界面显示语言",
  pluginIntroTitle: "插件介绍",
  pluginIntro: "从指定文件夹随机抽取笔记，支持标签和属性筛选，在全屏视图中逐篇浏览，用折叠 callout 显示/隐藏答案。适合闪卡复习、随机浏览和测验模拟。",
  usageTitle: "使用方法",
  usageItems: [
    "在「抽取控制」中选择目标文件夹，并按需设置标签、排除文件夹、属性（属性可组成条件组，组内条件需全部满足）等筛选",
    "通过命令面板、Ribbon 图标或右键文件夹启动复习",
    "用 ← → 或空格切换笔记，按 A 显示/隐藏答案，Esc 退出",
  ],
  updateLogTitle: "更新日志",
  updateLogItems: [
    {
      version: "1.1.5",
      text: "配置档案改为「命名档案」：同一文件夹可保存多套抽取规则，切换档案即切换文件夹与规则；改动自动保存，支持新建/重命名/删除/另存为新档案。",
    },
    {
      version: "1.1.4",
      text: "修复 Android 端部分从桌面同步的笔记因路径前缀不一致导致文件夹筛选失效的问题。",
    },
    {
      version: "1.1.3",
      text: "属性筛选支持条件组：组内多条条件需全部满足（AND），不同组之间为任一满足（OR），每组可独立设置抽取数量；每个条件支持 等于/包含/不等于。",
    },
    {
      version: "1.1.2",
      text: "复习视图内的内部链接现在可点击，点击后分屏打开目标笔记。",
    },
    {
      version: "1.1.0",
      text: "设置页分为「通用」与「抽取控制」两个选项卡，新增中英文界面语言切换。",
    },
    {
      version: "1.0.0",
      text: "首个版本：从指定文件夹按标签/属性筛选随机抽取笔记，全屏复习并支持答案折叠/展开。",
    },
  ],

  // 抽取控制
  noteFilterHeading: "笔记筛选",
  targetFolder: "目标文件夹",
  targetFolderDesc: "从中抽取笔记的文件夹，切换时自动保存当前配置",
  selectFolder: "— 请选择 —",
  profileHeading: "配置档案",
  profileDesc: "选择或新建一套抽取规则；同一文件夹可保存多套规则。当前改动会自动保存到选中的档案。",
  profileSelect: "选择档案",
  selectProfile: "— 未选择 —",
  profileName: "档案名称",
  profileNamePlaceholder: "输入档案名称",
  profileSaveAs: "另存为新档案",
  profileRename: "重命名",
  profileDelete: "删除",
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
  propertyFilterDesc: "属性按「条件组」筛选：一个组内的多条条件需全部满足（AND）；不同组之间为任一满足（OR），每组可独立设置抽取数量。",
  propertyKey: "属性名",
  propertyValue: "属性值",
  propertyCount: "抽取数量",
  propertyGroupTitle: "条件组",
  operatorEquals: "等于",
  operatorContains: "包含",
  operatorNotEquals: "不等于",
  addPropertyCondition: "+ 添加条件",
  removeCondition: "移除条件",
  addPropertyGroup: "+ 添加条件组",
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
    "In \"Extraction Control\", pick a target folder and configure tags, excluded folders, and property filters (properties can be grouped into AND condition groups)",
    "Launch the review via the command palette, the ribbon icon, or the folder context menu",
    "Use ← → or Space to switch notes, press A to show/hide the answer, and Esc to exit",
  ],
  updateLogTitle: "Changelog",
  updateLogItems: [
    {
      version: "1.1.5",
      text: "Profiles are now named: a folder can hold multiple rule sets; switching a profile switches its folder and rules. Edits auto-save, with create / rename / delete / save-as-new.",
    },
    {
      version: "1.1.4",
      text: "Fixed folder filtering on Android for notes synced from desktop with inconsistent path prefixes.",
    },
    {
      version: "1.1.3",
      text: "Property filtering now uses condition groups: every condition inside a group must match (AND), different groups are alternatives (OR), each with its own pick count; each condition supports equals / contains / not equals.",
    },
    {
      version: "1.1.2",
      text: "Internal links inside the review view are now clickable and open their target in a split pane.",
    },
    {
      version: "1.1.0",
      text: "Settings split into General / Extraction Control tabs; added Chinese/English interface language.",
    },
    {
      version: "1.0.0",
      text: "Initial release: randomly pick notes from a folder filtered by tags/properties and review them fullscreen with foldable answers.",
    },
  ],

  // 抽取控制
  noteFilterHeading: "Note Filtering",
  targetFolder: "Target Folder",
  targetFolderDesc: "Folder to pick notes from; settings auto-save per folder",
  selectFolder: "— Select —",
  profileHeading: "Profiles",
  profileDesc: "Select or create a rule set; a folder can have multiple rule sets. Edits are auto-saved to the selected profile.",
  profileSelect: "Select profile",
  selectProfile: "— Select —",
  profileName: "Profile name",
  profileNamePlaceholder: "Enter a name",
  profileSaveAs: "Save as new profile",
  profileRename: "Rename",
  profileDelete: "Delete",
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
  propertyFilterDesc: "Properties are grouped: every condition inside a group must match (AND); different groups are alternatives (OR), each with its own pick count.",
  propertyKey: "Property name",
  propertyValue: "Property value",
  propertyCount: "Pick count",
  propertyGroupTitle: "Condition group",
  operatorEquals: "equals",
  operatorContains: "contains",
  operatorNotEquals: "not equals",
  addPropertyCondition: "+ Add condition",
  removeCondition: "Remove condition",
  addPropertyGroup: "+ Add condition group",
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
