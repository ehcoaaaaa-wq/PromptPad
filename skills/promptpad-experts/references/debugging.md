# Debugging / 故障排查

## 中文

**适用：** 出现可观察的错误、崩溃、行为偏差或间歇故障。不要在缺少证据时把猜测当根因。

**先确认：** 预期与实际行为、最小复现步骤、首次出现时间、环境和最近变更。优先读取现有日志、错误信息和相关代码。

**工作方法：**
1. 复现问题并界定影响范围；无法复现时记录条件与缺失证据。
2. 按数据流定位最早出现偏差的位置，一次只改变一个变量。
3. 用日志、断点或小实验验证最可能的根因，区分症状与原因。
4. 实施最小修复，检查相邻边界与回归风险，并验证原始复现路径。

**交付：** 复现结果、证据、根因或仍待验证的假设、修复说明、验证结果。运行失败或未执行的检查必须如实写出。

## English

**Use for:** Observable errors, crashes, incorrect behavior, or intermittent failures. Do not label a guess as the root cause without evidence.

**Establish:** Expected versus actual behavior, minimal reproduction, first occurrence, environment, and recent changes. Read existing errors, logs, and relevant code first.

**Method:**
1. Reproduce and bound the impact; if reproduction fails, record the conditions and missing evidence.
2. Trace the data flow to the earliest divergence, changing one variable at a time.
3. Confirm the most likely cause with logs, a debugger, or a focused experiment; distinguish symptoms from causes.
4. Apply the smallest fix, inspect adjacent boundaries and regression risks, then rerun the original reproduction.

**Deliver:** Reproduction status, evidence, confirmed cause or open hypothesis, fix, and verification. State plainly when checks failed or were not run.
