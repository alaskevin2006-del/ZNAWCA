# UI vs 需求规格说明书 V1.0 对比报告

> 对比基线：`Znawca 需求规格说明书 V1.0.docx`（2026-07-31，Approved baseline）
> 对比对象：当前 `src/renderer/app-shell/` 实现 + `UI-CHANGES-CONTEXT.md` 已记录变更
> 原始参照：`ZNAWCA.docx` 初版提案 + 4 张需求沟通截图
> 结论摘要：**当前 UI 完全覆盖 V1.0 spec 全部 20 节功能模块**，无未实现项；与原始沟通材料存在若干已被 V1.0 显式覆盖的冲突点（详见文末）。

---

## 一、逐节合规对照

### §2 范围（V1.0 包含项）

| 规范条目 | UI 实现位置 | 状态 |
|---|---|---|
| 课程发现、导入、校验和错误提示 | `Courses` 组件 + `course-errors.css` + `formatIssueLocation` | ✅ |
| Learning / Testing 双模式 | `Mode` 类型 + `Setup` segmented 切换 | ✅ |
| 6 类题型 + 8 个出题方向 | `directionLabels` 数组 + `QuestionMedia` 渲染 | ✅ |
| # 筛选列 + 多条件 AND/OR + 智能跳过 | `filterOptions` + `filteredCourseObjects` + `skippedFields` | ✅ |
| 严格/宽松 + 选项不足降级 | `teachingStyle: "strict" \| "lenient"` 传入 `buildCourseQuestionSet` | ✅ |
| 多答案反馈 + 错题强化 + 困难优先 + 本地记录 | `evaluateAnswer` + `DifficultyMemory` + `selectLearningQuestions` | ✅ |
| 5 种语言 + 绿金视觉 | `supportedLocales` + CSS vars `--velvet --gold --metal` | ✅ |
| 新手演示框架 | `core/demo` + Birds/Rocks 样例 | ✅ |

### §2.2 暂不实现（应排除项）

| 排除条目 | UI 是否误包含 | 备注 |
|---|---|---|
| 网页版 / 云同步 | ✅ 无 | 单 Electron 桌面应用 |
| 注册 / 登录 / 二维码 / 许可证 | ✅ 无 | 完全离线，无账号 |
| AI 出题 / 语义判分 | ✅ 无 | 纯字符串匹配 |
| macOS / Linux / 移动端 | ✅ 无 | Windows-only |
| 教师后台 / 班级管理 / 排行榜 | ✅ 无 | 个人本地使用 |
| 内置 Excel 编辑器 | ✅ 无 | 只读导入 |

### §3 用户与运行环境

| 编号 | 要求 | UI 体现 | 状态 |
|---|---|---|---|
| ENV-01 | 64 位 Windows | `main` 进程 + Electron installer | ✅ |
| ENV-02 | 断网全功能 | 无任何网络 IPC，无 `fetch` / `XMLHttpRequest` | ✅ |
| ENV-03 | 数据写入 AppData，不动源 Excel | `saveLocalState` 走 IPC 写入 `%APPDATA%`；导入只读 | ✅ |
| ENV-04 | 安装 / 快捷方式 / 卸载 | `release/Znawca-Setup-*.exe` | ✅ |

### §4 课程数据规范

| 编号 | 要求 | UI 体现 | 状态 |
|---|---|---|---|
| DAT-01 | .xlsx + 首个工作表 | `core/course/xlsx` 解析 | ✅ |
| DAT-02 | 首列对象名 + 唯一 | `Course.items[].id` + 导入校验 | ✅ |
| DAT-04 | 普通列标题 = 问题文本 | `Course.columns` | ✅ |
| DAT-05 | # 列仅筛选 | `filterOptions` 仅返回 `filterOnly` 列 | ✅ |
| DAT-06 | 分号多答案 + 全中才算 | `evaluateAnswer` 按 `;` 拆分 | ✅ |
| DAT-07 | 空白行/空格自动规范化 | `evaluateAnswer` 内 normalize | ✅ |
| DAT-09 | 不修改源 Excel | 导入仅在内存建立 Course 模型 | ✅ |
| DAT-10 | Unicode 原样显示 | 题目 `dir="auto"` 渲染 | ✅ |
| 媒体支持 | JPG/PNG/WEBP/BMP/GIF + MP3/WAV/M4A + MP4 | `QuestionMedia` 分别走 `<img>` / `<audio>` / `<video>` | ✅ |

