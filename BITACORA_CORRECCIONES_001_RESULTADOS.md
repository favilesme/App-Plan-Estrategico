# Bitácora de correcciones 001 — resultados

**Módulo:** Filosofía Empresarial (Sprint 2)  
**Fecha de validación local:** 2 de octubre de 2026  
**Datos de prueba:** organización y contenidos ficticios en D1 local. Ningún registro del Site publicado se modificó durante estas pruebas.

## Resultado por incidencia

| ID | Cambio | Archivos | Prueba y resultado |
| --- | --- | --- | --- |
| E-001 | La ruta separa 4 preguntas de Misión y 6 de Visión; cada borrador muestra únicamente las respuestas de su bloque. | `app/organizacion/filosofia/page.tsx` | Vista local: se mostraron los dos grupos, sus contadores 4/4 y 6/6, y referencias independientes. **Validada localmente.** |
| E-002 | El formulario de respuesta se recrea con la clave y versión de la pregunta. Se comprueba la versión antes de guardar para evitar sobrescribir una edición simultánea. | `app/organizacion/filosofia/page.tsx`, `app/sprint2-actions.ts` | Vista local: guardar una respuesta avanzó a un campo vacío de otra pregunta; selección directa recuperó su respuesta; la edición se guardó y al regresar se vio la última versión sin recarga manual. **Validada localmente.** |
| E-003 | Las etiquetas preguntan cómo el valor ayuda a **CUMPLIR** la misión y a **LOGRAR** la visión; ambos verbos tienen énfasis visual. | `app/organizacion/filosofia/page.tsx` | Vista local de propietario: texto exacto, campos separados y énfasis presentes. **Validada localmente.** |
| E-004 | La solicitud de cambios persiste su fundamento en `approvals` y lo muestra en el set al que corresponde. La empresa ve el estado, la observación, puede editar y reenviar la versión corregida. | `app/organizacion/filosofia/page.tsx`, `app/sprint2-actions.ts`, `lib/sprint2.ts`, `lib/value-review.ts` | Vista local: el consultor solicitó cambios en «Colaboración» con una observación; al entrar como propietario, la misma observación apareció sin acción adicional. La corrección dejó el set «Pendiente de nueva revisión» y mantuvo visible el comentario anterior. **Validada localmente.** |
| E-005 | Cada set tiene su propio sujeto de revisión: ID y versión del valor más las versiones vigentes de Misión y Visión. Una modificación cambia solo el estado de ese set. Se leen aprobaciones anteriores del conjunto sin reescribirlas. | `app/organizacion/filosofia/page.tsx`, `app/sprint2-actions.ts`, `lib/sprint2.ts`, `lib/value-review.ts`, `tests/value-review.test.mjs` | Vista local: «Integridad» fue aprobada y «Colaboración» recibió cambios; tras editar «Colaboración», «Integridad» siguió aprobada. Tres pruebas automáticas comprobaron independencia, compatibilidad con aprobaciones del conjunto y precedencia de una solicitud posterior. **Validada localmente.** |

## Datos y compatibilidad

- **Migraciones:** ninguna. Se reutilizan `philosophy_answers`, `philosophy_statements`, `value_behaviors`, `approvals` y `audit_events`.
- **Nueva clave de revisión:** `philosophy.value` en `approvals`; cada fila guarda estado, fundamento, autor, sujeto versionado y fuentes. Los registros anteriores con `philosophy.values` permanecen intactos y se interpretan para los sets sin cambios.
- **Aprobación general del módulo:** se alcanza cuando todos los sets vigentes y ambos enunciados están aprobados. Un set nuevo o corregido queda pendiente sin invalidar las revisiones de los demás.
- **Datos reales del cliente:** no se copiaron ni alteraron para probar. El cliente conserva sus datos en la instancia publicada.

## Comprobaciones técnicas

- `tsc --noEmit`: correcto.
- `pnpm lint`: correcto.
- `node --test tests/*.test.mjs`: 3 de 3 correctas.
- `pnpm build`: correcto.
- Navegación, guardado, revisión por consultor, lectura por propietario y reenvío: correctos en la instancia local ficticia.

## Validación restante

Tras desplegar, repetir E-002, E-004 y E-005 en el Site publicado con cuentas separadas de propietario/líder y consultor. La simulación local usa una identidad de prueba alternando roles; no equivale a una prueba real de sesión simultánea o correo de invitación. El observador conserva su acceso de solo lectura por el control existente, pero conviene comprobarlo otra vez en la regresión del Sprint 2.
