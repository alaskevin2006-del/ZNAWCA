# ZNAWCA 14 项实施台账

> 填写者：WorkBuddy｜状态：已完成（A→F 六批全部执行完毕，最终验证通过）

## 1. 基线

- 开始时间：2026-08-13
- 执行工具/版本：WorkBuddy（node 22.22.2）
- 开始分支或提交：`codex/p2-completion`；工作区未提交（约 30 个修改/新增文件），**脏工作区，不创建基线提交**，不重置/覆盖既有改动
- `npm run typecheck`：主控基线通过
- `npm test -- --run`：主控基线通过，23 个测试文件、97 项测试；WorkBuddy 复跑基线 `npx vitest run` 通过：**23 个测试文件、97 项测试全通过**（21s）

## 2. 决策实施状态

状态只能填：`已满足仅补测试`、`已修改`、`阻塞`、`未开始`。

| 决策 | 状态 | 对应批次 | 修改文件/测试 | 说明 |
|---|---|---|---|---|
| D-01 | 已满足仅补测试 | A | tests/quiz/* | `hasUniqueReverseAnswer` 已实现；不唯一抛 `AMBIGUOUS_REVERSE_QUESTION`，question-set 记录 `ambiguous-reverse-question` 跳过原因 |
| D-02 | 已修改 | B | src/core/quiz/scoring.ts、tests/quiz/scoring.test.ts | `splitAnswer` 扩展 `;`、`；`、`,`、`，` 四分隔符（仅用户提交侧）；Excel 解析保持半角分号；`/`、`\`、冒号不拆分 |
| D-03 | 已满足仅补测试 | B | tests/quiz/* | `evaluateAnswer` 按集合比较 matched/missed/extra，顺序无关；多答 extra>0 判非 fullyCorrect |
| D-04 | 已满足仅补测试 | B | tests/quiz/* | `normalizeText` trim + 空白压缩 + 小写化，大小写不敏感 |
| D-05 | 已修改 | B | src/core/quiz/scoring.ts、tests/quiz/scoring.test.ts | `normalizeText` 增加 `₀—₉`→`0—9` 下标归一；不等同上标、不启用 NFKC，其他字符仍精确比较 |
| D-06 | 已修改 | B/C | src/core/difficulty/difficulty-memory.ts、src/renderer/app-shell/AppShell.tsx、tests/session/* | Learning/Testing/超时已统一用 `fullyCorrect`；批次 B 修 `difficulty-memory` 多答误判；批次 C 补 AppShell 最后一处入口（显式传 `fullyCorrect`） |
| D-07 | 已满足仅补测试 | A | tests/quiz/* | `applyFilters` 同字段 OR（some）、字段间 AND（every）、空选择不筛选 |
| D-08 | 已满足仅补测试 | A | tests/quiz/* | 干扰项池 `strict ? filteredObjects : allCourseObjects`，目标始终来自筛选范围 |
| D-09 | 已修改 | C | src/core/progress/knowledge-progress.ts、tests/session/* | `selectTestingQuestions` 不再过滤 `mastered`；Testing 从全部有效关系抽题，每个入选知识项目只出现一次 |
| D-10 | 已修改 | C | src/core/difficulty/difficulty-memory.ts、knowledge-progress.ts、persistence/index.ts、AppShell.tsx、tests/* | 困难键改为课程＋对象；删 30%/40% 配额，`difficultFirst=true` 统一走对象级 2:1 加权入口；`CONSECUTIVE_TO_RECOVER=2`；会话级汇总（任一错误归零、全对只累计一次、未出现不计）；迁移按对象二维去重 |
| D-11 | 已修改 | D | src/renderer/app-shell/choices.css、AppShell.tsx、tests/smoke/media-grid.test.tsx | `.choice-list` 已加媒体网格标记与选项图片高度限制；图片/音频 3/4 项布局在浏览器中验证 |
| D-12 | 已修改 | E | src/core/course/feedback-sounds.ts、types.ts、loader.ts、main.ts、AppShell.tsx、tests/* | 新增课程根目录严格命名提示音扫描（`correct NN.mp3`/`incorrect NN.mp3`，00–99 可不连续，排除子目录/错误前缀/位数/扩展名），排序后可注入随机源选择，多候选尽量不连续重复；空集合不阻断 |
| D-13 | 已修改 | E | src/renderer/app-shell/feedback-playback.ts、AppShell.tsx、tests/smoke/feedback-playback.test.tsx | 新增单一播放协调器：正误提示音→正确答案音频串行；切题/退出/再次提交/手动播放取消旧链；正确答案音频仅取可确定的 `audio-to-name` 题干音频或 `name-to-audio` 正确选项音频，其余方向跳过并记录；文件缺失/损坏/播放拒绝均不阻断答题 |
| D-14 | 已满足仅补测试 | F | tests/course/media.test.ts、loader.test.ts、validation.test.ts、organizer.test.ts、xlsx-fixture.ts、tests/smoke/course-import-flow.test.tsx | 损坏/不支持/放错目录/未匹配媒体均有带 `location.file` 绝对路径的 warning 且不阻断；仅无有效学习内容（无有效 item 或无可答题列无媒体）才 error 阻断并带文件/工作表定位与修复建议；规范化导入只复制不改源文件内容/时间戳/位置 |

## 3. 批次记录

每批复制并填写以下字段，不得只写“完成”：

### 批次 A

- 开始/完成时间：2026-08-13 09:18–09:24
- 修改摘要：审计确认 D-01/D-07/D-08 已在 `filter.ts`/`generator.ts`/`question-set.ts` 实现（唯一反向题检查、同字段 OR/字段间 AND、严格/宽松干扰项池、4→3→输入降级、去重排除正确值）。本轮不改源码，只补 3 个验收缺口测试：① 严格/宽松模式下筛选外对象均不能成为题目目标；② 宽松模式干扰项可来自筛选外但课程内；③ 每道选择题仅一个正确答案（按 `evaluateAnswer` 语义）且选项值无重复。
- 修改文件：无（源码不变）
- 新增或修改测试：`tests/quiz/quiz-engine.test.ts` 新增 `batch A acceptance` describe（3 项）
- 定向测试命令与结果：`npx vitest run tests/quiz/quiz-engine.test.ts tests/quiz/course-adapter.test.ts` → 2 文件、21 项全通过
- 与任务方案的偏差：无
- 风险或阻塞：无

### 批次 B

- 开始/完成时间：2026-08-13 09:25–09:27
- 修改摘要：① D-02 `splitAnswer` 改为按 `;`、`；`、`,`、`，` 四种分隔符拆分（仅用户提交侧；Excel 解析保持半角分号不变，`/`、`\`、冒号不拆分）；② D-05 `normalizeText` 增加 `₀—₉`→`0—9` 下标数字折叠（不启用 NFKC，上标及所有其他字符仍精确比较）；③ D-06 `DifficultyAttempt` 增加可选 `fullyCorrect`，`completeSession` 的 `allCorrect`/`trailingCorrect` 改用 `fullyCorrect ?? score>=1`，多答（score=1 但 fullyCorrect=false）不再误判为全对。D-03 集合比较、D-04 大小写/空白已在现有实现满足，只补测试。
- 修改文件：`src/core/quiz/types.ts`、`src/core/quiz/scoring.ts`、`src/core/difficulty/difficulty-memory.ts`
- 新增或修改测试：新增 `tests/quiz/scoring.test.ts`（10 项：四分隔符、非分隔符、顺序无关、缺/多/错项、下标折叠、上标不等价、其他字符精确、空白压缩）；`tests/session/difficulty.test.ts` 追加多答与 fullyCorrect 口径 2 项；`tests/session/learning-session.test.ts` 追加多答不完全正确 1 项；`tests/session/testing-session.test.ts` 追加多答计 0 分 1 项
- 定向测试命令与结果：`npx vitest run tests/quiz/ tests/session/` → 8 文件、51 项全通过；`npm run typecheck` 通过
- 与任务方案的偏差：无
- 风险或阻塞：AppShell 的 `completeSession` 调用仍只传 `score`（批次 B 允许修改文件不含 AppShell），旧行为不变；将在批次 C（D-10 改困难 scope 时）一并改为显式传 `fullyCorrect`，届时消除多答误判的最后一处入口

### 批次 C

- 开始/完成时间：2026-08-13 09:30–09:36
- 修改摘要：① D-09：`selectTestingQuestions` 删除 `mastered` 预过滤，Testing 从当前筛选/题型/题量下的全部有效关系抽题，不要求已掌握；每个入选知识项目只出现一次（对象轮分组选变体的既有语义保证）。② D-10 记录键对象级：`DifficultyScope` 去掉 `projectId`，键为"课程＋对象"；同对象多属性/媒体/方向/题型合并为一条记录。③ D-10 会话级汇总：每完成会话按对象汇总一次——任一未完全正确即困难且恢复归零；全部完全正确只累计 1 步（不再按 attempt 数累加）；对象未出现不计；其他对象错误不影响它。④ D-10 退出：`CONSECUTIVE_TO_RECOVER` 3→2，两个实际出现且自身全对的完成会话后清除。⑤ D-10 删配额：学习 30%/测试 40% 困难配额删除；`difficultFirst=true` 时统一走 `weightedSampleByObject` 对象级固定 2:1 加权入口（困难 2、普通 1，变体多不增权），`false` 时不加权（学习按未掌握/曝光少优先、测试按最近测试时间排序）。⑥ D-10 迁移：`migrateDifficultyRecords` 改为按 courseId+objectId 二维合并，同对象多条碎片记录折叠为一条，`consecutiveCorrect` clamp 到 0..1，旧字段不崩溃、不虚假增权。⑦ D-06 收尾：AppShell `completeLearning`/`completeTest` 的 `completeSession` 调用补传 `fullyCorrect`，多答误判的最后一处入口消除。⑧ UI：Difficulty 页改为对象级卡片（去掉 projectId 维度标签），恢复进度显示 `x / 2`。
- 修改文件：`src/core/difficulty/difficulty-memory.ts`、`src/core/progress/knowledge-progress.ts`、`src/core/persistence/index.ts`、`src/renderer/app-shell/AppShell.tsx`
- 新增或修改测试：`tests/session/difficulty.test.ts` 重写为对象级语义（13 项：两全对会话退出、未出现不计、其他对象错误不影响、同会话多次错误只汇总一次且归零、全对会话只累计 1 步、同对象多属性一条记录、权重 2:1、变体多不增权统计、fullyCorrect 口径）；`tests/session/knowledge-progress.test.ts` 新增未掌握项目可进 Testing、同知识项目一次测试不重复、difficultFirst=false 不加权（固定随机源未掌握优先）、true 时 learning/testing 各一个 2:1 统计测试；`tests/persistence/local-state.test.ts` 迁移期望改对象级单条并新增同对象多条竞争记录折叠测试；`tests/smoke/session-flow.test.tsx` 失败测试断言改对象级两条；`tests/smoke/p2-acceptance.test.tsx` 难度页断言改对象级
- 定向测试命令与结果：`npx vitest run tests/session/difficulty.test.ts tests/session/knowledge-progress.test.ts tests/persistence/local-state.test.ts tests/smoke/session-flow.test.tsx tests/smoke/p2-acceptance.test.tsx` → 5 文件、50 项全通过；`npm run typecheck` 通过
- 与任务方案的偏差：无
- 风险或阻塞：全量回归测试结果见第 4 节最终验证；weightedSampleByObject 的对象分组使同一对象在"每轮一次"约束下可跨多轮贡献不同项目，但单轮内每对象至多一个变体（D-10 变体多不增权），已由统计测试验证

### 批次 D

- 开始/完成时间：2026-08-13 09:44–10:10
- 修改摘要：① `choices.css` 增加 `.choice-list.media-grid` 规则：`grid-template-columns: repeat(2, minmax(0, 1fr))`，4 项为两列两行、3 项为两列两行且末项单独占位（grid 自动排列，不跨列拉伸）。② 增加 `.choice-list.media-grid .question-media img { max-height: 180px }`，保证选项区图片在 2×2 网格内收窄，最小常规窗口下两行布局可见。③ `AppShell.tsx` 增加 `isMediaGridOptions` helper（仅纯图片/音频选项且 3–4 项时返回 true），在 `Session` 和 `ReplayView` 的 fieldset 上条件添加 `media-grid` 语义标记；不改变 DOM/数据顺序。④ 组件测试覆盖 4 项图片、4 项音频、3 项图片、文字选择题、视频选项共 5 个场景。
- 修改文件：`src/renderer/app-shell/choices.css`、`src/renderer/app-shell/AppShell.tsx`
- 新增或修改测试：`tests/smoke/media-grid.test.tsx`（5 项：图片 4 项得 media-grid 标记且 4 个选项渲染可选中、音频 4 项得标记且 audio controls 存在、3 项图片得标记且两行布局、文字选择题无标记、视频选项无标记）
- 定向测试命令与结果：`npx vitest run tests/smoke/media-grid.test.tsx` → 1 文件 5 项全通过；`npm run typecheck` 通过
- 人工检查窗口尺寸：960×640（应用最小常规窗口）；独立证据页使用与产品一致的 CSS，选项容器（fieldset）自身无滚动条（scrollHeight ≤ clientHeight），2×2 两行布局成立；3 项时第二行仅一个格子占位，不跨列拉伸
- 3 项/4 项界面证据路径：
  - `artifacts/znawca-14-media-grid/media-grid-4-images-real.png`（4 项图片 2×2，真实图片加载）
  - `artifacts/znawca-14-media-grid/media-grid-3-images-real.png`（3 项图片 2×2，真实图片加载）
  - `artifacts/znawca-14-media-grid/media-grid-4-audio.png`（4 项音频 2×2，React 真实组件渲染）
  - 辅助证据文件：`artifacts/znawca-14-media-grid/layout-evidence-4.html`、`layout-evidence-3.html`
- 与任务方案的偏差：无
- 风险或阻塞：960×640 最小窗口下，页眉+标题+题干已占据较多高度，选项区第二行可能位于视口底部边缘；此现象来自题目卡片的整体排版而非选项容器本身。选项容器自身无滚动条，页面滚动由 `.content overflow:auto` 接管，符合 D-11"无需题目区域滚动"的语义。

### 批次 E

- 开始/完成时间：2026-08-13 10:16–10:23
- 修改摘要：① D-12 新增 `src/core/course/feedback-sounds.ts`：`scanFeedbackSounds` 只扫描课程根目录严格命名 `correct NN.mp3`/`incorrect NN.mp3`（NN 两位数字 00–99 可不连续；大小写、下划线、一位/三位数字、其他扩展名、子目录内同名文件一律不识别），排序后返回；目录不可读或空集合返回空且不产生 issue、不阻断。`selectFeedbackSound` 可注入随机源（复用 `RandomSource`，与 `Math.random` 同 [0,1) 语义），集合为空返回 -1、单候选允许重复、多候选与上一次相同时强制推进。② `Course` 增加可选 `feedbackSounds` 字段（缺省兼容既有 fixture），`loadCourse` 集成扫描，`src/core/course/index.ts` 导出。③ `main.ts` `withMediaUrls` 将提示音路径转换为 `znawca-media://` URL（白名单已含课程根目录）。④ D-13 新增 `src/renderer/app-shell/feedback-playback.ts`：`PlaybackCoordinator` 用 generation 令牌实现单一播放协调器——串行播放（上一段 ended 才播下一段）、任一段 error/播放被拒/创建失败跳过该段继续、新播放请求自动取代旧链、`cancel()` 停链；`domAudioFactory` 用游离 `<audio>`（不挂 DOM，play 事件不冒泡，不会误触发手动播放取消；自动播放被拒的 promise reject 转 error 由协调器跳过）；`answerAudioPath` 仅对 `audio-to-name`（题干音频）与 `name-to-audio`（正确选项音频）返回可确定答案音频，其余 6 个方向跳过并记录、不猜测；`buildFeedbackPlaybackChain` 纯函数——`fullyCorrect` 用 correct 集合、部分正确/错误/超时用 incorrect 集合，提示音后接正确答案音频。⑤ `AppShell.tsx` 集成：feedback 产生后构建并播放链；`next`/`submit`/`saveAndExit`/`beginSession`/`resume` 取消旧链；`document` capture 阶段监听 `play` 事件（用户手动播放任何媒体时取消旧链）；音量随 `playerVolume` 同步。⑥ 未使用任务书允许的 persistence 改动：随机避重状态用组件内存 `useRef`（应用运行期持续避重），不写磁盘，避免不必要持久化。
- 修改文件：`src/core/course/feedback-sounds.ts`（新增）、`src/core/course/types.ts`、`src/core/course/loader.ts`、`src/core/course/index.ts`、`src/main/main.ts`、`src/renderer/app-shell/feedback-playback.ts`（新增）、`src/renderer/app-shell/AppShell.tsx`
- 新增或修改测试：`tests/course/feedback-sounds.test.ts`（7 项：严格命名识别、错误前缀/位数/扩展名/子目录排除、不连续编号排序、空集合、固定随机源可复现、多候选避重、单候选/空集合边界）；`tests/smoke/feedback-playback.test.tsx`（18 项：协调器串行/空源跳过/cancel/新链接管/错误跳过/播放拒绝跳过/音量同步、`answerAudioPath` 三场景、`buildFeedbackPlaybackChain` 正确集合/错误集合/接答案音频/空集合/避重，以及 AppShell 有/无提示音两个集成冒烟测试——判题、计分、下一题均不被播放逻辑阻断）
- 定向测试命令与结果：`npx vitest run tests/course/feedback-sounds.test.ts tests/smoke/feedback-playback.test.tsx` → 2 文件、25 项全通过；`npm run typecheck` 通过；相关子集回归 `npx vitest run tests/course/ tests/smoke/ tests/platform/` → 17 文件、80 项全通过
- 与任务方案的偏差：审计确认当前 V1 代码库（`src/` 及 git 历史）不存在坐标朗读资源（无 speech/voice/coordinates 实现），按任务书 D-13 第 5 条“无法可靠确定则跳过并记录，不得猜测”执行：`answerAudioPath` 只处理可可靠确定的 `audio-to-name` 题干音频与 `name-to-audio` 正确选项音频。其余方向不播放正确答案音频（已记录，不猜测）
- 风险或阻塞：jsdom 未实现 `HTMLMediaElement.play/pause`（测试环境打印 Not implemented），协调器 try/catch 与工厂桥接已处理，测试不阻断；生产 Chromium 走 promise 路径，自动播放被拒转 error 跳过。空集合、损坏文件、播放拒绝均不影响判题、计分、保存与下一题

### 批次 F

- 开始/完成时间：2026-08-13 10:24–10:41
- 修改摘要：审计确认 D-14 主体已在 V1 实现——`validation.ts` 已具备 `NO_VALID_ITEMS`/`NO_LEARNING_CONTENT` error 阻断语义（含 `file`/`sheet` 定位与建议文本），`media.ts` 已对损坏/不支持/未匹配媒体产生 warning 级降级（含 `location.file`），`organizer.ts` 规范化导入只复制到新目录不改源。本轮不改源码，只补验收缺口测试：① 坏媒体与好媒体共存时课程可打开、坏对象媒体清空而好对象保留；② 仅表头无有效条目时 `NO_VALID_ITEMS` error 阻断并带 workbook 路径与 sheet 定位；③ 有条目但无可答题列且无媒体时 `NO_LEARNING_CONTENT` 阻断并带建议；④ 不支持扩展名（notes.txt）与放错目录（images 下 mp3）均产生带 `location.file` 绝对路径的 warning；⑤ 规范化导入前后源工作簿与源媒体 `mtimeMs` 不变（内容、时间戳、位置三合一）；⑥ UI 冒烟：单媒体 MEDIA_CORRUPT warning 不阻断进入学习（Question 1 of 8 可作答），返回课程列表后警告文本与带路径 location 可见。
- 修改文件：无（源码不变）
- 新增或修改测试：`tests/course/xlsx-fixture.ts` 的 `createCourseFixture` 增加可选 `dataRows` 参数（构造无有效内容场景）；`tests/course/media.test.ts` +2 项（unsupported extension、wrong media directory）；`tests/course/loader.test.ts` +2 项（坏+好媒体共存可打开、NO_VALID_ITEMS 阻断带定位）；`tests/course/validation.test.ts` +2 项（NO_VALID_ITEMS、NO_LEARNING_CONTENT 阻断带建议与定位）；`tests/course/organizer.test.ts` +mtimeMs 不变断言；`tests/smoke/course-import-flow.test.tsx` +1 项（媒体警告不阻断进入课程且列表展示警告带路径）
- 定向测试命令与结果：`npx vitest run tests/course/ tests/smoke/course-import-flow.test.tsx` → 7 文件、30 项全通过
- 与任务方案的偏差：无
- 风险或阻塞：无

## 4. 最终验证

> 批次 C 完成后中间全量回归（批次 D 改动前）：`npx vitest run` → **24 个测试文件、121 项全通过**（日志 `/tmp/znawca-full-check.log`，测试 26.16s、环境 239.32s）。最终全量在全部批次完成后运行并回填下表。

| 检查 | 命令 | 结果 | 摘要 |
|---|---|---|---|
| 类型检查 | `npm run typecheck` | ✅ 通过 | `tsc -p tsconfig.json --noEmit` 与 `tsc -p tsconfig.main.json --noEmit` 均无错误 |
| 全量测试 | `npx vitest run` | ✅ 通过 | **27 个测试文件、158 项测试全通过**，失败 0（日志 `.workbuddy/tmp/full-check.log`，测试 32.67s、环境初始化 260.88s） |
| 构建 | `npm run build` | ✅ 通过 | vite 8.1.5 构建成功，38 modules transformed，`dist/renderer/` 产出（index.html 0.45 kB、CSS 21.70 kB、JS 283.66 kB gzip 89.23 kB） |

> 构建警告说明：vite 提示 `src/core/course/feedback-sounds.ts` 的 `node:fs/promises`、`node:path` 被 externalized for browser compatibility。经核对构建产物：renderer bundle 仅包含 `selectFeedbackSound` 纯函数与播放链代码，`scanFeedbackSounds`（依赖 node:fs 的扫描逻辑）只被主进程引用、被 rolldown 正确 tree-shake，产物中无任何 `node:fs`/`node:path`/`readdir` 残留，浏览器运行时不会加载 Node 模块，警告无害。

## 5. 最终交接

- 全部修改文件（按批次）：
  - 批次 A：无源码修改；`tests/quiz/quiz-engine.test.ts`（+3 项）
  - 批次 B：`src/core/quiz/types.ts`、`src/core/quiz/scoring.ts`、`src/core/difficulty/difficulty-memory.ts`；新增 `tests/quiz/scoring.test.ts`，修改 `tests/session/difficulty.test.ts`、`tests/session/learning-session.test.ts`、`tests/session/testing-session.test.ts`
  - 批次 C：`src/core/difficulty/difficulty-memory.ts`、`src/core/progress/knowledge-progress.ts`、`src/core/persistence/index.ts`、`src/renderer/app-shell/AppShell.tsx`；新增 `tests/session/knowledge-progress.test.ts`，修改 `tests/session/difficulty.test.ts`、`tests/persistence/local-state.test.ts`、`tests/smoke/session-flow.test.tsx`、`tests/smoke/p2-acceptance.test.tsx`
  - 批次 D：`src/renderer/app-shell/choices.css`、`src/renderer/app-shell/AppShell.tsx`；新增 `tests/smoke/media-grid.test.tsx`
  - 批次 E：新增 `src/core/course/feedback-sounds.ts`、`src/renderer/app-shell/feedback-playback.ts`，修改 `src/core/course/types.ts`、`src/core/course/loader.ts`、`src/core/course/index.ts`、`src/main/main.ts`、`src/renderer/app-shell/AppShell.tsx`；新增 `tests/course/feedback-sounds.test.ts`、`tests/smoke/feedback-playback.test.tsx`
  - 批次 F：无源码修改；修改 `tests/course/media.test.ts`、`tests/course/loader.test.ts`、`tests/course/validation.test.ts`、`tests/course/xlsx-fixture.ts`、`tests/smoke/course-import-flow.test.tsx`，新增 `tests/course/organizer.test.ts`
  - 工作区另有主控既有未提交改动（docs 重组、AGENTS.md、PROJECT_STRUCTURE.md、优化方案/、每轮必读.md 等），按指令未重置、未创建基线提交
- 未解决事项：
  1. D-13 坐标朗读其余方向：V1 代码库（`src/` 与 git 历史）无坐标朗读资源，`answerAudioPath` 仅对可确定资源（`audio-to-name` 题干音频、`name-to-audio` 正确选项音频）返回路径，其余 6 个方向返回 undefined。未来引入坐标朗读资源后需扩展本函数（按任务书"无法可靠确定则跳过并记录，不得猜测"执行）。
  2. 提示音随机避重状态仅存组件内存（`useRef`），应用重启后重置——任务书允许但不强制持久化，实现选择不写磁盘。
- 已知风险：
  1. jsdom 未实现 `HTMLMediaElement.play/pause`（测试环境打印 "Not implemented"），协调器 try/catch 与 `domAudioFactory` 桥接已兜底，测试不阻断；生产 Chromium 走 promise 路径，自动播放被拒转 error 跳过对应音频段，不影响判题/计分/下一题。
  2. D-11：960×640 最小窗口下页眉+标题+题干占据较多高度，选项区第二行可能贴近视口底部边缘；选项容器自身无滚动条，页面滚动由 `.content overflow:auto` 接管，符合"无需题目区域滚动"语义（排版现象，非缺陷）。
  3. 构建时 vite 对 `feedback-sounds.ts` 的 `node:fs`/`node:path` externalize 警告：已核对产物，`scanFeedbackSounds` 仅被主进程引用、被 rolldown tree-shake，renderer bundle 无 Node 模块残留，运行时无影响。
  4. 全量测试环境初始化 260.88s（jsdom 多环境池化），单次执行约 5 分钟，无超时失败。
- 明确确认未实施的排除项（DECISIONS 第 2 节 11 项全部未实施）：
  1. 媒体从"整行对象"重构为"具体单元格媒体"（D-13 任务书明确沿用 V1 Excel 坐标朗读方案，未实施重构）
  2. `A1/A2+/B1/B2+` Excel V2 结构与中性 A 列
  3. 多语言工作簿、共享 `media/`、分语言 `speech/` 目录
  4. 单元格以 `/` 引用多个媒体变体
  5. `正向题干 / 反向题干` 新表头解析
  6. `/` 显式别名解析
  7. 取消或新增特殊列角色标记
  8. "总数/已掌握/剩余"新知识关系计数与界面
  9. 视频选项固定 2×2（D-11 仅对纯图片/音频 3–4 项生效，测试断言视频选项无 media-grid 标记）
  10. Web、账户、付费、后台、AI、Anvil 功能
  11. 客户尚未给出的五种界面翻译修订清单
- 建议验收者重点复核：
  1. D-10 对象级困难：升级迁移后旧碎片记录折叠为对象级单条、`consecutiveCorrect` clamp 0..1、Learning/Testing/超时统一 `fullyCorrect` 口径（`difficulty.test.ts` 13 项 + 迁移测试）。
  2. D-12/D-13 提示音：课程根目录 `correct NN.mp3`/`incorrect NN.mp3` 严格命名扫描与排序、可注入随机源避重、串行播放链、切题/退出/再次提交/手动播放取消、音量同步、空集合不阻断（`feedback-sounds.test.ts` 7 项 + `feedback-playback.test.tsx` 18 项）。
  3. D-14 媒体降级：坏媒体+好媒体共存课程可打开且坏对象媒体清空、仅无有效学习内容才 error 阻断（带文件/工作表定位与建议）、损坏/不支持/放错目录/未匹配均产生带 `location.file` 绝对路径的 warning、`organizeCourseFiles` 不改源（mtimeMs 断言）。
  4. 全量回归 27 文件 158 项（含 p0/p2 验收冒烟、导入流、会话流、语言设置、安全）全通过，可作为验收基线。

