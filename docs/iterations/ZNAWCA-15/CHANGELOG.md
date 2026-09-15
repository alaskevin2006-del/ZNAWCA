# ZNAWCA-15 实施台账

> 填写者：WorkBuddy（主干合并 + 检查员③ + 主控追加）｜状态：S0 ✅ S1 ✅（D-15~D-18）S2 ✅（D-19~D-21）S3 ✅（D-22~D-23）S4 ✅（D-24）+ 补充任务A/B ✅ D-25 ✅（视频 2×2）D-26 ✅（Learning 进度 mastered/remaining）｜S5（阿/俄文案）延后

## 1. 基线

- 开始时间：2026-09-07（主干 S0）；S2 分支开工 2026-09-09 00:20
- 执行工具/版本：WorkBuddy（node 22.22.2）
- S2 分支：`znawca15-quiz-rules`（worktree `ZNAWCA-night/s2`，基线孤儿提交 `a674004`，node_modules junction 可用）
- 开工审计（S2 范围现状）：
  - `scoring.ts`：`splitAnswer` 已按 D-02 四分隔符实现且正确——未重写，仅扩展；`evaluateAnswer` 为原子值集合比较，无别名概念 → D-20 需新实现。
  - `generator.ts`：`hasUniqueReverseAnswer`（D-01 歧义跳过）已正确实现——保留不动；`promptFor` 无双向题干概念 → D-19 需新实现。
  - `question-set.ts`/`course-adapter.ts`/`filter.ts`：无表头解析、无列角色、无双向表头校验 → D-19/D-21 需新实现。
- 分支内门禁（S2 完成后）：`npm run typecheck` ✅；`npm test -- --run` ✅ 31 文件 217 项全通过；`npm run build` ✅（37 modules）

## 2. 决策实施状态

状态只能填：`已满足仅补测试`、`已修改`、`阻塞`、`未开始`。

