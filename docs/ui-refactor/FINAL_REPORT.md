# CampusMate UI/UX Refactor V2 — 最终报告

仓库：`WorldExcuteMe/Cloud-CampusMate` · 分支：`ui-refactor-v2` · 基线：`429e6ce`
日期：2026-11-22 · 配套审计：[PHASE0_AUDIT.md](./PHASE0_AUDIT.md)

## 1. 原始问题与修复情况

| 原始问题 | 修复 | 状态 |
|---|---|---|
| 页面职责重叠：Today/任务/成长三处任务管理 | 统一 `TasksPage`（/app/tasks）为唯一任务中心；Today 只做行动驾驶舱；成长档案只读 | 已修复 |
| 导航语义错位（"任务与目标"→日常专区） | 导航"任务与目标"直达 /app/tasks；daily/growth 旧路由保留重定向 | 已修复 |
| 通知处理路径断裂（预览→详情→创建→返回） | `NoticeActions` 共享组件挂预览面板与详情页，预览内直接创建任务/查看来源/忽略 | 已修复 |
| 空状态占据大量空间 | EmptyState 紧凑化（p-6 + 单操作）；空课表周视图不再渲染 8:00–22:00 空网格，仅表头+截止区+引导 | 已修复 |
| 页面宽度不统一 | 全部业务页统一 `max-w-[1280px]` 容器（PageShell），Sidebar 240px，边距由 Layout 统一 | 已修复 |
| 内部标签外泄（todo/P65/分数） | `taskStatusLabel`/`priorityLabel` 用户语言化；分数不再直接展示 | 已修复 |
| 可信核验独立空壳页 | 降为二级档案页（迁移提示），核验状态内嵌到机会列表/详情与通知预览；无证据一律"未核验" | 已修复 |
| Landing 重复 CTA 与信息堆叠 | 单一主 CTA"打开工作台" + 锚点"了解功能"；右侧价值卡；预览侧栏同步 6 导航；移除模型名/token 展示 | 已修复 |
| 截图中的重复竞赛任务 | 属部署实例用户数据，不在种子中；未删除/合并任何数据；统一任务中心 + `inboxItemId` 来源追溯使重复可识别 | 按原则处置 |

## 2. 修改的页面与组件

- 新增：`components/task.tsx`（TaskItem + useTaskCompletion 统一确认完成）、`features/tasks/TasksPage.tsx`、`features/tasks/DailyImport.tsx`、`features/inbox/NoticeActions.tsx`、`e2e/ui-refactor-acceptance.spec.ts`。
- 重写：`DashboardPage`（驾驶舱）、`LandingPage`（保留浅色品牌视觉/宣传语/暗色预览）、`InboxDetailPage`（复用 InboxPreview）、`RadarPage`（紧凑列表+核验徽标）、`Timetable`（空课表压缩）。
- 调整：`shared.tsx`（PageShell/SectionHeader/MetricCard/EmptyState/状态与优先级语义）、`globals.css`（--radius 10px）、`layout.tsx`（6 导航、240px、子节点稳定 key）、`InboxPreview`（核验状态行、原文折叠、共享操作）、`OpportunityDetailPage`（无报告=未核验提示）、`TrustPage`（迁移提示）、`routes.tsx`（tasks 路由 + daily/growth 重定向）、`sites-repository.ts` + `functions/sites-v1.ts`（云端 PATCH，见 §6）。
- 删除：`GrowthPage.tsx`、`DailyTasksPage.tsx` 及其旧测试（能力并入 TasksPage，测试迁移为 `tasks/__tests__/TasksPage.test.tsx`）。

## 3. 合并或删除的功能

- 成长中心一级入口 → 任务与目标·成长档案 Tab（数据只读保留）。
- 日常任务专区一级入口 → 任务与目标·我的任务内折叠导入工具（清洗/去重/时间提取逻辑原样保留）。
- 可信核验一级入口 → 内嵌核验状态 + 二级报告档案页；`TrustReportPage` 与 `listReports/getReport` 契约不变。
- 未删除任何用户数据、种子数据或底层引擎。

## 4. 保留的底层能力

Agent 内核（`lib/agent/*`、`lib/llm/*`、`AgentChatPage` 消息/工具流）、Sites Function API 既有语义、课表导入预览+确认机制、通知 ingest 管线、会话同步与归档、鉴权与 owner 隔离、本地/云端双运行时。

## 5. 新导航结构与数据关系

导航 6 项：Today / 智能体工作台 / 信息中心 / 校园日历 / 任务与目标 / 机会中心（账户与设置保留在 UserChip）。
数据关系：`InboxItem --inboxItemId--> Task`；`VerificationReport --opportunityId--> Opportunity`；日历事件由 tasks/opps 派生（无独立事件表）。创建任务预填截止标注"来自通知提取，请核对"，不冒充官方截止；无截止保持待确认。

## 6. 与指令的偏差及理由（透明记录）

