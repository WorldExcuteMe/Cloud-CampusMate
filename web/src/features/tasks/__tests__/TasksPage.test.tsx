import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import type { Task } from "@/lib/data/types";
const mocks = vi.hoisted(() => ({ listTasks: vi.fn(), updateTask: vi.fn(), error: vi.fn() }));
vi.mock("@/app/auth", () => ({
  useAuth: () => ({ session: null }),
  useRepository: () => ({
    mode: "demo", listTasks: mocks.listTasks, updateTask: mocks.updateTask,
    getProfile: async () => ({ id: "demo", name: "", school: "", major: "", grade: "", interests: [], skills: [], goals: [], timeBudgetHours: 10, bio: "" }),
  }),
}));
vi.mock("sonner", () => ({ toast: { error: mocks.error, success: vi.fn() } }));
import { TasksPage } from "../TasksPage";
let task: Task;
let client: QueryClient;
beforeEach(() => {
  vi.clearAllMocks();
  task = { id: "fixture", userId: "demo-user", title: "状态切换测试班会", dueAt: null, status: "done", priority: 65, inboxItemId: null, estimateHours: 1, kind: "daily", createdAt: "2026-11-14", demo: true };
  mocks.listTasks.mockImplementation(async () => [{ ...task }]);
  mocks.updateTask.mockImplementation(async (_id: string, patch: Partial<Task>) => { task = { ...task, ...patch }; return task; });
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
});
afterEach(() => { cleanup(); client.clear(); });
const mount = (entry = "/app/tasks?tab=tasks&view=done") => render(
  <MemoryRouter initialEntries={[entry]}><QueryClientProvider client={client}><TasksPage /></QueryClientProvider></MemoryRouter>,
);
describe("unified task center status semantics", () => {
  it("undoes a completed task and re-completes it through the shared confirmation", async () => {
    mount();
    const undo = await screen.findByRole("button", { name: "撤销完成 状态切换测试班会" });
    await userEvent.click(undo);
    await waitFor(() => expect(mocks.updateTask).toHaveBeenLastCalledWith("fixture", { status: "todo" }));
    await userEvent.click(screen.getByRole("button", { name: "进行中" }));
    const checkbox = await screen.findByRole("checkbox", { name: "完成 状态切换测试班会" });
    await userEvent.click(checkbox);
    expect(mocks.updateTask).toHaveBeenCalledTimes(1); // 确认前不写入
    await userEvent.click(screen.getByRole("button", { name: "确认完成" }));
    await waitFor(() => expect(mocks.updateTask).toHaveBeenLastCalledWith("fixture", { status: "done" }));
  });
  it("locks the undo action while saving and keeps the old state on failure", async () => {
    let reject!: (e: Error) => void;
    mocks.updateTask.mockReturnValue(new Promise((_resolve, fail) => { reject = fail; }));
    mount();
    const undo = await screen.findByRole("button", { name: "撤销完成 状态切换测试班会" });
    await userEvent.click(undo);
    expect(undo).toBeDisabled();
    await act(async () => reject(new Error("fixture failure")));
    await waitFor(() => expect(undo).toBeEnabled());
    expect(task.status).toBe("done");
    expect(mocks.error).toHaveBeenCalledWith("更新任务状态失败，请重试");
  });
});