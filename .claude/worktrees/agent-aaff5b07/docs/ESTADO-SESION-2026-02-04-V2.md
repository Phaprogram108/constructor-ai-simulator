# Estado de Sesión - 4 Feb 2026 (Parte 2)

## PROBLEMA RESUELTO: Firecrawl inventaba datos

### Causa raíz identificada
Cuando Firecrawl usaba `extract` con schema AI, **inventaba datos** que no existían:
- ViBert: Nombres de modelos correctos (Sara, Daniela, etc.) pero **precios inventados** (USD 100,000)
- Habika: Decía "solo Buenos Aires y Córdoba" cuando la web dice "todo el país"

### Solución implementada
**Archivo**: `src/lib/firecrawl.ts`

1. **Deshabilitado `extract` de Firecrawl** - Solo usa `formats: ['markdown']`
2. **Nueva función `parseModelsFromMarkdown()`** - Extrae datos con regex del texto real
3. **No inventa precios** - Solo incluye precio si aparece explícitamente en el texto

### Cambio clave (línea ~252):
```typescript
// ANTES (malo - inventaba)
const result = await firecrawl.scrapeUrl(url, {
  formats: ['markdown', 'extract'],
  extract: { schema: catalogSchema }
});

// DESPUÉS (bueno - solo texto real)
const result = await firecrawl.scrapeUrl(url, {
  formats: ['markdown']
});
```

## OTROS CAMBIOS DE ESTA SESIÓN

| Cambio | Archivo | Estado |
|--------|---------|--------|
| Botón volver al inicio en chat | `src/components/ChatInterface.tsx` | ✅ |
| Markdown rendering (**negrita**) | `src/components/Message.tsx` | ✅ |
| Banner "Versión Piloto" | `src/app/page.tsx` | ✅ |
| Headers seguridad | `next.config.mjs` | ✅ |
| Lazy init API clients | `firecrawl.ts`, `scraper.ts`, `chat/route.ts` | ✅ |

## DEPLOY
- **URL**: https://agenteiagratis.com
- **Vercel**: Deployando automáticamente desde GitHub

## PRÓXIMOS PASOS

1. **Testear el fix** - Probar ViBert y Habika de nuevo para verificar que no inventa datos
2. **Ajustar regex si es necesario** - Si no extrae bien algunos modelos
3. **Considerar usar Claude Haiku** - Para parsear el markdown de forma más inteligente (pero sin inventar)

## COMANDOS ÚTILES

```bash
# Iniciar servidor
cd /Users/joaquingonzalez/Documents/dev/constructor-ai-simulator
npm run dev

# Test de Firecrawl con ViBert
node debug-firecrawl.mjs

# Ver página /casas de ViBert
node check-vibert-casas.mjs
```

## ARCHIVOS DE DEBUG CREADOS
- `debug-firecrawl.mjs` - Debug completo de Firecrawl
- `check-vibert-casas.mjs` - Ver contenido de /casas
- `scripts/debug-scraper-visual.py` - Debug visual con screenshots

---
*Guardado: 2026-02-04*