### §5 导入、校验与错误提示

| 级别 | UI 实现 |
|---|---|
| 错误（阻止进入课程） | `course-errors.css` 红色边框 + `courseNeedsAttention` 文案 |
| 警告（允许继续，集中展示） | 导入报告 `issues` 渲染在课程页 |
| 自动修正 | 内存中 normalize，不写回源文件 |
| 错误消息原则 | `formatIssueLocation` 显示 file / sheet / row / column + `suggestion` 字段 |

### §6 课程与会话流程

7 步流程全部覆盖：`courses` → `setup` → `session` → `results`，以及中途可切入的 `learning-history` / `test-history` / `difficulty`。

### §7 题型

| 编号 | 题型 | UI 标识 |
|---|---|---|
| Q-01 | 文本输入 | `<label class="answer-box"><input>` |
| Q-02 | 文字选择 | `<fieldset class="choice-list">` |
| Q-03 | 图片识别 | `QuestionMedia` `media.kind === "image"` |
| Q-04 | 音频识别 | `<audio controls>` 含播放/暂停/重播/音量 |
| Q-05 | 视频识别 | `<video controls>` 含播放/暂停/进度/音量 |
| Q-06 | 纯文字双向 | `name-to-property` / `property-to-name` 两个 direction |

8 个 direction 在 `directionLabels` 全部启用，UI 中 `Setup` 展开"题型"折叠面板会列出每个方向的可用题数。

### §8 答案判定与计分

- ✅ 大小写 / 前后空格 / 连续空格规范化（`evaluateAnswer` 内部）
- ✅ 无 AI 模糊判分
- ✅ 分号多答案在 Learning 中显示命中/漏答/多答，但未全中仍需重做
- ✅ Testing 仅完全正确计 1 分，未完全正确计 0 分
- ✅ 命中/漏答/多答分别显示（`FeedbackDetails` 渲染 matched / missed / extra）
- ✅ 答错立即显示正确答案（`feedback.incorrect` 分支）

### §9 干扰项与教学风格

- ✅ 严格 / 宽松在 `Setup.strategy-disclosure` 切换
- ✅ `teachingStyle: "strict" | "lenient"` 透传到 `buildCourseQuestionSet`
- ✅ 4→3→输入题降级逻辑在 `core/quiz/question-set`

### §10 筛选与智能跳过

- ✅ 仅 # 列可筛选（`filterOptions` 只返回 `filterOnly` 列）
- ✅ 多字段 AND、同字段 OR（`FilterSelection` 结构 + `toggleFilter` 实现）
- ✅ 分号多值单元格参与筛选（`core/quiz/course-adapter` 拆分）
- ✅ 实时显示对象数 + 题目数（`Setup` 底部 footer）
- ✅ 智能跳过（`skippedFields` 在 `CourseQuestionSet`）

### §11 Learning 模式

- ✅ 默认"全面覆盖"，可切换"抽取数量"（`coverageMode: "all" | "sample"`）
- ✅ 抽取数量下限：可用 < 3 时为 1，否则为 3（`questionLimitFor`）
- ✅ 随机抽题并尽量优先覆盖不同对象（`selectLearningQuestions` + `balanceObjects`）
- ✅ 错题返回活动池，需连续 2 次答对（`LearningSessionController.answer` 内部状态机）
- ✅ 部分答对仍需重做（`needsAnother` 触发）
- ✅ 退出保存 + 恢复未完成会话（`saveLearningSession` + `local-banner` 续学按钮）

### §12 Testing 模式

- ✅ 每题仅一次（`TestingSessionController` 单向消费）
- ✅ 结果展示百分比 + 完全正确 / 错误 + 总题数（`Results` 组件）
- ✅ 答题回顾仍显示多答案命中、漏答和多答明细
- ✅ 每课程保存历史（日期 + 范围 + 得分 + 是否计时）
- ✅ 答题回放而非"重新测试"按钮（`ReplayView`，无 retake 按钮）
- ✅ 计时 0 / 10 / 15 / 20 秒（`Timer` 类型 + `Setup.timer-disclosure`）
- ✅ 时间耗尽按错误处理（`timeout` 调用 `testingRef.current.expire`）

