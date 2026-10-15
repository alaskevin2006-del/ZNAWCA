# ZNAWCA

面向 Windows 的本地学习与测试应用，使用 TypeScript、React、Electron。课程来自 Excel 和本地媒体，学习记录保存在当前 Windows 用户的应用数据目录。

## 项目入口

- [AGENTS.md](AGENTS.md)：GPT / WorkBuddy 唯一团队约束入口。
- [产品基线](docs/PRODUCT.md)：当前有效规则，不代表全部已经实现或验收。
- [架构](docs/ARCHITECTURE.md)：当前结构、目标边界和扩展方式。
- [当前工作](docs/WORK.md)：工作区基线、已知问题、阶段状态与实际验证。

## 开发与检查

在项目根目录使用 Node.js / npm；依赖版本以 package-lock.json 为准。

```powershell
npm ci
npm run dev
npm run typecheck
npm test
```

首次开发先安装依赖。`dev` 同时启动界面开发服务、主进程编译和 Electron；单独 `npm start` 依赖已有构建产物。

```powershell
npm run build
npm run package:win
```

`build` 会重建 dist；`package:win` 向 release 输出 Windows 安装版、便携版和解包目录。实际构建、测试和发行验证结果以 WORK.md 为准，旧产物不能代表当前源码。

## 从哪里找代码

| 要处理的内容 | 位置 |
|---|---|
| 课程页、学习/测试页、历史、设置、困难内容 | src/renderer/features 下对应功能目录；专属样式同目录 |
| 页面装配与导航 | src/renderer/app |
| 共用播放器、题目展示 | src/renderer/shared |
| 翻译与全局主题 | src/renderer/i18n、src/renderer/styles |
| 会话流程、状态保存、课程访问接口 | src/application |
| 出题、判题、进度等纯规则 | src/core |
| Excel/媒体读取、存档迁移、IPC | src/main/course、src/main/storage、src/main/ipc |
| 跨进程数据与桌面桥接 | src/contracts、src/preload、src/renderer/adapters |
| 自动测试 | tests，按 application、course、session、platform、smoke 等责任组织 |

具体依赖关系、状态所有者和扩展入口见 [架构](docs/ARCHITECTURE.md)。tools/test-data 保留样例生成器；原始课程、附件与参考媒体已保存到 [远端资料归档](https://github.com/alaskevin2006-del/ZNAWCA/releases/tag/archive-materials-2026-10-15)，需要时单独下载。旧源码见远端 archive/pre-refactor-2026-10-15 分支，不作为当前实现入口。本地清理实际进度见 [当前工作](docs/WORK.md)。

