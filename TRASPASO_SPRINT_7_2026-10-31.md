# Traspaso al Sprint 7 — Anima Praxis

**Corte:** 31 de octubre de 2026. **Aplicación:** piloto privado de planificación estratégica de Anima Praxis. **Caso de prueba:** Andifresh. Este documento es un punto de partida para otro chat; el estado mutable debe comprobarse de nuevo antes de modificarlo.

## 1. Estado verificado al cierre del Sprint 6

- **Site piloto:** <https://anima-praxis-sos-piloto-20260929.favilesme.chatgpt.site/>. Proyecto Sites `appgprj_6abc6d91fa28819199f0ffb91eaa5a00`, acceso `custom`, versión publicada **28**. La base de datos de la instancia usa el binding D1 `DB`.
- **Repositorio principal:** <https://github.com/favilesme/App-Plan-Estrategico>, rama `main`, commit `b1cfca6bf0b82f997ddb6198ecc8a2cc2722c704` al corte. La copia local del código principal está en esta carpeta. La copia local de fuente del Site está en `../10_SPRINT_6_SITE_SOURCE`, commit `34509051b1da40d506ef0768a2bdc5e3c119cfa6` al corte. No asumir que ambos repositorios o el Site seguirán en esos commits: comparar sus árboles y la versión publicada al iniciar.
- **Progreso del ciclo de prueba:** 9 de 14 módulos del tablero en estado `approved`, 100 % cada uno: organización, diagnóstico, análisis interno, análisis externo, FODA, formulación, dirección competitiva, objetivos e iniciativas. Los módulos Plan de ejecución, KPIs, Seguimiento, Revisión estratégica e Informe ejecutivo aún no tienen flujo funcional; sus rutas muestran «Etapa pendiente».
- **Sprint 6:** cinco objetivos estratégicos y seis iniciativas aprobados. Las cuatro perspectivas del Balanced Scorecard tienen al menos un objetivo. Cada iniciativa apunta a un objetivo aprobado, a una acción estratégica de origen y a un responsable activo. Los vínculos de versión, las referencias de evidencia y la autoría se comprobaron sobre los registros publicados.
- **Gobierno de las aprobaciones:** tanto objetivos como iniciativas registran tres participaciones válidas del Equipo de Alto Nivel, incluido el director; después, revisión favorable de Paco Aguilar como consultor y decisión final aprobatoria de Francisco Avilés como director. La página publicada muestra esos fundamentos y el tablero marca ambos módulos aprobados. Las decisiones humanas no provienen de una recomendación automática de IA.

## 2. Decisión estratégica que debe gobernar el Sprint 7

- Dirección elegida por el cliente: **Enfoque con diferenciación dentro del segmento**.
- Caso de prueba: consumidores de alimentos deportivos saludables de **35 a 65 años en Quito**, periodo **2027–2029**. La referencia de la decisión es crecimiento anual del **5 %** y mayor presencia en autoservicios y tiendas especializadas; no convertir esa referencia en metas desagregadas de KPI sin decisión y datos del cliente.
- La ejecución sigue condicionada a verificar **rentabilidad del segmento, aceptación de la oferta especializada y capacidad operativa**. Estas condiciones deben figurar en iniciativas, riesgos, hitos o criterios de decisión según corresponda; la aprobación de Sprint 6 no demuestra por sí sola que ya se verificaron.
- En la MDEP aprobada, Enfoque fue la única dirección elegible. Costes y diferenciación general conservaron puntuaciones, pero tenían condiciones obligatorias pendientes y no son alternativas aprobadas. La fuente externa declarada para la condición de Enfoque no fue verificada independientemente en este trabajo.

## 3. Alcance previsto del Sprint 7

El plan original `../PLAN_SPRINTS_SITES_MULTIUSUARIO_2026-09-29.md` define el **Sprint 7: Plan de ejecución y KPI**. Convertir los objetivos e iniciativas aprobados en proyectos o acciones con responsable, hitos, fechas, recursos y riesgos. Completar KPI por objetivo o iniciativa con fórmula, unidad, fuente, línea base, meta, frecuencia, responsable y tolerancias propias aprobadas. El presupuesto del año 1 se presenta por mes y los años 2 y 3 por año. El alcance contempla **cuatro CMI**: uno corporativo y tres de áreas que debe elegir cada cliente; las áreas de Andifresh están `[FALTA]` hasta que las indique el cliente.

