"use client";

import {
  Briefcase,
  Camera,
  Clapperboard,
  ClipboardList,
  Code2,
  Compass,
  GraduationCap,
  Megaphone,
  Palette,
  PenLine,
  type LucideIcon,
} from "lucide-react";
import { JOB_ROLES, type JobRoleId } from "@/lib/team/rules";

export const ROLE_ICON: Record<JobRoleId, LucideIcon> = {
  account_manager: Briefcase,
  project_manager: ClipboardList,
  strategist: Compass,
  social_media_manager: Megaphone,
  designer: Palette,
  copywriter: PenLine,
  video_editor: Clapperboard,
  photographer: Camera,
  developer: Code2,
  intern: GraduationCap,
};

const GROUPS = [
  { access: "am", title: "Manages clients", note: "Every project · client and internal rooms · can invite clients" },
  { access: "creative", title: "Makes the work", note: "Only projects you put them on · internal room only" },
] as const;

/** Role cards grouped by access level; roles the user can't grant are left out. */
export function RolePicker({ value, onChange, allowManagers, name }: { value: JobRoleId; onChange: (id: JobRoleId) => void; allowManagers: boolean; name: string }) {
  return (
    <div className="space-y-4">
      {GROUPS.filter((g) => allowManagers || g.access === "creative").map((g) => (
        <fieldset key={g.access} className="space-y-2">
          <legend className="flex flex-wrap items-baseline gap-x-2 text-sm font-medium">
            {g.title} <span className="text-muted-foreground text-xs font-normal">{g.note}</span>
          </legend>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {JOB_ROLES.filter((r) => r.access === g.access).map((r) => {
              const Icon = ROLE_ICON[r.id];
              const on = value === r.id;
              return (
                <label
                  key={r.id}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border p-2.5 transition-colors ${on ? "border-primary bg-lime-400/10" : "hover:border-primary/40 bg-muted/30"}`}
                >
                  <input type="radio" name={name} value={r.id} checked={on} onChange={() => onChange(r.id)} className="sr-only" />
                  <span className={`inline-flex size-9 shrink-0 items-center justify-center rounded-full ${on ? "bg-primary text-primary-foreground" : "bg-lime-400/10 text-primary"}`} aria-hidden>
                    <Icon className="size-4" strokeWidth={1.75} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{r.label}</span>
                    <span className="text-muted-foreground block truncate text-xs">{r.blurb}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      ))}
    </div>
  );
}
