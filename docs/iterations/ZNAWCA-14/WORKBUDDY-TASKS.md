# WorkBuddy 实施任务与验收标准

> 执行原则：先审计、后最小修改；已有正确实现只补测试，不重写。按批次顺序执行，每批完成并记录后再进入下一批。

## 1. 全局任务边界

### 必须执行

1. 开始前读取本目录 `README.md`、`DECISIONS.md` 和本文件。
2. 先在 `CHANGELOG.md` 登记基线与每项现状：`已满足/部分满足/未实现`。
3. 每个行为修改必须新增或更新自动测试；测试必须验证结果，而非只验证函数被调用。
4. 每批完成后运行该批定向测试；全部批次完成后运行：
   - `npm run typecheck`
   - `npm test -- --run`
   - `npm run build`
5. 最终把改动文件、测试结果、已知风险和未决问题写入 `CHANGELOG.md`。

### 禁止事项

- 不修改 `DECISIONS.md`、`WORKBUDDY-TASKS.md` 或 `ACCEPTANCE.md`。
- 不实施 `DECISIONS.md` 第 2 节排除项。
- 不重置、删除、覆盖既有未提交改动；不做无关格式化、改名、目录整理或依赖升级。
- 不修改用户课程文件，不删除用户数据，不生成正式安装包。
- 不为让测试通过而降低断言、删除测试或把异常静默吞掉。
- 不一次性重写题库、会话、持久化或 AppShell；优先局部函数和明确接口。

## 2. 批次 A：出题范围与干扰项

### 包含决策

`D-01`、`D-07`、`D-08`

### 允许修改

- `src/core/quiz/filter.ts`
- `src/core/quiz/generator.ts`
- `src/core/quiz/question-set.ts`
- `src/core/quiz/course-adapter.ts`
- 与上述逻辑直接相关的类型文件
- `tests/quiz/*`、必要的 `tests/smoke/*`

### 实施要求

1. 验证反向文字题仅在属性值对应唯一对象时生成；不唯一时记录明确跳过原因。
2. 保持同一 `#` 字段 OR、字段间 AND；空选择不产生意外过滤。
3. 严格/宽松只切换干扰项池，目标对象始终来自筛选范围。
4. 干扰项去重并排除正确值；4 项不足降到 3 项，仍不足按现有规格降级输入。

### 自动验收

- 两个对象共享同一属性时，不产生歧义反向单选；正向题仍存在。
- 同字段选择 A/B 返回并集；再加另一字段只保留交集。
- 宽松模式可从筛选外但课程内取得干扰项；严格模式不能。
- 无论模式如何，筛选外对象不能成为题目目标。
- 每道选择题仅一个正确答案，选项无重复。

## 3. 批次 B：答案解析与统一判定

### 包含决策

`D-02`、`D-03`、`D-04`、`D-05`、`D-06`

### 允许修改

- `src/core/course/normalization.ts`
- `src/core/quiz/scoring.ts`
- `src/core/quiz/types.ts`
- `src/core/session/learning-session.ts`
- `src/core/session/testing-session.ts`
- `src/core/difficulty/difficulty-memory.ts` 中仅与正确口径直接相关部分
- 对应 `tests/course/*`、`tests/quiz/*`、`tests/session/*`

### 实施要求

1. Excel 解析继续仅按半角分号拆分，不改变 V1 数据格式。
2. 只在“用户提交答案”解析中接受四种分隔符。
3. 比较前统一大小写、首尾/连续空白和下标数字；不要使用 NFKC。
4. 用同一 `fullyCorrect` 语义驱动 Learning、Testing、超时和困难汇总。
5. 保留命中、漏答、多答明细；部分命中不得计满分。

### 自动验收

- `A; B`、`b，a`、` A；B ` 完全正确且顺序无关。
- `A/B` 不会被拆成两个答案。
- 缺一项、多一项、包含错误项均 `fullyCorrect=false`。
- `H₂O` 与 `H2O` 等价；`x²` 与 `x2` 不等价；其他字符差异仍判错。
- 同一份部分正确/多答输入在 Learning、Testing、困难评价中均为未完全正确。
- 超时在 Testing 和困难评价中均按错误处理。

## 4. 批次 C：Testing 与困难内容

### 包含决策

`D-09`、`D-10`

### 允许修改

- `src/core/progress/knowledge-progress.ts`
- `src/core/difficulty/difficulty-memory.ts`
- `src/core/session/testing-session.ts`
- `src/core/session/session-controller.ts`
- `src/core/persistence/index.ts` 中仅限兼容本批数据
- `src/renderer/app-shell/AppShell.tsx` 中仅限正确传递 `difficultFirst` 和本批所需数据
- 对应 `tests/session/*`、`tests/persistence/*`、必要的 smoke 测试

### 实施要求

1. Testing 候选池不得先过滤 `mastered=true`；掌握状态不控制是否可测试。
2. Testing 按知识项目去重，每个入选项目一次。
3. 困难记录键必须是课程＋对象，不含属性、媒体类型、方向或题型。
4. `difficultFirst=false` 时不加权；`true` 时对象级固定 2:1 权重，并避免一个对象因题目变体多而额外增权。
5. 删除学习 30%/测试 40%配额；只保留一套对象级加权入口。
6. 每个完成会话按对象汇总一次：该对象有任一未完全正确即困难且恢复归零；全对才累计一次；未出现不计；其他对象错误不影响它。
7. 保留旧本地数据的安全迁移；无法可靠迁移的旧字段不得造成崩溃或虚假增权。

