# ZNAWCA 当前工作

> 更新：2026-10-15。约束唯一入口：[AGENTS.md](../AGENTS.md)；产品：[PRODUCT.md](PRODUCT.md)；架构：[ARCHITECTURE.md](ARCHITECTURE.md)。

## 当前授权与阶段

最新交付授权：将当前源码与历史资料保存到用户新建的 GitHub 仓库，更新桌面便携版和安装包并保持图标，清理本地旧产物。交付记录见本文末尾。E/F 仍未启动。

用户已授权执行 A、B，并进一步授权分步执行 C、D，按功能分目录改善扩展与查找。C、D 已按顺序完成实现与本轮自动检查；B 的删除阻断独立保留，不进入 E/F 验收声明。除 D 明确要求的读写失败提示、重试与并发保存保护外，已知产品差距不混入结构迁移。

| 阶段 | 内容 | 状态 |
|---|---|---|
| A | 当前文档、统一约束、已有修改与问题盘点 | 已完成，2026-10-15 收尾复核通过 |
| B | 大文件、旧产物、无效源码与工具状态清理 | 部分完成；源码/脚本已清理，批量文件删除被自动审批阻止 |
| C | 页面、文案、样式及局部交互拆分 | 已完成；页面、播放与目录引用检查通过 |
| D | 应用流程、状态、存储迁移与文件适配解耦 | 已完成；新增回归、全量测试、类型检查与构建通过 |
| E | 扩展验证与依赖约束检查 | 未启动 |
| F | 独立桌面与交付验收 | 未启动 |

## A 接手基线（历史快照）

- 分支：`znawca15-trunk`。
- HEAD：`62ec49553cb32ae64835d32736cbc234bebf505c`。
- 实际代码基线是上述 HEAD **加接手时未提交改动**；HEAD 单独不能代表当前产品。A 不提交、不重置这些改动，也不宣称工作区已经 Git clean。
- 接手时有 14 个已跟踪文件修改（13 个代码/测试文件＋旧修改方案）及下述未跟踪内容。原作者与每项批准来源不能由 Git status 确定；归属记为既有工作，GPT 后续审查，不视为本轮新实现。

| 既有修改 | 内容线索与处理 |
|---|---|
| src/core/localization/index.ts、src/core/persistence/index.ts | 语言/状态字段等；保留原字节 |
| src/main/main.ts、src/main/window-options.ts | 启动与窗口适配；保留原字节 |
| src/renderer/app-shell/AppShell.tsx | 导入、缓存、播放和界面等综合差异；保留原字节 |
| 同目录 app-shell.css、choices.css、course-errors.css、media-question.css、settings.css | 布局与提示样式；保留原字节 |
| tests/smoke/course-import-flow.test.tsx、feedback-media-preview.test.tsx、feedback-playback.test.tsx | 导入、媒体与播放回归；保留原字节 |
| 原修改方案（本轮已合并后删除） | 最新反馈取消关联图、窗口适配、按需加载等有效内容已进入 PRODUCT.md |
| tools/extract-asar-file.cjs、tools/repro-locale-switch.mjs、tools/test-data/generate_ideal_sample.py | 未跟踪脚本，保留；B 再判定用途 |
| dist.bak2/、dist.bak3/、dist.bak4/ | 未跟踪构建副本，A 不删除 |
| 原需求速查表（本轮已合并后删除） | 与最新方案冲突的“关联小图”“全部已验收”描述未沿用 |

接手时对 src、tests、tools、assets 及根目录构建配置共 115 个文件采集 SHA-256；中断后恢复收尾再次逐文件比较，零新增、零缺失、零内容变化。A 没有改业务代码、测试、脚本或配置，既有未提交改动原样保留。