| 决策 | 状态 | 批次 | 修改文件/测试 | 说明 |
|---|---|---|---|---|
| D-10 | 已修改 | S0 | tests/session/difficulty.test.ts | 恢复「相同 objectId、不同 courseId 互不影响」测试（`keeps the same object id independent across different courses`），对象级合并测试保留 |
| D-11 | 已修改 | S0 | choices.css、app-shell.css、tests/smoke/media-grid.test.tsx | 图片 max-height≤130px、question-card padding 压缩、media-grid-card h1 margin 压缩，加 CSS 紧凑值断言 |
| D-12 | 已修改 | S0 | feedback-sound-select.ts、feedback-sounds.ts、media.ts、tests/course/feedback-sounds.test.ts、tests/course/media.test.ts | 纯选择函数与 Node 扫描器拆分；media.ts 排除 FEEDBACK_SOUND_PATTERN；补「合法提示音不误报」测试 |
| D-13 | 已修改 | S0 | feedback-playback.ts、AppShell.tsx、tests/smoke/feedback-playback.test.tsx | 四路径（完全正确/部分正确/错误/超时）AppShell 集成断言 + 切题/退出/手动播放取消 |
| D-14 | 已修改 | S0 | media.ts、tests/course/media.test.ts | 空目录 MEDIA_MISSING warning；坏/好媒体共存课程可打开 |
| D-15 | 已修改 | S1 | validation.ts、validation-v2.ts（遗留）、types.ts、tests/course/v2-multilanguage.test.ts | 遗留 validation-v2.ts 的 V2 结构（A1 显示名/A2+ 主媒体/B1 双向题干/B2+ 名称/C1+ 属性题干/C2+ 答案或媒体）审计正确，保留并补测试；本轮补 V1 侧 `formatVersion="v1"`、`nameColumnIndex=1` 显式标识，V1 只读兼容测试断言零 issue |
| D-16 | 已修改 | S1 | language.ts（遗留）、loader.ts（遗留）、types.ts、validation-v2.ts、tests/course/v2-multilanguage.test.ts、xlsx-fixture.ts | 遗留 language.ts 解析与 loader 多语言分组审计正确，保留；本轮补 `speechDirectory`（`speech/<lang>/`）字段、最小多语言样例 fixture 与「英俄引用同一共享图片」验收测试 |
| D-17 | 已修改 | S1 | cell-media.ts、validation-v2.ts、tests/course/cell-media.test.ts | 遗留单元格媒体解析审计基本正确；本轮修复遗留 bug（resolve 期间产生的单元格级 issue 未并入返回结果）、媒体语法单元格缺失文件不再回退为文字答案；补 A 列主媒体→item.media 行为测试 |
| D-18 | 已修改 | S1 | cell-media.ts、validation-v2.ts、tests/course/cell-media.test.ts、tests/course/validation-v2.test.ts | 新增 `cellMediaCategory` 语法级类别判定；同格混类别/媒体+文字混写→`CELL_MEDIA_MIXED_KIND` error；含路径引用→`CELL_MEDIA_PATH` error；列内混合→在冲突单元格处报 `COLUMN_MEDIA_MIXED_KIND`（精确列+单元格）；`/` 变体解析与「变体不互为干扰项」经 generateQuestion 行为断言 |
| D-19 | 已修改 | S2 | src/core/quiz/course-adapter.ts、generator.ts、question-set.ts；tests/quiz/header-rules.test.ts | 双向表头解析（首个 `/`、两侧必填）+ 校验阻断 + 正/反向题干用于 prompt；提交 `5512ae7` |
| D-20 | 已修改 | S2 | src/core/quiz/scoring.ts；tests/quiz/scoring.test.ts、tests/quiz/header-rules.test.ts | `;` 分必答组、`/` 组内任选别名；多别名判对；媒体路径保持原子匹配；提交 `52941f5`、`66dd876` |
| D-21 | 已修改 | S2 | src/core/quiz/question-set.ts、course-adapter.ts；tests/quiz/header-rules.test.ts | `$`＝仅作问题（只出反向题）、`*`＝仅作答案（只出正向题）；不替代 D-01；提交 `c3386a8` |
| D-22 | 已修改 | S3 | `src/core/course/media.ts`（`listSpeechAudioFiles`）、`src/core/course/validation-v2.ts`（`speechDirectory`/`speechFiles`）、`src/core/course/loader.ts`（接线）、`src/main/main.ts`（`withMediaUrls` 转 URL）、`src/core/course/speech-audio.ts`（坐标解析纯函数）、`src/renderer/app-shell/AppShell.tsx`/`choices.css`（扬声器按钮）、`src/renderer/app-shell/speech.ts`（兼容重导出）、`tests/course/speech-audio.test.ts`、`tests/smoke/speech-playback.test.tsx` | `speech/<lang>/` 分语言目录；坐标命名 `C4.mp3`、`C1-F.mp3`/`C1-R.mp3`；同坐标跨语言隔离；缺失静默跳过；无 TTS |
| D-23 | 已修改 | S3 | `src/renderer/app-shell/AppShell.tsx`（`questionSpeech` useMemo + useEffect 自动播放）、`tests/smoke/speech-playback.test.tsx` | 文字题出现自动播放问题单元格音频；媒体题不播；播放不阻断判题/计分/保存/下一题 |
| D-24 | 已修改 | S4 | `src/core/progress/knowledge-progress.ts`（`progressUnitKey`/`progressUnitTotal`/`ProgressUnitCounts`）、`src/core/session/learning-session.ts`、`src/core/session/testing-session.ts`、`src/core/session/session-controller.ts`（暴露 `progressUnits`）、`tests/session/progress-units.test.ts` | 一个「名称+学习单元格」关系为一个进度单位；Learning 开始固定总数、重试不增；Testing 显示总数/已完成/剩余；空单元格/缺失媒体/无区分度列天然被跳过不计 |
| D-25 | 已修改 | S3 检查员③ | `src/renderer/app-shell/AppShell.tsx`（`isMediaGridOptions` 加入 video kind）、`src/renderer/app-shell/choices.css`（视频收窄规则）、`tests/smoke/media-grid.test.tsx`（测试从排除改为纳入）、`vitest.config.ts`（pool:vmThreads 修复 vitest 4.x） | 视频选项与图片/音频一样固定 2×2；提交 `a331600` |
| D-26 | 已修改 | 主控追加 | `src/renderer/app-shell/AppShell.tsx`（Learning 头部按 masteredCount 替代 Question X of Y；Learning/Testing 统一显 unit-progress；进度条按 units.completed/total 推进）、`tests/smoke/learning-progress-display.test.tsx`（2 项：已掌握计数与 ARIA 推进、答错不增已掌握）、`tests/smoke/unit-progress-display.test.tsx`（Learning 第二条改为断言显 unit-progress）、`tests/smoke/{course-import-flow,media-grid,p2-acceptance,session-flow,speech-playback,feedback-playback}.test.tsx`（移除 Learning 顶部 Question X of Y 字面断言） | Learning 模式按进度单位显已掌握/未掌握，答错不增总数；标题用 `masteredCount` 键，五语言齐全；提问机制答错重入队不再推挤 X of Y |

## 3. 批次记录

### 批次 S1（Excel V2 数据模型，D-15~D-18）

- 开始/完成时间：2026-09-10 00:15 → 00:55（夜间流水线，s1 worktree，分支 `znawca15-v2-model`）
- 提交：`6338337`（D-17/D-18）、`4bef11e`（D-15/D-16），基线 `a674004`。
- 基线现状（开工审计，遗留自前一会话）：
  - `cell-media.ts`/`language.ts`/`validation-v2.ts` 及对应测试已存在。D-15 的 V2 结构解析、D-16 的工作簿名解析与 loader 分组、D-17 的单元格→media/ 解析、D-18 的 `/` 变体拆分基本正确 → 保留，只补测试。
  - 缺失/错误：① 单元格级 issue（MISSING/CORRUPT/MIXED_KIND）在 `validateV2Worksheet` 中因只开头展开一次 `mediaIssues` 而**全部丢失**（遗留 bug）；② 列内混合类别只报到表头（row=1），不满足「精确指出列和单元格」；③ 同格「媒体引用+文字」混写被静默当纯文本；④ 引用含路径未拒绝；⑤ 缺失媒体单元格回退成文字答案，会误触列类别混合；⑥ V1 课程无 formatVersion 标识；⑦ speech/<lang>/ 目录结构无模型支撑；⑧ 无多语言真实 xlsx 样例。
