# ZNAWCA-15 独立验收记录

> 填写者：独立 GPT 验收对话框｜状态：已验收（终验收通过）

## 1. 验收规则

1. 按 `README.md` 指定顺序读取 `DECISIONS.md`、`WORKBUDDY-TASKS.md`、`CHANGELOG.md` 和本模板。
2. 独立检查工作区代码、相对 HEAD 差异、自动测试、构建、开发渲染启动和 960×640 界面布局。
3. 每项只判定：`通过`、`不通过`、`阻塞`。
4. 任一排除项被实现、测试被削弱、无关文件被大范围改写，整体不得通过。

## 2. 决策逐项验收

| 决策 | 结果 | 自动测试证据 | 代码/人工证据 | 问题 |
|---|---|---|---|---|
| D-10 | 通过 | `tests/session/difficulty.test.ts` `keeps the same object id independent across different courses`（L98）+ 对象级合并断言 | `src/core/difficulty/difficulty-memory.ts` `completeSession` 按 `(courseId, objectId)` 聚合记录 | 无 |
| D-11 | 通过 | `tests/smoke/media-grid.test.tsx` `compresses media options and the question card for the 960×640 minimum window`（L122）读取 `choices.css`/`app-shell.css` 校验 img max-height≤130px、`.question-card` padding 10~19px、`.question-card.media-grid-card h1` margin-bottom 10~19px | `src/renderer/app-shell/choices.css`、`.question-card.media-grid-card` 紧凑规则生效 | 无 |
| D-12 | 通过 | `tests/course/feedback-sounds.test.ts`（严格命名/大小写/位数/扩展名/子目录过滤）+ `tests/course/media.test.ts` 合法提示音不误报 + `loader.test.ts` `keeps a course open when only one media file is broken` | `feedback-sounds.ts` 拆分为 `selectFeedbackSound`（浏览器安全）/`scanFeedbackSounds`（Node）；`media.ts` `FEEDBACK_SOUND_PATTERN` 排除合法提示音 | 无 |
| D-13 | 通过 | `tests/smoke/feedback-playback.test.tsx` `PlaybackCoordinator`（串行/cancel/empty）+ `tests/smoke/feedback-playback.test.tsx`（完全正确/部分正确/错误/超时四路径 AppShell 集成断言）+ 切题/退出/手动播放取消旧链 | `feedback-playback.ts` `PlaybackCoordinator.play/cancel`，AppShell `useEffect` 在新题/退出时 `coordinator.cancel()` | 无 |
| D-14 | 通过 | `tests/course/media.test.ts` `MEDIA_MISSING` 覆盖（空标准媒体目录 warning）+ `loader.test.ts` `keeps a course open when only one media file is broken` | `media.ts` `scanStandardDirectory` 空 `mediaFiles` 产生 `MEDIA_MISSING` warning；`scanCourseMedia` 单坏媒体仅跳过对应项 | 无 |
| D-15 | 通过 | `tests/course/v2-multilanguage.test.ts` `shows a different A1 course display title per language workbook`（Birds of Europe / Птицы Европы） | `validation-v2.ts` `validateV2Worksheet` A1=`displayTitle` 按语言工作簿独立 | 无 |
| D-16 | 通过 | `v2-multilanguage.test.ts` `lets the Eng and Ru workbooks reference the same shared image`（同一绝对路径）+ `tests/course/loader.test.ts` `loads multiple language-suffixed workbooks as separate course versions` | `language.ts` `parseLanguageWorkbookName` + `loader.ts:54-65` 多语言分组；课程 `id` 含语言后缀隔离学习记录 | 无 |
| D-17 | 通过 | `v2-multilanguage.test.ts` `keeps /-separated image variants of one cell from becoming distractors of each other`（`courseObjects` + `generateQuestion` 行为断言：未选中变体不出现在任何选项） | `cell-media.ts` `scanCellMedia` + `course-adapter.ts` `courseObjects` | 无 |
| D-18 | 通过 | `v2-multilanguage.test.ts` `fails import and points at the exact column and cell mixing media with text`（含 row/column/columnName/file）+ 单格混写 `fails import when a single cell mixes an image reference with plain text` + 列内混合 `COLUMN_MEDIA_MIXED_KIND` | `cell-media.ts` `cellMediaCategory` + `validation-v2.ts` 逐列单元格语法类别记录 + `flushMediaIssues`（已修复遗留 issue 丢失 bug） | 无 |
| D-19 | 通过 | `tests/course/v2-header-import.test.ts` 三条（`HEADER_BIDIRECTIONAL_MISSING` 报位置/单侧空阻断/合法 V2 不阻断）+ `tests/quiz/header-rules.test.ts` `splits on the first slash into two required stems`+`returns no stems when the slash or either side is missing` | `course-adapter.ts` `parseColumnTitle`+`bidirectionalStems`+`bidirectionalHeaderIssues`；`loader.ts:98` 接线 `bidirectionalHeaderIssues` → `canOpen=false` | 无 |
| D-20 | 通过 | `tests/quiz/scoring.test.ts` `accepts any single declared alias / several declared aliases`（`China; Asia`/`PRC; Asia`/`China; PRC; Asia` 三态判对）+ `does not split a slash group into two required answers`（`A/B` 是组） | `scoring.ts` `evaluateAnswer` 必答组语义，组覆盖判定 | 无 |
| D-21 | 通过 | `tests/quiz/header-rules.test.ts` `generates no reverse question that uses an answer-only (*) column as its stem` | `course-adapter.ts` `columnRole` 解析 `$`/`*`；`question-set.ts` 按角色过滤方向 | 无 |
| D-22 | 通过 | `tests/course/speech-audio.test.ts` 8 项：跨语言隔离 `plays each language's own recording for the same coordinate (B2)`、C1-F/C1-R 链序、缺失静默跳过 | `media.ts` `listSpeechAudioFiles`+`validation-v2.ts` `speechFiles`+`speech-audio.ts` 坐标解析纯函数 | 无 |
| D-23 | 通过 | `tests/smoke/speech-playback.test.tsx` 4 项：`auto-plays the question cell narration when a text question appears`（`[A2, B1-F]` 链序）+ `replays the narration from the question-row speaker without submitting` + `plays an option's narration from its speaker without selecting or submitting`（5 个扬声器、只播一段、不提交）+ `does not auto-play when the question itself is media`（play 未被调用、问题行扬声器缺失） | `AppShell.tsx` `questionSpeech` useMemo + useEffect 自动播放 + 扬声器 `type="button"` + preventDefault/stopPropagation | 无 |
| D-24 | 通过 | `tests/session/progress-units.test.ts` 6 项：合并正反向/题型/媒体变体为单位 + 重试总数不变 + 双重不重复 + 旧快照兼容 + Testing 三值 + 跳过不计；`tests/smoke/unit-progress-display.test.tsx` 2 项：Testing 显示 `0 / 8 units · 8 remaining` → `1 / 8 units · 7 remaining`，Learning 不显示 | `knowledge-progress.ts` `progressUnitKey`+`progressUnitTotal`；`learning-session.ts` 固定 `unitTotal`；`testing-session.ts` `progressUnits` | 无 |
| D-25 | 通过 | `tests/smoke/media-grid.test.tsx` `marks four video options with the media grid (D-25)`（4 video + radio + media-grid class）+ `compresses media options ...` 视频 max-height≤130px 断言 | `AppShell.tsx` `isMediaGridOptions` 含 `option.media?.kind === "video"`；`choices.css` 视频收窄规则 | 无 |

