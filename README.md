# Cloud CampusMate

> CampusMate 的 **Qoder Sites 云端部署版**：把通知、课表、机会与长任务，整理成日历、待办和可直接交付的成品。

[在线体验](https://campusmate-agent-d6ec0v7a94m.qoder.website/) · [完整版 CampusMate](https://github.com/WorldExcuteMe/CampusMate)

![CampusMate](web/public/campusmate-logo.png)

## 这是什么

本仓库只包含运行在 **Qoder Sites** 上的 CampusMate 本体，和完整版 CampusMate 仓库是两个不同的交付形态：

| | **Cloud CampusMate（本仓库）** | **CampusMate（完整版）** |
| --- | --- | --- |
| 运行位置 | Qoder Sites 静态站点 + Sites Function | 本地 / 自有服务器 |
| 前端 | React + TypeScript + Vite | 同一套前端 |
| 业务后端 | Sites Function（Deno）+ Sites 数据库 | Node API / Worker + 数据库 |
| 数据层 | `app.campusmate_*` 表，Sites 平台管理 | 完整版数据库与迁移体系 |
| 额外能力 | 云端登录、服务端模型、跨设备会话 | 本地工作区、完整后端、QQ/微信接入等 |
| 仓库 | 本仓库 | [WorldExcuteMe/CampusMate](https://github.com/WorldExcuteMe/CampusMate) |

本仓库**不包含** `backend/`、完整版数据库迁移、QQ/微信接入、机器本地运行脚本或任何真实凭证。

## 核心能力

- **校园 Agent**：通知解读、课表导入、任务与目标、机会跟踪、可信核验、成长记录。
- **长任务 Workflow**：计划确认门（`ask_user` + 目标/步骤/验收标准）、跨轮文档复用、检查点续跑、输出上限时保留阶段结论。
- **实时过程**：思考流分段推送、工具调用与耗时、任务事件游标恢复。
- **多模态附件**：图片直接交给模型；PDF / DOCX / XLSX 在服务端解析，文本回退。
- **成品而非 Markdown**：DOCX、XLSX、PPTX、CSV、HTML、SVG、Mermaid、JSON；PDF 通过 HTML 打印；PPTX 由客户端 `pptxgenjs` 生成。
- **通用课表模型**：学期开始日期、节次时间、周次、单双周、教室、校区、教师；兼容 Excel / PDF / 图片 / 文本输入。
- **可控写入**：Agent 可以读取和修改校园模块，但必须在明确指令下写入；缺信息会先提问。

## 架构

```text
Browser (React SPA / Vite)
   │  same-origin /functions/v1/app
   ▼
Qoder Sites Function (Deno)
   ├─ Auth / owner isolation
   ├─ /v1/tasks, /v1/sessions, /v1/providers, /v1/terms, /v1/schedules ...
   ├─ Server Model Executor (stream + tools + checkpoint)
   ├─ Attachment parser (PDF / DOCX / XLSX)
   └─ Artifact exporter (DOCX / XLSX / HTML / CSV / SVG / Mermaid / JSON)
   │
   ├──► Sites Database  app.campusmate_*  (tasks, events, messages, artifacts ...)
   └──► Server-side model providers  (Qwen / MiMo / Moss)
```

更完整的运行时说明见 [docs/CLOUD_ARCHITECTURE.md](docs/CLOUD_ARCHITECTURE.md)。

## 目录结构

```text
web/
  src/                 React 页面、Agent 工作区、校园模块
  functions/           Sites Function 入口、任务执行器、API、导出与解析
  functions/vendor/    PDF 解析运行时（pdfjs）
  sites/               Sites 数据库 schema（schema.sql / v2 / v3 / v4）
  sites-ui/            build-sites 使用的静态壳
  scripts/             构建与 Sites 打包脚本
  e2e/                 Playwright 端到端与视觉基线
  public/              LOGO 与公开静态资源
shared/                日历、文档、附件、工具协议的共享类型
docs/                  云端架构与交付说明
```

## 本地开发

要求 Node `^22.13.0` 或 `>=24`。

```powershell
cd web
npm ci
Copy-Item .env.example .env.local
npm run dev
```

常用命令：

```powershell
npm run test              # Vitest
npm run check:function    # Deno 类型检查
npx playwright install chromium
npm run test:e2e          # Playwright
npm run build             # React 静态产物 -> web/dist
node scripts/build-sites.mjs  # Sites Function 包 -> web/dist-sites-function
```

本地默认使用同源 `/functions/v1/app`；云端部署时设置 `VITE_RUNTIME=cloud`。模型密钥只能放在服务端 Secret，不要写入任何 `VITE_*` 变量。

## 部署到 Qoder Sites

1. 构建前端：`npm run build`，得到 `web/dist`。
2. 构建 Function 包：`node scripts/build-sites.mjs`，得到 `web/dist-sites-function`。
3. 按顺序应用 `web/sites/schema.sql`、`schema-v2.sql`、`schema-v3.sql`、`schema-v4.sql`。
4. 通过 Qoder Sites CLI / 控制台执行 `prepare_site` 与 `publish_site`，静态目录使用 `web/dist`，Function 目录使用 `web/dist-sites-function`。
5. 在平台侧配置登录与 `QODER_PAT` 等 Secret。`_qoder/backend.mjs` 由平台注入，不在仓库中。

部署输入文件包含项目级信息，属于本地私有配置，不应提交。发布前请确认当前 Qoder 账号、站点项目和 Secret 均指向正确环境。

## 数据与安全

- 所有业务表按 `owner_id` 隔离；服务端从已验证身份取 owner，不接受客户端传入 owner。
- 浏览器只持有公开配置；模型凭证、平台 PAT、用户 BYOK 加密材料均在服务端。
- 抓取与附件内容一律视为数据，不把其中的文字当作指令执行。
- 课表、通知、任务等写入需要明确用户指令；敏感或不确定信息会标注未核实。
- 仓库不包含 `.env`、真实密钥、证书、运行日志或本机数据库。

## 已知边界

- PDF 成品当前通过 HTML 打印/另存，不是原生 PDF 排版引擎。
- 扫描版 PDF/图片的识别准确率取决于视觉模型与原件质量。
- 超长文档需要分节多轮生成；单次输出达到上限时会保留阶段结论。
- 课表已支持固定课程规则；调课、停课、教室变更等例外尚未由 Agent 全量写入。
- 云端模型能力与额度由平台和所选 Provider 决定。

## 测试基线

当前版本：Vitest 共 **496** 项（干净环境 495 通过 + 1 项因外部测试库跳过），Playwright 视觉基线 **7/7** 通过。

## License

本项目使用 [MIT License](LICENSE)。第三方依赖、vendored PDF 运行时与模板资源保留各自许可证；模板来源见 [web/PROVENANCE.md](web/PROVENANCE.md)。

## 相关仓库

- 完整版本地/服务器版：[WorldExcuteMe/CampusMate](https://github.com/WorldExcuteMe/CampusMate)
- 云端部署版（本仓库）：[WorldExcuteMe/Cloud-CampusMate](https://github.com/WorldExcuteMe/Cloud-CampusMate)