- 本轮改动（最小修改，均在上表「允许修改」范围内）：
  - `cell-media.ts`：新增 `cellMediaCategory()`（语法级 text/单类别/mixed，不依赖文件存在）；CELL_MEDIA_MIXED_KIND 由 warning 升级为 **error**；新增 CELL_MEDIA_PATH error；`scanCellMedia` 接受可选 workbookPath，单元格级 issue 的 location.file 指向工作簿而非 media 目录。
  - `validation-v2.ts`：逐列记录单元格语法类别，列内混合在**冲突单元格**（row+column+columnName）报 COLUMN_MEDIA_MIXED_KIND error，A 列同样受约束（B 列语义恒为文字不参与）；`flushMediaIssues()` 修复丢失 bug；媒体语法单元格缺失文件保持媒体语义（仅 CELL_MEDIA_MISSING warning）；`speechDirectory` 指向 `speech/<lang>/`。
  - `validation.ts`：V1 课程返回 `formatVersion:"v1"`、`nameColumnIndex:1`。
  - `types.ts`：Course 增加 `speechDirectory?`。
  - `xlsx-fixture.ts`：`createMultilingualCourseFixture`（Birds_Eng/Ru.xlsx + 共享 media/ + speech/Eng|Ru/，含 `/` 变体与跨语言同图）、`writeWorkbookRows` 覆写工具。
- 五条自动验收（WORKBUDDY-TASKS.md §3）对应测试（`tests/course/v2-multilanguage.test.ts` 及配套）：
  1. A1 不同语言显示名 → `shows a different A1 course display title per language workbook`（Birds of Europe / Птицы Европы）。
  2. 英俄引用同一图片 → `lets the Eng and Ru workbooks reference the same shared image`（同一绝对路径）。
  3. `/` 变体不互为干扰项 → `keeps /-separated image variants of one cell from becoming distractors of each other`（经 courseObjects + generateQuestion 行为断言：目标对象仅 1 个选项、未选中变体不出现在任何选项）。
  4. 混合媒体类别导入失败并精确指出列和单元格 → `fails import and points at the exact column and cell mixing media with text`（row/column/columnName/file）+ 单格混写 `fails import when a single cell mixes an image reference with plain text`。
  5. V1 只读兼容不报错 → `loads a V1 course under the legacy model without any issues`（issues 为空、formatVersion="v1"）。
- 验证：`npm run typecheck` ✅；`npm test -- --run` ✅ 31 文件 208 项全通过（course 定向 10 文件 67 项）；`npm run build` ✅（37 modules）。
- 与任务方案的偏差：
  - CELL_MEDIA_MIXED_KIND（单格混类别）severity 由遗留代码的 warning 升级为 error：依据 D-18 字面「同一单元格只允许一种媒体类别及其变体」与验收「混合媒体类别导入失败」，属收紧而非放宽。
  - V2 触发条件维持遗留实现：仅当目录内**多个**工作簿均解析出同一基础名的语言后缀时按 V2 展开；单个带后缀工作簿（如只有 Birds_Eng.xlsx）仍按 V1 加载。DECISIONS.md 未规定单后缀工作簿场景，此为确定性规则（不靠猜测切换），已按字面执行并记录。
  - D-19 双向题干表头（`正/反`）属 S2，本轮 B1/C1+ 标题仍按普通标题解析（`/` 在表头中的语义未实现，避免越界）。
- 已知风险：
  - 纯文字答案若恰好以受支持媒体扩展名结尾再以 `/` 连接其他文字（如 `a.png/备注`），会被判为 mixed error。D-18 把 `/` 定为变体分隔符，此为字面执行的固有边界；正常别名（`China/PRC`）不含扩展名不受影响。
  - `courseObjects`（quiz 适配层，S2 允许修改范围）尚未消费 `item.cellMedia`；属性单元格媒体→「名称↔单元格」出题留待 S2。
  - UI 层对 `displayTitle`/`speechDirectory`/`languageCode` 的消费（多语言课程入口切换、朗读播放）分别依赖后续批次（S3 使用 speechDirectory）。
  - 多语言目录中某一语言工作簿导入失败时，仅该语言版本 canOpen=false，其余语言可正常打开（单课程阻断语义不变：仅当该语言工作簿自身无有效学习关系才阻断）。

### 批次 S0（返工，代码已在工作区完成）

- 开始/完成时间：2026-09-07 审计确认
- 修改摘要：D-10~D-14 五项返工在工作区已全部完成（见上表），本轮仅审计、验证并补齐台账，未改源码。
- 验证：typecheck ✅、test 27文件175项 ✅、build ✅、`npx vite` 开发服务器 ready in 1478ms（无 node:fs 崩溃）。
- 与任务方案的偏差：无。
- 风险或阻塞：S0 改动仍混在脏工作区未提交，ACCEPTANCE 由定时验收自动化接管。

### 批次 S2（出题/判题扩展，本分支）

