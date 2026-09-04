# Random Review — Obsidian 随机复习插件

[![English](https://img.shields.io/badge/English-README_EN-blue)](./README_EN.md)

[![Obsidian](https://img.shields.io/badge/Obsidian-Plugin-purple.svg)](https://obsidian.md)
[![Release](https://img.shields.io/github/v/release/ktlamors/obsidian-random-review)](https://github.com/ktlamors/obsidian-random-review/releases)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![GitHub Stars](https://img.shields.io/github/stars/ktlamors/obsidian-random-review)](https://github.com/ktlamors/obsidian-random-review)
[![Last Commit](https://img.shields.io/github/last-commit/ktlamors/obsidian-random-review)](https://github.com/ktlamors/obsidian-random-review)

从指定文件夹中按规则随机抽取笔记，全屏逐篇浏览复习，支持答案折叠/展开。适用于闪卡自测、随机回顾、模拟抽题等场景。

## 功能

- **🎲 随机抽取** — 从指定文件夹随机抽取笔记，支持设置抽取数量
- **🏷️ 标签筛选** — 按包含/排除标签过滤笔记（OR 逻辑）
- **📋 属性筛选** — 按「条件组」抽题：一个组内多条条件需全部满足（AND），不同组之间为任一满足（OR），每组可独立设置数量
- **📂 文件夹排除** — 排除目标文件夹下的特定子文件夹
- **👁 答案切换** — 一键展开/折叠笔记中的折叠 Callout（`> [!NOTE]-` 语法）
- **✏️ 边看边改** — 复习中可在右侧分屏打开笔记编辑，保存后自动刷新
- **💾 配置档案** — 支持命名档案，同一文件夹可保存多套抽取规则，切换档案即切换规则
- **🖱️ 三种启动方式** — 命令面板 / Ribbon 图标 / 文件夹右键菜单

### 1.1.6

**修复**：修复「另存为新档案」会覆盖原档案的问题——现在编辑规则只修改当前草稿，切换档案时才写回原档案，另存为不再影响原档案。

### 1.1.5

**新增**：配置档案改为「命名档案」——同一文件夹可保存多套抽取规则（如「数学-单选」「数学-易错」），切换档案即切换文件夹与规则；改动自动保存到当前档案，支持新建、重命名、删除、另存为新档案。

### 1.1.4

**修复**：修复 Android 端部分从桌面同步的笔记因路径前缀不一致导致文件夹筛选失效、提示「没有符合条件的笔记」的问题。

### 1.1.3

**新增**：属性筛选升级为「条件组」——一个组内的多条属性条件需全部满足（AND），不同组之间为任一满足（OR），每组可独立设置抽取数量；每个条件支持 等于 / 包含 / 不等于。

### 1.1.2

**新增**：复习视图下内部链接可点击，点击后分屏显示点击内容。

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
- **配置档案**：可新建、选择、重命名、删除档案；同一文件夹可保存多套规则（如「数学-单选」「数学-易错」），改动自动保存到当前档案
- **排除文件夹**：选择要跳过的子文件夹
- **包含/排除标签**：按标签筛选
- **属性筛选**：按「条件组」抽题，组内多条条件需同时满足（AND），不同组之间为任一满足（OR），每组可独立设置抽取数量；每个条件可选 等于/包含/不等于
- **抽取数量**：未设置属性筛选时的默认数量
- **答案默认折叠**：进入复习时 Callout 的初始状态

配置以「档案」为单位保存：一个档案 = 一套文件夹 + 筛选规则。改动自动保存到当前选中的档案，也可「另存为新档案」复制一份。

### 2. 启动复习

三种方式：

- `Ctrl+P` → 搜索「启动随机复习」
- 点击左侧边栏 🎲 图标
- 右键文件夹 →「从此文件夹随机抽取」

### 3. 复习操作

| 操作          | 按钮/快捷键                             |
| ------------- | --------------------------------------- |
| 下一题        | 点击「下一题 →」或按`→` / `Space` |
| 上一题        | 点击「← 上一题」或按`←`             |
| 显示/隐藏答案 | 点击按钮或按`A`                       |
| 编辑原笔记    | 点击「编辑原笔记」，右侧分屏编辑        |
| 退出          | 点击`✕` 或按 `Esc`                 |

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

| 键                 | 功能          |
| ------------------ | ------------- |
| `→` / `Space` | 下一题        |
| `←`             | 上一题        |
| `A`              | 显示/隐藏答案 |
| `Esc`            | 退出复习      |

## 开发

```bash
git clone https://github.com/ktlamors/obsidian-random-review.git
cd obsidian-random-review
npm install
npm run build
```

## 许可

MIT
