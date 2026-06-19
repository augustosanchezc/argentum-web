# ADR-001 — Licencia del proyecto

- **Estado:** Aceptada
- **Fecha:** 2026-06-19
- **Decidido por:** clokm (usuario), recomendado por el project-manager
- **Sprint:** 1 (Fase 0)

## Contexto

El proyecto construye un servidor y cliente web de Argentum Online. Existen al menos cuatro ecosistemas de código público de AO (ao-org / AO20, ao-libre, Comunidad-Winter, Finisterra), todos bajo **AGPL-3.0** o derivados con clausulas de copyleft fuerte. El análisis previo (`docs/contexto-y-analisis.md` §3.3) identificó dos riesgos legales:

1. **Contagio de licencia** si copiamos código de los repos AGPL.
2. **Assets gráficos** sin licencia clara que han generado disputas históricas (R-02).

El usuario quiere desarrollar y publicar el proyecto de forma transparente, alineado con la cultura del juego original (preservación, comunidad, libre acceso).

## Alternativas consideradas

| Opción | Pros | Contras |
|---|---|---|
| **A. AGPL-3.0-or-later** *(elegida)* | Elimina ambigüedad legal frente a los repos de referencia. Coherente con la cultura del juego. Cualquier reescritura derivada queda obligatoriamente libre. Compatible con donaciones (D-6). | Algunos colaboradores corporativos pueden evitarlo. No permite servicio SaaS cerrado. |
| **B. MIT / Apache-2.0** | Mínima fricción para adopción. | Crea zona gris frente a copia conceptual de repos AGPL. Permite que terceros tomen el código y monten servidor cerrado sin contribuir. |
| **C. Privado / propietario** | Control total. | Conflicto cultural con AO. No permite reutilizar referencias del ecosistema sin riesgo legal. |

## Decisión

El repositorio y todo el código original que produzcamos se licencian bajo **AGPL-3.0-or-later** desde el primer commit. El archivo `LICENSE` contiene el texto oficial descargado de gnu.org. El campo `license` en cada `package.json` declara `"AGPL-3.0-or-later"`.

## Consecuencias

**Positivas**
- Riesgo legal de contagio AGPL → resuelto: ya somos AGPL.
- Cualquier servidor derivado que se exponga por red debe publicar sus modificaciones (esto incluye el nuestro: si en el futuro se ofrece como SaaS, ese código también es público).
- Alinea al proyecto con la comunidad de AO existente.

**Negativas / a tener presentes**
- No podemos volver atrás sin la autorización de todos los contribuyentes futuros.
- Posibles colaboradores corporativos pueden no aportar por políticas internas.
- Los assets gráficos NO quedan cubiertos por AGPL — se tratan en una decisión aparte (ver R-02 del roadmap).

**Acciones derivadas**
- Añadir nota de copyright en cabecera de los archivos `.ts` del server (postergable a fin de Fase 0).
- Política de privacidad y términos de uso publicados antes de la Beta (Fase 4) — requerido por AGPL al ofrecer servicio por red.
- No copiar código verbatim de ao-org / ao-libre / Finisterra: usar solo como referencia conceptual.
