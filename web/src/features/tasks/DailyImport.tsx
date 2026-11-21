import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Import } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth, useRepository } from "@/app/auth";
import { uid } from "@/lib/data/types";
import { cleanGroupMessage, dedupKey, extractDailyTime, isDailyNotice } from "@/lib/ingest/clean";

const SEEN_KEY = "campusmate.daily.seen";

/** 群通知导入工具：清洗、去重、提取时间；保留原有预览确认机制。 */
export function DailyImport() {
  const repository = useRepository();
  const { session } = useAuth();
  const seenKey = `${SEEN_KEY}.${session?.user.id ?? "demo"}`;
  const qc = useQueryClient();
  const [raw, setRaw] = useState("");

  const preview = useMemo(() => {
    if (!raw.trim()) return null;
    const cleaned = cleanGroupMessage(raw);
    const t = extractDailyTime(cleaned);
    return { cleaned, ...t, daily: isDailyNotice(cleaned) };
  }, [raw]);

  const importMutation = useMutation({
    mutationFn: async () => {
      if (!preview) throw new Error("无内容");
      const key = dedupKey(raw);
      const seen: string[] = JSON.parse(localStorage.getItem(seenKey) || "[]");
      if (seen.includes(key)) throw new Error("该通知已导入（去重）");
      const firstLine = preview.cleaned.split("\n")[0].slice(0, 40);
      await repository.createTask({
        id: uid(),
        userId: "demo-user",
        title: firstLine || "日常任务",
        dueAt: preview.dueAt,
        status: "todo",
        priority: 65,
        inboxItemId: null,
        estimateHours: 1,
        kind: "daily",
        timeText: preview.timeText,
        createdAt: new Date().toISOString(),
        demo: repository.mode === "demo",
      });
      localStorage.setItem(seenKey, JSON.stringify([...seen, key]));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("已导入日常任务");
      setRaw("");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "导入失败"),
  });

  return (
    <details className="rounded-lg border bg-card p-4">
      <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
        <Import className="size-4 text-primary" />导入群通知（QQ/微信转发）
      </summary>
      <div className="mt-3 flex flex-col gap-3">
        <Textarea rows={4} placeholder="粘贴转发的群消息，如「@全体 周五19:00在教三101开班会，收到回复」" value={raw} onChange={(e) => setRaw(e.target.value)} />
        {preview && (
          <div className="rounded-md bg-muted p-3 text-xs">
            <p className="font-medium">清洗后：{preview.cleaned}</p>
            <p className="mt-1 text-muted-foreground">
              识别时间：{preview.dueAt ?? "未识别"} {preview.timeText} · {preview.daily ? "日常事务" : "非典型日常，仍可导入"}
            </p>
          </div>
        )}
        <Button disabled={!preview || importMutation.isPending} onClick={() => importMutation.mutate()}>
          导入为日常任务
        </Button>
      </div>
    </details>
  );
}