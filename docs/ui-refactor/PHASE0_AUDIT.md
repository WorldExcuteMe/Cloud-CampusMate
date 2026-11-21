# Phase 0 审计报告 — CampusMate UI/UX Refactor V2（Cloud-CampusMate）

日期：2026-11-22 · 仓库：`WorldExcuteMe/Cloud-CampusMate` @ `429e6ce` · 分支：`ui-refactor-v2`

## 0. 目标仓库纠正记录

- 会话最初在工作区旧副本（origin `WorldExcuteMe/CampusMate` @ `39a1a12`，detached HEAD）上执行了 Phase 0–2；经用户指认与 `git ls-remote` / `merge-base` 核实，**部署与审计截图对应的权威仓库是 `Cloud-CampusMate`**（两者无共同祖先，web/src 差异 55 文件）。
- 证据：Cloud 仓库含浅色 Landing 与宣传语"从一条通知，到一份成品。"、TrustPage 云端空状态"核验报告云端暂未就绪"，均与审计截图一致；`docs/CLOUD_ARCHITECTURE.md` 明确 Sites 部署静态目录为 `web/dist`（即本 SPA）。
- 处置：旧副本上的 Phase 1/2 提交以 `git am` + 对象级 checkout 移植到本仓库（`c914039`、`0d37030`），冲突仅 layout/TrustPage/Landing/Dashboard 的 cloud 特性行，均已保留 cloud 分支逻辑。旧副本分支 `ui-refactor-v2` 保留不删除，仅作移植来源。
- 本仓库工作区初始干净，无未提交用户更改。

## 1. 页面功能依赖矩阵

| 模块 | 路由 | 组件 | 数据来源 | 写入操作 |
|---|---|---|---|---|
| Landing | `/` | `features/landing/LandingPage`（浅色品牌页） | 静态文案 + logo | 无 |
| Today | `/app` | `features/dashboard/DashboardPage` | tasks/inbox/opps/schedules | `updateTask(done)`（确认弹窗） |
| 智能体工作台 | `/app/agent` | `features/agent/AgentChatPage` | sessions + Sites V1 API | 会话/工具流（不动） |
| 信息中心 | `/app/inbox` | `InboxPage` + `InboxPreview` | `listInbox` | 仅筛选；处理操作在详情页 |
| 导入通知 | `/app/inbox/new` | `NewInboxPage` | ingest 管线 | `createInbox` / `createTask` |
| 通知详情 | `/app/inbox/:id` | `InboxDetailPage` | `getInbox` | `createTask`、`updateInbox(ignored)` |
| 任务与目标(导航名) | `/app/daily` | `DailyTasksPage` | tasks(kind=daily) | 导入 + 直接勾选完成/撤销 |
| 校园日历 | `/app/calendar` | `CalendarPage`+`Timetable`+`ScheduleImport` | terms/schedules/tasks/opps | 课表导入（预览+确认） |
| 机会中心 | `/app/radar` | `RadarPage` / `OpportunityDetailPage` | opps + reports | `createTask(opportunity)` |
| 可信核验 | `/app/trust`、`/app/trust/:id` | `TrustPage` / `TrustReportPage` | reports | 无 |
| 成长中心 | `/app/growth` | `GrowthPage` | tasks + profile.goals | `updateTask(done/cancelled)` 无确认 |
| 资料/设置 | `/app/profile` `/app/settings` | — | profile/providers | 保留 |

运行时：`VITE_RUNTIME=cloud` 时走 Qoder Sites 同源 Function（`web/functions/index.ts`），匿名 Demo 用本地数据；`use-campus-calendar` 对云端匿名不请求需登录的 /v1 接口。数据层另有 `sites-repository.ts`（云端业务表 `app.campusmate_*`）。

## 2. 重复功能与问题清单

