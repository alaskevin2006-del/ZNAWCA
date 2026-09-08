# WorkBuddy 实施任务与验收标准（ZNAWCA-15）

> 执行原则：先审计、后最小修改；已有正确实现只补测试，不重写。按批次顺序执行，每批完成并记录后再进入下一批。

## 1. 全局任务边界

### 必须执行

1. 开始前读 `README.md`、`DECISIONS.md` 和本文件。
2. 先在 `CHANGELOG.md` 登记基线与每项现状：`已满足/部分满足/未实现`。
3. 每个行为修改必须新增或更新自动测试；测试必须验证结果，而非只验证函数被调用。
4. 每批完成后运行该批定向测试；全部批次完成后运行 `npm run typecheck`、`npm test -- --run`、`npm run build`。
5. 最终把改动文件、测试结果、已知风险和未决问题写入 `CHANGELOG.md`。

### 禁止事项

- 不修改 `DECISIONS.md`、`WORKBUDDY-TASKS.md` 或 `ACCEPTANCE.md`。
- 不实施 `DECISIONS.md` 第 4 节排除项。
- 不重置、删除、覆盖既有未提交改动；不做无关格式化、改名、目录整理或依赖升级。
- 不修改用户课程文件，不删除用户数据，不生成正式安装包。
- 不为让测试通过而降低断言、删除测试或把异常静默吞掉。

## 2. 批次 S0：返工 ZNAWCA-14 验收不通过项

### 包含决策

`D-10`、`D-11`、`D-12`、`D-13`、`D-14`

### S0-1：D-12 拆模块（优先，阻塞 D-13）

- 把 `feedback-sounds.ts` 拆为浏览器安全的纯选择函数（`selectFeedbackSound`）与 Node 端扫描器（`scanFeedbackSounds`），renderer 不再顶层导入含 `node:fs/promises`/`node:path` 的模块。
- 通用媒体扫描（`scanCourseMedia`）排除严格合法的 feedback 文件（`correct NN.mp3`/`incorrect NN.mp3`），不再产生 `MEDIA_FILE_UNMATCHED` 误报。
- 加 loader 集成测试：合法提示音导入且不产生对象媒体警告；加 dev renderer 冒烟测试。
- 验收：`npm run dev:renderer` 页面不空白；合法提示音不误报。

### S0-2：D-13 播放链集成测试

- 补真实 AppShell 测试，分别触发完全正确、部分正确、错误、超时，断言集合选择与播放顺序；断言切题/退出/手动播放取消旧链。
- 验收：四路径均经 AppShell 集成断言通过。

### S0-3：D-11 2×2 裁切修复

- 在实际 Session 整体布局内压缩卡片/媒体尺寸，使 960×640 下 3/4 项图片与音频完整可见。
- 加浏览器级断言：逐项 `getBoundingClientRect().bottom <= innerHeight`，验证无需为看全选项滚动。
- 验收：960×640 下第二行完整可见。

### S0-4：D-14 缺失媒体 warning

- 在 V1 可确定的缺失媒体语义上实现可定位 warning/题型跳过并补测试。
- 排除合法 feedback 文件的对象媒体误报。
- 验收：缺失媒体产生可定位 warning；好/坏媒体共存课程可打开。

### S0-5：D-10 跨课程隔离测试

- 恢复「相同 objectId、不同 courseId 互不影响」的 DifficultyMemory 测试，保留本批对象级测试。
- 验收：跨课程隔离 + 对象级合并测试均通过。

## 3. 批次 S1：Excel V2 数据模型

### 包含决策

`D-15`、`D-16`、`D-17`、`D-18`

### 允许修改

- `src/core/course/loader.ts`、`media.ts`、`validation.ts`、`types.ts`、`organizer.ts`
- `src/core/course/xlsx/xlsx-adapter.ts`
- 数据模型相关类型文件
- 对应 `tests/course/*`、`tests/smoke/*`

### 实施要求

