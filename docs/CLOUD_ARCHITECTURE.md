# Cloud CampusMate 运行时架构

本文只描述 **Qoder Sites 部署版**。完整版本地/服务器版的后端、数据库迁移与 Worker 不在本仓库范围内。

## 1. 运行拓扑

```text
React SPA (web/src, Vite)
  │  GET/POST /functions/v1/app/v1/...
  ▼
Qoder Sites Function (web/functions/index.ts, Deno)
  ├─ 平台身份校验（Qoder 登录 / 匿名 Demo）
  ├─ Sites 数据库客户端（app.campusmate_*）
  ├─ Sites V1 API（tasks / sessions / providers / terms / schedules）
  ├─ 服务端模型执行器（sites-exec.ts）
  ├─ 文档解析（document-parser.ts）
  └─ 成品导出（export-formats.ts）
  │
  ├──► Sites Database
  └──► 服务端模型 Provider（OpenAI-compatible）
```

页面与 Function 同源部署，前端不需要持有模型密钥。`_qoder/backend.mjs` 由 Sites 平台在部署时注入，仓库不包含该文件。

## 2. 前端

- `web/src/app`：路由、布局、鉴权、外观。
- `web/src/features/agent`：Agent 工作台、任务侧栏、思考流、产物预览。
- `web/src/features/{inbox,calendar,daily,radar,trust,growth}`：校园模块。
- `web/src/lib/agent`：API 客户端、会话状态、附件与模型设置。
- `web/src/lib/ingest`：附件选择、限制、图片压缩与文档读取。
- `web/src/lib/agent/pptx-client.ts`：客户端 PPTX 生成。

前端启动时根据 `VITE_RUNTIME` 决定运行时：

- `local`：本地开发，走同源 `/functions/v1/app` 或本地代理。
- `cloud`：Qoder Sites，使用平台登录与同源 Function。

匿名 Demo 使用本地演示数据；登录后业务数据按 Qoder 用户 `owner_id` 隔离。

## 3. Function 与 API

入口：`web/functions/index.ts`。

主要模块：

| 文件 | 职责 |
| --- | --- |
| `sites-v1.ts` | `/v1` 路由、任务/会话/设置/课表 API、数据库读写 |
| `sites-exec.ts` | 服务端模型执行器、工具调用、检查点、事件、重试 |
| `sites-database.ts` | Sites 数据库访问与迁移辅助 |
| `sites-production.ts` | 生产环境绑定与平台资源解析 |
| `sites-config.ts` | 站点常量、模型与能力配置 |
| `document-parser.ts` | PDF / DOCX / XLSX 文本解析 |
| `export-formats.ts` | DOCX / XLSX / HTML / CSV / SVG / Mermaid / JSON 导出 |
| `current-time.ts` | 北京时间与日期上下文 |
| `model-capabilities.ts` | 模型上下文、视觉、工具能力 |

核心路由：

- `POST /v1/tasks`：创建任务并启动执行。
- `GET /v1/tasks/:id`、`GET /v1/tasks/:id/events`：任务状态与事件续传。
- `POST /v1/tasks/:id/continue`：继续长任务。
- `GET /v1/sessions`、`POST /v1/sessions`：会话列表与创建。
- `GET /v1/providers`：只返回公开元数据，不下发凭证。
- `GET /v1/terms`、`POST /v1/terms`、`GET /v1/schedules`：学期与课表。
- `GET /v1/tasks/:id/artifacts`、`GET /v1/tasks/:id/artifacts/merge`：产物与合并导出。
- `GET/PATCH /v1/settings`、`GET /v1/profile`：用户设置与画像。

## 4. Agent 长任务运行时

执行器位于 `sites-exec.ts`，每轮：

1. 读取任务 checkpoint 与会话最近消息。
2. 调用服务端模型，流式产生 `thinking.delta` / `llm.delta`。
3. 解析工具调用，执行工具并把结果写回上下文。
4. 通过事件表持久化 `llm.request`、`llm.response`、`tool.*`、`run.*`。
5. 达到输出上限时写入阶段结论（`run.partial` + `checkpoint.lastPartial`），供下一轮继续。
6. 交付类意图检查产物；无产物时先自动续跑一次，仍无产物则明确失败，不谎称完成。

关键机制：

