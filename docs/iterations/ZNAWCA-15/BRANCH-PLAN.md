# ZNAWCA-15 分支划分与验收闭环

> 版本：2026-09-07｜主控定稿｜依据：S0~S5 各批次允许修改文件（见 WORKBUDDY-TASKS.md）

## 1. 划分原则

- 按「修改文件不冲突」分组：两个批次不碰同一文件即可并行分支，否则串行。
- 主干（`codex/p2-completion`）只做集成与验收，开发工作全部落到特性分支。
- 定时验收自动化（`ZNAWCA-15 定时验收`，每天 09:00）对主干当前状态跑 typecheck + test + build；通过即停，不通过产出 `NEXT-PUSH.md` 推进提示词。

## 2. 文件冲突矩阵

| 文件/目录 | S0 返工 | S1 模型 | S2 判题 | S3 朗读 | S4 进度 |
|---|---|---|---|---|---|
| loader.ts | ✓ | ✓ | | ✓ | |
| media.ts | ✓ | ✓ | | ✓ | |
| AppShell.tsx | ✓ | | | ✓ | ✓ |
| types.ts (course) | | ✓ | | ✓ | |
| validation.ts / organizer.ts / xlsx-adapter.ts | | ✓ | | | |
| feedback-sound-select.ts / feedback-sounds.ts | ✓ | | | | |
| choices.css / app-shell.css | ✓ | | | | |
| feedback-playback.ts / difficulty-memory.ts | ✓ | | | | |
| quiz/*（scoring/generator/filter/question-set/course-adapter） | | | ✓ | | |
| progress/* + session/*（knowledge-progress/learning/testing） | | | | | ✓ |
| main.ts / media-protocol.ts | | | | ✓ | |
| localization/* | | | | | |

核心冲突点：`loader.ts`、`media.ts`（S0/S1/S3）、`AppShell.tsx`（S0/S3/S4）、`types.ts`（S1/S3）。

## 3. 分支结构

| 分支 | 内容 | 允许修改 | 依赖 | 与谁并行 |
|---|---|---|---|---|
| `znawca15-trunk`（主干） | S0 完成基线 + 集成验收 | 仅文档/验收 | — | — |
| `znawca15-v2-model` | S1 Excel V2 数据模型 | course 目录全套（loader/media/validation/types/organizer/xlsx-adapter） | 主干 | 与 `quiz-rules` 并行 |
| `znawca15-quiz-rules` | S2 出题/判题扩展 | quiz 目录全套 | 主干 | 与 `v2-model` 并行 |
| `znawca15-audio-progress` | S3 朗读 + S4 进度 | loader/media/types/main/media-protocol/AppShell/progress/session | **v2-model 之后** | 与 `quiz-rules` 并行 |

说明：

- `v2-model`（S1）是地基，S3/S4 逻辑上依赖 V2 数据结构，且 S3 与其共享 loader/media/types，故 `audio-progress` 必须在 `v2-model` 合入后开始。
- `quiz-rules`（S2）与 `v2-model` 文件零冲突，可完全并行。
- S5（阿/俄文案）延后，不单独开分支。

## 4. 主干职责与验收闭环

1. 各特性分支完成后合入主干。
2. 定时验收自动化每天对主干跑 typecheck + test + build。
3. 全绿且 CHANGELOG/ACCEPTANCE 逐项通过 → 验收通过，停止推进。
4. 任一不通过 → 自动化产出 `NEXT-PUSH.md`（待修复文件 + 决策 ID + 验收标准 + 顺序），主干据此继续推进，次日再验。

## 5. 当前状态（2026-09-09 00:15 主控更新）

- **git 修复**：原仓库对象库部分缺失（声称的 `adaf313` 基线树不完整、18 个 `codex/*` 引用悬空、无任何可续接提交）。主控已从 S0 完成态工作树重建孤儿基线 `a674004`，删除坏引用（`packed-refs` 备份于 `.git/refs-backup-20260908/`），`main` 重指基线。
- 分支就绪：`znawca15-trunk`（主工作区）、`znawca15-v2-model`、`znawca15-quiz-rules`、`znawca15-audio-progress` 均指向 `a674004`；开发用 worktree 在 `C:\Users\Kevin\Desktop\ZNAWCA-night\{s1,s2,s3}`（node_modules 为 junction）。
- 分支名用 `-` 分隔（本机 `/` 分支名 ref 落盘失败），主干名由 `codex/p2-completion` 改为 `znawca15-trunk`。
- 工作树已存在前一会话遗留的 `cell-media.ts`、`language.ts`、`validation-v2.ts` 及配套测试（S1 部分动工，未验收），S1 工人须先审计再续作。
- 夜间加急流水线（2026-09-09 07:00 截止）的执行细节、时间表与状态板见 `NIGHT-OPS.md`。
- 下一步：S1（`znawca15-v2-model`）与 S2（`znawca15-quiz-rules`）并行实施。