**Criterios de salida del plan:** ninguna acción sin objetivo ni objetivo sin KPI; indicadores sin línea base, denominador o tolerancia válida marcados como pendientes o no calculables; permisos de asignación y actualización comprobados; granularidad del presupuesto y número de CMI verificados. No inventar metas, montos, fechas, denominadores ni bandas de semáforo. Cada KPI requiere sentido de interpretación y tolerancias propias aprobadas; no hay un porcentaje universal. Conservar datos aportados, cálculo, interpretación, hipótesis de IA y decisión humana como capas separadas.

El Sprint 6 registra una identificación inicial de KPI por objetivo, pero **su ficha operativa completa pertenece al Sprint 7**. El registro trimestral de avance y la revisión integral anual pertenecen al Sprint 8; el informe ejecutivo, al Sprint 9; la prueba de entrega reproducible a otros clientes, al Sprint 10.

## 4. Información y controles pendientes

1. `[FALTA]` Líneas base, metas específicas, fuentes y frecuencia de varios indicadores; validar cada valor con evidencia del cliente antes de calcular o clasificar.
2. `[FALTA]` Metas de cobertura, adopción comercial, aceptación de productos, entregas y costes que los objetivos o iniciativas dejan expresamente abiertas.
3. `[FALTA]` Verificación independiente de rentabilidad del segmento, aceptación de oferta, capacidad de planta y de la fuente externa indicada para la condición MDEP. Los documentos declarados en FODA y MDEP no equivalen a comprobación independiente.
4. `[FALTA]` Tres áreas para los CMI de área, responsables, calendario, recursos, presupuesto y tolerancias de cada KPI. Deben decidirlos y sustentarlos las personas autorizadas del cliente.
5. Observación de auditoría, sin bloqueo técnico de cierre: una participación del director en la revisión de **objetivos** menciona «iniciativas» en su fundamento. El registro está ligado técnicamente al conjunto de objetivos. No alterar ni reemplazar el texto de una decisión humana en silencio; si se busca mayor precisión, solicitar una aclaración o adenda humana.

## 5. Primeros pasos para el nuevo chat

1. Leer las instrucciones `AGENTS.md` aplicables y las reglas del proyecto. Verificar `main`, la fuente vinculada al Site, la versión publicada, el tablero y los registros D1 antes de editar. La documentación fechada de Sprints anteriores puede contener estados ya superados.
2. Inspeccionar el esquema, las relaciones y las puertas de revisión existentes para objetivos, iniciativas, aprobaciones, auditoría y progreso. Preservar las versiones aprobadas de Sprint 5 y 6; cualquier cambio de cliente debe pasar por el flujo de reapertura correspondiente.
3. Acordar el diseño mínimo del plan, KPI, presupuesto y CMI a partir del plan metodológico y de los datos reales disponibles. Registrar `[FALTA]` donde falte una decisión; no precargar cifras de Andifresh por inferencia.
4. Implementar de forma progresiva, validar entradas, permisos, cálculos, trazabilidad y estados pendientes con pruebas significativas. Sincronizar cambios relevantes con GitHub y comprobar la versión desplegada en el Site conforme a la autorización del nuevo encargo.

## 6. Fuentes locales principales

- `../PLAN_SPRINTS_SITES_MULTIUSUARIO_2026-09-29.md`: alcance y pruebas de salida de Sprints 7–10.
- `SPRINT_6_ALCANCE_Y_CONTROLES.md`: trazabilidad y límites de la primera entrega de objetivos e iniciativas. Su apartado de «decisiones pendientes» describe el **inicio** del Sprint 6 y quedó superado en cuanto a las aprobaciones humanas; no usarlo como estado actual.
- `SPRINT_5.md`, `SPRINT_4.md`, `SPRINT_3_ANALISIS_FODA_BASE.md` y `SPRINT_2_PERFIL_Y_DIAGNOSTICO.md`: reglas y antecedentes, con fechas propias.
- `lib/modules.ts` y `app/modulos/[slug]/page.tsx`: catálogo de módulos y pantalla pendiente actual.
- Base D1 del Site publicado: `module_progress`, `strategic_objectives`, `strategic_initiatives`, `approvals`, `audit_events`, `mdep_assessments`, `strategic_actions` y `members`. Consultar en modo lectura antes de diseñar las nuevas relaciones.