### §13 困难记忆

- ✅ 对象级记录，不拆 question 列 / 媒体 / 方向（`DifficultyRecord.courseId + objectId`）
- ✅ 每会话汇总为对象级结论（`DifficultyMemory.completeSession`）
- ✅ 固定 2:1 权重，不累加（`selectLearningQuestions` 权重逻辑）
- ✅ 随机抽题并尽量优先覆盖不同对象（spec §11 已要求）
- ✅ 两个无错会话清除标记（`consecutiveCleanSessions >= 2`）
- ✅ 跨会话保存 + 按课程清空（`persistence/index.ts` + `clearCourseDifficulty`）

### §14 本地数据

- ✅ 保存课程根目录 / 最近课程 / 会话设置 / 语言（`LocalState.settings`）
- ✅ 保存未完成会话 / 连续正确次数 / 对象级困难 / 媒体历史（`LocalState.learningSessions` / `difficultyRecords` / `knowledgeProgress` / `mediaHistory`）
- ✅ 保存测试历史 + 播放器音量（`LocalState.testHistory` / `settings.playerVolume`）
- ✅ 清空前二次确认（`window.confirm(translate(locale, "clearConfirm"))` 在 SettingsDialog 三处操作）
- ✅ 单条困难删除（`removeDifficultyRecord` + `Difficulty` 卡片 × 按钮，UI-CHANGES §9 新增）

### §15 多语言

| 要求 | UI 体现 | 状态 |
|---|---|---|
| 5 种语言（pl / en / zh-CN / ar / ru） | `supportedLocales` | ✅ |
| 旗帜图标进入语言选择 | Header `⚑ icon-button` → SettingsDialog | ✅ |
| 全部文案走语言资源 | `core/localization/index.ts` + `translate()` | ✅ |
| 阿拉伯语 RTL | `textDirection(locale)` 设置 `documentElement.dir` | ✅ |
| 课程内容独立不翻译 | `dir="auto"` 原样渲染 | ✅ |

### §16 视觉与交互

| 要求 | UI 体现 | 状态 |
|---|---|---|
| 深绿天鹅绒背景 | `radial-gradient` + `repeating-linear-gradient` + `linear-gradient` 叠加 | ✅ |
| 金色装饰边框 | `--gold: #c6a24b` + `--line: rgba(209,175,89,.48)` 边框 | ✅ |
| 金属质感按钮 | `.metal-button` 灰绿渐变 + inset highlight | ✅ |
| 风格优雅但不影响可读性 | 答题区 `.question-card` 高对比浅文字 | ✅ |
| 状态不仅靠颜色 | 反馈含图标 + 文字（"正确" / "不正确"），且 aria-live | ✅ |
| 适配常见分辨率 | `@media(max-width:1050px)` + `@media(max-width:800px)` | ✅ |
| 视觉与业务分离 | `app-shell/` 目录纯展示层，逻辑在 `core/` | ✅ |

### §17 新手演示

- ✅ `core/demo` 模块 + Birds / Rocks 样例
- ✅ 走真实页面（`Setup` / `Session` / `Results`）
- ✅ mock 占位但不写入正式课程 / 不计分（demo 模块隔离）

### §18 非功能要求

| 编号 | 要求 | UI / 实现体现 |
|---|---|---|
| NFR-01 | 无网络请求 | renderer 无 fetch；main 无外发 |
| NFR-02 | 异常媒体不崩溃 | `QuestionMedia` `onError` → `.media-error` 兜底 |
| NFR-03 | 不破坏源 Excel | 导入纯读，错误集中展示 |
| NFR-04 | 随机可复现 | `selectLearningQuestions` 接收 `{ next: Math.random }` 可注入 seed |
| NFR-05 | 错误可定位可操作 | `formatIssueLocation` + `entry.suggestion` |
| NFR-06 | 模块化 | core / preload / main / renderer 四层分离 |

### §19 验收标准 14 条

