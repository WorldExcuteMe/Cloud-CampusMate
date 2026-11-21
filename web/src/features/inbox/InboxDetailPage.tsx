import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRepository } from "@/app/auth";
import { PageShell } from "@/components/shared";
import { InboxPreview } from "./InboxPreview";

/** 独立详情页：分享链接 / 历史证据 / 长原文查阅；业务规则与预览面板共用 InboxPreview + NoticeActions。 */
export function InboxDetailPage() {
  const repository = useRepository();
  const { id = "" } = useParams();
  const { data: item, isLoading } = useQuery({
    queryKey: ["inbox", id],
    queryFn: () => repository.getInbox(id),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">加载中…</p>;
  if (!item) return <p className="text-sm text-muted-foreground">未找到该条目。</p>;

  return (
    <PageShell>
      <Button variant="ghost" size="sm" asChild className="mb-3">
        <Link to="/app/inbox"><ArrowLeft className="size-4" />返回信息中心</Link>
      </Button>
      <div className="rounded-lg border bg-card p-5">
        <InboxPreview item={item} />
      </div>
    </PageShell>
  );
}