该范围的聚合指纹为 `8652D4046371243591CD659808B4D9FBB3C37F2FA2C724A67537B5BF77B98977`：以项目相对路径（正斜杠）排序，将每项“路径＋TAB＋大写 SHA-256”以 LF 连接、不加末尾换行，再对 UTF-8 字节计算 SHA-256。此指纹用于识别本轮代码快照，不代表功能全部验收或替代 Git 提交。

## 当前行为、目标与差距

以下是后续任务输入，不能因为测试通过就标成已完成；A 不修复这些问题。

| 编号 | 当前证据/情况 | 目标或下一步 |
|---|---|---|
| A-01 | 静态确认 course-adapter.ts 把 cellMedia 合并到对象级媒体池，丢失属性列归属 | 保持“名称↔具体单元格”；GPT 构造同对象多图片属性用例验证，不沿用旧报告“未消费 cellMedia”的过时结论 |
| A-02 | loader.ts 按工作簿语言后缀选择 V2 分支；旧文档要求明确版本，但未统一显式标识位置 | GPT 明确格式识别契约及兼容用例，不能凭新文档假装实现已一致 |
| A-03 | defaultLocalState.coverageMode 为 sample；原批准规格要求默认全面覆盖 | 在功能修复任务核对并处理，不混入结构迁移 |
| A-04 | 超时记录反馈，推进题目走 next；C/D 后实现位于 StudySession.timeout；原批准规格要求超时进入下一题 | 验证完整计时交互并确定差距处理 |
| A-05 | 当前页面未发现独立新手演示入口，旧批准规格含演示；删除 mock 创建卡不等于取消演示需求 | 保留需求待核对，不擅自宣布取消或新增实现 |
| A-06 | ReplayView 用精确答案集合标记选项；反向唯一性签名尚未统一别名集合 | 核对多值/别名回放与等价反向答案，补针对性回归 |
| A-07 | C/D 已拆分页面与业务完成流程，core 移出文件访问，保存统一管理顺序、错误与重试 | 当前边界见 ARCHITECTURE.md；E 检验扩展接入与持续依赖约束 |
| A-08 | 阿/俄文案修订仍待客户专家；已有五语言支持存在 | 保留现有支持，不把修订延后解释为删除语言 |
| A-09 | 本轮测试有 act 警告，真实样例组跳过；未进行真实 Electron/布局/安装验证 | 单列测试质量与桌面验收，不能称零警告或全功能验收通过 |

## A 的文档收敛

当前工作入口收敛为根 AGENTS.md、README.md 和 docs 下 PRODUCT.md、ARCHITECTURE.md、WORK.md。有效规则从批准规格、最新主控方案、D-01～D-26 与 UI 行为记录合并。

本轮删除 29 份重复/过期入口、约束、产品边界及被合并的当前说明，不创建归档副本：

- `每轮必读.md`
- `PROJECT_STRUCTURE.md`
- `优化方案/README.md`
- `优化方案/阶段摘要.md`
- `优化方案/多智能体协作策略.md`
- `优化方案/项目文件组织方案.md`
- `优化方案/产品边界-ZNAWCA与Anvil.md`
- `优化方案/当前项目情况.md`
- `优化方案/ZNAWCA优化边界清单.md`
- `优化方案/ZNAWCA问题清单.md`
- `优化方案/待确认-属性交叉关联.md`
- `优化方案/优化方案.md`
- `优化方案/需求核对清单.md`
- `docs/README.md`
- `docs/decisions/待用户确认-属性交叉关联.md`
- `docs/plans/DEVELOPMENT_PLAN.md`
- `docs/plans/PROJECT_ORGANIZATION_PLAN.md`
- `docs/plans/UI-CHANGES-CONTEXT.md`
- `docs/guides/USER_GUIDE.md`
- `docs/acceptance/BRANCH_ACCEPTANCE.md`
- `docs/iterations/ZNAWCA-14/README.md`
- `docs/iterations/ZNAWCA-14/DECISIONS.md`
- `docs/iterations/ZNAWCA-14/WORKBUDDY-TASKS.md`
- `docs/iterations/ZNAWCA-14/PROMPTS.md`
- `docs/iterations/ZNAWCA-15/README.md`
- `docs/iterations/ZNAWCA-15/DECISIONS.md`
- `docs/iterations/ZNAWCA-15/WORKBUDDY-TASKS.md`
- `docs/iterations/ZNAWCA-15/BRANCH-PLAN.md`
- `docs/iterations/ZNAWCA-15/NIGHT-OPS.md`

