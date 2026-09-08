# ZNAWCA 14 项独立验收记录

> 填写者：独立 GPT 验收对话框｜状态：验收不通过，待项目主控退回 WorkBuddy

## 1. 验收规则

1. 已按 `README.md` 指定顺序完整读取 `DECISIONS.md`、`WORKBUDDY-TASKS.md`、`CHANGELOG.md` 和本模板。
2. 本次独立检查当前工作区代码、相对 `HEAD` 的差异、自动测试、构建、开发渲染启动和 960×640 界面布局；未以 WorkBuddy 台账代替证据。
3. 验收期间未修改源码、测试、需求或决策文件；只填写本文件。
4. 每项只判定：`通过`、`不通过`、`阻塞`。
5. 任一排除项被实现、测试被削弱、无关文件被大范围改写，整体不得通过。

## 2. 交付范围审查

- 验收时间：2026-08-15（Asia/Shanghai）
- 验收基线/提交：分支 `codex/p2-completion`，`HEAD=e448334342fb8493bb300c386410d69af5972371`；验收对象为该提交上的脏工作区，没有 WorkBuddy 独立交付提交或批次前补丁快照。
- WorkBuddy 台账是否完整：是。D-01～D-14、A～F 六批、最终命令、风险和界面证据路径均已填写。
- 是否存在未说明的源码改动：相对 `HEAD` 存在台账未列入本批的源码/测试差异，例如 `src/core/localization/index.ts`、`src/core/quiz/course-adapter.ts`、`src/core/session/testing-session.ts`、`src/preload/*`、`app-shell.css`、`settings.css` 等；这些文件当前修改时间为 2026-07-31，早于 2026-08-13 批次，和“批次开始前已有改动”的说明一致，未发现它们由本批新增的直接证据。由于没有干净基线提交或批次前 diff，无法独立完成逐字节归因。
- 是否触碰排除项：未发现。`/` 未成为答题分隔符或别名解析；未发现 Excel V2、中性 A 列、多语言/共享媒体目录、单元格媒体变体、新双向表头、特殊列角色调整、新关系计数、视频 2×2、Web/账户/付费/AI/Anvil 或五语翻译清单实现。
- 是否保留用户既有改动：`阻塞`。现有旧改动仍在，且未见 reset/checkout 痕迹；但 WorkBuddy 在已有改动的 `AppShell.tsx`、`persistence/index.ts` 等文件上继续编辑，批次前没有可比快照，无法证明原有 hunks 均未被覆盖。
- 是否削弱既有测试：是。`tests/session/difficulty.test.ts` 重写时删除了原有“同一 objectId 在不同 courseId 之间相互独立”的断言；新测试只覆盖同课程内不同对象。D-10 的记录键明确是“课程＋对象”，该独立维度失去直接回归保护。其余本批新增测试总体增加了行为断言，没有发现用空断言或仅验证函数调用来冒充结果验证。
- 是否产生可归因的无关修改：未发现明确可归因于 2026-08-13 本批的无关源码文件；但因缺少批次前快照，不能作绝对结论。

## 3. 决策逐项验收

