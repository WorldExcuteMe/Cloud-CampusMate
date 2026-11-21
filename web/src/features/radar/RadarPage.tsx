import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { opportunityTimeState, OPPORTUNITY_TIME_LABELS, type OpportunityTimeState } from "@/lib/time-policy";
import { useBeijingDay } from "@/lib/use-beijing-day";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRepository } from "@/app/auth";
import { CategoryBadge, DeadlineTag, EmptyState, PageHeader, VerifyBadge } from "@/components/shared";
import type { NoticeCategory } from "@/lib/schemas";

export function RadarPage() {
  const repository = useRepository();
  const { data: opps = [] } = useQuery({
    queryKey: ["opps"],
    queryFn: () => repository.listOpportunities(),
  });
  const { data: reports = [] } = useQuery({
    queryKey: ["reports"],
    queryFn: () => repository.listReports(),
  });
  const reportOf = (id: string) => reports.find((r) => r.opportunityId === id);
  const [q, setQ] = useState("");
  const [type, setType] = useState<string>("all");
  const [time, setTime] = useState<OpportunityTimeState | "all">("active");
  const today = useBeijingDay();

  const matching = useMemo(() => opps.filter((o) =>
    (type === "all" || o.type === type) &&
    (!q.trim() || `${o.title} ${o.organizer}`.toLowerCase().includes(q.trim().toLowerCase())),
  ), [opps, q, type]);

  const filtered = useMemo(
    () =>
      matching.filter((o) => time === "all" || opportunityTimeState(o, today) === time),
    [matching, time, today],
  );

  return (
    <div className="mx-auto w-full max-w-[1280px]">
      <PageHeader title="Opportunity Radar" description="按北京时间管理截止日期；过期记录保留在历史分类，不自动删除。" />
      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-2 top-2.5 size-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="搜索机会…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部类型</SelectItem>
            <SelectItem value="competition">学科竞赛</SelectItem>
            <SelectItem value="internship">实习招聘</SelectItem>
            <SelectItem value="research">科研项目</SelectItem>
            <SelectItem value="scholarship">奖学金</SelectItem>
            <SelectItem value="activity">校园活动</SelectItem>
            <SelectItem value="opensource">开源项目</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="机会时效筛选">
        {(["active", "unknown", "expired", "archived", "all"] as const).map((value) => (
          <Button key={value} size="sm" variant={time === value ? "default" : "outline"}
            aria-pressed={time === value} onClick={() => setTime(value)}>
            {value === "all" ? "全部" : OPPORTUNITY_TIME_LABELS[value]}（{value === "all" ? matching.length : matching.filter((o) => opportunityTimeState(o, today) === value).length}）
          </Button>
        ))}
      </div>
      <p className="mb-4 text-xs text-muted-foreground">“有效”仅表示未到已知截止日期，不代表来源或参与资格已核验；无有效日期的机会请在“待核实日期”查看。</p>

      {filtered.length === 0 ? (
        <EmptyState title="没有匹配的机会" hint="可切换时效分类或调整搜索条件；历史记录没有被删除。" />
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((o) => (
            <Link key={o.id} to={`/app/radar/${o.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-border p-3 transition-colors hover:bg-muted">
              <CategoryBadge value={o.type as NoticeCategory} />
              <Badge variant="outline">{OPPORTUNITY_TIME_LABELS[opportunityTimeState(o, today)]}</Badge>
              <VerifyBadge value={reportOf(o.id)?.status ?? "UNVERIFIED"} />
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{o.title}</span>
              <span className="hidden text-xs text-muted-foreground sm:inline">{o.organizer}</span>
              <DeadlineTag deadline={o.deadline} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