1. 固定 V2 结构：`A1` 课程显示名、`A2+` 主媒体、`B1` 名称双向题干、`B2+` 名称/别名、`C1+` 属性双向题干、`C2+` 答案/属性媒体。
2. 语言后缀工作簿解析：`Birds_Eng.xlsx`/`Birds_Ru.xlsx`，按基础名＋语言后缀分组。
3. 共享 `media/` + 分语言 `speech/<lang>/` 目录结构。
4. 媒体引用语法应用于 A 列和属性单元格；`/` 分隔同类型媒体变体。
5. 格式版本标识区分 V1/V2，V1 只读兼容。
6. 制作最小多语言样例（用于测试）。

### 自动验收

- `A1` 在不同语言工作簿显示不同课程名。
- 英语/俄语工作簿可引用同一张图片。
- 单元格 `/` 分隔的多张图片不互为干扰项。
- 混合媒体类别（图片+文字）导入失败并精确指出列和单元格。
- V1 课程按旧模型只读兼容，不报错。

## 4. 批次 S2：出题/判题扩展

### 包含决策

`D-19`、`D-20`、`D-21`

### 允许修改

- `src/core/quiz/scoring.ts`、`generator.ts`、`filter.ts`、`question-set.ts`、`course-adapter.ts`
- 对应 `tests/quiz/*`

### 实施要求

1. `/` 双向题干表头解析：首个 `/` 分隔，两侧必填，缺失阻断导入并报位置。
2. `/` 别名解析：`;` 分必答组、`/` 组内任选；多别名判对；选择题原样显示别名。
3. 列角色标记：`$`/`*` 声明「仅作问题/仅作答案」，不替代 D-01 跳过逻辑。

### 自动验收

- `China/PRC; Asia` 接受 `China; Asia`、`PRC; Asia`、`China; PRC; Asia`。
- `A/B` 不被拆成两个必答项。
- 缺 `/` 或任一侧的标题阻断导入并报位置。
- 声明「仅作答案」的列不生成以该列为题干的反向题。

## 5. 批次 S3：朗读与多媒体

### 包含决策

`D-22`、`D-23`

### 允许修改

- `src/core/course/loader.ts`、`media.ts`、`types.ts`
- `src/main/main.ts`、`media-protocol.ts`
- `src/renderer/app-shell/AppShell.tsx` 及播放器局部模块/样式
- 对应 `tests/course/*`、`tests/smoke/*`

### 实施要求

1. `speech/<lang>/` 分语言朗读目录；`C4.mp3` 坐标命名；双向标题 `C1-F.mp3`/`C1-R.mp3`。
2. 文字题出现时自动播放问题单元格音频（题目本身是媒体时不播）。
3. 问题行和文字答案按钮的扬声器图标；点击不等于提交答案。
4. 无朗读文件静默跳过，不启用 TTS。

### 自动验收

- 同一坐标不同语言播放各自录音。
- 正反向题干不播同一段。
- 媒体题不自动朗读。
- 扬声器点击不触发提交。

## 6. 批次 S4：进度统计

### 包含决策

`D-24`

### 允许修改

- `src/core/progress/knowledge-progress.ts`
- `src/core/session/learning-session.ts`、`testing-session.ts`
- `src/renderer/app-shell/AppShell.tsx` 中进度展示局部
- 对应 `tests/session/*`、`tests/smoke/*`

### 实施要求

1. 一个「名称＋学习单元格」关系计一个进度单位。
2. 空单元格、缺失/损坏媒体、无区分度列不计。
3. 正反向、题型、媒体变体不重复计数。
4. Learning 开始时固定总数；重试不增总数；Testing 显示总数/已完成/剩余。

### 自动验收

- 同一关系重试多次总数不变。
- 正反向题和不同题型不重复占进度。
- Testing 显示总数/已完成/剩余。

## 7. 批次 S5：界面语言收尾

### 包含决策

延后项（阿拉伯语/俄语文案，需客户专家定稿）。

- 本批不实施；待客户给出专家定稿后的阿/俄文案再单独修改。
- 英文/波兰/中文已在 ZNAWCA-14 改完，本批复核即可。

## 8. 最终交付格式

WorkBuddy 完成后只交付：

1. 更新后的 `CHANGELOG.md`。
2. 修改过的源码与测试。
3. S0-3 的界面证据文件路径。

不得自行填写「验收通过」；独立验收由另一 GPT 在 `ACCEPTANCE.md` 完成。