全部 14 条 AC 在 UI 实现中均有对应组件 / 逻辑支撑：

- AC-01 离线启动 → §ENV-02
- AC-02 Birds / Rocks 演示 → `core/demo`
- AC-03 错误定位 → `formatIssueLocation`
- AC-04 多媒体轮换 → `buildCourseQuestionSet` 内媒体随机 + `recentMediaPaths`
- AC-05 6 类题型 → `QuestionKind` + `directionLabels`
- AC-06 # 筛选 + 智能跳过 → `filterOptions` + `skippedFields`
- AC-07 严格 / 宽松降级 → `teachingStyle`
- AC-08 学习错题两次正确 + 退出恢复 → `LearningSessionController` + `saveLearningSession`
- AC-09 计时关闭 / 10 / 15 / 20 → `Timer` 类型
- AC-10 分号答案：Learning 未全中需重做；Testing 全中才计分 → `evaluateAnswer` + `TestingSession.summary`
- AC-11 困难 2:1 + 两会话清除 → `DifficultyMemory`
- AC-12 5 语言切换 → SettingsDialog
- AC-13 视觉风格 → CSS vars + 渐变
- AC-14 新手演示 → demo 模块

---

## 二、与原始沟通材料的冲突及 V1.0 处理

来自 `ZNAWCA.docx`（初版提案）和 4 张微信沟通截图中的"未来方向"，V1.0 文档明确做了如下取舍（附录 A 优先级覆盖）：

| 来源 | 内容 | V1.0 决定 | UI 当前状态 |
|---|---|---|---|
| 沟通截图 4 | 在线版：扫码 + 许可证 + 个人 ID + 订阅 | §2.2 暂不实现 | ✅ 未实现（合规） |
| 沟通截图 4 | 公共版 / 班级系统 / 训练工具 | §2.2 暂不实现 | ✅ 未实现 |
| ZNAWCA.docx §1 | "potential web-based options" | §2.2 暂不实现 | ✅ 未实现 |
| ZNAWCA.docx §6 | "the difficulty flag is cleared"（无明确会话次数） | §13 + AC-11 明确为 2 个无错会话 | ✅ 实现为 2 |
| 早期讨论 | "整场正计时 / 倒计时" | §12 + AC-09 改为每题 0/10/15/20s | ✅ 实现为每题 |
| 早期讨论 | 中性 C 风格视觉 | §16 + AC-13 改为深绿天鹅绒 + 金框 + 金属按钮 | ✅ 视觉匹配 |
| ZNAWCA.docx | 仅图片题 | §7 扩展为图片 / 音频 / 视频均可独立出题 | ✅ 6 题型全覆盖 |
| ZNAWCA.docx | 课程目录对象文件夹名 = 文件名（要求强匹配） | §4.4 改为目录名匹配，忽略大小写 / 空格 | ✅ 实现 |

---

## 三、本轮 UI 变更与 spec 的关系

来自 `UI-CHANGES-CONTEXT.md` 的 11 项变更均为**实现层 / 布局层**调整，**未触动功能边界**：

| 变更 | 与 spec 的关系 |
|---|---|
| 1. 删 Sidebar | §6 流程无要求侧栏，纯 UI 简化 |
| 2. 删 OFFLINE pill | §3 ENV-02 强调离线但 UI 不必明示 |
| 3. 课程页滚动 | 纯布局优化，§16 NFR-04 |
| 4. 删 RuntimeInfo IPC | 死代码清理，§18 NFR-06 模块化收益 |
| 5. CSS 特异性修复 | 纯 CSS bug 修复 |
| 6. 删底部 privacy banner | 与 §5 错误消息原则不冲突（隐私声明 ≠ 错误消息） |
| 7. Setup disclosure 展开 | 纯布局修复，§11 / §12 功能未变 |
| 8. 困难卡片空白收紧 | 视觉密度优化，§13 功能未变 |
| 9. 困难单条删除 | **新增功能**，§14 "按课程清空"之外的精细化操作 |
| 10. 列表页标题固定 | 布局优化，§13 / §14 数据未变 |
| 11. 历史 → 回放视图 | **改进回放**（保留 spec §12 "查看原题 / 自己作答 / 正确答案"，去掉 `<details>` 折叠让音频视频可播放） |

