# Random Review — Obsidian 随机笔记复习插件设计文档

**日期：** 2026-07-11
**状态：** 已确认

---

## 1. 概述

Random Review 是一款 Obsidian 插件，从指定文件夹中随机抽取笔记，支持标签和属性筛选，在全屏视图中逐篇浏览，支持切换显示/隐藏答案（callout 折叠内容）。

### 核心功能

1. 按文件夹 + 标签 + 属性组合筛选笔记
2. 一次性随机抽取指定数量的笔记形成队列
3. 全屏视图渲染单篇笔记，支持上一题/下一题导航
4. 统一控制 callout 折叠区域的展开/收起（显示/隐藏答案）
5. 多种启动方式：命令面板 / Ribbon 图标 / 右键菜单
6. 标准 Obsidian 设置 Tab，所有参数可配置

---

## 2. 文件结构

```
random-review/
├── manifest.json          # Obsidian 插件元信息
├── package.json           # 构建依赖
├── tsconfig.json          # TypeScript 配置
├── esbuild.config.mjs     # 打包配置（esbuild）
├── styles.css             # 全屏视图样式
├── src/
│   ├── main.ts            # 插件入口：注册命令/Ribbon/右键菜单，生命周期
│   ├── settings.ts         # 设置数据模型 + 设置 Tab UI
│   ├── note-extractor.ts   # 笔记抽取引擎
│   ├── review-view.ts      # 复习视图（ItemView 子类）
│   └── constants.ts        # 常量（视图类型 ID 等）
└── README.md
```

### 模块职责

| 模块 | 职责 |
|------|------|
| `main.ts` | 插件注册、命令/Ribbon/右键菜单绑定、启动复习视图 |
| `settings.ts` | `RandomReviewSettings` 接口、`SettingTab` 类 |
| `note-extractor.ts` | 根据文件夹/标签/属性筛选笔记，Fisher-Yates 随机抽取 |
| `review-view.ts` | `ItemView` 子类，渲染 Markdown、导航按钮栏、callout toggle |
| `constants.ts` | 视图类型 ID `random-review-view`、默认值等常量 |

### 依赖关系

```
main.ts
  ├─→ settings.ts        （注册设置 Tab）
  ├─→ note-extractor.ts  （调用抽取逻辑）
  └─→ review-view.ts     （创建并打开视图）
        ├─→ main.ts       （通过回调获取笔记队列）
        └─→ styles.css    （样式）
```

---

## 3. 设置模型

```typescript
interface RandomReviewSettings {
  // --- 笔记筛选 ---
  folderPath: string;              // 目标文件夹路径，如 "flashcards/"
  excludeFolders: string[];        // 排除的子文件夹
  includeTags: string[];           // 必须包含的标签（OR 逻辑）
  excludeTags: string[];           // 排除的标签
  propertyFilters: PropertyFilter[]; // 属性筛选条件（AND 逻辑）

  // --- 抽取规则 ---
  pickCount: number;               // 每次抽取数量，默认 10
  randomOrder: boolean;            // 随机排列 vs 按文件名排序

  // --- 显示设置 ---
  answerDefaultCollapsed: boolean; // 进入时答案(callout)默认折叠，默认 true
  showNavigationBar: boolean;      // 是否显示底部导航栏
}

interface PropertyFilter {
  key: string;       // 属性名，如 "difficulty"
  value: string;     // 属性值，如 "hard"
  operator: "equals" | "contains" | "not-equals";
}
```

### 默认值

```typescript
const DEFAULT_SETTINGS: RandomReviewSettings = {
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
```

---

## 4. 笔记抽取引擎

### 流程

```
启动插件
  ↓
读取设置: 文件夹、标签、属性、数量
  ↓
获取候选笔记列表
  ├─ 遍历目标文件夹下所有 .md 文件
  ├─ 过滤: 排除 excludeFolders 中的子文件夹
  ├─ 过滤: 只保留包含 includeTags 中标签的笔记（OR）
  ├─ 过滤: 排除包含 excludeTags 中标签的笔记
  └─ 过滤: 只保留满足所有 propertyFilters 的笔记（AND）
  ↓
候选数量 ≥ pickCount ?
  ├─ YES → Fisher-Yates 洗牌算法，取前 pickCount 篇
  └─ NO  → 取所有候选笔记，并提示「只有 N 篇符合条件的笔记」
  ↓
生成笔记队列 queue: TFile[]
  ↓
传给 ReviewView，自动打开第 1 篇
```

### 技术细节

