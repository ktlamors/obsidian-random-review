# Random Review — Obsidian 随机复习插件

[![English](https://img.shields.io/badge/English-README-blue)](./README.md)

从指定文件夹中按规则随机抽取笔记，全屏逐篇浏览复习，支持答案折叠/展开。适用于闪卡自测、随机回顾、模拟抽题等场景。

## 功能

- **🎲 随机抽取** — 从指定文件夹随机抽取笔记，支持设置抽取数量
- **🏷️ 标签筛选** — 按包含/排除标签过滤笔记（OR 逻辑）
- **📋 属性筛选** — 按 frontmatter 属性分别抽题，每个条件独立设置数量（OR 逻辑）
- **📂 文件夹排除** — 排除目标文件夹下的特定子文件夹
- **🖥️ 全屏浏览** — 沉浸式复习视图，支持键盘快捷键
- **👁 答案切换** — 一键展开/折叠笔记中的折叠 Callout（`> [!NOTE]-` 语法）
- **✏️ 边看边改** — 复习中可在右侧分屏打开笔记编辑，保存后自动刷新
- **💾 配置档案** — 每个目标文件夹独立保存配置，切换自动恢复
- **🖱️ 三种启动方式** — 命令面板 / Ribbon 图标 / 文件夹右键菜单

## 安装

### 社区市场（推荐）
在 Obsidian 社区插件市场搜索「**Random Review**」安装。

### 手动安装
从 [Releases](https://github.com/ktlamors/obsidian-random-review/releases) 下载 `main.js`、`manifest.json`、`styles.css`，放入：
```
<vault>/.obsidian/plugins/random-review/
```

### BRAT
添加仓库：`ktlamors/obsidian-random-review`

## 使用方法

### 1. 配置

设置 → 第三方插件 → Random Review → 设置：

- **目标文件夹**：选择笔记所在的文件夹
- **排除文件夹**：选择要跳过的子文件夹
- **包含/排除标签**：按标签筛选
- **属性筛选**：按 frontmatter 属性分条件独立抽题，每个条件设置抽取数量
- **抽取数量**：未设置属性筛选时的默认数量
- **答案默认折叠**：进入复习时 Callout 的初始状态

切换目标文件夹时，当前配置**自动保存**为档案，切回时**自动恢复**。

### 2. 启动复习

三种方式：
- `Ctrl+P` → 搜索「启动随机复习」
- 点击左侧边栏 🎲 图标
- 右键文件夹 →「从此文件夹随机抽取」

### 3. 复习操作

| 操作 | 按钮/快捷键 |
|------|------------|
| 下一题 | 点击「下一题 →」或按 `→` / `Space` |
| 上一题 | 点击「← 上一题」或按 `←` |
| 显示/隐藏答案 | 点击按钮或按 `A` |
| 编辑原笔记 | 点击「编辑原笔记」，右侧分屏编辑 |
| 退出 | 点击 `✕` 或按 `Esc` |

### 4. 笔记格式

答案部分使用 Obsidian **折叠 Callout** 语法：

```markdown
题目内容……

> [!NOTE]- 答案与解析
> 正确答案是 C
> 解析：……
```

复习时点击「显示答案」即可展开 Callout 内容。

## 键盘快捷键

| 键 | 功能 |
|----|------|
| `→` / `Space` | 下一题 |
| `←` | 上一题 |
| `A` | 显示/隐藏答案 |
| `Esc` | 退出复习 |

## 开发

```bash
git clone https://github.com/ktlamors/obsidian-random-review.git
cd obsidian-random-review
npm install
npm run build
```

## 许可

MIT