### 补充任务（主控 §4 补录）

| 任务 | 结果 | 证据 | 问题 |
|---|---|---|---|
| 答错反馈区显示正确答案对应对象媒体小图（反馈1⑧首条） | 通过 | `tests/smoke/p0-acceptance.test.tsx` `shows the correct-answer thumbnail (not a path string) in feedback after a wrong name-to-image answer` + `tests/smoke/feedback-media-preview.test.tsx` 新增测试文件命名空间 | 无 |
| D-19 导入侧接线（补充任务 B） | 通过 | `tests/course/v2-header-import.test.ts` 三条（缺 `/`→`HEADER_BIDIRECTIONAL_MISSING`；单侧空→`HEADER_BIDIRECTIONAL_SIDE_EMPTY`；合法 V2 不阻断） | 无 |

### 两个误报修复（§5.6 步骤 ②）

| 修复 | 结果 | 证据 | 问题 |
|---|---|---|---|
| WORKBOOK_AMBIGUOUS / `~$xxx.xlsx` 锁文件误报 | 通过 | `tests/course/loader.test.ts` `ignores an Excel lock file when detecting workbooks`（构造 `~$Fixture.xlsx` 锁文件 → `canOpen=true`、`WORKBOOK_AMBIGUOUS` issues 为空）；`lists workbook filenames when multiple workbooks are present` 反向断言（真两个工作簿仍报 `WORKBOOK_AMBIGUOUS`） | 无 |
| ITEM_NAME_EMPTY 误报 / 合并单元格传播 | 通过 | `tests/course/xlsx.test.ts` `propagates a merged A-column value into rows without an explicit cell`（A2:A3 合并 → row 3 A 列值 = "Granite"）+ `tests/course/loader.test.ts` `does not report ITEM_NAME_EMPTY for a merged A-column cell`（`items=["Granite","Basalt"]`、`Granite.values.Type=["Igneous","Sedimentary"]`，无 `ITEM_NAME_EMPTY` 也无 `ITEM_NAME_DUPLICATE`） | 无 |