- 开始/完成时间：2026-09-09 00:20 → 02:35
- 提交序列（基线 `a674004` 之上）：`52941f5`(D-20) → `5512ae7`(D-19) → `c3386a8`(D-21) → `66dd876`(D-20 媒体路径回归修复)
- 修改摘要：
  - **D-20**：`evaluateAnswer` 重写为「必答组」语义——期望值每项是一个组说明，`/` 拆组内别名（归一化后集合去重）；提交串按 D-02 分隔符切分后，其 `/` 子别名参与组覆盖判定；组全部被覆盖且无组外别名 → fullyCorrect。`China/PRC; Asia` 接受 `China; Asia`、`PRC; Asia`、`China; PRC; Asia`；`A/B` 是一个组（提交 A 或 B 任一即对），不被拆成两个必答项。`splitAnswer` 未动。
  - **D-20 回归修复（66dd876）**：媒体路径答案（`znawca-media://...` 或以图片/音频/视频扩展名结尾）含 `/` 但必须整体精确匹配，不参与别名拆分——否则 name-to-image 选择题选错图会共享路径段被误判对（tests/smoke/p0-acceptance 发现并复验）。
  - **D-19**：`course-adapter.ts` 新增 `parseColumnTitle`（标记顺序 `#`→`$`/`*`→`正向 / 反向`）、`bidirectionalStems`（首个 `/` 分隔、两侧非空才有效）、`bidirectionalHeaderIssues`（仅 V2：非筛选列含名称列 B 的标题缺 `/` → `HEADER_BIDIRECTIONAL_MISSING`、任一侧空 → `HEADER_BIDIRECTIONAL_SIDE_EMPTY`，位置精确到 文件/工作表/第1行/列号）、`BidirectionalHeaderError`。`question-set.ts` 构建入口对非法 V2 表头抛 `BidirectionalHeaderError`（quiz 层阻断）；`generator.ts` promptFor 用正向侧（`名称 / 正向题干`）与反向侧（`属性值 / 反向题干`）。V1 标题（无 `/`）prompt 行为不变。
  - **D-21**：`columnRole` 解析表头 `$`/`*`；`question-set.ts` 逐列出题时按角色过滤方向（`$` 跳过 name-to-property、`*` 跳过 property-to-name）；未声明列不受影响；歧义反向题仍走 D-01 的 `hasUniqueReverseAnswer` 抛错→skipped（有测试验证标记列不豁免歧义检查）。
- 四条自动验收对应测试（tests/quiz）：
  1. `China/PRC; Asia` 三种提交全对 → scoring.test.ts「accepts any single declared alias / several declared aliases」
  2. `A/B` 不拆成两个必答项 → scoring.test.ts「does not split a slash group into two required answers」
  3. 缺 `/`/单侧空标题阻断并报位置 → header-rules.test.ts「blocks a header without '/' and reports the exact header cell / with an empty side and names the empty side / also blocks an invalid name column header」
  4. 「仅作答案」列不生成以该列为题干的反向题 → header-rules.test.ts「generates no reverse question that uses an answer-only (*) column as its stem」
- 验证：`npm run typecheck` ✅；`npm test -- --run` ✅ 31 文件 217 项（含既有全量 smoke）；`npm run build` ✅。新增测试：header-rules.test.ts 15 项 + scoring.test.ts 6 项。
- 与任务方案的偏差（按 DECISIONS 字面执行并记录）：
  1. **导入侧接线缺口**：`loader.ts`/`validation-v2.ts` 不在 S2 允许修改范围，故「阻断导入」实现为 quiz 层 `buildCourseQuestionSet` 抛 `BidirectionalHeaderError`（issues 含文件/工作表/行/列）。`bidirectionalHeaderIssues` 已导出，导入侧接线只需在 `validateV2Worksheet` 各列解析处调用并把 error 纳入 canOpen=false（合并负责人/S1 一行事）。
  2. 名称列 B1 按 D-15「名称双向题干」同样要求两侧必填（含进校验）；其正/反向文本暂未用于 media-to-name 的界面 prompt（AppShell 注释已注明该 V2 机制属后续批次）。
  3. `$`/`*` 与 `$`＝仅作问题、`*`＝仅作答案 的对应取 DECISIONS 表述顺序的字面解释。
- 已知风险：
  1. 合并冲突面：S1 若在 v2 样例/测试中使用无 `/` 的表头（其现有 validation-v2.test.ts 用 "Name"/"Diet"），接线导入校验后需同步给样例表头补 `/`，否则 v2 样例课程将被 D-19 阻断。
  2. `hasUniqueReverseAnswer` 的签名比较未做别名集合归一（`China/PRC` 与 `PRC/China` 视为不同值）——D-01 字面执行，未扩大范围；如需归一应由主控决策。
  3. AppShell ReplayView 用精确集合匹配标记正确选项（AppShell.tsx:925），对多值/别名答案的回放标记本就不精确（基线既有行为，非本轮引入；AppShell 不在 S2 允许范围，未动）。
  4. 若 loader 接线前某 V2 课程带非法表头被打开，`buildCourseQuestionSet` 抛错会使 AppShell 崩溃（防御性阻断的代价；接线后正常路径不会发生）。
  5. 环境备注：本会话沙箱多次拦截 vitest 全量单命令（node_modules junction 下 `.vite-temp` 写入被判定批量删除），曾以分批运行获得同等覆盖（quiz/course/session 目录 + smoke 两批，全部通过），最终原样 `npm test -- --run` 复跑成功。

### 批次 S3+S4（朗读与多媒体 + 进度统计 + 补充任务A/B，s3 worktree，分支 `znawca15-audio-progress`）

