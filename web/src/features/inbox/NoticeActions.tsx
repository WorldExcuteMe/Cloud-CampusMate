import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowUpRight, EyeOff, ListPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRepository } from "@/app/auth";
import { uid } from "@/lib/data/types";
import type { InboxItem } from "@/lib/data/types";
import { publicSourceUrl } from "../../../../shared/document";

/**
 * 通知处理操作组：预览面板与详情页共用同一实现，避免两套业务规则。
 * 创建任务的截止预填来自通知提取结果，需用户核对；无明确截止时保持待确认。
 */
export function NoticeActions({ item, showDetailLink = false }: { item: InboxItem; showDetailLink?: boolean }) {
  const repository = useRepository();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const source = publicSourceUrl(item.sourceUrl ?? item.extracted.sourceUrl);

  const taskMutation = useMutation({
    mutationFn: async () => {
      await repository.createTask({
        id: uid(),
        userId: item.userId,
        title: title.trim() || `处理：${item.extracted.title}`,
        dueAt: due || item.extracted.deadline,
        status: "todo",
        priority: item.classification.priorityScore,
        inboxItemId: item.id,
        estimateHours: null,
        kind: "general",
        createdAt: new Date().toISOString(),
        demo: item.demo,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["inbox"] });
      toast.success("任务已创建，截止时间会同步显示在日历与 Today");
      setOpen(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "创建失败"),
  });

  const ignoreMutation = useMutation({
    mutationFn: () => repository.updateInbox(item.id, { status: "ignored" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inbox"] });
      toast.success("已忽略");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "操作失败"),
  });

  return (
    <div className="flex flex-wrap items-center gap-2 border-t pt-4">
      <Button onClick={() => { setTitle(""); setDue(item.extracted.deadline?.slice(0, 10) ?? ""); setOpen(true); }}>
        <ListPlus className="size-4" />创建任务
      </Button>
      {source && (
        <Button variant="outline" asChild>
          <a href={source} target="_blank" rel="noreferrer">查看来源<ArrowUpRight className="size-3.5" /></a>
        </Button>
      )}
      {item.status !== "ignored" && (
        <Button variant="ghost" disabled={ignoreMutation.isPending} onClick={() => ignoreMutation.mutate()}>
          <EyeOff className="size-4" />忽略
        </Button>
      )}
      {showDetailLink && (
        <Button variant="ghost" asChild>
          <Link to={`/app/inbox/${item.id}`}>完整详情页<ArrowUpRight className="size-3.5" /></Link>
        </Button>
      )}

      <Dialog open={open} onOpenChange={(next) => { if (!next && !taskMutation.isPending) setOpen(false); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>从通知创建任务</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-3">
            <div>
              <Label htmlFor="notice-task-title">任务标题</Label>
              <Input id="notice-task-title" placeholder={`处理：${item.extracted.title}`} value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="notice-task-due">截止日期</Label>
              <Input id="notice-task-due" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
              <p className="mt-1 text-xs text-muted-foreground">
                {item.extracted.deadline
                  ? "预填来自通知提取的截止时间，请核对；若只是建议完成日期，请改为内部计划日期。"
                  : "通知未识别出明确截止；留空则保持待确认，不要凭空填写。"}
              </p>
            </div>
            <p className="text-xs text-muted-foreground">创建后截止时间会自动进入校园日历的截止区域，无需重复加入。</p>
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={taskMutation.isPending} onClick={() => setOpen(false)}>取消</Button>
            <Button disabled={taskMutation.isPending} onClick={() => taskMutation.mutate()}>
              {taskMutation.isPending ? "正在创建…" : "创建任务"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}