# Sprint 4 — FODA cuantitativa

## Alcance implementado

- FO (Fortalezas × Oportunidades) y DA (Debilidades × Amenazas), hasta 10 factores por eje conforme al cierre del Sprint 3.
- Escala final 0, 1, 3 o 9 por cruce, con justificación y evidencia procedente de uno de los dos factores. La sugerencia IA se identifica como borrador y se guarda aparte.
- Totales, promedio por cantidad de factores del eje contrario, posición relativa y prioridad P1 (promedio ≥ 4,5) o P2 (promedio < 4,5). No se asigna prioridad hasta completar el cuadrante.
- Interpretación cualitativa FA y DO, sin puntajes nuevos.
- Vulnerabilidad de debilidades P1 de DA: impacto y probabilidad Alta/Media/Baja (100/75/50), capacidad de acción Alta/Media/Baja (75/50/25), grado = impacto × probabilidad / 100 y cuatro zonas. Se presentan en orden Muy crítico, Crítico, Alerta, Preparado.
- Validación de al menos tres líderes activos, incluido el director; revisión obligatoria de puntajes y prioridades por el consultor; cierre por dirección. Cada edición invalida los votos de la revisión anterior.
- Versiones aprobadas inmutables y reapertura justificada bajo responsabilidad de dirección. Cada versión conserva referencia a la instantánea FODA origen, puntuaciones, evidencias, votos, revisión y auditoría.

## Separación de procedencia

1. **Cliente:** factores y evidencias de la FODA congelada.
2. **IA:** sugerencia provisional para un cruce, nunca nota final.
3. **Equipo:** puntuación final, interpretación cualitativa y evaluación de vulnerabilidad.
4. **Sistema:** cálculos deterministas de totales, promedio, prioridad y zona.
5. **Consultor y dirección:** revisión y aprobación de la versión.

## Pruebas

- `node --experimental-strip-types --test tests/foda-matrix.test.mjs`: cruces, escala, evidencia, umbral 4,5, empates, zonas y quórum.
- Compilación TypeScript y build Vinext.
- Migraciones `0004` y `0005` aplicadas en D1 local sobre las migraciones anteriores.
- Validación multiusuario final en el Site publicado: pendiente de prueba con cuentas reales.

## Riesgos y límites

- La propuesta IA se pide manualmente para cada par y puede fallar por límites, crédito o conectividad del proyecto OpenAI. Es requisito previo a la nota final según la metodología; si falla, el cruce queda pendiente.
- La selección de una estrategia competitiva a partir de los resultados corresponde al Sprint 5; este sprint conserva las evidencias y prioridades necesarias para esa decisión.
- Un cambio en la FODA base abre otra versión y exige una matriz nueva; las versiones aprobadas anteriores permanecen consultables.
