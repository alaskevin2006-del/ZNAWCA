# ZNAWCA-15 晨报（2026-09-09 07:00）

> 产出者：终验收角色（验收 GPT，独立于实施工人）
> 时点：2026-09-09 06:20
> 验收基线：`6c4b79f`（branch `znawca15-trunk`，HEAD）

## 1. 总览

**ZNAWCA-15 全部决策 ID 通过独立验收**，三门禁全绿，未发现越权、未发现测试被削弱、未发现排除项被实现。
详情见 `docs/iterations/ZNAWCA-15/ACCEPTANCE.md`（逐项「通过/不通过+证据」）。

- 三门禁：typecheck ✅ / `npm test -- --run` ✅ **38 文件 254 项**全过 / build ✅ 86 文件 dist
- 工作区干净（`git status` clean），无未提交改动；未 `git push`。
- 主干 HEAD：`6c4b79f`（终验收仅改 ACCEPTANCE.md / 本晨报 / NIGHT-OPS.md 状态板，未产生代码提交）。

## 2. 完成清单（决策 ID 级）

### S0 返工（D-10~D-14）— 5/5 通过
| 决策 | 测试 | 状态 |
|---|---|---|
| D-10 跨课程/对象级合并 | `tests/session/difficulty.test.ts` | ✅ |
| D-11 960×640 2×2 紧凑 | `tests/smoke/media-grid.test.tsx` | ✅ |
| D-12 反馈音拆模块 | `tests/course/feedback-sounds.test.ts` + `tests/course/media.test.ts` | ✅ |
| D-13 播放链四路径 | `tests/smoke/feedback-playback.test.tsx` | ✅ |
| D-14 MEDIA_MISSING 警告 | `tests/course/media.test.ts` | ✅ |

### S1 V2 数据模型（D-15~D-18）— 4/4 通过
| 决策 | 测试 | 状态 |
|---|---|---|
| D-15 中性 A 列 + V2 结构 | `tests/course/v2-multilanguage.test.ts` | ✅ |
| D-16 多语言工作簿/共享媒体 | `tests/course/v2-multilanguage.test.ts` + `tests/course/loader.test.ts` | ✅ |
| D-17 单元格媒体映射 | `tests/course/v2-multilanguage.test.ts` `/` 变体不互扰 | ✅ |
| D-18 单元格多种媒体变体 | `tests/course/v2-multilanguage.test.ts` 混合类别精确报错 | ✅ |

### S2 出题/判题扩展（D-19~D-21）— 3/3 通过
| 决策 | 测试 | 状态 |
|---|---|---|
| D-19 双向题干表头 | `tests/course/v2-header-import.test.ts` + `tests/quiz/header-rules.test.ts` | ✅ |
| D-20 显式别名 | `tests/quiz/scoring.test.ts` 三态判对 | ✅ |
| D-21 列角色标记 | `tests/quiz/header-rules.test.ts` `*` 列不出反向题 | ✅ |

### S3 朗读与多媒体（D-22~D-23, D-25）— 3/3 通过
| 决策 | 测试 | 状态 |
|---|---|---|
| D-22 `speech/<lang>/` 分语言朗读 | `tests/course/speech-audio.test.ts` 8 项 | ✅ |
| D-23 文字题自动播放/扬声器 | `tests/smoke/speech-playback.test.tsx` 4 项 | ✅ |
| D-25 视频选项 2×2 | `tests/smoke/media-grid.test.tsx` 视频 max-height≤130px + 4 video 选项 | ✅ |

### S4 进度统计（D-24）— 1/1 通过
| 决策 | 测试 | 状态 |
|---|---|---|
| D-24 「名称+学习单元格」=1 单位，重试不增，Testing 三值 | `tests/session/progress-units.test.ts` 6 项 + `tests/smoke/unit-progress-display.test.tsx` 2 项 | ✅ |

### 补充任务
| 任务 | 测试 | 状态 |
|---|---|---|
| 反馈1⑧ 答错显示正确答案对应对象媒体小图 | `tests/smoke/p0-acceptance.test.tsx` + `tests/smoke/feedback-media-preview.test.tsx` | ✅ |
| D-19 导入侧接线 | `tests/course/v2-header-import.test.ts` 三条 | ✅ |
| 误报修复：`~$` 锁文件排除 | `tests/course/loader.test.ts` `ignores an Excel lock file when detecting workbooks` | ✅ |
| 误报修复：合并单元格传播 | `tests/course/xlsx.test.ts` `propagates a merged A-column value` + `loader.test.ts` `does not report ITEM_NAME_EMPTY for a merged A-column cell` | ✅ |

