# ZNAWCA 项目文件架构

> 最后更新：2026-08-12

## 根目录

```
ZNAWCA/
├─ AGENTS.md                  # Agent 唯一入口，定义每轮阅读路径
├─ 每轮必读.md                 # 项目协作规则
├─ README.md                  # 项目简介
├─ PROJECT_STRUCTURE.md       # 本文件
├─ .gitignore
├─ package.json               # 依赖与构建脚本
├─ package-lock.json
├─ tsconfig.json              # renderer 类型检查配置
├─ tsconfig.main.json         # Electron main 类型检查配置
├─ vite.config.ts             # Vite 构建配置
├─ vitest.config.ts           # 测试配置
├─ index.html                 # Vite 入口 HTML
│
├─ src/                       # 产品源码
├─ tests/                     # 自动化测试
├─ assets/                    # 应用运行必需资源（.gitignore 忽略）
├─ docs/                      # 项目文档
├─ tools/                     # 构建、演示、迁移脚本
├─ samples/                   # 课程样例与检查报告（.gitignore 忽略）
├─ artifacts/                 # 安装包、录屏等交付物（.gitignore 忽略）
│
├─ dist/                      # 构建产物（.gitignore 忽略）
├─ release/                   # electron-builder 输出（.gitignore 忽略）
├─ node_modules/              # 依赖（.gitignore 忽略）
├─ .git/                      # Git 仓库
└─ .workbuddy/                # WorkBuddy 工具状态
```

## src/ — 产品源码

```
src/
├─ core/                      # 纯 TypeScript 领域层，不依赖 Electron / React
│  ├─ course/
│  │  ├─ index.ts             # 对外导出
│  │  ├─ types.ts             # Course / CourseObject / CourseColumn 类型
│  │  ├─ loader.ts            # 课程发现与加载（discoverCourses / loadCourse）
│  │  ├─ media.ts             # 媒体扫描（scanCourseMedia）
│  │  ├─ normalization.ts     # 文件名/单元格规范化
│  │  ├─ organizer.ts         # 课程整理复制
│  │  ├─ validation.ts        # 课程校验与错误收集
│  │  └─ xlsx/
│  │     ├─ xlsx-adapter.ts   # .xlsx 解析适配器
│  │     ├─ xml.ts            # XML 解析
│  │     └─ zip-reader.ts     # ZIP 解包
│  ├─ quiz/
│  │  ├─ index.ts
│  │  ├─ types.ts             # Question / QuestionSet 类型
│  │  ├─ generator.ts         # 题目生成
│  │  ├─ question-set.ts      # 题目集合与降级逻辑
│  │  ├─ course-adapter.ts    # Course → Question 适配
│  │  ├─ filter.ts            # # 列筛选
│  │  └─ scoring.ts           # 答案判定（分号多值/规范化）
│  ├─ session/
│  │  ├─ index.ts
│  │  ├─ learning-session.ts  # 学习会话（错题强化/连续两次正确）
│  │  ├─ testing-session.ts   # 测试会话（每题一次/计分）
│  │  └─ session-controller.ts
│  ├─ difficulty/
│  │  ├─ index.ts
│  │  └─ difficulty-memory.ts # 对象级困难记忆（2:1 权重/两会话清除）
│  ├─ progress/
│  │  └─ knowledge-progress.ts # 知识进度追踪
│  ├─ persistence/
│  │  └─ index.ts             # LocalState 持久化（AppData JSON）
│  ├─ localization/
│  │  └─ index.ts             # 5 语言翻译 + RTL
│  ├─ demo/                   # 新手演示（Birds / Rocks mock 课程）
│  └─ shared/
│  │     └─ result.ts         # Result<T, E> 类型
│  ├─ main/
│  │  ├─ main.ts              # Electron 主进程入口
│  │  ├─ local-state-file.ts  # %APPDATA%\znawca 读写
│  │  ├─ media-protocol.ts    # local-media:// 协议处理
│  │  └─ window-options.ts    # 窗口配置
│  ├─ preload/
│  │  ├─ contracts.ts         # IPC 类型定义
│  │  └─ index.cts            # contextBridge 暴露
│  └─ renderer/
│     ├─ main.tsx             # React 入口
│     ├─ window.d.ts          # window 类型声明
│     └─ app-shell/
│        ├─ AppShell.tsx      # 主组件（课程/设置/会话/结果/历史）
│        ├─ app-shell.css
│        ├─ choices.css
│        ├─ course-errors.css
│        ├─ filters.css
│        ├─ media-question.css
│        └─ settings.css
```

## tests/ — 自动化测试

