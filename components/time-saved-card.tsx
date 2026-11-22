import { formatSaved, MINUTES, type TimeSaved } from "@/lib/dashboard/time-saved";

/** "Drifty saved you ~X hours · N drifts caught (estimate)", with the breakdown on tap/hover. */
export function TimeSavedCard({ data, scope }: { data: TimeSaved; scope: "project" | "workspace" }) {
  if (!data.minutes) return null;
  return (
    <details className="bg-beige-500 border-beige-400 rounded-lg border px-3 py-2 text-sm">
      <summary className="cursor-pointer list-none">
        <span className="font-semibold text-dark-teal-500">Drifty saved you {formatSaved(data.minutes)}</span>
        <span className="text-air-force-blue-300">
          {" · "}
          {data.drifts} drift{data.drifts === 1 ? "" : "s"} caught{scope === "workspace" ? " across your projects" : ""}{" "}
          <span className="rounded bg-beige-400 px-1 text-[10px] font-semibold uppercase">estimate</span>
        </span>
      </summary>
      <ul className="text-air-force-blue-300 mt-2 space-y-0.5 text-xs">
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
