# ZNAWCA 文件组织优化方案

## 1. 结论

当前目录较混乱。源码、需求原件、分析文档、样例、演示脚本、安装包和构建副本混放在根目录，Agent 难以判断读取优先级。

大文件不会自动消耗 Token；真正的浪费来自重复搜索、读取过期文档和辨认多个相似版本。

## 2. 目标结构

```text
ZNAWCA/
├─ AGENTS.md                    # Agent 唯一入口
├─ 每轮必读.md                 # 项目协作规则
├─ README.md
├─ package.json / 配置文件
├─ src/                        # 产品源码
├─ tests/                      # 自动化测试
├─ assets/                     # 应用运行必需资源
├─ docs/
│  ├─ README.md                # 文档索引与权威性说明
│  ├─ requirements/            # 已确认需求及原始反馈
│  ├─ plans/                   # 当前实施方案
│  ├─ acceptance/              # 验收标准与报告
│  ├─ decisions/               # 待确认项和决策记录
│  ├─ guides/                  # 用户及开发指南
│  └─ archive/                 # 已过期文档，只按需读取
├─ tools/                      # 构建、演示、样例生成脚本
├─ samples/                    # 课程样例与检查报告
└─ artifacts/                 # 安装包、录屏等交付物；不供 Agent 默认读取
```

以下目录为本地生成或工具状态，不纳入 Agent 默认读取：`.git/`、`.workbuddy/`、`node_modules/`、`dist/`、`release*/`。

## 3. 根目录整理

| 当前内容 | 目标位置 |
|---|---|
| `Znawca 需求规格说明书 V1.0.docx` | `docs/requirements/` |
| `ZNAWCA用户反馈.docx` | `docs/requirements/source/` |
| `ZNAWCA.docx`、`需求沟通*.png` | `docs/requirements/source/` |
| `待用户确认-属性交叉关联.md` | `docs/decisions/` |
| `UI-CHANGES-CONTEXT.md` | `docs/archive/`；确认仍有效则放 `docs/plans/` |
| `docs/*ACCEPTANCE*` | `docs/acceptance/` |
| `docs/*PLAN*`、`docs/*AUDIT*`、对比报告 | 按当前有效性放 `plans/`、`acceptance/` 或 `archive/` |
| `docs/USER_GUIDE.md` | `docs/guides/` |
| 根目录 `.py` 和辅助 `.ts` 脚本 | `tools/demo/`、`tools/test-data/` 或 `tools/migration/` |
| `ZNAWCA - sample/`及检查报告 | `samples/` |
| `ZNAWCA - sample.rar` | `artifacts/source-archives/` |
| 根目录 `.exe`、`.mp4` | `artifacts/installers/`、`artifacts/videos/` |
| `release-final-*`、`release-import-*` | 确认可重建后删除；需保留则移入 `artifacts/legacy-builds/` |

## 4. Agent 固定阅读路径

创建 `AGENTS.md`，只要求每轮依次读取：

1. `每轮必读.md`
2. `docs/README.md`
3. 当前任务对应的唯一需求文档
4. 当前任务对应的唯一方案文档

禁止默认递归读取 `docs/archive/`、`artifacts/`、`samples/`、`.workbuddy/`、构建目录和依赖目录。

`docs/README.md` 必须标明每类文档的唯一当前版本；旧版本统一移入 `docs/archive/`，不得与当前版本并列。

## 5. 权威文档规则

- 原始反馈只作证据，不直接作为实施指令。
- 已确认需求保留一份当前版 Markdown；避免 Agent 每次解析 DOCX。
- 实施方案保留一份当前版 Markdown，包含范围、数据规则、任务和验收标准。
- 待确认事项放入 `docs/decisions/`，状态只能是：`待确认`、`已确认`、`已拒绝`。
- 需求变化时先更新当前需求和方案，再修改代码。
- 历史报告不得复制当前需求或方案全文，只引用对应文件。

## 6. WorkBuddy 执行顺序

1. 记录 `git status`，保护当前未提交修改；不得覆盖、回滚或夹带代码改动。
2. 创建目标目录、`AGENTS.md` 和 `docs/README.md`。
3. 建立“当前文件 → 目标文件”清单，确认重名文件和有效版本。
4. 仅移动文件，不修改需求含义；Git 已跟踪文件使用保留历史的移动方式。
5. 不直接删除原始资料、样例、安装包或录屏。
6. 仅在确认可重建且内容重复后清理 `dist/`、`release*/` 等产物。
7. 更新文档中的相对链接、脚本路径和 `.gitignore`。
8. 执行类型检查、测试和构建，确认整理未改变产品行为。
9. 提交整理报告：移动清单、保留项、删除项、验证结果和未决问题。

## 7. 验收标准

- 根目录只保留入口文档、源码目录和项目配置。
- Agent 可通过 `AGENTS.md` 在四步内找到当前需求与当前方案。
- 每类信息只有一个当前权威版本。
- 历史资料、交付物和生成目录不会被默认扫描。
- 所有文档链接和工具路径有效。
- 整理前后的类型检查、测试和构建结果一致。
- 当前未提交代码修改全部保留。