用户补充要求历史证据集中保存：11 份旧报告、台账、客户翻译与反馈已全文合并到唯一的 [HISTORY.md](HISTORY.md)，分散的 11 份 Markdown 原文件删除。每份保留来源编号和原文，使用折叠纯文本区分历史指令与当前规则；当前阶段只维护本文件，不另建历史报告。原始 Word 附件未转换或删除；历史产物、样例、工具日志与旧自动化状态留给 B 逐项盘点。

特别记录：仓库内 .workbuddy/memory 的旧记录仍含 V1 目录、旧 Git 状态和旧打包操作描述，本轮未修改工具记忆或自动化。WorkBuddy 接手必须用下方提示词显式读取 AGENTS.md；旧工具上下文不能覆盖它。仅写规范无法证明所有工具会自动加载或遵守，仍以实际改动审查为准。

## A 验证记录（当轮实测）

| 检查 | 结果 |
|---|---|
| npm run typecheck | 通过，两端 noEmit，退出码 0 |
| npm test -- --reporter=dot | 40 个测试文件通过，1 个文件跳过；275 项通过，10 项跳过，退出码 0 |
| 跳过原因 | tests/course/v2-sample-verify.test.ts 按样例目录存在性 skipIf；当前样例不满足其路径条件 |
| 测试警告 | tests/smoke/p2-acceptance.test.tsx 等输出 React act 警告，未改测试消除或掩盖 |
| 当前文档链接与入口 | 5 份当前文档＋唯一 HISTORY.md；32 个可执行的本地链接及锚点全部有效（历史纯文本内旧链接不作入口）；AGENTS.md 仍为五条核心约束 |
| 删除清单 | A 原有 29 个精确路径已删除；历史合并追加删除 11 份 Markdown 原文件，合计 40 份；历史文件来源清单见 HISTORY.md |
| 历史全文校验 | H01～H11 共 11 份原文逐份一致，仅统一换行和末尾空白；docs/ 与优化方案/ 下仅剩 PRODUCT、ARCHITECTURE、WORK、HISTORY 四份 Markdown |
| 历史合并后的源码指纹 | 与上文 115 文件基线一致，业务代码、测试、脚本和配置未变；本次未重复运行代码测试 |
| 空目录清理 | 自动审批拒绝删除已空的旧报告目录，工具仅返回 blocked by policy；未重试绕过，空目录暂留，原报告文件已删除 |
| 保护文件 SHA-256 对照 | 115 个文件逐项一致；未新增、删除或改变受保护范围内文件 |
| 文档差异检查 | git diff --check 通过；仅有 Git 换行格式提示，没有空白错误 |
| build / package / 真实桌面 | 本轮未执行，不套用历史报告通过结论 |

## B 执行记录（2026-10-15）

接手仍为上述 HEAD 加现有未提交改动；重新采集 115 个源码/测试/工具/资源/构建配置文件指纹。B 只删除确认不用的入口和旧工具，不改变业务规则、不修改测试、不更新依赖版本、不重置 Git。

### 已完成清理