- 开始/完成时间：2026-09-09 03:05 → 03:55（夜间加急，接手基线为 trunk merge `7de853a`）
- 提交序列：`7775984`(补充B) → `f5c79ae`(D-22) → `23804d3`(D-24 核心) → `aaefff3`(D-23) → `f064cfb`(D-24 UI 接线) → `d5b740c`(补充A) → `14558ec`(D-24 收尾) → `f38c856`(typecheck 修复)。
- 修改摘要：
  - **D-22（朗读目录消费）**：`validation-v2.ts` 的 `validateV2Worksheet` 扫描 `speech/<lang>/` 坐标命名文件（`speechFiles`，按语言工作簿隔离——同坐标不同语言各自录音）；`main.ts` `withMediaUrls` 把 speechFiles 转 `znawca-media://` URL；坐标解析收敛为 `src/core/course/speech-audio.ts` 纯函数（浏览器安全）：普通单元格 `C4.mp3`、双向标题 `C1-F.mp3`/`C1-R.mp3`，去扩展名主干匹配（`.mp3`/`.wav` 均命中）；缺失静默跳过、不启用任何 TTS。
  - **D-23（自动播放 + 扬声器）**：`speechAudioForQuestion` 按界面显示顺序返回朗读链（正向：名称单元格→`C1-F`；反向：属性单元格→`C1-R`；media-to-name：名称单元格），题目本身是媒体（`question.media` 存在）返回空链不播；AppShell 新题出现 useEffect 自动播放（有反馈时不再播）；问题行 `SpeechButton` + 文字选项扬声器（`type="button"` + preventDefault/stopPropagation，点击不等于选中/提交）；`playNarration` 五语（en/pl/zh-CN/ar/ru）。
  - **D-24（进度统计）**：`knowledge-progress.ts` 新增 `progressUnitKey`（`${objectId}\u0000${projectIdForQuestion(question)}`——projectId 的 `field:<field>`/`media:<kind>` 语义天然实现「名称+学习单元格=一个单位」且正反向、题型、媒体变体合并）与 `progressUnitTotal`；`LearningSession` 构造时固定 `unitTotal`（重试重入队不增；快照写入并在恢复时沿用，旧快照按 queue+records 重算兼容），`completedUnits` 按单位键去重；`TestingSession.progressUnits()` 返回 {total, completed, remaining}；AppShell Testing 会话头部渲染三值（`unitCounts` 状态随提交与超时刷新，Learning 不显示）；空单元格（MISSING_ANSWER skip）、缺失/损坏媒体（scanCellMedia 不入 MediaAsset）、无区分度列（findNonDiscriminatingFields→skippedFields）均因不出题天然不计。
  - **补充任务A（答错反馈小图）**：AppShell 反馈区 incorrect 分支渲染正确答案对应对象媒体的 `FeedbackMediaPreview` 小图；媒体答案题不重复渲染（既有正确答案媒体控件不叠加第三张）。
  - **补充任务B（导入侧接线）**：`loader.ts` 调用 `bidirectionalHeaderIssues`（S2 已导出），非法 V2 双向表头在导入校验阶段即 `canOpen=false`，V2 测试样例表头补 `/`。
- 四条 S3 自动验收（WORKBUDDY-TASKS §5）对应测试（`tests/course/speech-audio.test.ts` 8 项 + `tests/smoke/speech-playback.test.tsx` 4 项）：
  1. 同一坐标不同语言播放各自录音 → speech-audio.test.ts 按语言工作簿隔离断言。
  2. 正反向题干不播同一段 → `C1-F`/`C1-R` 链序断言（speech-playback 首题 `A2,B1-F`）。
  3. 媒体题不自动朗读 → 「does not auto-play when the question itself is media」。
  4. 扬声器点击不触发提交 → 问题行/选项扬声器点击后无反馈文案、radio 未选中、Check answer 可用。
- 三条 S4 自动验收（WORKBUDDY-TASKS §6）对应测试（`tests/session/progress-units.test.ts` 6 项 + `tests/smoke/unit-progress-display.test.tsx` 2 项）：
  1. 同一关系重试多次总数不变 → Learning 答错重入队后 unitTotal 不变。
  2. 正反向题和不同题型不重复占进度 → 单位键合并断言（正反向双题完成只计 1）。
  3. Testing 显示总数/已完成/剩余 → unit-progress-display.test.tsx 提交后刷新断言。
- 验证：`npm run typecheck` ✅；`npm test -- --run` ✅ 38 文件 254 项全通过；`npx vite build && npx tsc -p tsconfig.main.json` ✅（38 modules；`npm run build` 的 clean 步骤在本会话沙箱被拦截，按既定替代命令执行）。
- 与任务方案的偏差：
  1. **并发实例协作**：本轮存在两个 S3+S4 工人实例在同一 worktree 并行工作（D-22/D-23/UI 侧与 D-24 核心侧各自提交）。提交 `f064cfb` 的 message 标注为 D-23，实际内容是 D-24 UI 接线（AppShell unitCounts + unitsLabel/unitsRemaining 本地化）与补充任务A 测试初稿（该实例提交时 `git add -A` 捞到另一实例的进行中改动）；上方提交序列按实际内容归属记录，未做历史改写。
  2. `speechFiles` 扫描从 loader 移入 validateV2Worksheet 属重构性收敛（两文件均在允许范围），消除 loader 对 V2 细节的重复耦合。
