"use client";

import { useState, type FormEvent } from "react";
import { saveObjective } from "@/app/sprint6-actions";
import { OBJECTIVE_VALIDATION_MESSAGES, PERSPECTIVES, parseIds, validateObjectiveDraft,
  type ObjectiveValidationCode } from "@/lib/sprint6-policy.mts";
import type { StrategicObjective } from "@/lib/sprint6";
import type { StrategicAction } from "@/lib/sprint5";

const input = "mt-1 w-full rounded-lg border border-[#C9C5BF] bg-white px-3 py-2 text-sm text-[#192538]";
const button = "rounded-lg bg-[#192538] px-4 py-2 text-sm font-semibold text-white hover:bg-[#344052]";
const perspectiveLabels = {
  financiera: "Financiera", cliente: "Cliente", procesos: "Procesos internos", aprendizaje: "Aprendizaje y crecimiento",
};

export function ObjectiveForm({ item, actions }: { item?: StrategicObjective; actions: StrategicAction[] }) {
  const [issues, setIssues] = useState<ObjectiveValidationCode[]>([]);
  const selected = new Set(item ? parseIds(item.source_action_ids_json) : []);

  function checkBeforeSave(event: FormEvent<HTMLFormElement>) {
    const data = new FormData(event.currentTarget);
    const field = (name: string) => String(data.get(name) ?? "");
    const nextIssues = validateObjectiveDraft({
      perspective: field("perspective"), statement: field("statement"),
      desiredResult: field("desired_result"), strategyLink: field("strategy_link"),
      sourceActionIds: data.getAll("source_action_id").map(String), evidenceNote: field("evidence_note"),
      kpiName: field("kpi_name"), kpiUnit: field("kpi_unit"), kpiDefinition: field("kpi_definition"),
    }, actions.map((action) => action.id));
    setIssues(nextIssues);
    if (nextIssues.length) event.preventDefault();
  }

  return <form action={saveObjective} onSubmit={checkBeforeSave} noValidate className="mt-4 space-y-3">
    <input type="hidden" name="id" value={item?.id ?? ""}/><input type="hidden" name="version" value={item?.version ?? 0}/>
    {issues.length > 0 && <div role="alert" className="rounded-lg bg-[#FBF0EA] p-3 text-sm text-[#7E3527]">
      <p className="font-semibold">Revisa estos campos; el borrador sigue en el formulario:</p>
      <ul className="mt-1 list-disc pl-5">{issues.map((code) => <li key={code}>{OBJECTIVE_VALIDATION_MESSAGES[code]}</li>)}</ul>
    </div>}
    <label className="block text-sm font-medium">Perspectiva BSC<select name="perspective" defaultValue={item?.perspective ?? ""} className={input} required>
      <option value="">Seleccionar perspectiva</option>{PERSPECTIVES.map((key) => <option key={key} value={key}>{perspectiveLabels[key]}</option>)}
    </select></label>
    <label className="block text-sm font-medium">Objetivo estratégico<input name="statement" defaultValue={item?.statement ?? ""} className={input} minLength={15} maxLength={300} required placeholder="Resultado estratégico concreto para el segmento aprobado"/></label>
    <label className="block text-sm font-medium">Resultado esperado<textarea name="desired_result" defaultValue={item?.desired_result ?? ""} className={input} minLength={15} maxLength={800} required/></label>
    <label className="block text-sm font-medium">Cómo contribuye a la dirección aprobada<textarea name="strategy_link" defaultValue={item?.strategy_link ?? ""} className={input} minLength={20} maxLength={1000} required/></label>
    <fieldset className="rounded-lg border border-[#E6DFD6] p-3"><legend className="px-1 text-sm font-semibold">Acciones aprobadas que sustentan el objetivo</legend>
      <div className="mt-2 space-y-2">{actions.map((action) => <label key={action.id} className="flex gap-2 text-sm"><input type="checkbox" name="source_action_id" value={action.id} defaultChecked={selected.has(action.id)}/><span>{action.quadrant} · {action.statement}</span></label>)}</div>
      <p className="mt-2 text-xs text-[#5A626F]">Selecciona al menos una. Se conservan sus referencias de evidencia y versión.</p>
    </fieldset>
    <label className="block text-sm font-medium">Fundamento de evidencia y límites<textarea name="evidence_note" defaultValue={item?.evidence_note ?? ""} className={input} minLength={15} maxLength={1000} required placeholder="Qué respalda este objetivo y qué falta validar"/></label>
    <div className="grid gap-3 sm:grid-cols-2"><label className="block text-sm font-medium">KPI propio · nombre<input name="kpi_name" defaultValue={item?.kpi_name ?? ""} className={input} minLength={3} maxLength={150} required/></label>
      <label className="block text-sm font-medium">Unidad<input name="kpi_unit" defaultValue={item?.kpi_unit ?? ""} className={input} minLength={1} maxLength={80} required placeholder="%, USD, clientes, días…"/></label></div>
    <label className="block text-sm font-medium">Qué medirá el KPI<textarea name="kpi_definition" defaultValue={item?.kpi_definition ?? ""} className={input} minLength={10} maxLength={500} required/></label>
    <p className="text-xs text-[#5A626F]">Fórmula, línea base, fuente de datos y metas se validarán en la fase de ejecución/KPIs. Ningún valor faltante se interpreta como cero.</p>
    <button className={button}>{item ? "Guardar nueva versión del objetivo" : "Guardar objetivo en borrador"}</button>
  </form>;
}