| 精确路径 | 删除依据 |
|---|---|
| src/core/shared/result.ts | Result/success/failure 无任何使用者，未被入口导出 |
| src/renderer/app-shell/speech.ts | 仅转导出的兼容壳，无使用者；实际调用者及测试直接引用 core/course/speech-audio |
| tools/extract-asar-file.cjs | 注明“用完即删”的临时提取脚本，硬编码本机依赖路径 |
| tools/repro-locale-switch.mjs | 注明“用完即删”的临时复现脚本，硬编码本机路径，不在检查链中 |
| tools/demo/build_demo.py | 旧桌面 Instruments Demo 生成流程，无当前入口引用；保留当前国家示例课生成器 |
| tools/demo/check_demo.ts | 移动目录后仍从 ./src 导入，路径无效，且读取旧模型字段；不是 npm test 的测试 |
| tools/demo/rebuild_videos_fast.py | 旧桌面 Demo 视频修补器，依赖本机绝对路径 |
| tools/demo/regenerate_videos.py | 旧桌面 Test Samples 视频修补器，依赖本机绝对路径 |
| tools/migration/restructure_instruments.py | 一次性外部课程目录改写脚本，含旧平铺布局和备份行为；未执行 |
| tools/test-data/integration_test.ts | 已失效的 ./src 导入与旧桌面样例检查；正式 tests 完整保留 |
| tools/test-data/generate_test_samples.py | 与旧桌面 Test Samples 工具链配套；当前样例与两份生成器保留 |

另调整 .gitignore：覆盖根 dist.bak* 与 release-* 产物，去掉逐个备份名的旧注释；忽略不等于删除，下面列出的目录仍存在。README 更新有效工具用途，ARCHITECTURE 去掉重复阶段状态，AGENTS.md 与 PRODUCT.md 不变。

### 历史证据

27 份 .workbuddy/memory 与 .workbuddy/automations Markdown 记录，加 1 份样例命名检查报告，已全文追加到 HISTORY.md 的 H12～H39。逐份对比一致，仅统一换行、去除末尾空白；H01～H11 原文保留。

原文件删除受阻，暂时仍有重复，不能宣称历史物理收敛已经完成。.workbuddy/automations 只有旧执行记录，没有调度配置；本轮没有查看或停用 WorkBuddy 外部调度器，也不能把清理记录等同于停用定时任务。旧工具记忆不能作为实施指令。

### 已核实但未删除的精确清单

执行下列批量删除前已解析绝对路径、确认全部位于本仓库内且无重解析点。自动审批在执行前拒绝整条命令，仅返回 `blocked by policy`，无更详细原因；这些目标全部仍在，不换工具绕过，也不交给其他 Agent 绕过。

| 精确路径 | 文件数 | 字节数 | 判定 |
|---|---:|---:|---|
| dist.bak/ | 73 | 570109 | 旧编译副本 |
| dist.bak2/ | 164 | 1321680 | 旧编译副本 |
| dist.bak3/ | 85 | 1000993 | 旧编译副本 |
| dist.bak4/ | 83 | 680189 | 旧编译副本 |
| release/ | 86 | 624068282 | 清理前旧发行产物，不对应本轮源码验证 |
| release-s0/ | 85 | 623398381 | 旧阶段发行产物 |
| release-s0.bak/ | 86 | 623569646 | 旧阶段发行副本 |
| artifacts/installers/ | 9 | 980689740 | 7～10 月旧安装包、便携包 |
| artifacts/legacy-builds/ | 90 | 841744278 | 旧打包目录 |
| .workbuddy/ | 85 | 14209497 | 旧记忆已合并；其余为临时脚本、素材副本、s1 源码备份和缓存 |
| .codex-tmp/ | 8 | 50858 | 临时图标截图和空转换目录 |
| eb-err.log | 1 | 0 | 旧打包输出 |
| eb-out.log | 1 | 0 | 旧打包输出 |
| err.log | 1 | 101 | 旧运行输出 |
| out.log | 1 | 9203 | 旧运行输出 |
| ~$AWCA用户反馈1.docx | 1 | 162 | 遗留 Word 锁文件，检查时无 WINWORD 进程 |
| samples/ZNAWCA - sample 命名规范检查报告.md | 1 | 5569 | 全文已在 H39 保存 |

