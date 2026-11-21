# web

Cloud CampusMate 的前端与 Qoder Sites Function。

- `src/`：React SPA（Agent 工作台、校园模块、设置）。
- `functions/`：Sites Function（API、服务端模型执行器、附件解析、成品导出）。
- `sites/`：Sites 数据库 schema。
- `scripts/`：构建与 Function 打包。
- `e2e/`：Playwright 端到端与视觉基线。

开发与部署说明见仓库根 [README](../README.md) 和 [docs/CLOUD_ARCHITECTURE.md](../docs/CLOUD_ARCHITECTURE.md)。

```powershell
npm ci
npm run dev
npm run test
npm run build
```