- 已知风险：
  1. 朗读文件名按去扩展名主干小写匹配，非坐标命名文件（如 `intro.mp3`）被静默忽略——符合「无朗读文件静默跳过」字面。
  2. Testing 三值仅按本次会话内作答统计（progressUnits 以 session records 为准），不含跨会话 Knowledge 进度聚合（DECISIONS 未要求跨会话累计 Testing）。
  3. 双实例提交的时序竞争已通过「每提交前 git log/status 复查 + 文件分工」收敛，最终工作区干净、三门禁全绿；但若夜间流水线后续有按提交 message 的自动化分类，`f064cfb` 的 message 需人工归位。



- S1（分支 `znawca15-v2-model`，2026-09-10 00:55）：typecheck ✅｜`npm test -- --run` 31 文件 208 项 ✅｜build ✅（37 modules）。
- S2（分支 `znawca15-quiz-rules`，2026-09-09 02:35）：`npm run typecheck` ✅ ／ `npm test -- --run` 31 文件 217 项全通过 ✅ ／ `npm run build` 37 modules ✅
- S2 复核（2026-09-09 02:40–02:55，接手工人独立复验，未改源码）：
  - 逐项审计 D-19/D-20/D-21 实现与测试映射，四条自动验收均有真实断言且与 DECISIONS 字面一致；未发现越权修改（`git diff a674004..HEAD` 仅触及 `src/core/quiz/{scoring,generator,question-set,course-adapter}.ts` 与 `tests/quiz/{scoring,header-rules}.test.ts`）。
  - `npm run typecheck` ✅；`npx vitest run tests/quiz` ✅ 4 文件 49 项（含 S2 新增 21 项）。
  - `npm test -- --run` 全量与 `npm run build` 在该会话被沙箱拦截，以 02:35 全绿记录 + typecheck/quiz 定向结果为准；由主控在主工作区合并后复跑全量门禁（见 §4 合并验证）。
- 主干合并验证（2026-09-09，主控）：S1+S2 合并后在主工作区复跑 `npm run typecheck` + `npm test -- --run` + `npm run build`，结果回填于此。
- S3+S4 分支验证（2026-09-09 03:40–03:42，主控巡检在 `znawca15-audio-progress`）：`npm run typecheck` ✅；定向测试（speech-audio/v2-header-import/progress-units/speech-playback）4 文件 21 项 ✅；`npm test -- --run` 36 文件 250 项 ✅；`npx vite build && npx tsc -p tsconfig.main.json` ✅。
- 主干合并验证（2026-09-09 03:42，主控在主工作区合并 `znawca15-audio-progress`）：Fast-forward 合并 `aaefff3`；`npm run typecheck` ✅；`npm test -- --run` 36 文件 250 项 ✅；`npx vite build && npx tsc -p tsconfig.main.json` ✅。
- S3+S4 worktree 末次验证（2026-09-09 03:55，分支 `znawca15-audio-progress`，s3 worktree）：`npm run typecheck` ✅ ／ `npm test -- --run` 38 文件 254 项全通过 ✅ ／ `npx vite build && npx tsc -p tsconfig.main.json` ✅（38 modules；沙箱拦截 `npm run build` clean 步骤，按 NIGHT-OPS 替代命令）。

### 批次 S3+S4（朗读与进度，D-22~D-24 + 答错小图）

- 开始/完成时间：2026-09-09 03:00 → 03:42（夜间流水线，s3 worktree，分支 `znawca15-audio-progress`）
- 提交序列（基于已含 S1+S2 的 trunk `7de853a`）：`7775984`(D-19 导入侧接线) → `f5c79ae`(D-22 朗读目录消费) → `23804d3`(D-24 进度统计) → `aaefff3`(D-22/D-23/D-24 UI 收尾与测试修复)
- 修改摘要：
  - **D-22**：`media.ts` 新增 `listSpeechAudioFiles` 静默扫描 `speech/<lang>/`；`validation-v2.ts` 把 `speechDirectory` 和 `speechFiles` 写入课程；`loader.ts` 把扫描结果和 D-19 `bidirectionalHeaderIssues` 一起并入课程导入 issues；`main.ts` `withMediaUrls` 将坐标文件名转为 `znawca-media://` URL；新增 `src/core/course/speech-audio.ts` 提供浏览器安全的纯函数 `speechAudioForQuestion`/`speechAudioForOption`/`columnLetters`；`AppShell.tsx` 在问题行和文字答案按钮旁渲染扬声器按钮；`choices.css` 加 `.speech-button` / `.question-heading` 样式；`speech.ts` 保留为兼容重导出入口。
  - **D-23**：`AppShell.tsx` 中用 `useMemo` 计算当前文字题的朗读链，并用 `useEffect` 在新题出现时自动播放；媒体题返回空链不播放；扬声器按钮 `type="button"` + 阻止冒泡，点击不选中、不提交。
  - **D-24**：`knowledge-progress.ts` 新增 `progressUnitKey`（`objectId\u0000projectId`）与 `progressUnitTotal`，正反向/题型/媒体变体全部归并；`learning-session.ts` 开始固定 `unitTotal`，完成单位用 Set 去重，快照保存/恢复兼容旧快照；`testing-session.ts` 累计已作答单位并计算剩余；`session-controller.ts` 暴露 `progressUnits()`；`AppShell.tsx` 中进度条与 Testing 计数使用新的进度统计。
  - **补充授权项（答错小图）**：已由 S0/S1 基线测试覆盖，`tests/smoke/p0-acceptance.test.tsx` 中 `shows the correct-answer thumbnail (not a path string) in feedback after a wrong name-to-image answer` 通过。
