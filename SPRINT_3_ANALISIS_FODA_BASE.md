# Anima Praxis · Sprint 3 · Análisis estratégico y FODA base

**Estado:** implementación local verificada y Site publicado. La vista de análisis interno y la puerta de FODA base se comprobaron en el Site con la cuenta propietaria, sin crear datos de producción. Las pruebas de escritura y roles con cuentas separadas siguen pendientes. Este sprint prepara factores y evidencias. No calcula todavía las matrices FO/DA ni prioridades.

## Alcance

| Módulo | Resultado y control |
|---|---|
| Análisis interno | Fortalezas y debilidades, con descripción, área, razón de clasificación y evidencia. |
| Análisis externo | Oportunidades y amenazas, con los mismos campos y distinción entre factores internos y externos. |
| FODA base | Revisión de cuatro categorías, evidencia mínima, posibles duplicados exactos normalizados y límite de diez factores activos por categoría. |
| Validación | Participación de al menos tres líderes activos, incluido el máximo director; solicitud de cambios bloquea el cierre. |
| Dudas | Revisión excepcional del consultor si una duda vigente llega con quórum. La revisión previa del diagnóstico sigue siendo obligatoria. |
| Cierre | La dirección congela la lista y conserva una instantánea de factores, evidencias, validaciones y revisión aplicable. Solo la dirección puede reabrir una nueva versión con motivo. |

La regla de **al menos un factor activo en cada categoría** es una condición técnica de cierre: evita pasar un eje vacío a las matrices FO/DA del siguiente sprint. No introduce puntajes ni cambia las fórmulas documentadas. El máximo diez aplica a factores activos de cada eje; los descartados siguen visibles e históricos. La detección automática de duplicados compara descripciones equivalentes tras normalizar mayúsculas, acentos y puntuación. Los líderes revisan además posibles equivalencias semánticas que el sistema no puede probar automáticamente.

## Datos y trazabilidad

`drizzle/0002_careless_george_stacy.sql` añade cinco tablas D1: conjunto FODA, factores, evidencias, validaciones e instantáneas cerradas. Cada factor conserva código, categoría, área, clasificación, autor, versión y estado. Cada evidencia conserva tipo, declaración, origen, referencia, periodo, autor y vínculo opcional a un dato aportado en el diagnóstico. La aplicación identifica estas declaraciones como **datos aportados por el cliente**; el nombre de una fuente no equivale a verificación independiente. `audit_events` registra los cambios y sus motivos. Las validaciones se vinculan a la revisión vigente del conjunto: editar un factor o evidencia obliga a validar la nueva revisión.

Las instantáneas cerradas conservan el identificador de la revisión del diagnóstico que las sustentó. Si el diagnóstico cambia después, la interfaz advierte que la dirección debe valorar una nueva versión antes de usar la lista para matrices. No se envían datos estratégicos a GitHub, GHL, Skool ni una base central.

## Puertas de aprobación

1. El equipo registra y depura factores F, D, O y A con al menos una evidencia cualitativa o cuantitativa por factor activo.
2. El consultor aprueba la **versión vigente del diagnóstico** en el módulo previo.
3. Al menos tres líderes activos, incluido el director, validan la misma revisión de la lista. Una solicitud de cambios obliga a corregir y renovar las validaciones.
4. Si hay una duda vigente, el consultor registra una resolución fundamentada. Sin duda, esta revisión de factores FODA no es obligatoria.
5. El director congela la lista. El próximo sprint utilizará únicamente una versión cerrada y compatible con el diagnóstico vigente.

La revisión obligatoria del consultor sobre **prioridades y notas de la MDEP piloto** corresponde a un sprint posterior y se conserva como regla independiente.

## QA local y aceptación en producción

Se aplicó la migración `0002` en D1 local y se registraron factores ficticios de tres categorías con evidencias; se comprobó su persistencia y el avance visual. Las seis pruebas automatizadas pasaron, junto con TypeScript, lint y la compilación. En el Site publicado se confirmó el renderizado de análisis interno y FODA base; la lista aún está vacía en producción, por lo que no se ejecutaron votos ni cierres reales.

La aceptación con usuarios reales requiere que un líder cree y edite factores; otros dos líderes, incluido el director, validen; un observador solo lea; el consultor intervenga únicamente si se registra una duda; el director congele y, con motivo, reabra una nueva versión. Se debe confirmar que las validaciones caducan al cambiar un factor y que la instantánea anterior permanece visible. Usar datos ficticios y evitar modificar la estrategia real durante esta prueba.
