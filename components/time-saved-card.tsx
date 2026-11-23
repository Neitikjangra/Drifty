import { Timer } from "lucide-react";
import { IconBadge } from "@/components/ui/icon-badge";
import { formatSaved, MINUTES, type TimeSaved } from "@/lib/dashboard/time-saved";

/** "Drifty saved you ~X hours · N drifts caught (estimate)", with the breakdown on tap/hover. */
export function TimeSavedCard({ data, scope }: { data: TimeSaved; scope: "project" | "workspace" }) {
  if (!data.minutes) return null;
  return (
    <details className="bg-accent group rounded-2xl border border-lime-400/20 px-4 py-3 text-sm">
      <summary className="flex cursor-pointer list-none items-center gap-3">
        <IconBadge icon={Timer} />
        <span className="min-w-0 flex-1">
          <span className="text-primary block font-semibold">Drifty saved you {formatSaved(data.minutes)}</span>
          <span className="text-muted-foreground text-xs">
            {data.drifts} drift{data.drifts === 1 ? "" : "s"} caught{scope === "workspace" ? " across your projects" : ""}{" "}
            <span className="rounded-full border border-lime-400/30 px-1.5 text-[10px] font-semibold uppercase">estimate</span>
          </span>
        </span>
        <span className="text-muted-foreground text-xs group-open:hidden">Details</span>
      </summary>
      <ul className="text-muted-foreground mt-3 space-y-0.5 border-t border-lime-400/15 pt-2 text-xs">
        <li>
          {data.changeLists} AI change list{data.changeLists === 1 ? "" : "s"} × {MINUTES.changeList} min
        </li>
        <li>
          {data.drifts} conflict{data.drifts === 1 ? "" : "s"} / drift{data.drifts === 1 ? "" : "s"} caught × {MINUTES.drift} min
        </li>
        <li>
          {data.approvals} approval{data.approvals === 1 ? "" : "s"} recorded × {MINUTES.approval} min
        </li>
        <li className="pt-1">An estimate of manual chasing and checking avoided, not measured time.</li>
      </ul>
    </details>
  );
}