未尝试重删 A 中被阻止的空目录。不能报告以上约 3.46 GiB 空间已经释放。

### 保留范围

- 所有正式测试、现有业务实现、V1/V2 导入与存档迁移；接手时有效代码修改保留。
- tools/test-data/generate_v2_sample.py、generate_ideal_sample.py；samples 中的客户课程、国家示例课及其使用说明。
- 原始 Word 附件、artifacts/videos 参考视频。artifacts/source-archives/ZNAWCA - sample.rar 含 62 个文件、原平铺目录，与当前课程结构不同，未证明完全重复，因此保留。
- artifacts/znawca-14-media-grid 的 9 个历史图像/HTML 附件；历史用途统一从 HISTORY.md 说明，不是新验收记录或规则入口。
- node_modules 用于当前检查；.git 和仓库外课程/用户学习数据未清理。依赖分类与打包体积优化不混入本轮删除。

### B 验证结果

| 检查 | 本轮结果 |
|---|---|
| npm run typecheck | 通过，退出码 0 |
| npm test -- --reporter=dot | 40 个测试文件通过、1 个跳过；275 项通过、10 项跳过，退出码 0 |
| 测试限制 | V2-Sample 缺失导致原有条件跳过；有 React act 警告及模拟环境 HTMLMediaElement play/pause 未实现提示；未修改测试掩盖问题 |
| npm run build | 通过，退出码 0；dist 从当前源码重新生成，renderer 38 个模块；未打包或启动真实桌面 |
| 代码指纹 | 115 个基线文件中只缺失清单内 11 个；剩余 104 个哈希全部一致，零意外新增/内容改变；包括全部正式测试及接手时有效修改 |
| 输入资料指纹 | 232 个课程媒体、工作簿、原始 Word、参考视频与样例压缩包逐项一致 |
| 历史原文 | 新增 H12～H39 共 28 份与源文件归一化后完全一致；H01～H11 原文逐份未变 |
| 当前文档链接 | 6 份入口/历史文档共 60 个本地链接及显式锚点有效，历史纯文本内旧链接不算入口 |
| git diff --check | 通过；仅有 Git 换行提示，无空白错误 |
| 删除阻断复核 | 17 个批量目标全部仍存在，合计 3,711,318,688 字节（3.456 GiB）；没有把待清理量报告为已释放量 |

未提交、未推送。B 的未完成部分是物理删除与旧工具状态收敛，不是通过测试就能替代的验收条件。

## 后续起点

C、D 已完成本轮实现检查，下一独立主题是 E 的扩展接入验证与持续依赖约束，之后是 F 真实桌面验收；两者本轮未启动。B 的文件删除阻断继续单列。主控 GPT 是本轮唯一代码写入者；WorkBuddy 如参与，只做最终只读复核。

## C/D 实施顺序

1. C1：renderer 按 app、features/courses、features/study、features/history、features/settings、features/difficulty、shared、i18n、styles 归位，移除旧页面入口并同步全部引用。
2. C2：抽出媒体播放 hook，页面仅负责展示与局部交互。C 后运行类型检查和 smoke 回归。
3. D1：core 只保留纯规则；文件扫描、Excel、媒体签名和课程整理归 main/course；跨进程数据归 contracts；存档类型、迁移、更新、读写分开。
4. D2：会话完成流程、课程加载接口与去重、顺序保存和状态管理归 application；React 通过适配器组合，不直接承担完成会话后的多份记录更新。
5. D3：检查真实调用方向，补状态保存顺序/失败恢复、并发课程加载及会话状态一致性回归，运行完整测试、类型检查和构建。阶段结果只记录在本文件。

产品中的已知功能差距 A-01～A-06 不混入结构迁移。重构在现有未提交工作区上实施，不使用旧构建或 Git 历史覆盖现有代码；不新增副本目录、规则或独立进度文档。

## C/D 交付记录（2026-10-15）

### C：界面与文件组织

