# ZNAWCA-15 实施台账

> 填写者：WorkBuddy（S2 分支）｜状态：S2 完成（D-19~D-21）

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
| D-15 | 未开始 | S1 | | （S1 分支实施） |
| D-16 | 未开始 | S1 | | （S1 分支实施） |
| D-17 | 未开始 | S1 | | （S1 分支实施） |
| D-18 | 未开始 | S1 | | （S1 分支实施） |
| D-19 | 已修改 | S2 | src/core/quiz/course-adapter.ts、generator.ts、question-set.ts；tests/quiz/header-rules.test.ts | 双向表头解析（首个 `/`、两侧必填）+ 校验阻断 + 正/反向题干用于 prompt；提交 `5512ae7` |
| D-20 | 已修改 | S2 | src/core/quiz/scoring.ts；tests/quiz/scoring.test.ts、tests/quiz/header-rules.test.ts | `;` 分必答组、`/` 组内任选别名；多别名判对；媒体路径保持原子匹配；提交 `52941f5`、`66dd876` |
| D-21 | 已修改 | S2 | src/core/quiz/question-set.ts、course-adapter.ts；tests/quiz/header-rules.test.ts | `$`＝仅作问题（只出反向题）、`*`＝仅作答案（只出正向题）；不替代 D-01；提交 `c3386a8` |
| D-22 | 未开始 | S3 | | |
| D-23 | 未开始 | S3 | | |
| D-24 | 未开始 | S4 | | |
| D-25 | 未开始 | S3 | | |

## 3. 批次记录

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

## 4. 最终验证

- S2（本分支，2026-09-09 02:35）：`npm run typecheck` ✅ ／ `npm test -- --run` 31 文件 217 项全通过 ✅ ／ `npm run build` 37 modules ✅
- S1~S5 其余批次在各自分支验证（见对应分支 CHANGELOG）。

## 5. 最终交接

- S2 交付：本 CHANGELOG、4 个提交（`52941f5`/`5512ae7`/`c3386a8`/`66dd876`）、修改文件 `src/core/quiz/{scoring,generator,question-set,course-adapter}.ts`、新增 `tests/quiz/header-rules.test.ts` 及 `tests/quiz/scoring.test.ts` 扩展。`filter.ts` 审计后无需修改。
- 未 git push（按硬约束）。
- 按本任务硬约束未修改 NIGHT-OPS.md 状态板（任务指令明确禁改），状态板更新由主控执行。
