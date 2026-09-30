# Anima Praxis · Sprint 1 · Arquitectura y verificación

**Estado:** piloto técnico de arquitectura, navegación, identidad y persistencia. Los módulos metodológicos posteriores son rutas visibles y marcadas como pendientes; no calculan resultados ni reciben datos estratégicos todavía.

## Decisión de arquitectura

- **Instancia:** un Site privado por cliente, propiedad del cliente. No hay base SaaS central de Anima Praxis.
- **Identidad:** Sign in with ChatGPT inyecta el identificador estable de la persona en cada solicitud. El correo sirve para vincular una invitación interna con la identidad autenticada; después se verifica el identificador estable.
- **Dos permisos:** compartir el Site determina quién puede abrirlo; el rol interno determina qué operación puede ejecutar. Registrar a alguien en `members` no le comparte el Site. Un visualizador externo del Site puede tener el rol funcional de consultor dentro de la aplicación, sujeto a prueba con cuentas reales.
- **Datos:** D1 de la instancia para registros estructurados, versiones, aprobaciones y auditoría; R2 de la instancia para archivos de evidencia. La interfaz no guarda datos del cliente en `localStorage`.
- **Capas:** `app/` y `components/` son presentación; `lib/authz.ts` y `lib/workspace.ts` concentran acceso y consultas; `lib/methodology.ts` es configuración versionada; `db/schema.ts` y `drizzle/` contienen el contrato persistente.
- **IA:** no se llama a un modelo en este Sprint. La selección del proveedor, credencial y coste queda bajo control de cada cliente en su instancia antes de activar IA en fases posteriores.

## Entidades físicas de Sprint 1

| Tabla | Propósito | Relaciones principales |
|---|---|
| `organizations` | Organización propietaria del plan | Una por instancia mediante la operación de alta |
| `strategy_cycles` | Periodo y versión metodológica | Pertenece a organización |
| `members` | Equipo, rol, dirección y estado | Pertenece a organización; vinculación por identidad ChatGPT |
| `module_progress` | Estado, porcentaje, resumen y aprobación de etapa | Pertenece a ciclo; módulo único por ciclo |
| `approvals` | Puerta, decisión, revisor, fundamento y fuentes | Pertenece a ciclo y sujeto; preparada para flujos posteriores |
| `evidence_files` | Metadatos de archivo en R2 | Pertenece a organización y ciclo |
| `audit_events` | Registro de cambios con actor, evento y sujeto | Pertenece a organización y opcionalmente a ciclo |

Las tablas `approvals` y `evidence_files` están preparadas; sus interfaces de negocio aún no existen. No se ha atribuido validez metodológica a sus filas vacías.

## Modelo de dominio previsto para los sprints siguientes

Este es el contrato de relación, no una escala de valoración nueva. Se añadirán migraciones separadas cuando se implemente cada etapa y se verifiquen las reglas fuente.

| Entidad futura | Dependencia | Trazabilidad necesaria |
|---|---|---|
| Respuesta de diagnóstico | Ciclo, pregunta y autor | Evidencia, fecha, versión y estado de revisión |
| Factor FODA | Ciclo, cuadrante y autor | Al menos una evidencia cualitativa o cuantitativa; máximo 10 por eje de cruce |
| Valoración y cruce FODA | Factores aprobados | Votos, puntuaciones, fórmula y versión congelada |
| Interpretación | Resultado cuantitativo | Referencias a factores y cálculos; separación de dato e hipótesis |
| Alternativa MDEP/Porter | Interpretación y mercado objetivo | `Pᵢ`, afinidades, viabilidad, notas y revisión obligatoria del consultor |
| Decisión estratégica | Alternativas revisadas | Elección y justificación de dirección del cliente |
| Objetivo estratégico | Decisión vigente | Perspectiva BSC, versión y responsable; al menos uno por perspectiva |
| Iniciativa y acción | Objetivo vigente | Responsable, plazo, presupuesto y avance trimestral |
| KPI | Objetivo o iniciativa | Definición, línea base, meta y tolerancias por KPI |
| Revisión integral | Ciclo y mediciones | Hasta 12 meses entre revisiones, decisiones y correcciones |

