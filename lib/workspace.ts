import { getD1 } from "@/db";

export type Organization = { id: string; name: string; sector: string | null; created_at: string };
export type StrategyCycle = { id: string; organization_id: string; name: string; start_date: string; end_date: string; methodology_version: string; status: string; version: number };
export type Member = { id: string; email: string; display_name: string; role: string; is_leader: number; is_director: number; status: string; auth_user_id: string | null };
export type ModuleProgress = { module_slug: string; status: string; percent: number; summary: string | null };

export async function getOrganization(): Promise<Organization | null> {
  return getD1().prepare("SELECT id, name, sector, created_at FROM organizations ORDER BY created_at LIMIT 1").first<Organization>();
}

export async function getCurrentCycle(organizationId: string): Promise<StrategyCycle | null> {
  return getD1().prepare("SELECT id, organization_id, name, start_date, end_date, methodology_version, status, version FROM strategy_cycles WHERE organization_id = ? ORDER BY created_at DESC LIMIT 1")
    .bind(organizationId).first<StrategyCycle>();
}

export async function getMembers(organizationId: string): Promise<Member[]> {
  const result = await getD1().prepare("SELECT id, email, display_name, role, is_leader, is_director, status, auth_user_id FROM members WHERE organization_id = ? ORDER BY is_director DESC, is_leader DESC, display_name")
    .bind(organizationId).all<Member>();
  return result.results ?? [];
}

export async function getModuleProgress(cycleId: string): Promise<ModuleProgress[]> {
  const result = await getD1().prepare("SELECT module_slug, status, percent, summary FROM module_progress WHERE cycle_id = ?")
    .bind(cycleId).all<ModuleProgress>();
  return result.results ?? [];
}
