# ZNAWCA-15 实施台账

> 填写者：WorkBuddy（主干）｜状态：S0 已完成，S1~S5 待实施

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
| D-15 | 未开始 | S1 | | |
| D-16 | 未开始 | S1 | | |
| D-17 | 未开始 | S1 | | |
| D-18 | 未开始 | S1 | | |
| D-19 | 未开始 | S2 | | |
| D-20 | 未开始 | S2 | | |
| D-21 | 未开始 | S2 | | |
| D-22 | 未开始 | S3 | | |
| D-23 | 未开始 | S3 | | |
| D-24 | 未开始 | S4 | | |
| D-25 | 未开始 | S3 | | |

## 3. 批次记录

### 批次 S0（返工，代码已在工作区完成）

- 开始/完成时间：2026-09-07 审计确认
- 修改摘要：D-10~D-14 五项返工在工作区已全部完成（见上表），本轮仅审计、验证并补齐台账，未改源码。
- 验证：typecheck ✅、test 27文件175项 ✅、build ✅、`npx vite` 开发服务器 ready in 1478ms（无 node:fs 崩溃）。
- 与任务方案的偏差：无。
- 风险或阻塞：S0 改动仍混在脏工作区未提交，ACCEPTANCE 由定时验收自动化接管。

## 4. 最终验证

（S1~S5 完成后回填）

## 5. 最终交接

（S1~S5 完成后回填）
