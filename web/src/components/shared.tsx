import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { NoticeClass, NoticeCategory, VerificationStatus, TaskStatus } from "@/lib/schemas";
import { deadlineInstant, localParts } from "../../../shared/calendar";
import { useBeijingDay } from "@/lib/use-beijing-day";

const CLASS_META: Record<NoticeClass, { label: string; className: string }> = {
  must_act: { label: "必须处理", className: "bg-red-100 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-200 dark:border-red-800" },
  high_value: { label: "高价值机会", className: "bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-950 dark:text-indigo-200 dark:border-indigo-800" },
  worth_watching: { label: "值得关注", className: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-800" },
  normal: { label: "普通信息", className: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-950 dark:text-slate-200 dark:border-slate-800" },
  risk: { label: "风险警告", className: "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-200 dark:border-rose-800" },
};

const CATEGORY_LABEL: Record<NoticeCategory, string> = {
  competition: "学科竞赛",
  internship: "实习招聘",
  research: "科研项目",
  scholarship: "奖学金",
  activity: "校园活动",
  opensource: "开源项目",
  notice: "校园通知",
};

export function ClassBadge({ value }: { value: NoticeClass }) {
  const m = CLASS_META[value];
  return <Badge variant="outline" className={cn("border", m.className)}>{m.label}</Badge>;
}

export function CategoryBadge({ value }: { value: NoticeCategory }) {
  return <Badge variant="secondary">{CATEGORY_LABEL[value]}</Badge>;
}

export function MockBadge() {
  return (
    <Badge variant="outline" className="border-dashed border-slate-300 text-slate-500">
      MOCK · 规则提取
    </Badge>
  );
}

export function DeadlineTag({ deadline, pastLabel = "已过期" }: { deadline: string | null; pastLabel?: string }) {
  const today = useBeijingDay();
  if (!deadline) return <span className="text-xs text-muted-foreground">无截止日期</span>;
  const instant = deadlineInstant(deadline, "Asia/Shanghai");
  if (!Number.isFinite(instant)) return <span className="text-xs text-muted-foreground">截止日期待核对：{deadline}</span>;
  const local = localParts(instant, "Asia/Shanghai"), date = local.date;
  const label = /T\d/.test(deadline) ? `${date} ${local.time}（北京时间）` : deadline;
  const days = Math.round((Date.parse(date) - Date.parse(today)) / 86_400_000);
  const expired = instant < Date.now();
  const urgent = days <= 3;
  const soon = days <= 7;
  return (
    <span
      className={cn(
        "text-xs font-medium",
        urgent ? "text-red-600 dark:text-red-300" : soon ? "text-amber-700 dark:text-amber-300" : "text-muted-foreground",
      )}
    >
      截止 {label}
      {!expired && days > 0 && ` · 剩 ${days} 天`}
      {!expired && days === 0 && " · 今天截止"}
      {expired && ` · ${pastLabel}`}
    </span>
  );
}

const VERIFY_META: Record<VerificationStatus, { label: string; className: string }> = {
  VERIFIED: { label: "已核验", className: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-800" },
  PARTIALLY_VERIFIED: { label: "部分核验", className: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-800" },
  UNVERIFIED: { label: "未核验", className: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-950 dark:text-slate-200 dark:border-slate-800" },
  CONFLICTING: { label: "信息冲突", className: "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-200 dark:border-orange-800" },
  RISK_FLAGGED: { label: "风险标记", className: "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-200 dark:border-rose-800" },
};

export function VerifyBadge({ value }: { value: VerificationStatus }) {
  const m = VERIFY_META[value];
  return <Badge variant="outline" className={cn("border", m.className)}>{m.label}</Badge>;
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions}
    </div>
  );
}

/** 统一页面容器：内容区最大 1280px，左右对齐与边距由 Layout 统一提供。 */
export function PageShell({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mx-auto w-full max-w-[1280px]", className)}>{children}</div>;
}

export function SectionHeader({ title, action }: { title: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="flex items-center gap-2 text-base font-semibold">{title}</h2>
      {action}
    </div>
  );
}

/** 关键指标卡：有链接时可点击跳转；数值与标签均来自真实数据。 */
export function MetricCard({ label, value, icon: Icon, to, tone = "default" }: {
  label: string;
  value: number | string;
  icon: LucideIcon;
  to?: string;
  tone?: "default" | "warning" | "danger";
}) {
  const body = (
    <div className={cn(
      "flex items-center gap-3 rounded-lg border bg-card px-4 py-3",
      to && "transition-colors hover:border-foreground/25",
      tone === "warning" && "border-warning/40",
      tone === "danger" && "border-destructive/40",
    )}>
      <Icon className={cn("size-5 shrink-0", tone === "danger" ? "text-destructive" : tone === "warning" ? "text-warning" : "text-primary")} />
      <div className="min-w-0">
        <p className="text-xl font-semibold tabular-nums">{value}</p>
        <p className="truncate text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
  return to ? <Link to={to} className="block">{body}</Link> : body;
}

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-border px-4 py-6 text-center">
      <p className="text-sm font-medium text-foreground">{title}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      {action && <div className="mt-3 flex justify-center">{action}</div>}
    </div>
  );
}

const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  todo: "待处理",
  in_progress: "进行中",
  done: "已完成",
  cancelled: "已取消",
};

export function taskStatusLabel(status: TaskStatus): string {
  return TASK_STATUS_LABEL[status] ?? status;
}

export function TaskStatusBadge({ value }: { value: TaskStatus }) {
  return (
    <Badge variant="outline" className={cn(
      "border",
      value === "done" && "border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
      value === "in_progress" && "border-blue-200 bg-blue-100 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200",
      (value === "todo" || value === "cancelled") && "border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200",
    )}>{taskStatusLabel(value)}</Badge>
  );
}

/** 内部优先级分数 → 用户可理解的档位；分数本身只在解释区展示。 */
export function priorityLabel(priority: number): "高" | "中" | "低" {
  return priority >= 80 ? "高" : priority >= 60 ? "中" : "低";
}