| 决策 | 结果 | 自动测试证据 | 代码/人工证据 | 问题 |
|---|---|---|---|---|
| D-01 歧义反向题跳过 | 通过 | `tests/quiz/quiz-engine.test.ts` 覆盖歧义反向题抛错、题集记录 `ambiguous-reverse-question`，全量测试通过。 | `src/core/quiz/generator.ts:111` 在生成反向题前调用唯一性检查；`:200` 按候选对象归一化签名计数；`question-set.ts:133` 转为明确跳过原因。正向题生成路径未受该检查影响。 | 无。 |
| D-02 四种答题分隔符 | 通过 | `tests/quiz/scoring.test.ts` 验证 `;；,，`，并验证 `/`、`\`、冒号不拆分。 | `src/core/quiz/scoring.ts:13-24` 只在用户提交解析中使用四字符正则；Excel 仍由 `src/core/course/normalization.ts` 的半角分号规则解析。 | 无。 |
| D-03 多答案顺序无关 | 通过 | `tests/quiz/scoring.test.ts` 覆盖乱序、缺答、多答、错答；全量测试通过。 | `src/core/quiz/scoring.ts:26-43` 把期望与提交归一为集合，分别计算 matched/missed/extra，只有无漏答且无额外项才 `fullyCorrect=true`。 | 无。 |
| D-04 大小写与空格容错 | 通过 | `tests/quiz/scoring.test.ts` 覆盖大小写、首尾空格和连续空白。 | `src/core/quiz/types.ts:81-89` 执行 trim、连续空白压缩和小写化；未做拼写或语义纠错。 | 无。 |
| D-05 化学式下标数字 | 通过 | `tests/quiz/scoring.test.ts` 验证 `H₂O=H2O`、`x²≠x2`，并保留其他字符精确差异。 | `src/core/quiz/types.ts:76-89` 只折叠 U+2080～U+2089；未使用 NFKC，也未折叠上标。 | 无。 |
| D-06 完全正确口径统一 | 通过 | `learning-session.test.ts`、`testing-session.test.ts`、`difficulty.test.ts` 分别覆盖多答未完全正确；Testing 超时测试产生 `fullyCorrect=false`；全量测试通过。 | `LearningSession.answer` 以 `evaluation.fullyCorrect` 决定重做；`TestingSession.summary` 只按完全正确计分；`AppShell.tsx:311-316,342-347` 向困难汇总显式传入 `fullyCorrect`。 | 无。 |
| D-07 范围与 `#` 筛选 | 通过 | `quiz-engine.test.ts` 覆盖同字段 A/B 并集和跨字段交集；`course-adapter.test.ts` 覆盖只暴露 `#` 字段。 | `filter.ts:8-18` 对字段内值用 `some`、字段间用 `every`；`course-adapter.ts:28-30` 在真实课程入口过滤空选择。 | 直接调用 `applyFilters` 传空 values 会返回空集，但产品入口先移除空选择；当前界面路径满足决策。 |
| D-08 严格/宽松干扰项 | 通过 | `quiz-engine.test.ts` 覆盖宽松从筛选外课程内取干扰项、严格不越范围、两模式目标均来自筛选范围及选项去重。 | `generator.ts:147` 只切换干扰项源；`question-set.ts:64,78` 的 target 始终从 `filteredObjects` 取得；正确项和重复项在 `generator.ts:148-169` 排除。 | 无。 |
| D-09 Testing 不限已掌握 | 通过 | `tests/session/knowledge-progress.test.ts` 覆盖未掌握项目进入 Testing、同知识项目只取一个方向/题型变体。 | `knowledge-progress.ts:137-155` 从全部 project groups 选择，没有 `mastered` 预过滤；每个 group 最终只由 `chooseVariant` 产生一题。 | 无。 |
| D-10 对象级困难逻辑 | 不通过 | 新测试覆盖对象级合并、2:1 权重、会话级归零/恢复、两次全对退出、迁移折叠；但原有跨课程隔离测试被删除，未由新测试替代。 | `difficulty-memory.ts:42-87` 当前实现按 `[courseId, objectId]` 汇总并以 2 次全对会话恢复；`:119-158` 对象级加权；`persistence/index.ts:316-409` 执行旧数据折叠。代码审查未发现当下逻辑错误。 | 测试质量未达完成门槛：D-10 核心键的 `courseId` 维度失去直接自动回归保护。返工：恢复“相同 objectId、不同 courseId 互不影响”的 DifficultyMemory 测试，并保留本批新增对象级测试。 |
| D-11 图片/音频 2×2 | 不通过 | `media-grid.test.tsx` 只验证 class、元素数、radio 和 controls，不测实际尺寸或可见性，因此未发现真实布局失败。 | CSS 确实在 `choices.css:12-18` 设置两列并限制图片高度；但用最终 CSS 在 960×640 复核时，4 项第 3/4 个 label 的 top≈598.8px、bottom≈866.8px，均超出 640px 视口；3 项最后一个同样超出。台账截图 `artifacts/znawca-14-media-grid/media-grid-4-images-real.png`、`media-grid-3-images-real.png` 和 `media-grid-4-audio.png` 也直接显示第二行被裁切。 | 不满足“同时可见”。返工：在实际 Session 整体布局（含 78px 标题栏、会话头、题干和操作区）内压缩卡片/媒体尺寸，使 3/4 项在 960×640 完整可见；增加浏览器级断言，逐项检查 `getBoundingClientRect().bottom <= innerHeight`，并验证页面/题目区域无需为看全选项而滚动。 |
| D-12 随机正误提示音 | 不通过 | `feedback-sounds.test.ts` 的严格命名、排序、随机复现和避重测试通过；但没有“通过 `loadCourse` 导入合法提示音且不产生对象媒体警告”的集成测试，也没有开发渲染启动测试。 | `feedback-sounds.ts` 的集合扫描本身正确；但 `loader.ts:51-55` 先让通用 `scanCourseMedia` 扫同一根目录，再扫描提示音。独立复现放入合法 `correct 00.mp3` 和 `incorrect 99.mp3`：两者进入 feedback 集合，同时各产生一条 `MEDIA_FILE_UNMATCHED` 警告及错误修复建议。另因 `feedback-playback.ts:1` 从顶层导入同时含 `node:fs/promises`/`node:path` 的 `feedback-sounds.ts`，官方 `npm run dev:renderer` 页面为空白，Vite 报 `Cannot access node:fs/promises.readdir in client code`。 | 合法提示音被误报，且开发渲染链回归。返工：把浏览器安全的随机选择函数与 Node 扫描器拆分；通用媒体扫描应排除严格合法的 feedback 文件；增加 loader 集成测试和 dev renderer 冒烟测试。 |
| D-13 串行音频播放链 | 不通过 | `feedback-playback.test.tsx` 的协调器单测覆盖串行、取消、新请求接管、错误/拒绝跳过和音量；纯函数测试通过。但名为“部分正确、错误、超时”的测试实际只对一个 `fullyCorrect=false` 值循环一次，未经过 AppShell 的三条真实提交/超时路径。 | `feedback-playback.ts:53-116` 的 generation 取消与串行代码审查成立，`AppShell.tsx:116-140,288-305,362-380` 接入提交、超时、切题和退出；然而最终渲染依赖图因 `feedback-playback.ts:1` 导入 Node 扫描模块而在项目官方开发启动链直接崩溃，无法在实际开发 UI 中验收播放链。 | 最终集成不可运行，不能只凭单元测试判定通过。返工：修复浏览器/Node 模块边界；增加真实 AppShell 测试，分别触发完全正确、部分正确、错误、超时并断言集合与播放顺序，以及切题/退出/手动播放取消。 |
| D-14 错误定位与降级 | 不通过 | 损坏、不支持、放错目录、坏/好媒体共存、无有效内容阻断、UI 警告展示和源文件 mtime 测试均通过；没有任务书明确要求的“缺失媒体产生可定位 warning”测试。 | `media.ts` 对现存坏文件可定位降级，`validation.ts:78-86` 只在无有效 item/内容时阻断，`AppShell.tsx:725,734-739` 展示原因、建议和位置。独立复现创建 `Known Bird/images/` 空目录后扫描结果为 `issues: []`、媒体为空；代码没有缺失路径/声明的 warning 分支。另 D-12 合法提示音被误报为对象媒体 warning，说明当前报告还会给出错误原因与错误修复建议。 | 未满足“缺失、损坏、不支持、放错目录分别可定位”的完整自动验收，且存在合法文件误报。返工：在 V1 可确定的缺失媒体语义上实现可定位 warning/题型跳过并补测试；排除合法 feedback 文件的对象媒体误报；保留现有坏/好共存及不写源文件测试。 |

