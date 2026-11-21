vi.mock("@/app/auth",()=>({useAuth:()=>({session:null}),useRepository:()=>({listInbox:async()=>[],listTasks:async()=>[{id:"late",title:"逾期任务",dueAt:"2026-11-10",status:"todo"},{id:"future",title:"未来任务",dueAt:"2026-11-18",status:"todo"}],listOpportunities:async()=>[]})}));
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
vi.mock("@/app/config", () => ({ runtime: "local", repository: { listInbox: async () => [], listTasks: async () => [{ id: "late", title: "逾期任务", dueAt: "2026-11-10", status: "todo" }, { id: "future", title: "未来任务", dueAt: "2026-11-18", status: "todo" }], listOpportunities: async () => [], updateTask: vi.fn() } }));
vi.mock("@/lib/agent/api-client", () => ({ backendEnabled: () => true, listTerms: async () => [{ id: "t", name: "秋", startDate: "2026-09-07", endDate: "2027-01-24", totalWeeks: 20, timezone: "Asia/Shanghai" }], listSchedules: async () => ({ schedules: [{ id: "math", courseName: "今日数学", weekday: 1, startTime: "08:00", endTime: "09:40", startWeek: 1, endWeek: 20, weekPattern: "every" }], exceptions: [], schemes: [] }) }));
import { DashboardPage } from "./DashboardPage";
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
it("Today 驾驶舱读取真实今日课程作为下一项，逾期单独计数且不计入未来七天", async () => {
  vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-11-16T07:00:00+08:00"));
  render(<MemoryRouter><QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><DashboardPage /></QueryClientProvider></MemoryRouter>);
  // 接下来面板展示真实投影出的今日课程（仅一处，不再复制整份课表）。
  expect(await screen.findByText("今日数学")).toBeVisible();
  expect(screen.getByText("今天共 1 节课 · 今日待办 0")).toBeVisible();
  expect(screen.getByRole("link", { name: "1 近期截止（7 天内）" })).toHaveAttribute("href", "/app/tasks?view=soon");
  expect(screen.getByRole("link", { name: "1 已逾期待处理" })).toHaveAttribute("href", "/app/tasks?view=overdue");
  // 逾期任务进入优先任务首位，未来任务随后。
  const boxes = await screen.findAllByRole("checkbox");
  expect(boxes.map((b) => b.getAttribute("aria-label"))).toEqual(["完成 逾期任务", "完成 未来任务"]);
});