```
tests/
├─ setup.ts                   # vitest 公共 setup
├─ course/
│  ├─ loader.test.ts
│  ├─ media.test.ts
│  ├─ organizer.test.ts
│  ├─ validation.test.ts
│  ├─ xlsx.test.ts
│  └─ xlsx-fixture.ts         # 测试用 .xlsx fixture 生成
├─ quiz/
│  ├─ quiz-engine.test.ts
│  └─ course-adapter.test.ts
├─ session/
│  ├─ learning-session.test.ts
│  ├─ testing-session.test.ts
│  ├─ session-controller.test.ts
│  ├─ difficulty.test.ts
│  └─ knowledge-progress.test.ts
├─ persistence/
│  └─ local-state.test.ts
├─ platform/
│  ├─ local-state-file.test.ts
│  └─ media-protocol.test.ts
├─ localization/
│  └─ localization.test.ts
└─ smoke/                     # 端到端 UI 冒烟测试
   ├─ app-shell.test.tsx
   ├─ course-fixture.ts
   ├─ course-import-flow.test.tsx
   ├─ session-flow.test.tsx
   ├─ p0-acceptance.test.tsx
   ├─ p2-acceptance.test.tsx
   ├─ language-settings.test.tsx
   └─ security.test.ts
```

## docs/ — 项目文档

```
docs/
├─ README.md                  # 文档索引，标明每类文档唯一当前版本
├─ requirements/
│  ├─ Znawca 需求规格说明书 V1.0.docx   # V1.0 唯一需求基线
│  └─ source/                 # 原始反馈（仅作证据，.gitignore 忽略）
│     ├─ ZNAWCA用户反馈.docx
│     ├─ ZNAWCA.docx          # 初版提案
│     └─ 需求沟通1~4.png       # 微信沟通截图
├─ plans/
│  ├─ DEVELOPMENT_PLAN.md     # 当前开发计划
│  ├─ UI-CHANGES-CONTEXT.md   # UI 变更清单（勿回滚）
│  ├─ PROJECT_ORGANIZATION_PLAN.md  # 目录重组方案
│  └─ REORGANIZATION_REPORT.md      # 重组报告
├─ acceptance/
│  ├─ ACCEPTANCE_REPORT_V1.0.md     # V1.0 验收报告
│  ├─ BRANCH_ACCEPTANCE.md          # 分支验收检查清单
│  ├─ P0_INTEGRATION_AUDIT.md       # P0 集成审计
│  └─ UI_VS_SPEC_V1.0_COMPARISON.md # UI 与 spec 逐节对照
├─ decisions/
│  └─ 待用户确认-属性交叉关联.md      # 状态：待确认
├─ guides/
│  └─ USER_GUIDE.md           # 用户使用指南
└─ archive/                   # 已过期文档（只按需读取）
```

## tools/ — 辅助脚本

```
tools/
├─ demo/
│  ├─ build_demo.py           # 构建演示数据
│  ├─ check_demo.ts           # 检查演示
│  ├─ rebuild_videos_fast.py  # 快速重建演示视频
│  └─ regenerate_videos.py    # 重新生成视频
├─ test-data/
│  ├─ generate_test_samples.py  # 生成测试样本
│  └─ integration_test.ts       # 手动集成测试
└─ migration/
   └─ restructure_instruments.py  # Instruments 课程重组
```

## assets/ — 应用运行资源（.gitignore 忽略）

```
assets/
├─ test-samples/              # 内置测试课程（Countries / Dogs / Fruits / Instruments / Planets / Special）
├─ videos/
│  └─ ZNAWCA使用讲解.mp4
└─ 课程库/
   └─ Instruments/            # 8 种乐器课程
```

## samples/ — 课程样例（.gitignore 忽略）

```
samples/
├─ ZNAWCA - sample/           # Birds / Rocks 示例课程
└─ ZNAWCA - sample 命名规范检查报告.md
```

## artifacts/ — 交付物（.gitignore 忽略）

```
artifacts/
├─ installers/
│  ├─ Znawca-Portable.exe
│  └─ Znawca-Setup.exe
├─ videos/
│  ├─ 3b9b96877c741fe095fe470821a8f21a.mp4
│  └─ 72592f3bcab2a194f0a2a55edd2856ef.mp4
├─ source-archives/
│  └─ ZNAWCA - sample.rar
└─ legacy-builds/
   ├─ release-final-electron-icon/
   └─ release-import-organization/
```

## 构建产物（.gitignore 忽略）

```
dist/                        # vite build + tsc main 输出
release/                     # electron-builder 输出
node_modules/                # npm 依赖
```
