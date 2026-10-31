# Sprint 7 · Plan de ejecución y KPI

**Inicio:** 31 de octubre de 2026. **Fuente de alcance:** `TRASPASO_SPRINT_7_2026-10-31.md` y `../PLAN_SPRINTS_SITES_MULTIUSUARIO_2026-09-29.md`. Este documento registra la primera entrega de código; no certifica el cierre del sprint ni la aprobación de datos del cliente.

## Primera entrega local

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
5. `[FALTA]` Prueba de permisos con varios usuarios reales del Site, de despliegue y migración en D1 publicada. Las migraciones `0008_round_union_jack.sql` y `0009_tiny_shocker.sql` sólo se verificaron localmente y **no** se aplicaron al Site.

## Criterios para continuar

- Confirmar con el cliente áreas, moneda, importes y sustentos; completar las fichas sin inferir valores.
- Definir con Francisco y el equipo autorizado la puerta de revisión de planes, KPI, presupuesto y CMI; exigir que las tolerancias vigentes se aprueben antes de clasificar mediciones.
- Probar flujo multiusuario, concurrencia y migración en una base de prueba, y luego sincronizar código y Site con autorización explícita de publicación.
- Mantener Sprint 8 para mediciones trimestrales y revisión integral anual; Sprint 9 para informe ejecutivo.
