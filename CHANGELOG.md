# Changelog

Todos los cambios notables del proyecto se documentan aqui.

## [2026-02-04] - Mejoras de Scraping y Error Handling

### Agregado
- **Actions Universales en Firecrawl**: 30+ selectores para expandir FAQs, accordions y revelar WhatsApp
- **Vision Scraper**: Fallback con Claude Vision para paginas complejas (tablas, planos)
- **URLs Prioritarias**: FAQ, tipologias, cobertura ahora se scrapen primero
- **Funcion extractFAQContent()**: Extrae pares pregunta-respuesta del markdown
- **Script QA 20 empresas**: `scripts/test-20-empresas-qa.ts`

### Cambiado
- **rawText limits**: Aumentados de 6K->12K (web) y 8K->15K (PDF)
- **MAX_CATALOG_URLS**: Aumentado de 10 a 15
- **Prompt del bot**: Ahora busca en rawText antes de decir "no tengo info"

### Arreglado
- **Fallback "Empresa Constructora"**: Ahora devuelve error HTTP 422 claro en lugar de datos inventados
- **Chat error 400**: Corregido pasando systemPrompt y conversationHistory en cada request

### Eliminado
- **Firecrawl extract con AI**: Inventaba datos, reemplazado por regex parsing

---

## [2026-02-03] - Lanzamiento Inicial

### Agregado
- Scraping basico con Firecrawl
- Chat con Claude 3.5 Sonnet
- UI con Next.js + TailwindCSS
- Deploy en Vercel

---

## Proximas Mejoras Planificadas

- [ ] Mejorar extraccion WhatsApp (actualmente ~5% exito)
- [ ] Soporte para empresas de construccion tradicional (no solo modular)
- [ ] CI/CD con tests automaticos
- [ ] Rate limiting mas robusto
