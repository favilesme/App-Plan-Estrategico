import { getD1 } from "@/db";
import type { ValueReviewRecord } from "@/lib/value-review";

export const philosophyQuestions = [
  { key: "mission_who", group: "mission", question: "¿Quiénes somos?", why: "Identifica la razón de ser actual de la empresa." },
  { key: "mission_what", group: "mission", question: "¿Qué hacemos?", why: "Precisa los servicios, productos o soluciones que entrega." },
  { key: "mission_how", group: "mission", question: "¿Cómo lo hacemos?", why: "Describe capacidades y forma de trabajo que sostienen la misión." },
  { key: "mission_for_whom", group: "mission", question: "¿Para quién lo hacemos?", why: "Aclara a quién sirve la organización." },
  { key: "vision_aspiration", group: "vision", question: "¿Qué queremos o visionamos ser?", why: "Expresa el futuro deseado." },
  { key: "vision_future", group: "vision", question: "¿Cómo quiere ser la empresa en el futuro?", why: "Describe las capacidades y la forma de operar que se buscan." },
  { key: "vision_destination", group: "vision", question: "¿A dónde quiere llegar, en posicionamiento y resultados?", why: "Aclara el destino y los resultados que se esperan." },
  { key: "vision_internal", group: "vision", question: "¿Cómo quiere verse ante empleados y accionistas?", why: "Incluye la perspectiva de las personas y propietarios." },
  { key: "vision_external", group: "vision", question: "¿Cómo quiere que la vean clientes, sociedad y competidores?", why: "Aclara la posición que busca ante actores externos." },
  { key: "vision_when", group: "vision", question: "¿Cuándo quiere llegar?", why: "Define el horizonte de la visión." },
] as const;

export type PhilosophyQuestionKey = (typeof philosophyQuestions)[number]["key"];
export type PhilosophyAnswer = { id: string; question_key: string; answer: string; version: number; updated_by_user_id: string; updated_at: string };
export type PhilosophyStatement = { id: string; kind: "mission" | "vision"; statement: string; version: number; updated_by_user_id: string; updated_at: string };
export type ValueBehavior = { id: string; value_name: string; behavior: string; mission_link: string | null; vision_link: string | null; version: number; updated_by_user_id: string; updated_at: string };
export type DiagnosticInput = { id: string; area: string; classification: string; statement: string; source_type: string; source_detail: string; period: string; version: number; created_by_user_id: string; updated_by_user_id: string; updated_at: string };
export type ProjectProfile = { id: string; scope: string; calendar_notes: string; primary_sources: string; secondary_sources: string; updated_by_user_id: string; updated_at: string };

export async function getProjectProfile(cycleId: string) {
  return getD1().prepare("SELECT * FROM project_profiles WHERE cycle_id = ?").bind(cycleId).first<ProjectProfile>();
}
export async function getPhilosophyAnswers(cycleId: string) {
  const result = await getD1().prepare("SELECT id, question_key, answer, version, updated_by_user_id, updated_at FROM philosophy_answers WHERE cycle_id = ?")
    .bind(cycleId).all<PhilosophyAnswer>();
  return result.results ?? [];
}
export async function getPhilosophyStatements(cycleId: string) {
  const result = await getD1().prepare("SELECT id, kind, statement, version, updated_by_user_id, updated_at FROM philosophy_statements WHERE cycle_id = ?")
    .bind(cycleId).all<PhilosophyStatement>();
  return result.results ?? [];
}
export async function getValueBehaviors(cycleId: string) {
  const result = await getD1().prepare("SELECT id, value_name, behavior, mission_link, vision_link, version, updated_by_user_id, updated_at FROM value_behaviors WHERE cycle_id = ? ORDER BY updated_at, id")
    .bind(cycleId).all<ValueBehavior>();
  return result.results ?? [];
}
export async function getValueReviewRecords(cycleId: string) {
  const result = await getD1().prepare("SELECT id, gate_key, subject_id, status, rationale, reviewer_user_id, source_ids_json, created_at FROM approvals WHERE cycle_id = ? AND gate_key IN ('philosophy.value', 'philosophy.values') ORDER BY rowid DESC")
    .bind(cycleId).all<ValueReviewRecord>();
  return result.results ?? [];
}
export async function getDiagnosticInputs(cycleId: string) {
  const result = await getD1().prepare("SELECT id, area, classification, statement, source_type, source_detail, period, version, created_by_user_id, updated_by_user_id, updated_at FROM diagnostic_inputs WHERE cycle_id = ? ORDER BY updated_at DESC, id DESC")
    .bind(cycleId).all<DiagnosticInput>();
  return result.results ?? [];
}
export async function latestApproval(cycleId: string, gateKey: string, subjectId: string) {
  return getD1().prepare("SELECT status, rationale, reviewer_user_id, created_at FROM approvals WHERE cycle_id = ? AND gate_key = ? AND subject_id = ? ORDER BY rowid DESC LIMIT 1")
    .bind(cycleId, gateKey, subjectId).first<{ status: string; rationale: string; reviewer_user_id: string; created_at: string }>();
}
export async function isHighLevelMember(organizationId: string, memberId: string | null) {
  if (!memberId) return false;
  const member = await getD1().prepare("SELECT is_leader, is_director, status FROM members WHERE id = ? AND organization_id = ?")
    .bind(memberId, organizationId).first<{ is_leader: number; is_director: number; status: string }>();
  return member?.status === "active" && Boolean(member.is_leader || member.is_director);
}

export function statementSubject(item: PhilosophyStatement) { return `${item.id}:v${item.version}`; }
export function valuesSubject(items: ValueBehavior[], statements: PhilosophyStatement[]) {
  return [...items.map((item) => `${item.id}:v${item.version}`), ...statements.map((item) => `${item.id}:v${item.version}`)].sort().join("|");
}
export function diagnosticSubject(items: DiagnosticInput[]) { return items.map((item) => `${item.id}:v${item.version}`).sort().join("|"); }
