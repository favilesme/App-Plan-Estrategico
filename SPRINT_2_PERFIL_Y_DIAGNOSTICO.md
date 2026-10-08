# Anima Praxis · Sprint 2 · Perfil empresarial y diagnóstico

**Estado:** Sprint 2 validado funcionalmente por el propietario en el Site publicado el 8 de octubre de 2026. El código y la migración también se probaron localmente con datos ficticios.

Francisco Avilés confirmó la comprobación con cuentas separadas: un líder realizó nuevas ediciones, el consultor registró observaciones y el observador pudo consultar sin editar. Esta constancia documenta su prueba de aceptación; no implica que se hayan copiado los datos del Site ni que Codex haya iniciado sesión en esas cuentas.

## Alcance implementado

| Etapa | Captura | Revisión y trazabilidad |
|---|---|---|
| Encuadre | Alcance, calendario, fuentes primarias y secundarias por ciclo | Edición por propietario o consultor; auditoría del valor anterior y actual |
| Misión | Cuatro preguntas de la metodología fuente, una por pantalla | Respuesta conjunta del Equipo de Alto Nivel; borrador del equipo; revisión fundamentada del consultor |
| Visión | Seis preguntas de la metodología fuente, una por pantalla | Mismo control de versión y revisión que misión |
| Valores | Valor y conducta observable, vinculados a misión, visión o ambas | Habilitados después de aprobar misión y visión; revisión del consultor |
| Diagnóstico | Antecedentes operativos, comerciales y financieros | Cada registro distingue dato aportado, supuesto o `[FALTA]`; fuente, periodo, autor, versión y revisión |

La interfaz muestra progreso de captura, sin convertirlo en puntuación metodológica. El diagnóstico no produce un índice general. Cada cambio de una respuesta o enunciado deja el valor anterior en `audit_events` e invalida la aprobación asociada por versión. La revisión de los resultados se registra en `approvals` con autor, fundamento, referencias y versión metodológica.

## Reglas y límites del piloto

- Solo un integrante activo del Equipo de Alto Nivel (líder de opinión o máximo director) puede guardar respuestas, borradores, valores y antecedentes del diagnóstico. Un observador no puede modificarlos. El propietario y el administrador únicamente aportan si también integran ese equipo.
- El consultor puede revisar los enunciados y valores de filosofía y el diagnóstico, con justificación. Esta puerta pertenece a estas etapas; no sustituye la excepción por dudas acordada para FODA ni la revisión obligatoria de prioridades y notas de la MDEP piloto.
- La clasificación `dato aportado` exige referencia concreta de una fuente. Identificarla no constituye verificación independiente. `supuesto` y `[FALTA]` permanecen visibles como tales.
- El progreso del diagnóstico requiere registrar los tres ámbitos y una revisión. Registrar `[FALTA]` cubre un ámbito para el seguimiento del trabajo, sin afirmar que el dato ya existe.
- Los borradores de misión y visión son redactados por el equipo; no se atribuyen a IA. La conexión IA, su credencial y coste por cliente permanecen sin activar.
- El material fuente se auditó en el análisis previo del proyecto. La copia actual del ZIP en OneDrive aparece sin bytes locales disponibles; se volverá a contrastar con la copia local anunciada por Francisco cuando esté accesible. Las preguntas implementadas proceden del inventario validado en ese análisis, no de una suposición nueva.

## Persistencia

La migración `drizzle/0001_careful_skaar.sql` añade `project_profiles`, `philosophy_answers`, `philosophy_statements`, `value_behaviors` y `diagnostic_inputs` a la D1 propia de esta instancia. No guarda datos estratégicos en el navegador ni los envía a GHL, Skool o una base SaaS central.

## QA realizada antes de publicar

| Prueba | Resultado |
|---|---|
| Migración `0001` sobre la base `0000` | Aplicó en SQLite y Wrangler D1 locales |
| TypeScript y compilación del Site | Correctas |
| Alta de organización y encuadre ficticios | Guardó y volvió a mostrar los datos |
| Primera respuesta de filosofía | Avanzó a la siguiente pregunta y pasó de 0/10 a 1/10 |
| Antecedente operativo ficticio | Guardó fuente, periodo, autor y versión; se mantuvo tras navegar |
| Acciones no autorizadas de otros roles | Revisadas en código servidor; la comprobación final con cuentas separadas fue confirmada por Francisco el 8 de octubre de 2026 |

## Verificación con usuarios reales en el Site

1. El propietario completa o edita el encuadre con datos de prueba.
2. Un líder responde una pregunta y otro líder comprueba que la respuesta compartida queda visible. El propietario que no sea director ni líder y el administrador que no sea líder no deben poder guardar respuestas.
3. El observador confirma que puede leer, pero no registrar ni editar.
4. El consultor visualizador confirma que puede acceder al Site y registrar una revisión fundamentada después de completar misión, visión y los tres ámbitos de diagnóstico; no puede cambiar los datos de origen como líder.
5. El equipo edita una respuesta o un antecedente aprobado y comprueba que la aprobación anterior deja de aplicar a la nueva versión.

La comprobación final descrita arriba cierra la validación funcional del Sprint 2. El detalle de las correcciones E-001 a E-005 permanece en `BITACORA_CORRECCIONES_001_RESULTADOS.md`.
