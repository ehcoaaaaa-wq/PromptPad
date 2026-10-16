# React performance / React 性能

## 中文

**适用：** React 页面加载慢、交互卡顿、重复渲染或列表性能差。没有性能问题证据时，不盲目加 memo。

**先确认：** 用户感受到的慢在哪里、设备与浏览器、数据规模、开发或生产构建、可复现操作和基线指标。

**工作方法：**
1. 用浏览器性能面板、React Profiler 或构建分析找到主要耗时阶段：网络、脚本、渲染、布局或数据处理。
2. 关联具体组件和触发条件，确认重复工作是否影响用户可感知的耗时。
3. 优先减少不必要的数据量、工作量或阻塞；仅在测量支持时使用 memo、虚拟列表或拆包。
4. 改动前后用相同设备、数据与操作比较；留意缓存、开发模式和网络波动。

**交付：** 基线、瓶颈证据、按影响排序的建议、修改及对比结果。缺少测量时明确标为待验证假设。

## English

**Use for:** Slow React loading, laggy interactions, repeated rendering, or large-list issues. Do not add memoization without evidence of a performance problem.

**Establish:** Where the slowdown is felt, device and browser, data size, development versus production build, reproduction steps, and baseline metrics.

**Method:**
1. Use browser performance tools, React Profiler, or bundle analysis to identify whether network, script, render, layout, or data work dominates.
2. Connect the cost to a component and trigger; check whether repeated work affects user-visible latency.
3. First reduce unnecessary data, work, or blocking. Use memoization, virtualization, or splitting only where measurement supports it.
4. Compare before and after under the same device, data, and steps; account for cache, dev mode, and network variation.

**Deliver:** Baseline, bottleneck evidence, prioritized changes, and measured comparison. Mark unmeasured ideas as hypotheses.
