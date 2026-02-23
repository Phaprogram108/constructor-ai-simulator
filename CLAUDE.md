# Constructor AI Simulator

## Verificacion (REGLA #0)

**URL de verificacion**: `http://localhost:3000`
**Comando para iniciar**: `npm run dev`
**Stack**: Next.js 14 + TypeScript + Tailwind + shadcn/ui

## Known Issues

Ver `KNOWN_ISSUES.md` en la raiz del proyecto.

## Estructura del Proyecto

```
src/app/           - Next.js app router pages
src/components/    - React components (shadcn/ui)
src/lib/           - Utilities, API clients
src/scripts/       - Data processing scripts
src/types/         - TypeScript type definitions
ground-truth/      - QA ground truth data
docs/              - Documentation
```

## Notas Especificas

- Chatbots generados desde sitios web de empresas constructoras
- Usa Firecrawl para scraping de websites
- Ground truth data en JSON para validacion de respuestas
- Node.js project: usar `npm` para dependencies
