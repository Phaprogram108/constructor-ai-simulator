# Requisitos: Testing Sistematico de 16 Empresas Constructoras

## Objetivo

Evaluar la calidad del sistema Constructor AI Simulator testeando 16 empresas constructoras argentinas, documentando las conversaciones y generando un analisis de la capacidad del agente Sofia para responder consultas comerciales.

## Contexto

El sistema actual:
- Usa Firecrawl para scrapear sitios web de constructoras
- Extrae modelos de casas (nombre, m2, dormitorios, precio)
- Genera un agente IA (Sofia) que responde consultas
- Ya tiene 100k paginas/mes disponibles en Firecrawl
- Ya guarda conversaciones en `/logs/conversations/`

## Funcionalidades Requeridas

### Fase de Testing
- [x] Sistema de scraping exhaustivo funcionando (Firecrawl)
- [x] Chat interface con Sofia
- [x] Logging automatico de conversaciones
- [x] Sistema de tests E2E con Playwright (parcial)
- [ ] Fixtures actualizados con las 16 empresas
- [ ] Script de consolidacion de conversaciones
- [ ] Documento final de analisis

### Empresas a Testear

| # | Empresa | URL | Estado |
|---|---------|-----|--------|
| 1 | Ecomod | https://ecomod.com.ar/ | Pendiente |
| 2 | Lista | https://lista.com.ar/ | Pendiente |
| 3 | Movilhauss | https://movilhauss.com | Pendiente |
| 4 | PlugArq | https://www.plugarq.com/ | Pendiente |
| 5 | Habika | https://habika.ar/ | Pendiente |
| 6 | Arcohouse | https://arcohouse.com.ar/ | Pendiente |
| 7 | Atlas Housing | https://atlashousing.com.ar/ | Pendiente |
| 8 | Lucy's House | https://www.lucyshousearg.com/ | Pendiente |
| 9 | Sienna Modular | https://www.siennamodular.com.ar/ | Pendiente |
| 10 | Offis | https://www.offis.ar/ | Pendiente |
| 11 | Efede Casas Modulares | https://efede.com.ar/casas-modulares/ | Pendiente |
| 12 | Mini Casas | https://www.minicasas.com.ar/ | Pendiente |
| 13 | Wellmod | https://www.wellmod.com.ar/ | Pendiente |
| 14 | Grupo Steimberg | https://www.gruposteimberg.com/ | Pendiente |
| 15 | Aftamantes Refugios | https://aftamantes.net/refugios/ | Pendiente |
| 16 | Arqtainer | https://arqtainer.com.ar/ | Pendiente |

### Preguntas Estandar (ya definidas en test-questions.json)

1. **Modelos**: "Que modelos tienen?"
   - Esperado: Lista con m2 y dormitorios

2. **Precio**: "Cuanto cuesta el modelo mas chico?"
   - Esperado: Precio o pedido de ubicacion para cotizar

3. **Ubicacion**: "Construyen en Cordoba?"
   - Esperado: Respuesta sobre zonas de cobertura

4. **Obra gris**: "Que incluye la obra gris?"
   - Esperado: Detalle de inclusiones

5. **Financiamiento**: "Tienen financiamiento?"
   - Esperado: Opciones de pago

6. **Recomendacion**: "Quiero una casa de 2 dormitorios"
   - Esperado: Modelos especificos recomendados

## Criterios de Aceptacion

### Testing
1. Las 16 empresas deben ser scrapeadas sin errores criticos
2. Cada empresa debe recibir las 6 preguntas estandar
3. Las conversaciones deben guardarse automaticamente

### Documentacion
1. Documento unico con las 16 conversaciones completas
2. Resumen de modelos extraidos por empresa
3. Metricas de calidad (% respuestas especificas vs genericas)
4. Clasificacion de empresas por calidad de resultados

### Metricas Minimas
- 75% de empresas con scraping exitoso (12/16)
- 50% de respuestas con informacion especifica (modelos con m2)
- Documento final generado y revisable

## Fuera de Alcance

- Modificaciones al algoritmo de scraping
- Cambios en el system prompt de Sofia
- Integracion con nuevas APIs
- Testing de carga o performance
- Modificaciones a la UI

## Entregables

1. `/tests/e2e/fixtures/test-companies.json` - Actualizado con 16 empresas
2. `/logs/conversations/*.txt` - Conversaciones individuales (auto-generadas)
3. `/docs/ANALISIS-CONVERSACIONES.md` - Documento consolidado
4. `/docs/REPORTE-FINAL-TESTING.md` - Analisis con conclusiones
5. Screenshots de cada sesion (opcionales, generados por Playwright)

## Estimaciones

| Fase | Tiempo | Creditos Firecrawl |
|------|--------|-------------------|
| Preparacion | 5 min | 0 |
| Actualizar fixtures | 10 min | 0 |
| Testing automatizado | 90-120 min | ~480 |
| Consolidacion | 15 min | 0 |
| Analisis final | 20 min | 0 |
| **Total** | **~2.5 horas** | **~480 creditos** |

## Dependencias Tecnicas

- Node.js 18+
- Next.js 14
- Playwright para tests E2E
- Firecrawl API (con creditos)
- Anthropic API (para chat con Sofia)
