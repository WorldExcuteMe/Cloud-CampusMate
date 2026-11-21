import { lazy, Suspense } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Layout } from "./layout";
const LandingPage = lazy(() => import("@/features/landing/LandingPage").then((m) => ({ default: m.LandingPage })));
const DashboardPage = lazy(() => import("@/features/dashboard/DashboardPage").then((m) => ({ default: m.DashboardPage })));
const InboxPage = lazy(() => import("@/features/inbox/InboxPage").then((m) => ({ default: m.InboxPage })));
const NewInboxPage = lazy(() => import("@/features/inbox/NewInboxPage").then((m) => ({ default: m.NewInboxPage })));
const InboxDetailPage = lazy(() => import("@/features/inbox/InboxDetailPage").then((m) => ({ default: m.InboxDetailPage })));
const RadarPage = lazy(() => import("@/features/radar/RadarPage").then((m) => ({ default: m.RadarPage })));
const OpportunityDetailPage = lazy(() => import("@/features/radar/OpportunityDetailPage").then((m) => ({ default: m.OpportunityDetailPage })));
const TrustPage = lazy(() => import("@/features/trust/TrustPage").then((m) => ({ default: m.TrustPage })));
const TrustReportPage = lazy(() => import("@/features/trust/TrustReportPage").then((m) => ({ default: m.TrustReportPage })));
const TasksPage = lazy(() => import("@/features/tasks/TasksPage").then((m) => ({ default: m.TasksPage })));
const ProfilePage = lazy(() => import("@/features/profile/ProfilePage").then((m) => ({ default: m.ProfilePage })));
const SettingsPage = lazy(() => import("@/features/settings/SettingsPage").then((m) => ({ default: m.SettingsPage })));
const AgentChatPage = lazy(() => import("@/features/agent/AgentChatPage").then((m) => ({ default: m.AgentChatPage })));
const CalendarPage = lazy(() => import("@/features/calendar/CalendarPage").then((m) => ({ default: m.CalendarPage })));
import { LoginPage } from "./auth";

// 旧一级入口兼容：日常专区与成长中心已合并进统一任务中心，保留查询参数语义。
function DailyRedirect() {
  return <Navigate to="/app/tasks?tab=tasks" replace />;
}
function GrowthRedirect() {
  const loc = useLocation();
  const view = new URLSearchParams(loc.search).get("view");
  const next = new URLSearchParams({ tab: "tasks" });
  if (view) next.set("view", view);
  return <Navigate to={{ pathname: "/app/tasks", search: next.toString() }} replace />;
}

export function AppRoutes() {
  return (
    <Suspense fallback={<p role="status" className="p-6 text-sm text-muted-foreground">加载中…</p>}>
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/app" element={<Layout />}>
        <Route index element={<DashboardPage />} />
        <Route path="agent" element={<AgentChatPage />} />
        <Route path="inbox" element={<InboxPage />} />
        <Route path="inbox/new" element={<NewInboxPage />} />
        <Route path="inbox/:id" element={<InboxDetailPage />} />
        <Route path="daily" element={<DailyRedirect />} />
        <Route path="tasks" element={<TasksPage />} />
        <Route path="calendar" element={<CalendarPage />} />
        <Route path="radar" element={<RadarPage />} />
        <Route path="radar/:id" element={<OpportunityDetailPage />} />
        <Route path="trust" element={<TrustPage />} />
        <Route path="trust/:id" element={<TrustReportPage />} />
        <Route path="growth" element={<GrowthRedirect />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/app" replace />} />
    </Routes>
    </Suspense>
  );
}