El primer año del presupuesto se modelará por meses; los años segundo y tercero, anualmente. Habrá un CMI corporativo y tres CMI de áreas elegidas por el cliente. Las reglas numéricas de FODA no se trasladan ni reinterpretan en MDEP.

## Matriz de permisos de producto

| Operación | Propietario | Administrador delegado | Líder | Consultor visualizador | Observador |
|---|---|---|---|---|---|
| Ver plan de su instancia | Sí | Sí | Sí | Sí, si Site compartido | Sí |
| Crear organización y ciclo inicial | Sí | No | No | No | No |
| Designar administrador, líder u observador | Sí | Líder u observador | No | No | No |
| Designar consultor o máximo director | Sí | No | No | No | No |
| Registrar aportes de diagnóstico y FODA | Futuro | Futuro | Futuro | Revisión según etapa | No |
| Validar factores, puntajes y acciones FODA | Futuro, con quórum | Futuro, con quórum | Futuro, con quórum | Solo dudas documentadas | No |
| Revisar prioridades y notas MDEP | No sustituye al consultor | No sustituye al consultor | No sustituye al consultor | Obligatorio | No |
| Elegir dirección competitiva final | Dirección del cliente | Según mandato documentado | No | No | No |

Solo las tres primeras operaciones de gestión se implementan ahora. El resto de la matriz es la política de autorización que deberán aplicar los sprints correspondientes, sin simular aprobaciones inexistentes.

## Comprobaciones realizadas

| Comprobación | Resultado |
|---|---|
| Compilación TypeScript | Correcta |
| Alta de organización y ciclo con datos ficticios | Correcta en D1 local |
| Alta de un líder ficticio | Correcta en D1 local |
| Recarga de la vista de equipo | Los registros persisten |
| R2 local | Escritura, lectura, comparación y eliminación de un objeto ficticio correctas |
| Navegación | Dashboard y 14 rutas visibles; etapas 02–14 señalan claramente que están pendientes |
| Quórum | Se muestra el conteo y la condición de al menos tres líderes, incluido el director; votación aún pendiente |

## Límites y pruebas pendientes para el cierre del piloto multiusuario

1. La vista local solo ofrece una identidad simulada. **No se ha probado** una segunda cuenta ChatGPT como administrador o líder ni el acceso del consultor externo como visualizador del Site.
2. No se ha demostrado todavía el rechazo efectivo entre cuentas o entre dos Sites de clientes distintos. Cada instancia usa almacenamiento propio por diseño, pero falta un ensayo con dos instancias y cuentas reales.
3. La recuperación de una versión aprobada no tiene interfaz ni flujo de prueba en Sprint 1. Se conserva un número de versión del ciclo y el registro de auditoría, pero eso no equivale a recuperación funcional.
4. Las aprobaciones de factores FODA y la revisión MDEP no se pueden ensayar sin sus módulos. Su puerta y trazabilidad están modeladas; la ejecución se comprobará en los sprints 3–5.
5. No se ha activado IA. Su credencial y consumo se verificarán con el cliente en un ensayo posterior, antes de procesar información real.
6. La publicación privada se verificará por separado. No ingresar datos empresariales reales hasta cerrar las pruebas de acceso con el propietario del Site.

## Decisiones metodológicas preservadas

- FODA: cada factor requiere evidencia; máximo diez factores por eje de cruce; la validación ordinaria requiere tres líderes activos, incluido el máximo director. Las dudas documentadas se elevan al consultor.
- MDEP piloto 1.1: conserva la revisión obligatoria del consultor para prioridades `Pᵢ`, afinidades, notas y viabilidad; la decisión estratégica final corresponde al cliente.
- Seguimiento: tolerancias configurables por KPI; revisión trimestral de acciones y revisión estratégica integral al menos una vez cada doce meses.
- Zonas de vulnerabilidad: presentación **Muy críticas → Críticas → Alerta → Preparado**, sin cambiar fórmulas ni clasificación.