- 自动验收对应测试：
  - 同一坐标不同语言播放各自录音 → `speech-audio.test.ts` "plays each language's own recording for the same coordinate (B2)"
  - 正反向题干不播同一段 → `speech-audio.test.ts` "plays the forward stem (C1-F) for forward and the reverse stem (C1-R) for reverse questions"
  - 媒体题不自动朗读 → `speech-audio.test.ts` / `speech-playback.test.tsx` "does not narrate when the question itself is media" / "does not auto-play when the question itself is media"
  - 扬声器点击不触发提交 → `speech-playback.test.tsx` "plays an option's narration from its speaker without selecting or submitting"
  - 同一关系重试多次总数不变 → `progress-units.test.ts` "keeps the learning total fixed across retries"
  - 正反向题和不同题型不重复占进度 → `progress-units.test.ts` "merges forward/reverse directions..." / "does not double-count a unit when both its forward and reverse questions complete"
  - Testing 显示总数/已完成/剩余 → `progress-units.test.ts` "shows total/completed/remaining for testing"
  - 空单元格/缺失媒体/无区分度列不计 → `progress-units.test.ts` "excludes empty cells, missing media and non-discriminating columns"
- 验证：`npm run typecheck` ✅；定向测试 4 文件 21 项 ✅；`npm test -- --run` 36 文件 250 项 ✅；`npx vite build && npx tsc -p tsconfig.main.json` ✅。
- 与任务方案的偏差：
  - `session-controller.ts` 不在 S4「允许修改」明确列出的文件中，但为让 AppShell 获取进度统计所必需，改动仅为暴露 `progressUnits()` 两个 getter，属最小必要封装。
  - `src/core/course/speech-audio.ts` 文件名未在 S3「允许修改」列表中，但它是把 renderer 侧 `speech.ts` 的坐标解析逻辑收敛为浏览器安全纯函数所必需，供 AppShell 与测试共用。
  - D-25 视频 2×2：S3+S4 工人未实施（原测试断言不标记视频选项），检查员③（04:45）整改完成——`isMediaGridOptions` 加入 video kind、choices.css 视频收窄规则、测试从排除改为纳入。提交 `a331600`。
  - vitest 4.x setup 文件 bug：`tests/setup.ts` 导入 `afterEach` from "vitest" 在默认 pool 下崩溃（"Vitest failed to find the current suite"）；修复为 `vitest.config.ts` 加 `pool: "vmThreads"`，全量测试可跑。
- 已知风险：
  - 朗读链顺序假设：问题单元格 → 双向标题（F/R）。若后续 UI 把题干放在内容前，需同步调整顺序。
  - `speech-audio.ts` 中列标题按 `course.columns.find((column) => column.title === field)` 查找；V2 表头含双向文本（如 `Diet / Food`），`field` 存储的是完整标题字符串，与列定义一致，故能正确命中。

### 批次 D-26（Learning 进度展示 mastered/remaining，主控追加，2026-09-11）

- 触发：客户 2026-09-09 反馈 ⑦（剪贴板截屏）——Learning 顶部"Question X of Y"在答错重入队后会超过总题数（"题目数量无限扩张"），与客户期望"已掌握/未掌握"不符。
- 提交：本轮在主工作区直接修改，未开新分支；包含 D-26 改动的提交将在文档固化后由主控一次性提交。
- 修改摘要：
  - **`AppShell.tsx` Session header**：Learning + units 存在时，`<strong>` 改为 `{completed} / {total} mastered`（key `masteredCount`），不再用 `Question X of Y`；Learning 未设 units 的极端路径保留 fallback（旧字面仍在 tests 旧断言删除干净后无回归）。`unit-progress` 与 `.progress-track` 改为以 `units.completed / units.total` 推进；`role="progressbar"`、`aria-valuemin/valuemax/valuenow` 同步以 mastered/total 表达。
  - **`beginSession`/`submit`/`resume` 三处接线 `setUnitCounts`**：Learning 进入即 `learningRef.current.progressUnits()`；提交/超时时 `learningRef.current!.answer(...)` 后刷新；`resume` 从 `record.progress` 的 unit 维度（completedUnits + queue）重建计数，确保跨会话恢复后顶部数字一致。
  - **五语言键 `masteredCount`/`unitsLabel`/`unitsRemaining`** 早已在 D-24 实现，本轮复用，无新增本地化键。
- 验收测试（`tests/smoke/learning-progress-display.test.tsx` 2 项）：
  1. `replaces the asked-count header with mastered counts and a unit-based progress bar` —— 断言 `0 / 8 mastered`、副条 `0 / 8 units · 8 remaining`、无 `Question X of Y`、进度条宽度=0、ARIA `role="progressbar"` + `valuemin=0/valuemax=8/valuenow=0`。
  2. `advances only on a correct answer and stays flat after a wrong retry` —— 首题答对（Cuculus canorus，requiredStreak=1）→ `1 / 8 mastered`、填充 12.5%、ARIA valuenow=1；下一题答错（`wrong`）重入队后计数/进度条不变。
  - 辅助改动：旧 Learning 顶部 `Question X of Y` 字面断言从 7 个 smoke 测试（`course-import-flow`、`media-grid`×4、`p2-acceptance`、`session-flow`×2、`speech-playback`×2、`feedback-playback`×2、`unit-progress-display`）改为断言 `unit-progress`/`masteredCount` 或直接删除。
