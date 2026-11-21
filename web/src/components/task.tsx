import { useState, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DeadlineTag, priorityLabel } from "@/components/shared";
import { useRepository } from "@/app/auth";
import { isOpenTask } from "@/lib/time-policy";
import type { Task } from "@/lib/data/types";

/**
 * 全站唯一的"完成任务"交互：先确认再写入，失败保留弹窗与任务。
 * Today 与任务中心共用，保证同一任务在各页面状态一致。
 */
export function useTaskCompletion() {
  const repository = useRepository();
  const qc = useQueryClient();
  const [pendingTask, setPendingTask] = useState<Task | null>(null);

  const complete = useMutation({
    mutationFn: (id: string) => repository.updateTask(id, { status: "done" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      setPendingTask(null);
      toast.success("任务已完成");
    },
    onError: () => toast.error("完成任务失败，请重试"),
  });

  const confirmDialog = (
    <AlertDialog open={pendingTask !== null} onOpenChange={(open) => { if (!open && !complete.isPending) setPendingTask(null); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>确认完成任务？</AlertDialogTitle>
          <AlertDialogDescription>将「{pendingTask?.title}」标记为已完成？确认后将从待办列表移除，完成记录保留在成长档案。</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={complete.isPending}>取消</AlertDialogCancel>
          <AlertDialogAction
            disabled={complete.isPending}
            onClick={(event) => { event.preventDefault(); if (pendingTask && !complete.isPending) complete.mutate(pendingTask.id); }}
          >{complete.isPending ? "正在保存…" : "确认完成"}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { requestComplete: setPendingTask, completing: complete.isPending, confirmDialog };
}

/** 统一任务行：复选框 + 标题 + 截止 + 优先级档位；额外操作经 children 注入。 */
export function TaskItem({ task, onComplete, completing = false, children }: {
  task: Task;
  onComplete: (task: Task) => void;
  completing?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-border p-3">
      <Checkbox
        checked={task.status === "done"}
        disabled={completing || task.status === "done"}
        onCheckedChange={(checked) => { if (checked === true) onComplete(task); }}
        aria-label={`完成 ${task.title}`}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{task.title}</p>
        <div className="flex flex-wrap items-center gap-x-2">
          <DeadlineTag deadline={task.dueAt} pastLabel={isOpenTask(task) ? "已逾期" : "截止已过"} />
          {task.timeText && <span className="text-xs text-muted-foreground">{task.timeText}</span>}
        </div>
      </div>
      <span className="shrink-0 text-xs text-muted-foreground">优先级 {priorityLabel(task.priority)}</span>
      {children}
    </div>
  );
}