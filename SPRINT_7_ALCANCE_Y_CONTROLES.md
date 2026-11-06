# Sprint 7 · Plan de ejecución y KPI

**Inicio:** 31 de octubre de 2026. **Fuente de alcance:** `TRASPASO_SPRINT_7_2026-10-31.md` y `../PLAN_SPRINTS_SITES_MULTIUSUARIO_2026-09-29.md`. Este documento registra la primera entrega publicada; no certifica el cierre del sprint ni la aprobación de datos del cliente.

## Actualización del piloto comercial · 5 de noviembre de 2026

Francisco decidió conservar los datos sintéticos como **conjunto definitivo de demostración comercial**. La aprobación del Sprint 7 se limita a la coherencia de ese conjunto y no equivale a evidencia o compromiso de un cliente real. En D1 hay seis planes, cinco fichas KPI, 84 entradas de presupuesto y tres CMI de área todavía en `draft`. Los 18 meses de presupuesto anteriores al inicio de los planes se corrigieron a cero con origen ficticio visible. Los demás datos no se sustituirán en este piloto.

El código incorpora una puerta de revisión para la versión exacta del conjunto: tres participaciones de líderes activos, incluido el director; revisión del consultor; decisión final del director. Cada paso exige fundamento, registra identidad y auditoría, y las modificaciones invalidan participaciones previas. La aprobación final cambia las fichas a `approved` y los módulos Ejecución y KPI a 100 %, únicamente para demostración. **Al corte de esta actualización, la publicación y las decisiones humanas siguen pendientes.**

## Primera entrega publicada

- Una ficha de ejecución en borrador por iniciativa aprobada, vinculada a la versión de la iniciativa y de su objetivo. Registra responsable activo, inicio, cierre, hitos fechados, recursos y riesgos. La pantalla señala campos pendientes.
- Una ficha KPI en borrador por objetivo aprobado, vinculada a la versión del objetivo. Conserva el nombre, unidad y propósito del objetivo; registra fórmula, denominador cuando corresponde, fuente, línea base, meta, frecuencia, responsable, sentido y tolerancia propia fundamentada.
- Presupuesto en borrador por plan con 12 períodos mensuales del año 1 y períodos anuales de los años 2 y 3. Cada entrada conserva importe, moneda y sustento; los períodos vacíos aparecen como pendientes.
- Un CMI corporativo que abarca todos los objetivos y hasta tres CMI de área con nombre elegido por el cliente y KPI asignados. No se precargan áreas.
- `pendiente` significa que faltan datos o criterios. `no_calculable` señala denominador obligatorio ausente. `lista_para_revision` significa que los campos están completos y coherentes en formato; **no** equivale a verificación de la fuente, aprobación humana ni medición.
- Sólo líderes activos con rol `owner`, `admin` o `leader` pueden guardar borradores. Cada escritura controla versión, organización, ciclo, origen aprobado, responsable activo y registra autor, fecha y valores anteriores en `audit_events`. Los objetivos, iniciativas y decisiones de Sprint 5–6 no se editan desde estas pantallas.

## Pendientes de la primera entrega publicada, antes de la decisión de usar datos ficticios definitivos

1. Los datos de cliente, la moneda, los importes y tres áreas de cliente quedaron fuera del alcance del piloto comercial por decisión posterior. Se usan datos ficticios etiquetados; el 5 % anual de la dirección competitiva no se precargó como meta KPI.
2. La regla de revisión humana ya está implementada en el código, pero sigue pendiente de publicación y prueba funcional con los perfiles del Site.
3. `[FALTA]` Tres participaciones humanas, revisión del consultor y decisión del director para las versiones vigentes del conjunto.
4. `[FALTA]` Prueba de permisos y concurrencia con varios usuarios reales del Site.

## Criterios para continuar

- Publicar y comprobar la puerta de revisión sobre los datos ficticios definitivos; no registrar decisiones en nombre de otras personas.
- Exigir la aprobación de las tolerancias de demostración antes de mostrar el conjunto como aprobado. Las mediciones reales quedan fuera de este piloto.
- Probar flujo multiusuario y concurrencia antes de declarar el Sprint 7 completo.
- Mantener Sprint 8 para mediciones trimestrales y revisión integral anual; Sprint 9 para informe ejecutivo.

## Verificación de la primera publicación

El 31 de octubre de 2026 se publicó la versión 29 del Site con acceso `custom`, sin cambiar la audiencia. El despliegue terminó en `succeeded`; D1 mostró las cuatro tablas nuevas (`execution_plans`, `kpi_specs`, `budget_entries`, `area_scorecards`) y conservó nueve módulos aprobados, cinco objetivos y seis iniciativas. Las rutas publicadas `/modulos/ejecucion` y `/modulos/kpis` cargaron y mostraron sus coberturas pendientes. Ningún registro de cliente se precargó en las tablas nuevas.
