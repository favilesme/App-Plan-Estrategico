// MDEP piloto 1.1 de Anima Praxis. Estas ponderaciones son reglas de Francisco
// Avilés; las tres direcciones competitivas son categorías de Porter.
export const DIRECTIONS = ["costes", "diferenciacion", "enfoque"] as const;
export type Direction = typeof DIRECTIONS[number];
export type StrategicQuadrant = "FO" | "FA" | "DO" | "DA";
export const DIRECTION_LABELS: Record<Direction, string> = {
  costes: "Liderazgo en costes", diferenciacion: "Diferenciación", enfoque: "Enfoque",
};
export const CRITERIA: Record<Direction, readonly { key: string; label: string; why: string }[]> = {
  costes: [
    { key: "ventaja_economica", label: "Ventaja económica", why: "Coste unitario frente a rivales o alternativas." },
    { key: "sistema_eficiencia", label: "Sistema de eficiencia", why: "Actividades que explican el menor coste relativo." },
    { key: "relevancia_cliente", label: "Relevancia para el cliente", why: "Sensibilidad al precio y valor mínimo aceptable." },
    { key: "sostenibilidad", label: "Sostenibilidad", why: "Actividades o recursos difíciles de replicar." },
  ],
  diferenciacion: [
    { key: "valor_distintivo", label: "Valor distintivo", why: "Atributos relevantes frente a alternativas." },
    { key: "respuesta_cliente", label: "Respuesta del cliente", why: "Compra, preferencia, permanencia o disposición a pagar." },
    { key: "capacidad_entrega", label: "Capacidad de entrega", why: "Recursos y procesos para cumplir la promesa." },
    { key: "sostenibilidad", label: "Sostenibilidad", why: "Complementariedad o barreras a la imitación." },
  ],
  enfoque: [
    { key: "segmento_definido", label: "Segmento definido", why: "Criterios para incluir y excluir clientes." },
    { key: "necesidades_distintas", label: "Necesidades distintas", why: "Problemas que requieren una oferta adaptada." },
    { key: "atractivo_economico", label: "Atractivo económico", why: "Demanda, margen, tamaño o crecimiento accesible." },
    { key: "capacidad_especializada", label: "Capacidad especializada", why: "Mejor servicio al segmento frente a competidores amplios." },
  ],
};
export type MdepAction = { id: string; priority: number | null };
export type MdepAffinity = { action_id: string; direction: Direction; score: number | null };
export type MdepCriterion = { direction: Direction; criterion_key: string; score: number | null };
export type MdepCondition = { direction: Direction; status: "met" | "pending" | "unmet" };

export function affinityScore(actions: MdepAction[], affinities: MdepAffinity[], direction: Direction): number | null {
  if (!actions.length || actions.some((item) => !Number.isInteger(item.priority) || item.priority! < 1 || item.priority! > 5)) return null;
  const byAction = new Map(affinities.filter((item) => item.direction === direction).map((item) => [item.action_id, item.score]));
  if (actions.some((item) => !Number.isInteger(byAction.get(item.id)) || byAction.get(item.id)! < 0 || byAction.get(item.id)! > 3)) return null;
  const denominator = actions.reduce((sum, item) => sum + item.priority!, 0);
  return 100 * actions.reduce((sum, item) => sum + item.priority! * byAction.get(item.id)! / 3, 0) / denominator;
}

export function viabilityScore(criteria: MdepCriterion[], direction: Direction): number | null {
  const required = CRITERIA[direction].map((item) => item.key);
  const byKey = new Map(criteria.filter((item) => item.direction === direction).map((item) => [item.criterion_key, item.score]));
  if (required.some((key) => !Number.isInteger(byKey.get(key)) || byKey.get(key)! < 0 || byKey.get(key)! > 4)) return null;
  return 100 * required.reduce((sum, key) => sum + byKey.get(key)!, 0) / 16;
}

export function directionResult(actions: MdepAction[], affinities: MdepAffinity[], criteria: MdepCriterion[],
  conditions: MdepCondition[], direction: Direction) {
  const affinity = affinityScore(actions, affinities, direction);
  const viability = viabilityScore(criteria, direction);
  const condition = conditions.find((item) => item.direction === direction)?.status ?? "pending";
  const score = affinity === null || viability === null ? null : 0.6 * affinity + 0.4 * viability;
  return { direction, affinity, viability, score, condition,
    eligible: score !== null && condition === "met",
    status: condition === "unmet" ? "Descartada: condición incumplida" :
      condition === "pending" ? "Bloqueada: evidencia o condición pendiente" :
      score === null ? "Cálculo pendiente: [FALTA]" : "Elegible" };
}

export function mdepRecommendation(results: ReturnType<typeof directionResult>[]) {
  if (results.some((item) => item.score === null))
    return { direction: null as Direction | null, label: "Cálculo pendiente: faltan valoraciones para comparar las tres direcciones" };
  const highest = [...results].sort((a, b) => b.score! - a.score!)[0];
  if (highest && !highest.eligible)
    return { direction: null as Direction | null, label: "La dirección con mayor puntaje está bloqueada; verificar condición y deliberar" };
  const eligible = results.filter((item) => item.eligible).sort((a, b) => b.score! - a.score!);
  if (!eligible.length) return { direction: null as Direction | null, label: "Sin recomendación: condiciones o datos pendientes" };
  const best = eligible[0], second = eligible[1];
  if (best.score! >= 70 && second && best.score! - second.score! < 10)
    return { direction: null as Direction | null, label: "Direcciones cercanas: deliberar" };
  if (best.score! >= 70) return { direction: best.direction, label: "Dirección sugerida para validación" };
  if (best.score! >= 60) return { direction: best.direction, label: "Dirección potencial: fortalecer evidencia o capacidades" };
  return { direction: null as Direction | null, label: "Base insuficiente para recomendar esta dirección" };
}

export const displayScore = (score: number | null) => score === null ? "[FALTA]" : score.toFixed(1);