- 笔记列表：通过 `app.vault.getMarkdownFiles()` 获取所有 Markdown 文件，按路径筛选
- 标签获取：通过 `app.metadataCache.getFileCache(file)?.tags` 和 `frontmatter?.tags`
- 属性获取：通过 `app.metadataCache.getFileCache(file)?.frontmatter`
- 内容读取：通过 `app.vault.read(file)` 读取 Markdown 原文

---

## 5. 复习视图 UI

### 布局

```
┌──────────────────────────────────────────────┐
│  📄 笔记标题                        [× 退出] │  ← 顶部栏
├──────────────────────────────────────────────┤
│                                              │
│         📝 笔记渲染内容区域（可滚动）          │
│                                              │
│    > 这是问题的正文内容...                     │
│                                              │
│    > [!NOTE]- 答案                            │
│    > 这是折叠的答案内容                        │
│                                              │
├──────────────────────────────────────────────┤
│  [← 上一题]   3 / 20   [下一题 →]              │  ← 底部导航栏
│  [👁 显示答案 / 隐藏答案]                      │
└──────────────────────────────────────────────┘
```

### UI 元素

| 元素 | 说明 |
|------|------|
| 顶部栏 | 笔记标题（`file.basename`）+ 退出按钮 `×` |
| 内容区 | `MarkdownRenderer` 渲染的完整笔记，支持滚动 |
| 上一题/下一题 | 切换到队列中的相邻笔记 |
| 位置指示器 | `当前位置 / 总数`，纯展示 |
| 显示/隐藏答案 | 统一展开/折叠所有可折叠 callout |

### 交互行为

- **上一题 / 下一题**：切换笔记，内容区重新渲染，保留当前答案显示状态
- **到达最后一篇后点下一题**：弹出提示「已完成本轮复习，是否重新抽取？」
- **退出 `×`**：关闭视图，回到之前的 Obsidian 布局
- **键盘快捷键**：
  - `→` 或 `Space`：下一题
  - `←`：上一题
  - `A`：切换显示/隐藏答案
  - `Esc`：退出

### 边界情况

| 场景 | 处理 |
|------|------|
| 队列为空 | 显示「没有符合条件的笔记」 |
| 只有 1 篇 | 隐藏上一题/下一题按钮 |
| 笔记内容为空 | 显示「（空笔记）」 |
| 笔记被删除（渲染时） | 跳过该笔记，自动前进到下一篇 |
| 笔记读取失败 | 显示错误卡片，保留导航按钮 |

---

## 6. Callout 折叠控制

### 机制

Obsidian 渲染后的可折叠 callout 在 DOM 中带有 `.callout.is-collapsible` 类，折叠状态由 `.is-collapsed` 类控制。

统一展开/折叠实现：
```typescript
toggleAnswer(show: boolean) {
  const callouts = this.contentEl.querySelectorAll('.callout.is-collapsible');
  callouts.forEach(el => {
    show ? el.classList.remove('is-collapsed') : el.classList.add('is-collapsed');
  });
}
```

- 仅操作带 `is-collapsible` 的 callout（不影响非折叠 callout）
- 切换笔记时保持当前答案显示状态（从上一题继承，而非重置为默认值）
- 切换笔记时重新查询 DOM 并应用当前状态

---

## 7. 错误处理

| 场景 | 处理方式 |
|------|----------|
| 目标文件夹不存在 | `Notice` Toast 提示「文件夹不存在，请检查设置」 |
| 没有符合条件的笔记 | 视图显示空状态提示 + 快捷入口跳转到设置 |
| 笔记在渲染前被删除 | 跳过该笔记，自动前进到下一篇 |
| 笔记读取失败 | 显示错误信息卡片，保留导航，用户可跳过 |
| 插件初始化失败 | `console.error` + 不阻止 Obsidian 启动 |

---

## 8. 技术栈

- **语言**：TypeScript
- **框架**：Obsidian Plugin API（`obsidian` 模块）
- **构建**：esbuild（Obsidian 官方推荐）
- **样式**：原生 CSS，通过 `styles.css` 注入

---

## 9. 成功标准

1. ✅ 从指定文件夹成功随机抽取指定数量的笔记
2. ✅ 标签和属性筛选正确生效
3. ✅ 全屏视图正确渲染笔记 Markdown 内容
4. ✅ 上一题/下一题导航正常切换
5. ✅ 显示/隐藏答案统一控制 callout 折叠状态
6. ✅ 命令面板、Ribbon 图标、右键菜单三种启动方式均可正常触发
7. ✅ 设置 Tab 配置项持久化保存
8. ✅ 键盘快捷键正常工作
9. ✅ 边界情况（空笔记、无符合条件笔记等）有友好提示
