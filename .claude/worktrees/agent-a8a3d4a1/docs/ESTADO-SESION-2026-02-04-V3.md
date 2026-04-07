# Estado de Sesión - 4 Feb 2026 (Parte 3) - FIX COMPLETO

## PROBLEMA RESUELTO: Firecrawl inventaba datos

### Causa raíz
1. **Firecrawl `extract` con AI inventaba datos** cuando no encontraba información estructurada
2. **URLs no priorizadas** - `/casas` (con todos los modelos) se scrapeaba después de las primeras 10 URLs
3. **Detección de duplicados muy laxa** - "S" se consideraba duplicado de "Sara"

### Solución implementada (3 commits)

#### Commit 1: Deshabilitar extract AI
**Archivo**: `src/lib/firecrawl.ts`
- Deshabilitado `extract` de Firecrawl (inventaba datos)
- Solo usa `formats: ['markdown']`
- Nueva función `parseModelsFromMarkdown()` con regex

#### Commit 2: Mejorar patrones de regex
- Separar patrones para casas (con personas) y quinchos (sin personas)
- Capturar nombre completo de quinchos (Quincho S, M, L, A)
- Mejorar detección de duplicados (evitar falsos positivos)

#### Commit 3: Priorizar URLs de catálogo
- Priorizar `/casas`, `/catalogo`, `/modelos` primero en el scraping
- URLs se ordenan por importancia antes de scrapear

## RESULTADO FINAL - ViBert

**14 modelos extraídos correctamente:**
- Casa Sara - 65.55m² - 1 dorm - 1 baño
- Casa Daniela - 79.45m² - 2 dorm - 1 baño
- Casa Justina - 87.94m² - 2 dorm - 1 baño
- Casa Dora - 55.82m² - 1 dorm - 1 baño
- Casa Micaela - 76.5m² - 2 dorm - 1 baño
- Casa Estefanía - 96.2m² - 2 dorm - 1 baño
- Casa Carmela - 67.78m² - 2 dorm - 1 baño
- Casa Selene - 82.4m² - 2 dorm - 1 baño
- Casa Valeria - 97.65m² - 3 dorm - 2 baños
- Casa María - 110.98m² - 3 dorm - 2 baños
- Quincho S - 27.5m²
- Quincho M - 47.48m²
- Quincho L - 58m²
- Quincho A - 68m²

**0 precios inventados** - Solo datos reales del sitio web.

## DEPLOY

- **URL**: https://agenteiagratis.com
- **Vercel**: Auto-deploy desde GitHub
- **Último commit**: 2873552

## COMANDOS ÚTILES

```bash
# Iniciar servidor
npm run dev

# Test de parsing (offline)
node test-parsing.mjs

# Test de Firecrawl con ViBert
node check-vibert-casas.mjs

# Crear simulador via API
curl -X POST http://localhost:3000/api/simulator/create \
  -H "Content-Type: application/json" \
  -d '{"websiteUrl":"https://www.vibert.com.ar/"}'
```

## ARCHIVOS MODIFICADOS

| Archivo | Cambio |
|---------|--------|
| `src/lib/firecrawl.ts` | Regex parsing, URL prioritization |
| `test-parsing.mjs` | Script de test offline |
| `src/components/ChatInterface.tsx` | Botón volver |
| `src/components/Message.tsx` | Markdown rendering |
| `next.config.mjs` | Security headers |

---
*Guardado: 2026-02-04*
