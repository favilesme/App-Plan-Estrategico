# Sprint 7 · Plan de ejecución y KPI

**Inicio:** 31 de octubre de 2026. **Fuente de alcance:** `TRASPASO_SPRINT_7_2026-10-31.md` y `../PLAN_SPRINTS_SITES_MULTIUSUARIO_2026-09-29.md`. Este documento registra la primera entrega publicada; no certifica el cierre del sprint ni la aprobación de datos del cliente.

## Primera entrega publicada

- Una ficha de ejecución en borrador por iniciativa aprobada, vinculada a la versión de la iniciativa y de su objetivo. Registra responsable activo, inicio, cierre, hitos fechados, recursos y riesgos. La pantalla señala campos pendientes.
- Una ficha KPI en borrador por objetivo aprobado, vinculada a la versión del objetivo. Conserva el nombre, unidad y propósito del objetivo; registra fórmula, denominador cuando corresponde, fuente, línea base, meta, frecuencia, responsable, sentido y tolerancia propia fundamentada.
- Presupuesto en borrador por plan con 12 períodos mensuales del año 1 y períodos anuales de los años 2 y 3. Cada entrada conserva importe, moneda y sustento; los períodos vacíos aparecen como pendientes.
- Un CMI corporativo que abarca todos los objetivos y hasta tres CMI de área con nombre elegido por el cliente y KPI asignados. No se precargan áreas.
- `pendiente` significa que faltan datos o criterios. `no_calculable` señala denominador obligatorio ausente. `lista_para_revision` significa que los campos están completos y coherentes en formato; **no** equivale a verificación de la fuente, aprobación humana ni medición.
- Sólo líderes activos con rol `owner`, `admin` o `leader` pueden guardar borradores. Cada escritura controla versión, organización, ciclo, origen aprobado, responsable activo y registra autor, fecha y valores anteriores en `audit_events`. Los objetivos, iniciativas y decisiones de Sprint 5–6 no se editan desde estas pantallas.

## Salida todavía pendiente

1. `[FALTA]` Datos del cliente: fechas, hitos, recursos, riesgos, fuentes, bases, metas, denominadores y tolerancias. El 5 % anual de la dirección competitiva es una referencia y no se precarga como meta KPI.
2. `[FALTA]` Moneda, importes y sustentos del presupuesto aportados por el cliente.
3. `[FALTA]` Tres áreas elegidas por el cliente y su composición KPI, para completar los cuatro CMI con el corporativo.
4. `[FALTA]` Regla de revisión y aprobación humana de las fichas del Sprint 7. Hasta definirla, ninguna ficha puede pasar a `approved` ni marcar los módulos al 100 %.
5. `[FALTA]` Prueba de permisos y concurrencia con varios usuarios reales del Site. Las migraciones se aplicaron al publicar; los flujos de escritura aún no tienen prueba funcional multiusuario.

## Criterios para continuar

- Confirmar con el cliente áreas, moneda, importes y sustentos; completar las fichas sin inferir valores.
- Definir con Francisco y el equipo autorizado la puerta de revisión de planes, KPI, presupuesto y CMI; exigir que las tolerancias vigentes se aprueben antes de clasificar mediciones.
- Probar flujo multiusuario y concurrencia antes de declarar el Sprint 7 completo.
- Mantener Sprint 8 para mediciones trimestrales y revisión integral anual; Sprint 9 para informe ejecutivo.

## Verificación de la primera publicación

El 31 de octubre de 2026 se publicó la versión 29 del Site con acceso `custom`, sin cambiar la audiencia. El despliegue terminó en `succeeded`; D1 mostró las cuatro tablas nuevas (`execution_plans`, `kpi_specs`, `budget_entries`, `area_scorecards`) y conservó nueve módulos aprobados, cinco objetivos y seis iniciativas. Las rutas publicadas `/modulos/ejecucion` y `/modulos/kpis` cargaron y mostraron sus coberturas pendientes. Ningún registro de cliente se precargó en las tablas nuevas.
