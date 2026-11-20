import type { GuestRole, MemberRole } from "@/lib/auth/permissions";

export interface Workspace {
  id: string;
  name: string;
  owner_id: string;
  plan: string;
}

export interface Membership {
  workspace: Workspace;
  role: MemberRole;
}

export interface Profile {
  user_id: string;
  display_name: string;
  email: string | null;
  nexconn_user_id: string;
}

export interface Project {
  id: string;
  created_at: string;
  workspace_id: string;
  client_name: string;
  approver_id: string | null;
  rounds_included: number;
  client_channel_id: string | null;
  internal_channel_id: string | null;
  archived: boolean;
}

export interface ProjectGuest {
  user_id: string;
  role: GuestRole;
  display_name: string;
  joined_at: string;
}

export interface Invite {
  id: string;
  created_at: string;
  project_id: string;
  email_or_phone: string;
  display_name: string | null;
  role: GuestRole;
  expires_at: string;
  revoked_at: string | null;
  used_at: string | null;
}