1. **"删除"任务操作**：Repository 与云端 `/v1/domain/*` 均无 delete 契约（POST 仅插入+去重）。为不改既有 API 语义且不删用户数据，任务行提供 完成/编辑/取消/恢复/查看来源；"取消"保留记录可恢复。物理删除未实现，列为后续建议。
2. **云端状态持久化缺陷修复**：基线中云端 `updateTask/updateInbox` 走 POST 会被去重为 no-op（状态更新不生效）。新增 `PATCH /v1/domain/:kind`（增量合并，POST 语义不变）并让 sites-repository 改走 PATCH。属向后兼容的附加端点；**云端真机未验证**（无平台凭据），列为未验证项。
3. **flaky 测试稳定化**：`session-cloud.test.tsx` 增量断言在负载下偶发失败（基线单跑稳定、全套件偶发），加入 30ms settle 吸收前序残留异步写入；非产品行为变更。
4. **既有 e2e 断言修复**：`layout-and-confirm` 品牌断言改为 `img[alt="CampusMate"]`（基线即失败）；多处标题句号/旧 IA 断言随重构更新，行为断言（独立滚动、确认流、移动端可达）保留。
5. **验收竞态修复**：移动端导航过渡期间旧路由残留同名复选框导致误点；验收脚本改为等待目标页标题后再操作（真实 UX 无此问题，属测试时序）。
6. Layout 条件兄弟节点加稳定 key，防止状态条插拔引起内容重挂载（稳定性加固）。

## 7. 测试结果（实际执行命令与结果）

环境：node v24.21.0；本机 npm shim 失效，统一 `node <npm-cli.js> …` 等价执行。

| 命令（web/ 下） | 结果 |
|---|---|
| `npm test`（vitest run，基线 worktree main） | 67 files passed · 495 passed \| 1 skipped |
| `npm test`（重构分支，最终） | 67 files passed · 495 passed \| 1 skipped（与基线一致） |
| `npx playwright test`（全量，最终） | **35 passed**（含 9 项 V2 验收） |
| `npx playwright test e2e/ui-refactor-acceptance.spec.ts` | 9 passed |
| `VITE_RUNTIME=cloud npm run build` | exit 0（tsc + vite，12 路由回退页） |
| `node scripts/build-sites.mjs` | exit 0（dist-sites 3 文件 / dist-sites-function 16 文件） |

验收覆盖（ui-refactor-acceptance.spec.ts）：6 一级入口可用且 trust/growth 不在导航；daily/growth 重定向无 404；同一任务完成后 Today/任务中心/成长档案一致；信息中心预览内创建任务（预填可核对）；无课程日历空状态引导；无证据机会不显示"已核验"；1440×900 / 1280×800 / 768×1024 / 375×812 四视口六路由无水平溢出；移动端导航与确认弹窗不超屏。

日志归档（工作区 `.local/`）：`cloud-final-unit.log`、`cloud-final-e2e.log`、`cloud-acceptance-r6.log`、`cloud-build.log`、`cloud-build-sites.log`、`cloud-baseline-full.log` 等。

## 8. 视觉截图

归档于 [screenshots/](./screenshots/)：today-1440x900、tasks-375x812、inbox-1440x900、radar-1280x800、calendar-768x1024、landing-light-1440。
完整四视口 × 六路由 24 张位于 `web/test-results/ui-v2-acceptance/`（本地生成，不入库）；双主题基线位于 `web/test-results/visual/`。

## 9. 未解决的问题 / 未验证项

- **Qoder Sites 发布未执行**：`prepare_site`/`publish_site` 需 Qoder Sites CLI/控制台与平台 Secret（QODER_PAT 等）；本环境 Qoder CLI 未安装、无 Sites MCP 工具。产物已构建就绪（`web/dist` cloud runtime、`web/dist-sites-function`），发布步骤见 §10。
- 云端 PATCH 端点与登录态业务流未在真机验证（无凭据）；匿名 Demo 与本地运行时已全量验证。
- 云端核验报告仍"暂未就绪"（基线既有边界），UI 如实显示未核验/空状态，不谎报。
- 任务物理删除、目标进度/关联任务数据模型缺失（UI 不虚构进度）。
- 旧工作区副本（origin CampusMate）上的同名分支仅作移植来源保留，未推送。

## 10. 风险与后续建议

1. 发布：在已登录 Qoder 账号的环境执行 `prepare_site` + `publish_site`（静态 `web/dist`、Function `web/dist-sites-function`），确认站点项目/Secret 指向目标环境；schema 无变更，无需新迁移。
2. 推送：`git push origin ui-refactor-v2` 后走 PR 合入 main（本环境无推送凭据时由用户执行）。
3. 建议后续为 `/v1/domain/:kind` PATCH 补 Deno 契约测试与真机回归；为任务删除设计带确认的软删除契约。
4. 目标进度建议在 profile/goals 数据结构中补充里程碑字段后再接 UI，避免虚构百分比。
5. 回归基线中 `session-cloud` 仍属时序敏感测试，建议长期改为事件驱动断言。