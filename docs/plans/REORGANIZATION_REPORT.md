# 文件夹重组报告

执行日期：2026-08-12
执行依据：`docs/plans/PROJECT_ORGANIZATION_PLAN.md`

## 1. 移动清单

### 根目录 → docs/requirements/

| 原路径 | 新路径 | 方式 |
|---|---|---|
| `Znawca 需求规格说明书 V1.0.docx` | `docs/requirements/Znawca 需求规格说明书 V1.0.docx` | git mv |

### 根目录 → docs/requirements/source/

| 原路径 | 新路径 |
|---|---|
| `ZNAWCA用户反馈.docx` | `docs/requirements/source/ZNAWCA用户反馈.docx` |
| `ZNAWCA.docx` | `docs/requirements/source/ZNAWCA.docx` |
| `需求沟通1.png` | `docs/requirements/source/需求沟通1.png` |
| `需求沟通2.png` | `docs/requirements/source/需求沟通2.png` |
| `需求沟通3.png` | `docs/requirements/source/需求沟通3.png` |
| `需求沟通4.png` | `docs/requirements/source/需求沟通4.png` |

### 根目录 → docs/decisions/

| 原路径 | 新路径 |
|---|---|
| `待用户确认-属性交叉关联.md` | `docs/decisions/待用户确认-属性交叉关联.md` |

### 根目录 → docs/plans/

| 原路径 | 新路径 |
|---|---|
| `UI-CHANGES-CONTEXT.md` | `docs/plans/UI-CHANGES-CONTEXT.md` |

### docs/ 内部重组

| 原路径 | 新路径 | 方式 |
|---|---|---|
| `docs/ACCEPTANCE_REPORT_V1.0.md` | `docs/acceptance/ACCEPTANCE_REPORT_V1.0.md` | git mv |
| `docs/BRANCH_ACCEPTANCE.md` | `docs/acceptance/BRANCH_ACCEPTANCE.md` | git mv |
| `docs/P0_INTEGRATION_AUDIT.md` | `docs/acceptance/P0_INTEGRATION_AUDIT.md` | git mv |
| `docs/UI_VS_SPEC_V1.0_COMPARISON.md` | `docs/acceptance/UI_VS_SPEC_V1.0_COMPARISON.md` | mv |
| `docs/DEVELOPMENT_PLAN.md` | `docs/plans/DEVELOPMENT_PLAN.md` | git mv |
| `docs/PROJECT_ORGANIZATION_PLAN.md` | `docs/plans/PROJECT_ORGANIZATION_PLAN.md` | mv |
| `docs/USER_GUIDE.md` | `docs/guides/USER_GUIDE.md` | git mv |

### 根目录 → tools/

| 原路径 | 新路径 |
|---|---|
| `build_demo.py` | `tools/demo/build_demo.py` |
| `check_demo.ts` | `tools/demo/check_demo.ts` |
| `rebuild_videos_fast.py` | `tools/demo/rebuild_videos_fast.py` |
| `regenerate_videos.py` | `tools/demo/regenerate_videos.py` |
| `generate_test_samples.py` | `tools/test-data/generate_test_samples.py` |
| `integration_test.ts` | `tools/test-data/integration_test.ts` |
| `restructure_instruments.py` | `tools/migration/restructure_instruments.py` |

### 根目录 → samples/

| 原路径 | 新路径 |
|---|---|
| `ZNAWCA - sample/` | `samples/ZNAWCA - sample/` |
| `ZNAWCA - sample 命名规范检查报告.md` | `samples/ZNAWCA - sample 命名规范检查报告.md` |

### 根目录 → artifacts/

| 原路径 | 新路径 |
|---|---|
| `Znawca-Portable.exe` | `artifacts/installers/Znawca-Portable.exe` |
| `Znawca-Setup.exe` | `artifacts/installers/Znawca-Setup.exe` |
| `3b9b96877c741fe095fe470821a8f21a.mp4` | `artifacts/videos/3b9b96877c741fe095fe470821a8f21a.mp4` |
| `72592f3bcab2a194f0a2a55edd2856ef.mp4` | `artifacts/videos/72592f3bcab2a194f0a2a55edd2856ef.mp4` |
| `ZNAWCA - sample.rar` | `artifacts/source-archives/ZNAWCA - sample.rar` |
| `release-final-electron-icon/` | `artifacts/legacy-builds/release-final-electron-icon/` |
| `release-import-organization/` | `artifacts/legacy-builds/release-import-organization/` |

## 2. 新建文件

| 文件 | 用途 |
|---|---|
| `AGENTS.md` | Agent 唯一入口，定义每轮阅读路径和禁止递归读取的目录 |
| `docs/README.md` | 文档索引，标明每类文档的唯一当前版本 |

## 3. .gitignore 更新

- 移除旧的根级忽略规则（`ZNAWCA - sample/`、`ZNAWCA - sample.rar`、`需求沟通*.png`、`ZNAWCA.docx`、`ZNAWCA - sample V1.0/**/`）
- 新增 `docs/requirements/source/`、`samples/`、`artifacts/` 忽略规则

## 4. 保留项（未移动）

- 根目录入口文档：`每轮必读.md`、`README.md`、`AGENTS.md`
- 项目配置：`package.json`、`package-lock.json`、`tsconfig.json`、`tsconfig.main.json`、`vite.config.ts`、`vitest.config.ts`、`index.html`、`.gitignore`
- 源码与测试：`src/`、`tests/`
- 运行时资源：`assets/`
- 构建产物：`dist/`、`release/`（已在 .gitignore 中）
- 依赖：`node_modules/`
- 工具状态：`.workbuddy/`、`.git/`

## 5. 删除项

无。所有文件均通过移动保留，未删除任何原始资料、样例、安装包或录屏。

## 6. 验证结果

| 检查项 | 结果 |
|---|---|
| TypeScript 类型检查（renderer + main） | ✅ 通过 |
| Vitest 测试（23 文件，97 测试） | ✅ 全部通过 |
| Vite 生产构建 | ✅ 通过（CSS 21.57 kB / JS 281.13 kB） |
| Electron main 编译 | ✅ 通过 |
| 未提交代码修改 | ✅ 全部保留（git status 确认） |

## 7. 未决问题

- `docs/plans/UI-CHANGES-CONTEXT.md` 当前归类为 plans（仍有效的 UI 变更清单）。如后续确认已过期，应移入 `docs/archive/`。
- `release/` 目录保留原位（标准 electron-builder 输出目录，已在 .gitignore 中）。
- `artifacts/legacy-builds/` 下的两个旧构建目录可由 `npm run package:win` 重建，如需清理可随时删除。