- 页面按课程、学习/测试、历史、设置、困难内容归入 features；共享题目展示和媒体播放归 shared，应用装配归 app。
- 五语言主文案分别存放在 i18n/locales；课程、学习、历史等补充文案按功能归位。保留原文案与课程语音语言规则。
- 抽出 usePlayback、useQuestionSets、useCourseLibrary；展开 TS/TSX 与样式格式，功能样式与对应页面相邻，全局主题单独保留。
- 旧 app-shell 代码文件及引用移除，不留兼容转发壳。C 阶段 smoke 回归 13 个文件、84 项通过后进入 D。

### D：流程、状态与系统适配

- core 中的目录/Excel/媒体读写迁入 main/course；内容校验保留为纯规则并通过资源参数获得扫描结果。
- contracts 集中桌面 API、课程库结果与存档结构；preload 使用新契约。main 拆开窗口装配、IPC、课程库服务、媒体 URL 和存储模块。
- LocalStateStore 统一持久状态与保存顺序；加载前的修改在读取成功后合并，读写失败可见且可重试。磁盘层按文件串行写入，避免共享临时文件被并发替换。
- StudySession 封装开始、提交、超时、下一题、保存、恢复；completion 统一历史、进度与困难更新。React 订阅快照，不再另外持有一份控制器队列或持久化设置。
- CourseAccess 对相同课程的在途加载去重；课程 hook 管理目录与已加载内容，异步扫描只更新课程缓存，不覆盖扫描期间的新设置。
- 存档默认值、纯更新、校验、迁移、文件写入分别归位，保留既有兼容迁移与损坏 JSON 处理。没有升级依赖或修改打包配置。

### 检查结果

| 检查 | 实际结果 |
|---|---|
| npm run typecheck | 通过，退出码 0 |
| npm test -- --reporter=dot | 44 个文件通过、1 个文件跳过；286 项通过、10 项跳过，退出码 0；较 B 新增 11 项 |
| 新增覆盖 | 慢保存顺序、保存失败/重试、读取期间编辑、读取失败后合并重试、课程加载去重/失败重试、会话单次完成、保存恢复、真实文件并发写入、文件不可读报错、界面错误重试、延迟扫描保留新设置 |
| npm run build | 通过，退出码 0；当前源码重建 dist，renderer 77 个模块；未运行 package:win |
| 模块边界静态复核 | 检查 301 条源码相对依赖，未发现层级反向引用；core/application/contracts 无平台外部依赖，renderer 无 main/Node/Electron 导入；尚未加入持续检查脚本 |
| 桌面桥接与旧路径 | renderer 只有 adapters/desktop.ts 引用 window.znawca；src/tests/tools 未发现旧 app-shell、core/persistence、core/localization 或已迁移 loader/organizer/xlsx 路径 |
| 测试迁移 | 原断言语义保留；保存断言等待顺序队列完成，CSS 断言容许格式空白但保持原尺寸要求；没有删除用例或增加跳过 |
| 已复现并修复的失败 | 并发保存导致临时文件 rename ENOENT；不可读文件被当作默认状态；界面缺少保存错误提示。新增回归在相应修复后通过 |
| 联调调整 | 修正迁移后的 CSS 引用、让注入时钟兼容假计时器、保持旧桥接可选能力与异步保存断言；最终全量无失败 |
| 额外 unused 检查 | 清除新源码中的未用导入；额外 noUnusedLocals 检查仍报告原 tests/course/v2-multilanguage.test.ts 两个未用样例常量，不属于既有 typecheck 门禁，未为此次迁移改写样例 |
| git diff --check | 通过；有 Git 换行格式提示，无空白错误 |

仍有 React act 警告和 jsdom 未实现媒体 play/pause 的提示；V2-Sample 的原有 10 项条件跳过仍在。没有运行真实 Electron 窗口、安装包或独立验收，不能据此宣称所有产品行为已经验收。A-01～A-06、阿/俄语言专家审订及 B 物理删除阻断继续保留；本轮未重试删除受阻目标。

