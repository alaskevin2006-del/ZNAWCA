# UI/UX 变更清单（防止误回滚）

本文档记录了 Znawca 应用在本轮迭代中做出的 UI/UX 变更及其原因。
**所有变更均为有意为之，请勿"修复"或"还原"以下任何改动。**
若你（Codex / 其他 Agent）认为某处有问题，先与 Kevin 确认，不要自行改回。

---

## 1. 删除左侧导航栏（Sidebar）

**变更：**
- `AppShell.tsx` 删除 `Sidebar` 组件、相关 runtime state、`RuntimeInfo` import。
- `app-shell.css` 删除 `.sidebar` / `.nav-label` / RTL sidebar 残留规则。
- `.workspace` 由双列 grid 改为单列布局。

**原因：** 侧栏只有"课程"一个选项，纯属冗余。删除后布局更简洁。

---

## 2. 删除离线标识（两处）

**变更：**
- Header 中 `OFFLINE` 小字删除。
- `.offline-pill` 元素及其 CSS 删除。

**原因：** 这是纯离线单机应用，离线状态是默认且唯一的，标识无意义。

---

## 3. 课程页滚动优化

**变更：**
- 课程区域重构为 `.page-courses`（固定区） + `.courses-scrollable`（滚动区）。
- `.content-courses` 设为 `overflow: hidden`，仅内部 grid 滚动。
- 标题 / 副标题 / section heading 保持固定不随内容滚动。

**原因：** 原先整页一起滚动，标题会滚走。改为只有课程网格可滚动。

---

## 4. 清理死代码：RuntimeInfo IPC 通道

**变更：**
- `contracts.ts` / `index.cts` / `main.ts` 删除 `RuntimeInfo` interface、`getRuntimeInfo` IPC 通道 / handler / preload 桥接。
- `localization/index.ts` 删除 5 个 locale 中 `localOnly` 相关翻译（Znawca 版本号 / 无需账号 / 本地数据 等）。

**原因：** 之前左下角显示的 "Znawca 1.0.0 / 无需账号 / 本地数据" 依赖此 IPC，现已不展示，通道与翻译全部删除避免死代码。

---

## 5. CSS 特异性修复（布局审查）

**变更：**
- `.content-courses` 选择器在 `settings.css` 中改为 `.app-shell .content-courses`（特异性 0,2,1），以覆盖 `.app-shell .content`（0,2,1 同级，但靠后声明 + 更高特异性生效）。
- 同理 `.content-list` / `.content-setup` 等均使用 `.app-shell` 前缀。

**原因：** 原先 `.content-courses`（特异性 0,1,0）被 `.app-shell .content`（0,2,1）的 `overflow-y: auto` 覆盖，导致滚动行为异常。**不要把选择器降回单类名，否则布局会坏。**

---

## 6. 删除底部重复的 Privacy Banner

**变更：**
- 删除页底重复的隐私 / 数据说明条。

**原因：** 与上方已有说明重复，冗余。

---

## 7. Setup Disclosure 展开修复

**变更：**
- `.setup-disclosure.is-open` 由 `flex: 1 1 auto`（撑满剩余空间）改为 `flex: 0 0 auto`（按内容高度）。
- disclosure body 由 `overflow: auto`（单独滚动）改为 `overflow: visible`。
- 改为整个 `.setup-disclosures` 容器 `overflow-y: auto` 统一滚动。

**原因：** 原先展开后 disclosure 撑满 section 高度并独立滚动，导致内容显示不足 + 大量空白。改为内容自然高度，容器统一滚动。

---

## 8. 困难内容卡片空白收紧

**变更：**
- `.difficulty-card` 及内部 head / body 的 padding / margin 收紧。
- `.history-card` 等同类卡片同步收紧。

**原因：** 原先卡片内空白过大，信息密度低。

---

## 9. 困难内容单条删除功能

**变更：**
- `AppShell.tsx` 新增 `onRemove` prop 传给 Difficulty 卡片，每条加删除按钮。
- `persistence/index.ts` 新增 `removeDifficultyRecord(state, courseId, objectId)`，同时清除 `difficulty` 对象 key 和 `difficultyRecords` 数组项。

**原因：** 原先困难内容无法单条删除，只能整课程清除。这是缺失功能，非多余代码。

---

## 10. 列表页标题固定（统一布局）

**变更：**
- Difficulty / LearningHistory / TestHistory 三个列表页统一使用：
  - `.page-list`（外层 flex column）
  - `.list-heading`（固定区，flex: 0 0 auto）
  - `.list-scroll`（滚动区，flex: 1 1 auto, overflow-y: auto）
- `AppShell.tsx` section className 按屏幕加 `content-list`。

**原因：** 原先列表页整页滚动，标题随内容滚走。统一为标题固定 + 列表滚动。

---

## 11. 学习/测试历史改为答题回放视图

**变更：**
- 删除原来的 `<details>` 折叠展开形式。
- 点击历史卡片进入 `ReplayView`（回放视图）：
  - 顶部题号导航条，可快速切换题目。
  - 只读 question card + 答案对比（用户答案 vs 正确答案）。
  - 音频内容仍以正常学习/测试形式呈现（非纯文本折叠）。
- `replay` state 结构：`{ kind: 'learning' | 'test', recordId, index }`。
- `replayActive` 守卫用于渲染回放视图时隐藏列表。
- `localization/index.ts` 新增 `replayTitle` / `backToList` / `noAnswerRecord` 翻译。
- 测试文件更新断言：点击 `.history-card-open` 进入回放、答案对比文本匹配。
- 回放中值用纯 `<span dir="auto">` 渲染（不用 `<bdi>`），因为 testing-library `getByText` 只匹配直接文本子节点。

**原因：** 原先折叠展开无法呈现音频等富媒体内容，且无法快速切题。回放视图更贴近实际学习/测试体验。**不要改回 `<details>` 折叠形式。**

---

## 测试 & 构建验证

所有变更均通过：
- 双 tsconfig 类型检查（`tsconfig.json` renderer + `tsconfig.main.json` main）
- vitest 84 个 smoke 测试全绿
- vite build 成功（最终 CSS ≈ 19KB / JS ≈ 270KB）

---

_最后更新：2026-07-31_