### 自动验收

- 未掌握项目能进入 Testing；同一知识项目在一次测试不重复。
- 开关关闭时固定随机源下不调用困难优先；开启时困难/普通对象权重恰为 2/1。
- 同对象多个属性只产生一条困难记录。
- 同会话同对象多次错误只汇总一次；任一错误使其恢复归零。
- 两个实际出现且该对象自身全对的完成会话后清除；未出现不计；另一对象答错不影响它。
- 持久化旧数据加载不崩溃，迁移后不保留同对象多条互相竞争的困难记录。

## 5. 批次 D：图片与音频选项 2×2

### 包含决策

`D-11`

### 允许修改

- `src/renderer/app-shell/choices.css`
- `src/renderer/app-shell/media-question.css`
- `src/renderer/app-shell/app-shell.css` 或 `settings.css` 中必要的局部布局
- `src/renderer/app-shell/AppShell.tsx` 中仅限增加稳定 class/语义标记
- `tests/smoke/*` 中对应界面测试

### 实施要求

1. 仅图片和音频四选项使用固定 2×2；文字选择题保持原布局，视频不纳入本轮。
2. 4 项为两列两行；3 项仍为两列两行，最后一项单独占位但不强制拉伸跨两列。
3. 在应用规定的最小常规窗口尺寸内，四项同时可见，题目选项容器不出现自身滚动条。
4. 保持键盘、焦点、标签点击和音频播放控件可用；不得用视觉顺序改变答案数据顺序。

### 自动与人工验收

- 组件测试验证图片/音频 4 项获得媒体网格标记，文字/视频不误用。
- 组件测试验证四个选项均渲染且可选择，音频控件可操作。
- WorkBuddy 在 `CHANGELOG.md` 记录人工检查的窗口尺寸、3 项和4项截图路径；截图只作证据，不替代自动测试。

## 6. 批次 E：正误提示音与播放链

### 包含决策

`D-12`、`D-13`

### 允许修改

- `src/core/course/loader.ts`、`media.ts`、`types.ts` 中仅限课程级提示音和既有坐标朗读资源
- `src/main/main.ts`、`media-protocol.ts`
- `src/preload/contracts.ts`、`index.cts`
- `src/renderer/app-shell/AppShell.tsx` 及必要的播放器局部模块/样式
- `src/core/persistence/index.ts` 中仅限短期随机避重状态
- 对应 `tests/course/*`、`tests/platform/*`、`tests/smoke/*`

### 实施要求

1. 提示音只扫描课程根目录严格命名文件；排序后再通过可注入随机源选择，测试可复现。
2. 完全正确使用 correct 集合；其他结果含部分正确、错误、超时均使用 incorrect 集合。
3. 同集合存在两个以上候选时，尽量不连续重复；只有一个时允许重复。
4. 实现单一播放协调器：正误音结束后才播放正确答案音频；新题、退出、再次提交或手动播放时明确取消旧链。
5. 正确答案音频只使用 V1 已有/可确定的坐标朗读资源或当前音频答案，不引入单元格媒体 V2。若当前 V1 无法可靠确定某题的正确答案音频，则跳过并记录，不得猜测。
6. 文件缺失、损坏、被删除或播放失败均不影响判题、计分、保存和进入下一题。

### 自动验收

- 只识别 `correct 00.mp3`/`incorrect 99.mp3` 等合法名称；错误前缀、位数、扩展名和子目录文件不识别。
- 编号不连续仍完整识别；固定随机源结果可复现；多个候选避免连续重复。
- 正确、部分正确、错误、超时分别选择正确集合。
- 事件顺序严格为提示音结束后才启动答案音频；切题/退出会触发停止。
- 空集合、损坏文件和播放拒绝不会抛出未处理异常，也不会阻止下一题。

## 7. 批次 F：错误定位与媒体降级

### 包含决策

`D-14`

### 允许修改

- `src/core/course/loader.ts`、`media.ts`、`validation.ts`、`types.ts`
- `src/main/main.ts` 与导入报告相关部分
- `src/renderer/app-shell/course-errors.css`、`AppShell.tsx` 中仅限错误报告展示
- 对应 `tests/course/*`、`tests/smoke/course-import-flow.test.tsx`

### 实施要求

1. 保持 V1 错误与警告等级：结构性无有效课程阻断；单媒体问题为可定位警告。
2. 每条问题包含可获得的文件、工作表、行、列或媒体路径、原因和用户可执行建议。
3. 单媒体异常只移除该媒体；该对象的文字题和其他有效媒体题继续。
4. 全部有效学习内容耗尽时才阻止进入课程，并说明根因。
5. 任何内存规范化不得写回用户 Excel 或移动/删除媒体。

### 自动验收

- 缺失、损坏、不支持和放错目录媒体分别产生可定位警告。
- 一个坏媒体与一个好媒体共存时课程可打开，好媒体和文字题可用。
- 课程完全无有效学习内容时不可打开，错误包含文件/工作表及修复建议。
- 导入前后用户 Excel 和媒体文件的内容、时间戳及位置不被程序修改。

## 8. 最终交付格式

WorkBuddy 完成后只交付：

1. 更新后的 `CHANGELOG.md`。
2. 修改过的源码与测试。
3. 批次 D 的界面证据文件路径。

不得自行填写“验收通过”；独立验收由另一 GPT 在 `ACCEPTANCE.md` 完成。

