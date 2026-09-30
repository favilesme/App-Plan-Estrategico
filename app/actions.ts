"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getD1 } from "@/db";
import { canAssignRole, canManageTeam, getActor, type AppRole } from "@/lib/authz";
import { MAX_HIGH_LEVEL_LEADERS, METHODOLOGY_VERSION } from "@/lib/methodology";

function value(form: FormData, key: string): string {
  return String(form.get(key) ?? "").trim();
}

function normalizedEmail(email: string): string {
  return email.trim().toLowerCase();
}

function validEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

function validDate(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(date));
}

export async function createOrganization(form: FormData) {
  const actor = await getActor();
  if (!actor || actor.role !== "owner") redirect("/organizacion?error=permission");
  const name = value(form, "name");
  const sector = value(form, "sector");
  const cycleName = value(form, "cycle_name");
  const startDate = value(form, "start_date");
  const endDate = value(form, "end_date");
  const ownerIsDirector = form.get("owner_is_director") === "on";
  if (name.length < 2 || name.length > 120 || sector.length > 120 || cycleName.length < 2 || cycleName.length > 100 || !validDate(startDate) || !validDate(endDate) || endDate < startDate) {
    redirect("/organizacion?error=invalid");
  }
  const db = getD1();
  const existing = await db.prepare("SELECT id FROM organizations LIMIT 1").first();
  if (existing) redirect("/organizacion?error=exists");

  const organizationId = crypto.randomUUID();
  const cycleId = crypto.randomUUID();
  const ownerMemberId = crypto.randomUUID();
  await db.batch([
    db.prepare("INSERT INTO organizations (id, name, sector, created_by_user_id) VALUES (?, ?, ?, ?)")
      .bind(organizationId, name, sector || null, actor.user.userId),
    db.prepare("INSERT INTO strategy_cycles (id, organization_id, name, start_date, end_date, methodology_version) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(cycleId, organizationId, cycleName, startDate, endDate, METHODOLOGY_VERSION),
    db.prepare("INSERT INTO members (id, organization_id, auth_user_id, email, display_name, role, is_leader, is_director) VALUES (?, ?, ?, ?, ?, 'owner', ?, ?)")
      .bind(ownerMemberId, organizationId, actor.user.userId, normalizedEmail(actor.user.email), actor.user.displayName, ownerIsDirector ? 1 : 0, ownerIsDirector ? 1 : 0),
    db.prepare("INSERT INTO module_progress (id, cycle_id, module_slug, status, percent, summary, updated_by_user_id) VALUES (?, ?, 'organizacion', 'in_progress', 0, ?, ?)")
      .bind(crypto.randomUUID(), cycleId, "Organización y ciclo registrados; perfil estratégico pendiente.", actor.user.userId),
    db.prepare("INSERT INTO audit_events (id, organization_id, cycle_id, actor_user_id, actor_email, event_type, subject_type, subject_id, payload_json) VALUES (?, ?, ?, ?, ?, 'organization.created', 'organization', ?, ?)")
      .bind(crypto.randomUUID(), organizationId, cycleId, actor.user.userId, normalizedEmail(actor.user.email), organizationId, JSON.stringify({ cycleId, methodologyVersion: METHODOLOGY_VERSION })),
  ]);
  revalidatePath("/");
  revalidatePath("/organizacion");
  revalidatePath("/equipo");
  redirect("/organizacion?created=1");
}

export async function saveMember(form: FormData) {
  const actor = await getActor();
  if (!actor || !canManageTeam(actor.role) || !actor.organizationId) redirect("/equipo?error=permission");
  const organizationId = actor.organizationId;
  const db = getD1();
  const memberId = value(form, "member_id");
  const email = normalizedEmail(value(form, "email"));
  const displayName = value(form, "display_name");
  const requestedRole = value(form, "role") as AppRole;
  // External consultants and observers cannot count toward the client's
  // high-level-team quorum even if a stale form submits is_leader=on.
  const isLeader = requestedRole === "leader" || (requestedRole === "admin" && form.get("is_leader") === "on");
  const isDirector = form.get("is_director") === "on";
  const status = value(form, "status") === "inactive" ? "inactive" : "active";
  if (!validEmail(email) || displayName.length < 2 || displayName.length > 100 || !canAssignRole(actor.role, requestedRole) || (isDirector && (!isLeader || actor.role !== "owner"))) {
    redirect("/equipo?error=invalid");
  }

  const existing = memberId
    ? await db.prepare("SELECT id, email, role, is_leader, is_director FROM members WHERE id = ? AND organization_id = ?")
        .bind(memberId, organizationId).first<{ id: string; email: string; role: string; is_leader: number; is_director: number }>()
    : null;
  if (memberId && !existing) redirect("/equipo?error=missing");
  if (existing?.role === "owner" || (actor.role === "admin" && (existing?.role === "admin" || existing?.role === "consultant" || existing?.is_director))) {
    redirect("/equipo?error=permission");
  }
  const sameEmail = await db.prepare("SELECT id FROM members WHERE organization_id = ? AND email = ? AND id != ?")
    .bind(organizationId, email, memberId || "").first();
  if (sameEmail) redirect("/equipo?error=duplicate");
  const leaderCount = await db.prepare("SELECT COUNT(*) AS total FROM members WHERE organization_id = ? AND is_leader = 1 AND role IN ('owner', 'admin', 'leader') AND status = 'active' AND id != ?")
    .bind(organizationId, memberId || "").first<{ total: number }>();
  if (isLeader && status === "active" && (leaderCount?.total ?? 0) >= MAX_HIGH_LEVEL_LEADERS) redirect("/equipo?error=limit");
  if (isDirector && status === "active") {
    const otherDirector = await db.prepare("SELECT id FROM members WHERE organization_id = ? AND is_director = 1 AND status = 'active' AND id != ?")
      .bind(organizationId, memberId || "").first();
    if (otherDirector) redirect("/equipo?error=director");
  }
  const id = memberId || crypto.randomUUID();
  if (existing) {
    await db.batch([
      db.prepare("UPDATE members SET email = ?, display_name = ?, role = ?, is_leader = ?, is_director = ?, status = ?, auth_user_id = CASE WHEN email = ? THEN auth_user_id ELSE NULL END, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND organization_id = ?")
        .bind(email, displayName, requestedRole, isLeader ? 1 : 0, isDirector ? 1 : 0, status, email, id, organizationId),
      db.prepare("INSERT INTO audit_events (id, organization_id, actor_user_id, actor_email, event_type, subject_type, subject_id, payload_json) VALUES (?, ?, ?, ?, 'member.updated', 'member', ?, ?)")
        .bind(crypto.randomUUID(), organizationId, actor.user.userId, normalizedEmail(actor.user.email), id, JSON.stringify({ role: requestedRole, isLeader, isDirector, status })),
    ]);
  } else {
    await db.batch([
      db.prepare("INSERT INTO members (id, organization_id, email, display_name, role, is_leader, is_director, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(id, organizationId, email, displayName, requestedRole, isLeader ? 1 : 0, isDirector ? 1 : 0, status),
      db.prepare("INSERT INTO audit_events (id, organization_id, actor_user_id, actor_email, event_type, subject_type, subject_id, payload_json) VALUES (?, ?, ?, ?, 'member.added', 'member', ?, ?)")
        .bind(crypto.randomUUID(), organizationId, actor.user.userId, normalizedEmail(actor.user.email), id, JSON.stringify({ role: requestedRole, isLeader, isDirector, status })),
    ]);
  }
  revalidatePath("/equipo");
  redirect("/equipo?saved=1");
}
