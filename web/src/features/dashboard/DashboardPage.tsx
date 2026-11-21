import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { CalendarDays, Clock3, Inbox, ListTodo, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRepository } from "@/app/auth";
import { runtime } from "@/app/config";
import { ClassBadge, DeadlineTag, EmptyState, MetricCard, MockBadge, PageHeader, PageShell, SectionHeader } from "@/components/shared";
import { TaskItem, useTaskCompletion } from "@/components/task";
import { useCampusCalendar } from "@/features/calendar/use-campus-calendar";
import { todayTasks, overdueTasks, upcomingDeadlines, importantNotices } from "@/lib/domain/today";
import { dateEntries, localParts, projectCourses } from "../../../../shared/calendar";

/** Today = 行动驾驶舱：只回答"接下来最值得做什么"，完整清单在任务中心与信息中心。 */
export function DashboardPage() {
  const repository = useRepository();
  const inbox = useQuery({ queryKey: ["inbox"], queryFn: () => repository.listInbox() });
  const { tasks, opps, term, today, timezone, knowledge, schedules } = useCampusCalendar();
  const { requestComplete, completing, confirmDialog } = useTaskCompletion();

  const allTasks = tasks.data ?? [];
  const openTasks = allTasks.filter((t) => t.status === "todo" || t.status === "in_progress");
  const overdue = overdueTasks(allTasks, Date.now(), timezone);
  const urgent = upcomingDeadlines(allTasks, 7, Date.now(), timezone).length;
  const todayTodo = todayTasks(allTasks, Date.now(), timezone);
  const pendingReview = (inbox.data ?? []).filter((i) => i.status === "pending_review").length;

  // 优先任务：逾期最先，其余按截止时间与优先级排序，最多 5 条。
  const rest = openTasks
    .filter((t) => !overdue.some((o) => o.id === t.id))
    .sort((a, b) => ((a.dueAt ?? "9999").localeCompare(b.dueAt ?? "9999")) || (b.priority - a.priority));
  const priorityTasks = [...overdue, ...rest].slice(0, 5);

  const courses = term && knowledge === "ready" ? projectCourses(term, schedules.data?.schedules ?? [], schedules.data?.exceptions ?? [], today, today).entries : [];
  const next = [...courses, ...dateEntries({ from: today, to: today, timezone, tasks: allTasks, opps: opps.data ?? [] })]
    .filter((e) => e.allDay || e.endTime >= localParts(Date.now(), timezone).time)
    .sort((a, b) => a.startTime.localeCompare(b.startTime))[0];

  const notices = importantNotices((inbox.data ?? []).map((i) => ({ id: i.id, title: i.extracted.title, priority: i.classification.priorityScore })), 3);
  const noticeOf = (id: string) => (inbox.data ?? []).find((i) => i.id === id);

  return (
    <PageShell>
      <PageHeader title="今天需要关注什么" description={`${today} · 优先任务、近期截止与重要通知。`} />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <MetricCard label="待处理任务" value={openTasks.length} icon={ListTodo} to="/app/tasks" />
        <MetricCard label="近期截止（7 天内）" value={urgent} icon={Clock3} to="/app/tasks?view=soon" />
        <MetricCard label="待确认通知" value={pendingReview} icon={Inbox} to="/app/inbox" />
        {overdue.length > 0 && <MetricCard label="已逾期待处理" value={overdue.length} icon={ShieldAlert} to="/app/tasks?view=overdue" tone="danger" />}
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <section className="rounded-lg border bg-card p-5">
          <SectionHeader
            title={<><ListTodo className="size-4 text-primary" />优先任务</>}
            action={<Button variant="ghost" size="sm" asChild><Link to="/app/tasks">查看全部任务</Link></Button>}
          />
          <div className="mt-3 flex flex-col gap-2">
            {priorityTasks.length === 0 ? (
              <EmptyState
                title="暂无待办"
                hint="从信息中心确认通知后可生成任务。"
                action={<Button variant="outline" size="sm" asChild><Link to="/app/inbox/new">导入通知</Link></Button>}
              />
            ) : (
              priorityTasks.map((t) => <TaskItem key={t.id} task={t} onComplete={requestComplete} completing={completing} />)
            )}
          </div>
        </section>

        <section className="rounded-lg border bg-card p-5">
          <SectionHeader
            title={<><CalendarDays className="size-4 text-primary" />接下来</>}
            action={<Button variant="ghost" size="sm" asChild><Link to="/app/calendar">打开日历</Link></Button>}
          />
          {next ? (
            <div className="mt-3">
              <p className="text-base font-semibold">{next.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{next.allDay ? "当天截止" : `${next.startTime}–${next.endTime}`}</p>
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">今天没有后续已记录安排。</p>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            {knowledge === "ready" ? `今天共 ${courses.length} 节课` : knowledge === "loading" ? "正在读取课表…" : "课表未接入，可在日历导入"}
            {" · "}今日待办 {todayTodo.length}
          </p>
        </section>
      </div>

      <section className="rounded-lg border bg-card p-5">
        <SectionHeader
          title={<><Inbox className="size-4 text-primary" />最新重要信息</>}
          action={<Button variant="ghost" size="sm" asChild><Link to="/app/inbox">查看全部消息</Link></Button>}
        />
        <div className="mt-3 flex flex-col gap-2">
          {notices.length === 0 ? (
            <EmptyState title="收件箱为空" hint="导入一条通知开始。" action={<Button variant="outline" size="sm" asChild><Link to="/app/inbox/new">导入通知</Link></Button>} />
          ) : (
            notices.map((n) => {
              const item = noticeOf(n.id);
              if (!item) return null;
              return (
                <Link key={n.id} to={`/app/inbox/${n.id}`} className="flex flex-wrap items-center gap-2 rounded-md border border-border p-3 hover:bg-muted">
                  <ClassBadge value={item.classification.class} />
                  {(item.extractionMock ?? item.demo) && <MockBadge />}
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{item.extracted.title}</span>
                  <DeadlineTag deadline={item.extracted.deadline} />
                </Link>
              );
            })
          )}
        </div>
      </section>
      <p className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
        <Inbox className="size-3" />
        {runtime === "cloud" ? "演示数据与 Mock 结果均明确标识；登录 Qoder 后进入个人空间。" : "演示数据与 Mock 结果均明确标识；配置 Supabase 与模型后启用真实模式。"}
      </p>
      {confirmDialog}
    </PageShell>
  );
}