- **检查点**：任务状态、消息、工具结果、文档、阶段结论持久化。
- **租约与 CAS**：`checkpoint`、`seq`、任务状态均做条件更新，避免重复执行和事件乱序。
- **跨轮文档**：同一会话新任务无附件时，从最近 8 个任务合并已上传文档。
- **计划确认门**：复杂任务先通过 `ask_user` 给出目标/步骤/验收标准，用户选择后再执行。
- **澄清暂停**：`ask_user` 将任务置为 `needs_input`，前端渲染选项；回答后继续。
- **重试**：超时、网络、上游错误、流中断等 transient 错误有限重试。
- **实时思考**：按段推送，避免单条事件过大；前端逐字平滑展示。

## 5. 数据模型

数据库 schema 在 `web/sites/`，按顺序应用：

- `schema.sql`：运行时账本与协调锁。
- `schema-v2.sql`：用户凭证与 Provider。
- `schema-v3.sql`：Agent 业务表。
- `schema-v4.sql`：长任务热路径索引。

业务表（`app.` schema，均按 `owner_id` 隔离）：

```text
campusmate_conversations   会话
campusmate_messages        会话消息
campusmate_tasks           任务、状态、checkpoint、结果
campusmate_events          任务事件（seq 游标）
campusmate_artifacts       产物与多节元数据
campusmate_approvals       审批/确认
campusmate_settings        用户设置、课表 timetable JSON
campusmate_profile         画像
campusmate_inbox           信息中心
campusmate_daily           日常任务/目标
campusmate_opportunities   机会
campusmate_providers       用户 BYOK Provider
campusmate_secrets         加密后的用户凭证
```

课表复用 `campusmate_settings.data.timetable`，避免额外迁移：

```text
{
  terms: [{ id, name, startDate, endDate, totalWeeks, timezone, periods[] }],
  schedules: [{ id, termId, courseName, weekday, startTime, endTime,
                startWeek, endWeek, weekPattern, classroom?, campus?, teacher? }]
}
```

## 6. 附件与成品

- 图片在浏览器压缩到最长边 2048px、JPEG 0.92，并以 `detail: high` 交给模型。
- PDF / DOCX / XLSX 的服务端解析逻辑在 `document-parser.ts`；PDF 运行时在 `functions/vendor/`。
- 文档文本会作为附件上下文传给模型；原始文件不写入独立文件服务器。
- 成品格式：DOCX / XLSX / CSV / HTML / SVG / Mermaid / JSON 由 `export-formats.ts` 生成；PPTX 由客户端 `pptxgenjs` 生成；PDF 通过 HTML 打印。
- 多节产物可通过 `artifacts/merge` 合并导出。

## 7. 课表导入

通用模型按中国高校常见形式设计：

- 学期开始日期、总周数、节次时间。
- 课程名、星期、起止节次、起止周、单双周、教室、校区、教师。
- 输入可为 Excel / PDF / 图片 / 文本；XLSX 由服务端解析为表格文本。
- 缺少开学日期或作息时，Agent 先用 `ask_user` 询问，不擅自猜测。
- 导入工具写入 `campusmate_settings.timetable`，日历通过 `/v1/terms` 与 `/v1/schedules` 读取。

## 8. 安全边界

- 所有读写从平台验证身份取 owner；客户端传入的 owner 无效。
- 模型接口只返回 Provider 公共元数据；API Key / PAT / 加密材料不下发浏览器。
- 用户 BYOK 凭证使用服务端密钥加密后存入 `campusmate_secrets`。
- 抓取和附件内容按数据处理，不执行其中的指令；高风险写入需要用户明确指令。
- 任务事件、消息、产物均按 owner 查询，跨用户返回 404。

## 9. 部署与构建

```text
npm run build                 -> web/dist（React 静态产物）
node scripts/build-sites.mjs  -> web/dist-sites-function（Function 包）
web/sites/schema*.sql         -> Sites 数据库 schema
```

Sites 部署使用 `prepare_site` + `publish_site`，静态目录为 `web/dist`，Function 目录为 `web/dist-sites-function`。项目 ID、schemaRef 与 Secret 属于本地私有配置，不提交。

## 10. 已知边界

- PDF 成品是 HTML 打印，不是原生 PDF 排版。
- 扫描件/图片识别依赖视觉模型，复杂表格可能需要二次确认。
- 超长文档需要分节多轮；单次输出有上限。
- 课表例外（调课、停课、教室变更）尚未由 Agent 全量写入。
- 云端积分、模型可用性与平台配额由平台决定。