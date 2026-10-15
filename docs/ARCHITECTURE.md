# ZNAWCA 架构

> 2026-10-15。明确区分当前事实与目标；实施进度只在 [WORK.md](WORK.md) 维护。团队约束见 [AGENTS.md](../AGENTS.md)，行为见 [PRODUCT.md](PRODUCT.md)。

## 当前实现

Electron + React + TypeScript + Vite；TypeScript 启用 strict。当前源码按以下职责组织，旧 renderer/app-shell、core/persistence、core/localization 和 preload/contracts.ts 入口已移除，调用方直接使用新路径。

```text
src/
  core/                  纯领域规则
    course/              课程模型、表格内容校验、媒体分类与选择
    quiz/                出题、过滤、判题
    session/             学习/测试控制器
    progress/ difficulty/ shared/
  application/           不依赖 React、Electron 或 Node 的业务组合
    courses/             课程访问接口、并发请求去重、目录模型转换
    state/               状态唯一入口、默认值、纯更新函数
    study/               会话动作与完成后的记录更新
  contracts/             IPC 数据、存档结构、课程整理结果
  main/
    course/              目录扫描、媒体检查、课程整理、xlsx 读取
    storage/             存档校验、迁移、解析、磁盘读写
    ipc/                 请求处理与参数校验
    main.ts              窗口、协议与运行时装配
  preload/               受控桌面桥接
  renderer/
    adapters/            桌面接口到应用接口的转换
    app/                 组件装配、导航与页面切换
    features/            courses、study、history、settings、difficulty
    shared/              复用的题目展示、媒体播放、保存错误提示
    i18n/                locales 下五语言表，其他文件按功能组织文案
    styles/              全局主题与通用提示样式
```

页面专属样式与页面放在同一功能目录。全局 app-shell.css 保留原来的覆盖顺序；本次展开压缩格式，没有按选择器机械拆分，以免改变层叠关系。AppShell 仍负责跨页面参数装配与导航；会话控制器、完成记录更新、播放协调和课程目录操作均有独立入口。

## 模块责任

模块化单体、明确分层、接口隔离、组合优先。纯规则用函数；会话和播放等有状态生命周期用类/状态机；React 保持函数组件。接口用于实际变化点，不为每个文件建立抽象类。

| 位置 | 责任 |
|---|---|
| core/ | 课程、出题、判题、会话、进度和困难的纯规则；不访问 Node 文件、DOM 或 Electron |
| application/ | 开始、提交、完成、恢复等完整业务流程及应用状态更新，通过接口使用外部能力 |
| main/ | Electron 装配、IPC 校验、课程文件/Excel 适配、存储、媒体协议与路径安全 |
| preload/ | 最小桥接实现 |
| contracts/ | 普通可序列化的跨进程请求/响应，不传类实例 |
| renderer/app/ | 应用装配与页面切换 |
| renderer/features/ | courses、study、history、settings、difficulty 的页面和专属交互 |
| renderer/shared/、i18n/、styles/ | 已有真实复用的组件/播放器、语言资源、全局主题 |

## 调用与状态

- 页面调用应用流程；应用流程组合 core 规则，并依赖存储、课程访问等小接口；运行时入口装配实际实现。
- 浏览器侧适配器通过 preload 调用主进程；主进程把磁盘路径转换为界面可用的媒体数据。core 与共享契约不反向引用具体适配器。
- 会话控制器管理会话事实，页面从快照显示；弹窗、展开项等局部状态归组件，避免 React 与控制器分别维护同一份题目/进度事实。
- 完成会话统一生成历史、知识进度和困难更新；保存入口管理顺序与失败反馈。旧存档迁移与文件写入分离。
- 文件扫描/Excel 读取输出统一课程模型；标题、角色和答案解析归课程规则，出题模块不解释磁盘格式。
- 自动与手动媒体共享播放协调入口；对象组合采用显式依赖注入，不引入全局万能服务或通用事件总线。

| 状态或能力 | 当前唯一管理入口 | 使用方式 |
|---|---|---|
| 本地设置、历史、进度、困难记录 | application/state/LocalStateStore | 组件订阅快照；通过 update/updateSettings 更新，外部读写由 StatePersistence 注入 |
| 当前学习/测试会话 | application/study/StudySession | 内部持有 core 控制器；暴露开始、提交、超时、下一题、保存、恢复及显示快照 |
| 完成会话后的记录变更 | application/study/completion.ts | 一次纯更新合并历史、进度与困难记录，避免页面分散写入 |
| 课程目录、已加载课程、选择项 | renderer/features/courses/useCourseLibrary | 活跃课程从选择 ID 派生；迟到的请求不能恢复已清空/失效的目录 |
| 课程访问 | application/courses/CourseAccess、CourseGateway | 接口注入；相同课程的在途请求合并，失败后允许重新加载 |
| 媒体协调 | renderer/shared/media/usePlayback、feedback-playback.ts | 自动播放与用户操作共用协调器，卸载时取消播放链 |
| 弹窗、输入、展开项、导航 | React 页面及 app 装配 | 局部显示状态，不另存一份持久化设置或会话队列 |

LocalStateStore 在首次读取完成前暂存更新；读取失败不写入默认数据，重试成功后把暂存操作应用于原存档。保存按顺序提交，失败保留当前内存结果并展示重试入口；磁盘层另按目标路径串行执行临时文件写入与替换，避免并发争用。仍沿用原有存档格式和 v1～v7 迁移，不把“无法读文件”混同于“首次运行没有文件”。损坏 JSON 的兼容解析策略保持原样。

core/course/validation*.ts 只校验传入的工作表与资源描述；main/course/validation*.ts 准备文件标题、媒体扫描和语音目录信息。renderer 只有 adapters/desktop.ts 访问 window.znawca，其他模块使用普通接口。preload 的通道字面量由 contracts 的类型校验约束，保留沙箱要求的独立桥接脚本。

## 扩展位置

| 新能力 | 预计修改位置 | 应保持稳定 |
|---|---|---|
| 界面语言 | renderer/i18n/locales、功能文案、语言注册与校验 | 判题、进度、保存 |
| 导入格式 | main/course 适配器、识别入口与样例；必要时补 core 内容校验 | 统一课程模型下的会话流程 |
| 出题策略 | 策略实现、配置入口与测试 | 存储和无关策略 |
| 题型 | 类型契约、生成/判定、展示与注册 | 无关页面和既有题型 |
| 历史展示 | renderer/features/history 与应用层查询 | 导入与会话规则 |
| 存储后端 | StatePersistence 实现、renderer/adapters 或 main/storage 及迁移 | 页面与判题规则 |

只为当前确有需求的变化点建接口；模型变化允许有界的契约修改，不承诺所有扩展零修改旧代码。依赖检查与小型适配器接入验证在 E 阶段落实。

## 迁移与验证

已有规则测试保留；tests/application 验证顺序保存、失败重试、课程请求去重和会话完成一致性；tests/platform 验证真实临时文件并发写入；tests/smoke 验证页面流程与保存错误反馈。测试引用直接迁移，不留旧实现转发壳。

smoke 使用 React 模拟环境，不能代表真实窗口布局、媒体播放和安装验证。持续依赖约束、扩展接入实验与真实桌面验收分别留在 E/F；具体检查结果与已知功能差距只在 WORK.md 维护。