当前结果仍是上述 HEAD 加未提交修改，未提交、未推送。文档只更新现有 PRODUCT、ARCHITECTURE、WORK 与 README；没有新增约束副本、备份实现或分散验收报告。

## 远端保存与桌面更新（2026-10-15）

用户指定仓库：https://github.com/alaskevin2006-del/ZNAWCA 。当前源码交付主线为 main；旧 HEAD 62ec49553cb32ae64835d32736cbc234bebf505c 已推送到 archive/pre-refactor-2026-10-15，远端引用核对一致。原始文档从当前 Git 索引移出，但物理文件未删除，旧分支保留原文件。

资料归档：https://github.com/alaskevin2006-del/ZNAWCA/releases/tag/archive-materials-2026-10-15 。附件 reference-materials-2026-10-15.tar.gz 包含 samples、原始反馈/规格、参考视频、历史截图和原始样例压缩包，共 443,254,947 字节。GitHub 返回 uploaded，服务器 SHA-256 与本地一致：37bbd50e609bd06108e72fb48f809b15d2f859740f4c802e4f4deb7b70dda62f。docs/requirements 下另一版本规格保存在旧 Git 分支中，不将两个不同版本视为重复。

桌面使用原文件名替换，未新增带日期的备份 EXE：

| 文件 | SHA-256 |
|---|---|
| C:/Users/Kevin/Desktop/Znawca-Portable-1.0.0-x64.exe | B59CB60E8E24869CE925937D8626DE45452E0DC9358D25AB1A0897943088CE53 |
| C:/Users/Kevin/Desktop/Znawca-Setup-1.0.0-x64.exe | 5F9798D5A5B08BB23857A0E43BE1A3A63116F436E1DAEFBA2948235CF5149DC8 |

使用现有 assets/icon.ico，SHA-256 20FE17F26FF613866C3B6B0DD4EF12AC3541B8B157F72B29E74EF51BF583B9B6 未变；未修改任何桌面 .lnk。检查用户桌面与公共桌面未发现 Znawca 快捷方式，未发现对应用户安装登记，本轮更新对象为桌面两个 EXE，未执行安装程序。

构建与 NSIS/portable 打包成功。包内 main、preload、renderer 关键编译文件与本次 dist 的 SHA-256 一致；桌面文件与打包输出一致。类型检查通过；全量测试 44 个文件通过、1 个跳过，286 项通过、10 项跳过，退出码 0；既有 act 和模拟媒体警告仍在。未执行真实窗口完整交互或安装验收。

本地清理尚未完成：旧产物批量删除和已上传资料的本地删除，均被自动审批在执行前拒绝，只有 blocked by policy，无详细理由；不换工具绕过。本轮未释放这些目标占用，B 清单、四个空目录和桌面 ZNAWCA.zip 仍保留。首次在 release 打包还遇到 app.asar 占用，最终改用系统临时目录成功打包；release 不代表最终交付产物。上传与打包中间文件的临时目录为 C:/Users/Kevin/AppData/Local/Temp/znawca-package-90e0b8b414824daa91405018e4dce810，清理结果以最终回执为准。

WorkBuddy 越界创建的 2026-10-15 记忆已全文追加到 HISTORY 的 H40；统一入口明确只读任务也禁止工具自动记忆写入。原文件因清理阻断仍在。依赖目录保留用于当前开发；不能以忽略规则或移出 Git 索引冒充物理空间已释放。

最终回执：当前代码提交 1e3ce28dd585cc63e35b99c2a3324e156a9a47ef 已推送 main，远端 SHA 核对一致；仓库默认分支已改为 main。本轮临时打包目录删除同样被自动审批拒绝，仍占 1,067,325,179 字节；没有通过换工具或委派绕过。远端保存、桌面更新完成，本地物理清理未完成。
