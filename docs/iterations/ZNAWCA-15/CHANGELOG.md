# ZNAWCA-15 实施台账

> 填写者：WorkBuddy（主干）｜状态：S1 完成（D-15~D-18）｜S0 已完成，S2~S5 待实施

## 1. 基线

- 开始时间：2026-09-07
- 执行工具/版本：WorkBuddy（node 22.22.2）
- 分支：`codex/p2-completion`（HEAD=e448334，脏工作区）
- `npm run typecheck`：✅ 通过
- `npm test -- --run`：✅ 27 文件、175 项全通过
- `npm run build`：✅ 通过（37 modules，无 node:fs externalize 残留）

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
| D-19 | 未开始 | S2 | | |
| D-20 | 未开始 | S2 | | |
| D-21 | 未开始 | S2 | | |
| D-22 | 未开始 | S3 | | |
| D-23 | 未开始 | S3 | | |
| D-24 | 未开始 | S4 | | |
| D-25 | 未开始 | S3 | | |

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

## 4. 最终验证

- S1（本分支 `znawca15-v2-model`，2026-09-10 00:55）：typecheck ✅｜`npm test -- --run` 31 文件 208 项 ✅｜build ✅（37 modules）。S2~S5 完成后由对应分支/主干回填。

## 5. 最终交接

（S1~S5 完成后回填）