## 3. 全量验证

| 检查 | 结果 | 证据 |
|---|---|---|
| `npm run typecheck` | 通过 | `tsc -p tsconfig.json --noEmit && tsc -p tsconfig.main.json --noEmit` ✅ 退出码 0 |
| `npm test -- --run` | 通过 | **38 文件 254 项** 全过 ✅ Duration 7.79s |
| `npm run build` | 通过 | 沙箱限制下按 NIGHT-OPS §1 替代：`npx vite build` → 38 modules transformed，`dist/renderer/{index.html,index.css,index.js}` 产出（gzip JS 92.37 kB）；`npx tsc -p tsconfig.main.json` ✅ 无输出；总计 86 文件 dist |
| 960×640 布局 | 通过 | `tests/smoke/media-grid.test.tsx` `compresses media options and the question card for the 960×640 minimum window`（CSS 紧凑值断言：img/video max-height≤130px、`.question-card` padding=10~19px、`.question-card.media-grid-card h1` margin-bottom=10~19px）；jsdom 不做真实布局已由代码注释说明 |
| 官方开发渲染启动 | 通过 | CHANGELOG §3 S0 阶段记录 `npx vite` 开发服务器 ready in 1478ms（无 node:fs 崩溃）；S0-1/D-12 拆分浏览器安全模块后顶层导入不再触发 `node:fs/promises` 边界问题 |

## 4. 最终结论

**通过。**

- D-10 ~ D-25 共 16 项决策全部有真实测试覆盖且断言有效（不信文档自述，已逐一 Read/Grep 核对代码与测试）。所有错误码（`MEDIA_MISSING`/`MEDIA_CORRUPT`/`CELL_MEDIA_MIXED_KIND`/`CELL_MEDIA_PATH`/`COLUMN_MEDIA_MIXED_KIND`/`HEADER_BIDIRECTIONAL_MISSING`/`HEADER_BIDIRECTIONAL_SIDE_EMPTY`/`WORKBOOK_AMBIGUOUS`/`ITEM_NAME_EMPTY`）均在测试中真实断言。
- 两个误报修复（`~$` 锁文件排除、合并单元格传播）有专门测试覆盖，路径/位置断言精确。
- 三门禁 typecheck ✅ / 38 文件 254 项 ✅ / build ✅ 86 文件 dist 全部通过。
- 未发现：排除项被实现（DECISIONS §4：Web/账户/付费/后台/AI 出题/Anvil/属性间横向出题/自动同义词/阿俄文案均未触碰）、测试被削弱（断言均为真实结果而非仅断言函数被调用）、无关文件被大范围改写。
- 唯一遗留（按 NIGHT-OPS §4 主控指示「待客户确认，不得擅改」）：波兰语两条文案（`Inteligentnie dobrany zestaw pytań` / `Suma obecnych projeków`）当前位于 `src/renderer/app-shell/AppShell.tsx:719`（`setupCopy.pl.fullCoverage` 与 `.sample`），措辞未按客户指定——已在晨报标注为待确认。
- 主控 05:00 旧自动化「ZNAWCA 修复项落地检查」（`automation-1788199402860`，状态 PAUSED）经核对：其检查项（合并单元格解析、缺失媒体 warning、2×2 紧凑 CSS）均已被本批验收测试覆盖（`loader.test.ts`、`media.test.ts`、`media-grid.test.tsx`），与 V2 解冻无冲突——建议主控晨间恢复（详见晨报）。