**总计：16 决策 + 4 补充/误报修复 = 20 项验收对象，全部通过。**

## 3. 未完成清单及原因

| 项目 | 状态 | 原因 |
|---|---|---|
| S5 阿拉伯语/俄语界面文案（D-23 之后） | 未实施 | DECISIONS §4 第 5 条明确排除：「阿拉伯语/俄语界面文案（S5，延后至客户专家定稿）」。客户专家定稿后再单独修改。 |
| 波兰语两条文案措辞 | **已澄清（无遗留）** | 反馈1 §⑦ 图文按顺序核对（P106/P108/P114/P116/P118/P121），客户在原文中已把目标措辞全部列清；当前代码已按客户原文实现，无「待确认」项（详见 §4 已澄清）。 |

## 4. 已澄清与遗留风险

### 已澄清：波兰语两条文案

按 2026-09-09 反馈1 §⑦ 图文顺序核对后，NIGHT-OPS §4 主控指示的「待客户确认」实际为误判——客户在反馈原文 P106/P108/P114/P116/P118/P121 已给出目标措辞，代码已按原文照搬实现：

| Key | 反馈原文（节选） | 当前代码（PL） | 状态 |
|---|---|---|---|
| `setupCopy.pl.sample` | `Inteligentnie dobrany zestaw pytań` | `Inteligentnie dobrany zestaw pytań` | ✅ 已对齐 |
| `setupCopy.pl.fullCoverage` | `Suma obecnych projeków` | `Suma obecnych projeków` | ✅ 已对齐（字面含"projeków"——以客户原文为准） |
| Learning 模式标题（学习强度三档） | `Wymagający` / `Łagodny` + 小字 | `Wymagający` / `Łagodny` + 小字 | ✅ 已对齐 |
| `extraAnswers` 标签 | `Twoja błędna odpowiedź` | `Twoja błędna odpowiedź` | ✅ 已对齐 |
| 全集 vs 智能题 | `The entire set` / `All projects this time` | `The entire set` / `All projects this time` | ✅ 已对齐 |
| 干扰项措辞 | `Incorrect answers similar to correct answers` / `Distractors from filters` | `Incorrect answers similar to correct answers` / `Distractors from filters` | ✅ 已对齐 |
| 反馈区"missed" 标签 | 不再显示 | 代码已不渲染 missed | ✅ 已对齐 |

晨间已无需客户回复即可关闭该清单。如客户后续提供更优措辞，按最小改动更新 `AppShell.tsx:719` 的 `setupCopy.pl` 字段即可。

### 已知遗留风险（已在 CHANGELOG 记录）

1. `courseObjects`（quiz 适配层）尚未消费 `item.cellMedia`——「名称↔单元格」出题留待后续批次（S2 范围未涵盖 A 列→item.media 之外的属性单元格媒体）。
2. AppShell ReplayView 用精确集合匹配标记正确选项（基线既有行为），对多值/别名答案的回放标记本就不精确——非本批引入，AppShell 不在 S2 允许范围。
3. Testing 进度三值仅按本次会话内作答统计（progressUnits 以 session records 为准），不含跨会话 Knowledge 进度聚合（DECISIONS 未要求跨会话累计 Testing）。
4. 朗读文件名按去扩展名主干小写匹配，非坐标命名文件（如 `intro.mp3`）被静默忽略——符合「无朗读文件静默跳过」字面。
5. `hasUniqueReverseAnswer` 的签名比较未做别名集合归一（`China/PRC` 与 `PRC/China` 视为不同值）——D-01 字面执行。
6. D-26 Learning 顶部 `<strong>`（已掌握计数）与 `<span class="unit-progress">`（已完成·剩余）并存——信息密度略增；如客户希望只保留其一可后续去重。

## 5. 建议主控晨间动作

### A. 旧自动化「ZNAWCA 修复项落地检查」（`automation-1788199402860`，PAUSED，每天 05:00）

**建议：恢复（resume）。**