## 4. 全量验证

| 检查 | 结果 | 证据 |
|---|---|---|
| `npm run typecheck` | 通过 | 独立运行 `npm.cmd run typecheck`，两个 TypeScript 配置均退出码 0。 |
| `npm test -- --run` | 通过 | 独立运行：27 个测试文件、158 项测试通过、失败 0；控制台仍打印 jsdom 未实现 `HTMLMediaElement.play/pause`。 |
| `npm run build` | 通过 | 独立运行退出码 0，38 modules transformed；仍出现 `feedback-sounds.ts` 的 `node:fs/promises`、`node:path` browser externalize 警告。生产 bundle 能完成 tree-shake，但官方开发渲染链已实测崩溃，故警告不能认定为整体无害。 |
| 图片 3/4 项布局 | 不通过 | 960×640 下第二行 bottom≈866.8px，超出视口；交付截图也显示裁切。 |
| 音频 3/4 项布局及控件 | 不通过 | 自动测试证明 4 个 controls 存在，但 `media-grid-4-audio.png` 在 960×640 下第二行未完整可见；3 项音频没有独立人工证据。 |
| 正确/错误/部分正确/超时音频链 | 不通过 | 协调器纯函数/单元测试通过；真实开发渲染因 Node 模块导入错误空白，且部分/错误/超时未分别经过 AppShell 集成断言。 |
| 坏媒体与好内容共存导入 | 通过 | `loader.test.ts` 与 `course-import-flow.test.tsx` 通过：坏媒体 warning、好媒体与文字题继续、课程可打开。 |
| 旧课程与旧本地状态兼容 | 通过 | `feedbackSounds` 为可选字段；`local-state.test.ts` 覆盖 v1/v5/v7 解析与对象级迁移，全量测试通过。 |
| 官方开发渲染启动 | 不通过 | `npm run dev:renderer` 后打开渲染页为空白；Vite 明确报 `feedback-sounds.ts:1` 访问 externalized `node:fs/promises.readdir`。 |

## 5. 最终结论

- 结论：不通过。
- 不通过项：D-10、D-11、D-12、D-13、D-14。
- 必须返工项：
  1. 修复 960×640 下图片/音频 3/4 项第二行不可见，并用真实尺寸自动验证。
  2. 拆分 Node 端提示音扫描与 renderer 可用的纯选择逻辑，恢复官方开发渲染启动。
  3. 阻止合法 `correct NN.mp3` / `incorrect NN.mp3` 被通用媒体扫描误报。
  4. 补齐 D-13 完全正确、部分正确、错误、超时四条 AppShell 集成路径及取消行为测试。
  5. 实现并测试 D-14 明确要求的缺失媒体可定位 warning/降级语义。
  6. 恢复 D-10 “课程＋对象”键中跨课程隔离的既有自动测试。
- 非阻断观察：当前没有独立 WorkBuddy 提交或批次前 diff，导致既有脏改动是否逐字节保留只能依据文件仍在、修改时间和现有差异间接判断；后续返工应先保存批次前补丁或建立可比较提交。
- 是否建议项目主控接受：否。请由项目主控退回 WorkBuddy 返工；最终接受决定仍由项目主控作出。