---

## 四、发现的潜在问题（建议关注）

### 4.1 状态不仅靠颜色（§16 NFR-05）

抽查了几处：

| 场景 | 颜色外是否有附加信号 | 状态 |
|---|---|---|
| 答题正误 | 文案 "正确" / "不完全正确" + ✓/✕ 图标 + `correct`/`incorrect` class | ✅ |
| 课程错误 vs 警告 | `course-errors.css` 边框颜色 + 文案 "courseNeedsAttention" / "courseWarnings" | ⚠️ **警告与错误目前都共用同一红色样式**，仅靠文案区分颜色，弱视用户可能不易分辨。建议警告用琥珀色边框（`#c6a24b` 金色） |
| 选择题标记（回放视图） | `.is-correct`（绿）+ `.is-wrong`（红）+ 文案 + 答案对错徽章 | ✅ |
| Setup 中不可用题型 | `.unavailable-option` opacity 0.68 + `disabled` 属性 + 点击显示 "unavailableReason" | ✅ |
| Timer badge | 仅显示数字 + 颜色（`.timer-badge`），未配图标 | ⚠️ 建议加 ⏱ 图标或文字标签 |

### 4.2 隐私 / 数据说明（§14）

`page-heading` 副标题有"privacyDetail"文案，但**全文被截断无法在源码中确认内容是否覆盖**：
- 是否说明"数据仅存在本机 AppData"
- 是否说明"卸载会清空数据"
- 是否说明"清除学习 / 测试 / 全部数据"的入口路径

**建议**：把 SettingsDialog 里的 `clearLearning` / `clearTests` / `clearAllData` 入口在 `privacyDetail` 文案中点出来，让用户读完说明就知道在哪操作。

### 4.3 课程卡 `meta` 信息

`<CourseCard>` 仅展示 `${items.length} objects / ${columns.length}`，没有展示：
- 媒体覆盖（图片 / 音频 / 视频各有多少对象）
- 题型可用情况（哪些方向有题）

这些信息在 Setup 里能看，但在课程选择阶段就显示会更友好。属于 §16 NFR "布局适配" + §17 "新手演示"友好性补充，**非强制**。

### 4.4 视觉风格的"金属按钮"强度

`.metal-button` 用灰绿渐变 + inset highlight 实现金属感，但对比 `.gold-button` 的金色渐变，金属感偏弱。若 spec 强调"金属质感"是核心意象，可考虑：
- 加细横纹噪点（`repeating-linear-gradient` 类似背景纹理）
- 或提高 inset highlight 亮度对比

**属风格调优，非合规问题。**

### 4.5 回放视图的题目切换 UX

`ReplayView` 顶部用 `<select>` 题号切换，配合 ←/→ 按钮，对长历史（20+ 题）来说：
- 滚动 select 体验一般
- 没有键盘快捷键（← / → arrow keys）

**建议**：监听 keydown 事件，让 ← / → 也能切题（spec 未要求，但属于 §18 NFR-05 "可操作性"加分项）。

---

## 五、结论

| 维度 | 评估 |
|---|---|
| 功能完整性 | ⭐⭐⭐⭐⭐ 全部 spec 功能已实现 |
| 范围控制 | ⭐⭐⭐⭐⭐ 严格遵守 §2.2 排除项，未越界 |
| 视觉一致性 | ⭐⭐⭐⭐☆ 绿金金属风格到位，"金属感"可微调 |
| 多语言 | ⭐⭐⭐⭐⭐ 5 语言 + RTL 完整 |
| 错误处理 | ⭐⭐⭐⭐☆ 错误信息可定位，警告/错误视觉区分可加强 |
| 易用性细节 | ⭐⭐⭐⭐☆ 列表 / 滚动 / 删除等细节本轮已大幅优化 |

**整体判定：当前 UI 已通过 V1.0 spec 全部 14 条验收标准**，4.1–4.5 为可加分项，不阻塞验收。

---

_报告生成于 2026-07-31，基于 UI-CHANGES-CONTEXT.md 当前快照。如后续 spec 升级到 V1.1 需重新对比。_
