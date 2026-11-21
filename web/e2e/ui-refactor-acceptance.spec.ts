import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";

// UI/UX Refactor V2 验收：六个一级入口、旧路由兼容、跨页状态一致、核验不谎报、四视口无溢出。
const OUT = path.join("test-results", "ui-v2-acceptance");
mkdirSync(OUT, { recursive: true });

const VIEWPORTS = [
  { name: "1440x900", width: 1440, height: 900 },
  { name: "1280x800", width: 1280, height: 800 },
  { name: "768x1024", width: 768, height: 1024 },
  { name: "375x812", width: 375, height: 812 },
] as const;

const ROUTES = ["/app", "/app/agent", "/app/inbox", "/app/calendar", "/app/tasks", "/app/radar"] as const;

async function seedDemo(page: Page) {
  await page.addInitScript(() => { localStorage.setItem("campusmate.onboarded", "true"); });
  await page.route("**/api/providers", (route) => route.fulfill({ json: { providers: [], mutable: false } }));
}

test("六个一级导航入口可用，旧一级路由重定向不产生 404", async ({ page }) => {
  await seedDemo(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/app");
  const nav = page.getByRole("navigation", { name: "主导航", exact: true });
  for (const label of ["Today", "智能体工作台", "信息中心", "校园日历", "任务与目标", "机会中心"]) {
    await expect(nav.getByRole("link", { name: label, exact: true }).or(nav.getByRole("button", { name: label, exact: true }))).toBeVisible();
  }
  await expect(nav.getByRole("link", { name: "可信核验", exact: true })).toHaveCount(0);
  await expect(nav.getByRole("link", { name: "成长中心", exact: true })).toHaveCount(0);
  await page.goto("/app/daily");
  await expect(page).toHaveURL(/\/app\/tasks/);
  await expect(page.getByRole("heading", { name: "任务与目标" })).toBeVisible();
  await page.goto("/app/growth?view=overdue");
  await expect(page).toHaveURL(/\/app\/tasks\?tab=tasks&view=overdue/);
  await page.goto("/app/trust");
  await expect(page.getByText("Trust Engine")).toBeVisible();
  await expect(page.getByText(/可信核验已内嵌/)).toBeVisible();
});

test("同一任务完成后 Today / 任务中心 / 成长档案状态一致", async ({ page }) => {
  await seedDemo(page);
  await page.goto("/app");
  const checkbox = page.getByRole("checkbox", { name: /参加班会/ });
  await checkbox.click();
  await page.getByRole("alertdialog").getByRole("button", { name: "确认完成", exact: true }).click();
  await expect(page.getByRole("checkbox", { name: /参加班会/ })).toHaveCount(0);
  await page.goto("/app/tasks?tab=tasks&view=done");
  await expect(page.getByRole("button", { name: /撤销完成 参加班会/ })).toBeVisible();
  await page.getByRole("tab", { name: "成长档案", exact: true }).click();
  await expect(page.getByText("参加班会（辅导员通知）", { exact: true })).toBeVisible();
  await page.goto("/app");
  await expect(page.getByRole("checkbox", { name: /参加班会/ })).toHaveCount(0);
});

test("信息中心预览内直接创建任务，截止预填可核对", async ({ page }) => {
  await seedDemo(page);
  await page.goto("/app/inbox");
  await page.getByRole("button", { name: /预览/ }).first().click();
  await page.getByRole("button", { name: "创建任务", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText(/预填来自通知提取的截止时间|通知未识别出明确截止/)).toBeVisible();
  await dialog.getByRole("button", { name: "创建任务", exact: true }).click();
  await expect(page.getByText(/任务已创建/)).toBeVisible();
  await page.goto("/app/tasks?tab=tasks&view=all");
  await expect(page.getByText(/处理：/).first()).toBeVisible();
});

test("无课程时日历为空状态引导而非大面积空网格", async ({ page }) => {
  await seedDemo(page);
  await page.goto("/app/calendar");
  await expect(page.getByText(/本学期尚无课程记录|课表尚未接入/).first()).toBeVisible();
  await expect(page.getByText("本学期尚无课程记录；上方为已记录的任务与机会截止。导入课表后此处显示时间网格。")).toBeVisible();
});

test("无核验证据的机会不显示已核验", async ({ page }) => {
  await seedDemo(page);
  await page.goto("/app/radar");
  await page.getByRole("button", { name: /全部（/ }).click();
  const rows = page.getByRole("link", { name: /全国大学生人工智能创新大赛/ });
  await expect(rows.first()).toBeVisible();
  await expect(page.getByText("已核验", { exact: true })).toHaveCount(0);
  await expect(page.getByText("未核验", { exact: true }).first()).toBeVisible();
});

for (const vp of VIEWPORTS) {
  test(`四视口验收 ${vp.name}：关键路由无水平溢出且截图`, async ({ page }) => {
    await seedDemo(page);
    await page.setViewportSize({ width: vp.width, height: vp.height });
    for (const route of ROUTES) {
      await page.goto(route);
      await page.waitForTimeout(350);
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      const name = route === "/app" ? "today" : route.split("/").pop();
      await page.screenshot({ path: path.join(OUT, `${name}-${vp.name}.png`), fullPage: vp.width >= 768 });
    }
    // 移动端关键操作可达：导航 + 任务确认弹窗不超屏。
    if (vp.width < 768) {
      await page.goto("/app/tasks");
      await page.getByRole("navigation", { name: "移动导航" }).getByRole("link", { name: "Today", exact: true }).click();
      // 等待路由过渡完成，避免点到旧路由残留的同名复选框。
      await expect(page.getByRole("heading", { name: "今天需要关注什么", exact: true })).toBeVisible();
      const checkbox = page.getByRole("checkbox", { name: /参加班会/ });
      await expect(checkbox).toBeVisible();
      await checkbox.click();
      const dialog = page.getByRole("alertdialog");
      await expect(dialog).toBeVisible();
      await expect.poll(async () => (await dialog.boundingBox())?.width ?? 0).toBeGreaterThan(0);
      const box = (await dialog.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(vp.width);
      await dialog.getByRole("button", { name: "取消", exact: true }).click();
    }
  });
}