1. 任务管理三套交互实现（Growth 无确认完成/取消、Daily 直接勾选、Today 确认弹窗），共享同一 repository 与 `["tasks"]` 缓存 → 数据不重复、交互重复。
2. 导航语义错位："任务与目标"→ daily 专区；真正任务中心在"成长中心"。
3. Inbox 预览无处理操作，必须跳详情页；预览与详情字段各写一套。
4. 内部标签外泄：`t.status` 原值、`P{priority}`、`priorityScore 分`、原始 `item.status`。
5. 宽度混用 max-w-3xl/4xl/5xl/7xl；EmptyState `p-10` 过大；空课表周网格固定 8:00–22:00。
6. Landing 重复 CTA（header"打开工作台" + 暗卡"开始使用"同动作）；预览侧栏仍列 8 模块；预览暴露模型名/token 统计。
7. 截图中的"蓝桥杯/华为 ICT 重复任务"属部署实例用户数据，**不在种子数据中**；不删除/不合并用户数据，靠统一任务中心 + `inboxItemId` 来源追溯暴露重复。
8. `Task.dueAt` 单字段，无官方截止/计划/提醒区分；不改 schema，UI 预填时标注"来自通知提取，请核对"。

## 3. 测试基线（实际执行）

- 命令：`npm test`（vitest run）· 基线 worktree `cloud-baseline`（main @429e6ce）：
  `Test Files 67 passed (67) · Tests 495 passed | 1 skipped (496)`。
- 移植后分支二次全套件：与基线一致（495 passed | 1 skipped）。首次运行中 `session-cloud.test.tsx` 一例失败，单跑与复跑均通过 → **时序 flaky，非回归**，记录不掩盖。
- e2e 基线（main）：`layout-and-confirm.spec.ts:36` 既有失败（BrandMark 为纯图片，断言却找文本节点）；本分支已修正断言为 `img[alt="CampusMate"]`，保留"品牌固定、独立滚动"行为断言。
- `closed-loop.spec.ts:14` 因 Today 优先任务上限 5 条不再保证展示新建任务 → 断言改为统一任务中心 `/app/tasks`（IA 变更的预期结果）。
- 环境备注：本机 npm shim 失效，统一以 `node <npm-cli.js>` 执行；Playwright 浏览器复用本机缓存。

## 4. 部署链路（Qoder Sites）

```
npm run build                -> web/dist（SPA 静态产物，Sites 静态目录）
node scripts/build-sites.mjs -> web/dist-sites-function（Function 包）
web/sites/schema*.sql        -> Sites 数据库 schema
部署：prepare_site + publish_site（平台侧工具；项目 ID/schemaRef/Secret 为本地私有配置）
```

当前 `sites-config.ts` 指向 global 站点 `campusmate-agent-d6ec0v7a94m.qoder.website`（审计实测域名）。重构只改前端 SPA 与样式，不改动 Function API 契约、schema 与站点常量。

## 5. 重构决策（Phase 1–4 依据）

1. 导航收敛 6：Today / 智能体工作台 / 信息中心 / 校园日历 / 任务与目标(`/app/tasks`) / 机会中心；growth/daily 路由保留重定向；trust 降为二级页（迁移提示 + 报告列表），报告详情保留。
2. 统一 `TasksPage`：Tab 我的任务 / 长期目标 / 成长档案；日常群通知导入保留为折叠工具；完成统一确认弹窗；成长档案只读。
3. Today 行动驾驶舱：3 核心指标 + 条件逾期指标；优先任务 ≤5（逾期置顶）；接下来；重要通知 ≤3。
4. 核验内嵌：机会有报告才显示对应 VerifyBadge，无报告 = 未核验；通知显示提取来源/风险信号；绝不默认已核验。
5. 设计系统：内容区 max-w-[1280px]、Sidebar 240px、卡片圆角 10px/控件 8px、PageHeader 24px/600、紧凑 EmptyState、状态/优先级用户语言化。Landing 保留浅色品牌视觉与暗色预览，单一主 CTA + 锚点次按钮。
6. 信息中心双栏保留；`NoticeActions` 共享组件挂预览与详情；"加入日历"不做假按钮（任务截止自动派生进日历，文案说明）。