理由（逐项核对）：
- **合并单元格解析（修复 ITEM_NAME_EMPTY 误报）**：`src/core/course/xlsx/xlsx-adapter.ts` 已含 `parseMergeRanges`+`applyMergedCells`（L83-129，传播值带 `merged:true`）；`src/core/course/validation.ts` 已处理 `isMergedContinuation`（L87-105，把合并续行属性并入同名 item）；`tests/course/xlsx.test.ts`（L36-41）+ `loader.test.ts`（L76-90）合并单元格测试齐全 ✅
- **缺失媒体可定位 warning（D-14）**：`tests/course/media.test.ts` 空目录 `MEDIA_MISSING` 测试齐全 ✅
- **2×2 在 960×640 完整可见（D-11）**：`src/renderer/app-shell/choices.css` 已含 `max-height ≤ 130px` 紧凑规则；`app-shell.css` 已含 `.question-card.media-grid-card h1` margin-bottom 压缩；`AppShell.tsx` `isMediaGridOptions` 已加 media-grid-card 语义 class ✅

旧自动化的检查项已被本批验收测试覆盖，与 V2 解冻无冲突。恢复后该自动化可作为「持续回归守卫」长期生效。

### B. worktree 目录 `ZNAWCA-night` 去留

**建议：保留 7 天后清理（即 2026-09-16 后视情况删除）。**

理由：
- 三个 worktree（`ZNAWCA-night/{s1,s2,s3}`）的代码已全部合并入 trunk（fast-forward `d458d0d`/`aaefff3`/`7de853a`），其本身不含独有改动。
- 短期保留可作为「本批实现的物理备份」便于回滚参考；中长期保留仅占空间。
- 若主控近期无需回滚，最快可今晚（2026-09-09）执行 `git worktree remove ZNAWCA-night/s1 s2 s3` + 删除 `/c/Users/Kevin/Desktop/ZNAWCA-night/`。
- 合并冲突面已不存在（CHANGELOG 已记录完整提交序列）。

### C. 其他（无强制）
- 波兰语两条文案已澄清（见 §4）——如客户后续提供更优措辞，按最小改动更新 `AppShell.tsx:719`，无回归风险。
- 是否升级 S5 触发条件（DECISIONS §4 第 5 条）——按硬约束不在本批范围。

## 6. 验收交付清单

- `docs/iterations/ZNAWCA-15/ACCEPTANCE.md` — 全部 20 项「通过/不通过+证据」明细
- `docs/iterations/ZNAWCA-15/MORNING-REPORT-2026-09-09.md` — 本文件
- `docs/iterations/ZNAWCA-15/NIGHT-OPS.md` §6 — 已追加 06:20 终验收状态板
- 无代码改动；未 git push。

## 7. 增补（2026-09-11 主控追加）

客户在 2026-09-09 反馈 ⑦（剪贴板截屏）提出新需求：Learning 模式顶部"Question X of Y"在答错重入队后会超过总题数（"题目数量无限扩张"），期望改为「已掌握 / 未掌握」展示。

主控判定为新增决策 D-26（Learning 进度展示 mastered/remaining），已在 DECISIONS.md §3 表追加、在主工作区直接落地、未开新分支。

**改动摘要**

- `AppShell.tsx` Session header：Learning 模式下 `<strong>` 由 `Question X of Y` 改为 `{completed} / {total} mastered`（key `masteredCount`，五语言齐全）；`unit-progress` 与 `.progress-track` 按 `units.completed / units.total` 推进；ARIA `role="progressbar"` + valuemin/valuemax/valuenow 同步改为 mastered/total。
- `beginSession`/`submit`/`resume` 三处补 `setUnitCounts` 接线，确保 Learning 进入、提交/超时、跨会话恢复时顶部计数刷新。
- 新增 `tests/smoke/learning-progress-display.test.tsx`（2 项）+ 清理 7 个 smoke 测试中的 `Question X of Y` 字面断言（Learning 顶部无该字面）。

**三门禁**

- `npm run typecheck` ✅
- `npx vitest run` ✅ **39 文件 256 项**（新增 2 项来自 `learning-progress-display.test.tsx`）
- `npx vite build && npx tsc -p tsconfig.main.json` ✅

**后续便携版打包**（见 2026-09-11 下午会话）：将基于本批 D-26 代码重新打包 Windows 便携版（`Znawca-Portable-1.0.0-x64.exe`），输出到 `artifacts/installers/`。

**遗留风险**

- Learning 顶部 `<strong>` 与 `<span class="unit-progress">` 并存（信息密度略增）；如客户反馈需合并，去重为单一展示即可（5 行内可改）。
- 老快照（D-24 之前）若无 `completedUnits` 字段，Resume 按 `queue.length` 重算 counts——属可接受兼容行为。