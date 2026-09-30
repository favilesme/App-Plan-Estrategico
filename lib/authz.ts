import { env } from "cloudflare:workers";
import { getChatGPTUser, type ChatGPTUser } from "@/app/chatgpt-auth";
import { getD1 } from "@/db";

export type AppRole = "owner" | "admin" | "leader" | "consultant" | "observer";
export type Actor = {
  user: ChatGPTUser;
  role: AppRole | "none" | "unconfigured";
  organizationId: string | null;
  memberId: string | null;
};

type MemberMatch = { id: string; auth_user_id: string | null; role: AppRole; status: string };

export function isOwnerEmail(email: string): boolean {
  const configured = env.SITE_OWNER_EMAIL?.trim().toLowerCase();
  return Boolean(configured && email.trim().toLowerCase() === configured);
}

export async function getActor(): Promise<Actor | null> {
  const user = await getChatGPTUser();
  if (!user) return null;
  if (!env.SITE_OWNER_EMAIL?.trim()) return { user, role: "unconfigured", organizationId: null, memberId: null };

  const db = getD1();
  const organization = await db.prepare("SELECT id FROM organizations ORDER BY created_at LIMIT 1").first<{ id: string }>();
  if (!organization) return {
    user,
    role: isOwnerEmail(user.email) ? "owner" : "none",
    organizationId: null,
    memberId: null,
  };

  if (isOwnerEmail(user.email)) {
    const owner = await db.prepare("SELECT id FROM members WHERE organization_id = ? AND email = ? LIMIT 1")
      .bind(organization.id, user.email.trim().toLowerCase()).first<{ id: string }>();
    return { user, role: "owner", organizationId: organization.id, memberId: owner?.id ?? null };
  }

  const member = await db.prepare(
    "SELECT id, auth_user_id, role, status FROM members WHERE organization_id = ? AND (auth_user_id = ? OR email = ?) LIMIT 1"
  ).bind(organization.id, user.userId, user.email.trim().toLowerCase()).first<MemberMatch>();
  if (!member || member.status !== "active" || (member.auth_user_id && member.auth_user_id !== user.userId)) {
    return { user, role: "none", organizationId: organization.id, memberId: null };
  }
  if (!member.auth_user_id) {
    await db.prepare("UPDATE members SET auth_user_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND auth_user_id IS NULL")
      .bind(user.userId, member.id).run();
  }
  const role = ["admin", "leader", "consultant", "observer"].includes(member.role) ? member.role : "none";
  return { user, role, organizationId: organization.id, memberId: member.id };
}

export function canRead(role: Actor["role"]): boolean {
  return role === "owner" || role === "admin" || role === "leader" || role === "consultant" || role === "observer";
}

export function canManageTeam(role: Actor["role"]): role is "owner" | "admin" {
  return role === "owner" || role === "admin";
}

export function canAssignRole(actorRole: Actor["role"], targetRole: AppRole): boolean {
  if (actorRole === "owner") return targetRole !== "owner";
  return actorRole === "admin" && (targetRole === "leader" || targetRole === "observer");
}