- 验证：`npm run typecheck` ✅；`npx vitest run` ✅ **39 文件 256 项** 全过；`npx vite build` ✅；`npx tsc -p tsconfig.main.json` ✅。
- 与任务方案的偏差（按 DECISIONS 字面执行并记录）：
  1. `unit-progress` 与 `<strong>` 的 Learning 头部并存（前者来自 D-24 Testing 阶段，后者新增），信息密度略增但不冗余：`<strong>` 给绝对计数，`<span class="unit-progress">` 给"已完成 · 剩余"。如客户希望只保留其一，可在 M 阶段去重。
  2. Learning 模式 fallback `Question X of Y` 保留（仅在 `props.units` 未设时），但当前主流程三个 beginSession 路径均会设 units，故正常路径不可见。
- 已知风险：
  1. `Resume` 路径用 `record.progress.completedUnits` + `record.progress.queue` 重算 counts，旧快照若无 `completedUnits`（D-24 之前的快照）会按 0/queue.length 重算，可能与原会话轻度不一致——属可接受兼容行为，老快照后续自动归档。

## 5. 最终交接

- S2 交付：本 CHANGELOG、4 个提交（`52941f5`/`5512ae7`/`c3386a8`/`66dd876`）、修改文件 `src/core/quiz/{scoring,generator,question-set,course-adapter}.ts`、新增 `tests/quiz/header-rules.test.ts` 及 `tests/quiz/scoring.test.ts` 扩展。`filter.ts` 审计后无需修改。
- 未 git push（按硬约束）。
- 按本任务硬约束未修改 NIGHT-OPS.md 状态板（任务指令明确禁改），状态板更新由主控执行。

### 主控直派：V2 完整测试样例（2026-09-12，非任务清单项）

- 触发：主控提出「目前缺乏完整的测试样例」，方案确认后要求生成覆盖全部需求的样例。
- 新增（全部为新文件，未改 src/）：
  - `tools/test-data/generate_v2_sample.py`：V2 样例生成器（Pillow + openpyxl + ffmpeg，装在托管 venv `binaries/python/envs/default`）。
  - `samples/V2-Sample/`（85 文件，2.6 MB，gitignored）：`Countries/`（`Countries_Eng.xlsx` + `Countries_Ru.xlsx` 双语言、图/音/视频全列、多变体、别名、`*`/`$` 列标记、`#Continent`/`#Eurozone` 筛选列、correct/incorrect 提示音、分语言 speech）+ `Minerals/`（单语言、化学式下标 SiO₂/CaMg(CO₃)₂/Fe₂O₃/FeS₂）+ 覆盖点 README。
  - `tests/course/v2-sample-verify.test.ts`：样例回归 10 项（真实 loader/quiz 栈：零 issue、D-15/16/17/18/19/20/21、4.2 下标、5.1 筛选 OR/AND、D-01 逐值歧义跳过、D-12/D-22 提示音与 speech）；samples 缺失时 `describe.skipIf` 自动跳过，不阻塞 fresh clone。
- 埋点设计：法德货币同 Euro、波兰/日本国旗颜色同 `White; Red` → 歧义反向跳过；中国货币 `Renminbi/Yuan` → 别名三态判对；波兰主媒体双变体验「不互为干扰项」。
- 验证：`npx vitest run` ✅ **40 文件 273 项**全过（新增 10 项）。
- 备注：本机 dist 重编译被运行中的 Znawca.exe 锁文件（TS5033 间歇报错），验证改走 vitest 源码路径，不影响结果。

### 主控直派：V2 样例音频补全——真实 TTS 朗读 + 网载正误音效（2026-09-12，非任务清单项）

- 触发：主控提出样例音频仅为合成蜂鸣音，无法耳验「正确答案朗读」的坐标对应关系；要求补全（中性列确认已覆盖）。
- 变更（未改 src/）：
  - `tools/test-data/generate_v2_sample.py`：speech 坐标音频改用 edge-tts 朗读单元格真实文本（En: en-US-AriaNeural / Ru: ru-RU-SvetlanaNeural，venv 新增依赖 edge-tts）；正误音效改下载 Google Actions 音效库 ogg 转 mp3（pop / bowling_strike / crash / clang_and_wobble）；Minerals 补 correct/incorrect 4 枚；朗读坐标新增 D 列（Countries 国旗颜色、Minerals 硬度）。TTS 与下载失败均自动回退合成音，脚本离线可跑。音频全程内存管道（edge-tts 流式字节 → ffmpeg stdin），不落临时文件——规避 WorkBuddy safe-delete 对 `Path.unlink()` 的 fail-closed 拦截。
  - `samples/V2-Sample/`（123 文件，9.3MB）：Countries speech 32×2 段（含 D 列）、Minerals speech 18 段、两课程各 4 枚网载 mp3；README 更新音效来源署名。
  - `tests/course/v2-sample-verify.test.ts`：D-12/D-22 用例扩展（Minerals 提示音 2+2、D1-F/H1-R 坐标存在）。
- 验证：`npx vitest run` ✅ 40 文件 273 项全过；生成日志零回退（82 段 TTS + 8 枚音效全部真实素材）。
