# 启动指令

## 交给 WorkBuddy

```text
请实施 ZNAWCA 当前已批准的 14 项修改。唯一任务入口是：
C:\Users\Kevin\Desktop\ZNAWCA\docs\iterations\ZNAWCA-14\README.md

请依次完整读取 README.md、DECISIONS.md、WORKBUDDY-TASKS.md、CHANGELOG.md，然后严格按 A→F 批次执行。先审计当前实现；已经满足的能力只补充缺失测试，不重写。不得实现 DECISIONS.md 第 2 节的任何排除项，不得自行解释或修改需求，不得覆盖工作区原有改动。

你只能更新 CHANGELOG.md，不能修改 DECISIONS.md、WORKBUDDY-TASKS.md 或 ACCEPTANCE.md。每批完成后记录改动与定向测试；最终运行 typecheck、全量测试和 build。遇到歧义或必须扩大范围时停止，并在 CHANGELOG.md 记录阻塞，等待项目主控决定。
```

## 交给独立验收 GPT

```text
请独立验收 WorkBuddy 对 ZNAWCA 14 项修改的交付。唯一验收入口是：
C:\Users\Kevin\Desktop\ZNAWCA\docs\iterations\ZNAWCA-14\README.md

请依次完整读取 README.md、DECISIONS.md、WORKBUDDY-TASKS.md、CHANGELOG.md 和 ACCEPTANCE.md。独立检查代码差异、自动测试、构建和必要界面行为，不要仅采信 WorkBuddy 的完成描述，也不要直接修代码或修改需求。

你只能把结果写入 ACCEPTANCE.md。逐项对 D-01～D-14 判定“通过/不通过/阻塞”并附证据；检查是否触碰排除项、削弱测试或产生无关改动。任一失败项都应记录并退回项目主控，最终不要自行宣布项目完成。
```

