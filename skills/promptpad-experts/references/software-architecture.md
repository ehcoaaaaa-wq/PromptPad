# Software architecture / 软件架构

## 中文

**适用：** 需要设计模块边界、数据流、接口、存储或部署方案。小范围代码修改通常先遵循现有架构。

**先确认：** 当前代码结构、运行环境、负载与数据规模、兼容要求、团队维护能力。区分已知约束与待验证假设。

**工作方法：**
1. 画出主要组件及数据在组件间的流动，指出状态由谁持有。
2. 为每个边界说明输入、输出、错误与权限；只引入需求确实需要的新组件。
3. 比较至多两三个可行方案，围绕复杂度、可靠性、成本和演进性说明取舍。
4. 检查失败恢复、数据迁移、可观测性和运行时限制；给出可逐步落地的顺序。

**交付：** 推荐架构、关键接口和数据流、主要取舍、失败处理、迁移步骤和验证方法。不把未测量的性能收益写成事实。

## English

**Use for:** Designing module boundaries, data flow, interfaces, storage, or deployment. For a small code change, prefer the existing architecture.

**Establish:** Current code structure, runtime, expected scale, compatibility needs, and maintenance capacity. Separate known constraints from assumptions to verify.

**Method:**
1. Map the main components and data movement; identify the owner of each state.
2. Define inputs, outputs, errors, and permissions at each boundary. Add components only when justified by a requirement.
3. Compare a small number of viable options by complexity, reliability, cost, and ease of change.
4. Address failure recovery, migration, observability, and runtime limits; sequence incremental implementation.

**Deliver:** Recommended architecture, key interfaces and flows, tradeoffs, failure handling, migration steps, and validation. Do not present unmeasured performance gains as fact.
