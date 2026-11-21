import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, ExternalLink, Pencil, Sprout, Target, Undo2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRepository } from "@/app/auth";
import { DeadlineTag, EmptyState, PageHeader, PageShell, TaskStatusBadge } from "@/components/shared";
import { TaskItem, useTaskCompletion } from "@/components/task";
import { isOpenTask, isTaskOverdue, isTaskDueSoon } from "@/lib/time-policy";
import { useBeijingDay } from "@/lib/use-beijing-day";
import type { Task } from "@/lib/data/types";
import type { TaskStatus } from "@/lib/schemas";
import { DailyImport } from "./DailyImport";

const VIEWS = [
  { id: "open", label: "进行中" },
  { id: "soon", label: "近期截止" },
  { id: "overdue", label: "已逾期" },
  { id: "done", label: "已完成" },
  { id: "all", label: "全部" },
] as const;
type View = (typeof VIEWS)[number]["id"];

const PRIORITY_OPTIONS = [{ label: "高", value: 80 }, { label: "中", value: 65 }, { label: "低", value: 40 }];

/** 全站唯一任务管理中心：我的任务 / 长期目标 / 成长档案。 */
export function TasksPage() {
  const repository = useRepository();
  const qc = useQueryClient();
  const { data: tasks = [] } = useQuery({ queryKey: ["tasks"], queryFn: () => repository.listTasks() });
  const { data: profile } = useQuery({ queryKey: ["profile"], queryFn: () => repository.getProfile() });
  const [params, setParams] = useSearchParams();
  const today = useBeijingDay();
  const { requestComplete, completing, confirmDialog } = useTaskCompletion();

  const tab = ["tasks", "goals", "growth"].includes(params.get("tab") ?? "") ? params.get("tab")! : "tasks";
  const requestedView = params.get("view") ?? "open";
  const view: View = VIEWS.some((v) => v.id === requestedView) ? requestedView as View : "open";
  const setParam = (key: string, value: string) => setParams((current) => { const next = new URLSearchParams(current); next.set(key, value); return next; });

  const [editing, setEditing] = useState<Task | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDue, setEditDue] = useState("");
  const [editPriority, setEditPriority] = useState(65);

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: TaskStatus }) => repository.updateTask(id, { status }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      toast.success(variables.status === "done" ? "任务已完成" : variables.status === "cancelled" ? "任务已取消，记录保留" : "已恢复为进行中");
    },
    onError: () => toast.error("更新任务状态失败，请重试"),
  });

  const editMutation = useMutation({
    mutationFn: async () => {
      if (!editing) throw new Error("无任务");
      const dueAt = editDue
        ? (editing.dueAt && editing.dueAt.slice(0, 10) === editDue && editing.dueAt.includes("T") ? editing.dueAt : editDue)
        : null;
      await repository.updateTask(editing.id, { title: editTitle.trim() || editing.title, dueAt, priority: editPriority });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("任务已更新");
      setEditing(null);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "更新失败"),
  });

  const open = tasks.filter((t) => isOpenTask(t) && !isTaskOverdue(t, today));
  const overdue = tasks.filter((t) => isTaskOverdue(t, today));
  const soon = tasks.filter((t) => isTaskDueSoon(t, today));
  const done = tasks.filter((t) => t.status === "done");
  const cancelled = tasks.filter((t) => t.status === "cancelled");
  const shown = view === "open" ? [...overdue, ...open] : view === "soon" ? soon : view === "overdue" ? overdue : view === "done" ? done : tasks;

  const openEdit = (task: Task) => {
    setEditing(task);
    setEditTitle(task.title);
    setEditDue(task.dueAt?.slice(0, 10) ?? "");
    setEditPriority(task.priority);
  };

  const rowActions = (task: Task) => (
    <div className="flex shrink-0 items-center gap-1">
      {task.inboxItemId && (
        <Button size="icon-xs" variant="ghost" asChild aria-label="查看来源通知">
          <Link to={`/app/inbox/${task.inboxItemId}`}><ExternalLink className="size-3.5" /></Link>
        </Button>
      )}
      {isOpenTask(task) && (
        <>
          <Button size="icon-xs" variant="ghost" aria-label={`编辑 ${task.title}`} onClick={() => openEdit(task)}>
            <Pencil className="size-3.5" />
          </Button>
          <Button size="icon-xs" variant="ghost" aria-label={`取消 ${task.title}`} disabled={statusMutation.isPending}
            onClick={() => statusMutation.mutate({ id: task.id, status: "cancelled" })}>
            <X className="size-3.5 text-muted-foreground" />
          </Button>
        </>
      )}
      {task.status === "done" && (
        <Button size="icon-xs" variant="ghost" aria-label={`撤销完成 ${task.title}`} disabled={statusMutation.isPending}
          onClick={() => statusMutation.mutate({ id: task.id, status: "todo" })}>
          <Undo2 className="size-3.5" />
        </Button>
      )}
      {task.status === "cancelled" && (
        <Button size="icon-xs" variant="ghost" aria-label={`恢复 ${task.title}`} disabled={statusMutation.isPending}
          onClick={() => statusMutation.mutate({ id: task.id, status: "todo" })}>
          <Undo2 className="size-3.5" />
        </Button>
      )}
    </div>
  );

  return (
    <PageShell>
      <PageHeader title="任务与目标" description="全站唯一的任务管理中心：待办执行、长期目标与成长记录。" />
      <Tabs value={tab} onValueChange={(value) => setParam("tab", value)} className="mb-4">
        <TabsList>
          <TabsTrigger value="tasks">我的任务</TabsTrigger>
          <TabsTrigger value="goals">长期目标</TabsTrigger>
          <TabsTrigger value="growth">成长档案</TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === "tasks" && (
        <div className="flex flex-col gap-4">
          <DailyImport />
          <section className="rounded-lg border bg-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-semibold">我的任务</h2>
              <div className="flex flex-wrap gap-1" role="group" aria-label="任务筛选">
                {VIEWS.map((v) => (
                  <button key={v.id} aria-pressed={view === v.id} onClick={() => setParam("view", v.id)}
                    className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${view === v.id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"}`}>
                    {v.label}{v.id === "overdue" ? `（${overdue.length}）` : ""}
                  </button>
                ))}
              </div>
            </div>
            {view === "overdue" && <p className="mt-2 text-xs text-muted-foreground">逾期不等于已完成。核实后手动完成或取消；不会自动删除历史记录。</p>}
            <div className="mt-3 flex flex-col gap-2">
              {shown.length === 0 ? (
                <EmptyState title="暂无任务" hint="导入群通知，或在信息中心从通知创建任务。" />
              ) : shown.map((task) => task.status === "done" || task.status === "cancelled" ? (
                <div key={task.id} className="flex items-center gap-3 rounded-md border border-border p-3">
                  <Check className={`size-4 shrink-0 ${task.status === "done" ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{task.title}</p>
                    <DeadlineTag deadline={task.dueAt} pastLabel="截止已过" />
                  </div>
                  <TaskStatusBadge value={task.status} />
                  {rowActions(task)}
                </div>
              ) : (
                <TaskItem key={task.id} task={task} onComplete={requestComplete} completing={completing}>
                  {rowActions(task)}
                </TaskItem>
              ))}
            </div>
          </section>
        </div>
      )}

      {tab === "goals" && (
        <section className="rounded-lg border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-base font-semibold"><Target className="size-4 text-primary" />长期目标</h2>
            <Button variant="ghost" size="sm" asChild><Link to="/app/profile">管理目标</Link></Button>
          </div>
          <div className="mt-3 flex flex-col gap-2">
            {(profile?.goals ?? []).length === 0 ? (
              <EmptyState title="还没有长期目标" hint="在个人画像中写下目标，Agent 也能帮你拆解为任务。"
                action={<Button variant="outline" size="sm" asChild><Link to="/app/profile">去设置目标</Link></Button>} />
            ) : (profile?.goals ?? []).map((goal, i) => (
              <div key={i} className="rounded-md border border-border p-3">
                <p className="text-sm font-medium">{goal}</p>
                <p className="mt-1 text-xs text-muted-foreground">进度与关联任务暂未记录；完成的相关任务会进入成长档案。</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {tab === "growth" && (
        <section className="rounded-lg border bg-card p-5">
          <h2 className="flex items-center gap-2 text-base font-semibold"><Sprout className="size-4 text-primary" />成长档案</h2>
          <p className="mt-1 text-xs text-muted-foreground">已完成 {done.length} · 已取消 {cancelled.length} · 只读记录，来自真实任务历史。</p>
          <div className="mt-3 flex flex-col gap-2">
            {done.length === 0 ? (
              <EmptyState title="还没有完成记录" hint="在「我的任务」中确认完成后，会在这里积累。" />
            ) : done.map((task) => (
              <div key={task.id} className="flex items-center gap-3 rounded-md border border-border p-3">
                <Check className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{task.title}</p>
                  <DeadlineTag deadline={task.dueAt} pastLabel="截止已过" />
                </div>
                <TaskStatusBadge value="done" />
                {task.inboxItemId && (
                  <Button size="icon-xs" variant="ghost" asChild aria-label="查看来源通知">
                    <Link to={`/app/inbox/${task.inboxItemId}`}><ExternalLink className="size-3.5" /></Link>
                  </Button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <Dialog open={editing !== null} onOpenChange={(open) => { if (!open && !editMutation.isPending) setEditing(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>编辑任务</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-3">
            <div><Label htmlFor="task-edit-title">标题</Label><Input id="task-edit-title" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} /></div>
            <div><Label htmlFor="task-edit-due">截止日期</Label><Input id="task-edit-due" type="date" value={editDue} onChange={(e) => setEditDue(e.target.value)} /></div>
            <div>
              <Label htmlFor="task-edit-priority">优先级</Label>
              <select id="task-edit-priority" className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={editPriority} onChange={(e) => setEditPriority(Number(e.target.value))}>
                {PRIORITY_OPTIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={editMutation.isPending} onClick={() => setEditing(null)}>取消</Button>
            <Button disabled={editMutation.isPending} onClick={() => editMutation.mutate()}>{editMutation.isPending ? "正在保存…" : "保存"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {confirmDialog}
    </PageShell>
  );
}