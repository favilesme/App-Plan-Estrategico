# Sprint 5 · Formulación y dirección competitiva

Fuente metodológica: `Metodologia_Direccion_Estrategica_Porter_MDEP.md`, piloto 1.1, más las reglas aprobadas del Equipo de Alto Nivel. La MDEP añade una capa sobre la matriz FODA aprobada: **no cambia** factores, escala FO/DA 0–1–3–9, promedios, P1/P2 ni el análisis cualitativo FA/DO.

## Flujo

1. La matriz FODA cuantitativa aprobada es la fuente congelada.
2. El equipo delimita unidad de negocio, oferta, clientes y mercado.
3. Registra acciones FO, FA, DO o DA con factores de ambos ejes, evidencia, efecto esperado y prioridad de acción Pᵢ entre 1 y 5. La prioridad se justifica con la rúbrica piloto y no se infiere del número de factores.
4. Al menos tres miembros del Equipo de Alto Nivel, incluido el máximo director, validan la lista. El consultor revisa vínculos, fuentes y prioridades. Dirección cierra la lista.
5. Para cada acción, el equipo asigna afinidad 0–3 a costes, diferenciación y enfoque. Se registra evidencia y fundamento.
   La IA puede generar un borrador para las tres afinidades de una acción. Se guarda aparte de la valoración final del equipo.
6. Para cada dirección, se registran cuatro criterios de viabilidad 0–4 con fuente y fundamento, la condición obligatoria y el contexto competitivo disponible. `[FALTA]` mantiene el cálculo pendiente.
   Cada alternativa conserva una ficha de ventajas, riesgos, capacidades, implicaciones y coherencia, junto con sus acciones y factores vinculados.
7. La app calcula `Afinidad = 100 × Σ(Pᵢ × Aᵢ,d / 3) / ΣPᵢ`, `Viabilidad = 100 × Σ criterio / 16` y `MDEP = 0,60 × Afinidad + 0,40 × Viabilidad`. Se calculan con precisión completa y se muestran con un decimal. Las tres afinidades no suman necesariamente 100.
8. Solo las direcciones con datos completos y condición cumplida son elegibles. Umbrales piloto: ≥70 y ventaja ≥10: sugerida; ≥70 y diferencia <10: deliberar; 60–<70: potencial; <60: base insuficiente. No se presenta como probabilidad de éxito.
9. Si Dirección elige enfoque, registra segmento, actividades y exclusiones y compara de nuevo los criterios relevantes de costes y diferenciación **con datos del segmento**. No se reutilizan las notas generales.
10. El equipo registra su deliberación, el consultor revisa evidencias y condiciones y Dirección elige y justifica la decisión. Todas las ediciones y aprobaciones conservan actor, fecha, revisión y fuentes en `audit_events`.

## Separación de capas

- **Datos del cliente:** alcance, acciones, vínculos, fuentes, notas profesionales y decisión.
- **Cálculos metodológicos:** fórmulas deterministas de la MDEP en `lib/mdep.ts`.
- **Interpretación:** lectura de umbrales y bloqueos; es orientación experimental, no certeza.
- **Hipótesis de la app:** dirección sugerida para deliberación.
- **Decisión del cliente:** voto del equipo y cierre documentado de Dirección.

## Validación

`node --experimental-strip-types --test tests/mdep.test.mjs` comprueba denominador, faltantes, 60/40, bloqueo y empate. Además: TypeScript, build, migración D1 local, permisos en Site publicado y flujo con cuentas separadas. El cierre funcional del sprint requiere esa última prueba por el cliente.
