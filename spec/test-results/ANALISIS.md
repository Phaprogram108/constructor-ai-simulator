# Análisis de Tests - 5 Empresas

## Resumen de Resultados (v1 - commit dc07d96)

| Empresa | Tipo Esperado | Tipo Obtenido | Modelos Extraídos | PASS/FAIL |
|---------|---------------|---------------|-------------------|-----------|
| Atlas Housing | Modular | MODULAR | Katerra, Upsala, Fitz Roy, Blackberry, Hexa, Montana (6) | **PASS** |
| ViBert | Modular | MODULAR | "No se encontraron modelos estructurados" | **FAIL** |
| Ecomod | Modular | MODULAR | "No se encontraron modelos estructurados" | **FAIL** |
| Movilhauss | Modular | MODULAR | inquba, inquba +, inquba duo, freestyle, inquba/work (5) | **PASS** |
| MakenHaus | Inmobiliaria/Tradicional | MODULAR | "No se encontraron modelos estructurados" | **FAIL** |

## Fix Aplicado (commit 410833e)

Se agregó clasificación `inmobiliaria` con keywords:
- desarrollos inmobiliarios
- proyectos inmobiliarios residenciales
- lotes/unidades en ejecución
- emprendimientos
- barrios cerrados/privados
- departamentos
- fideicomiso, preventa, etc.

**PROBLEMA**: MakenHaus sigue fallando porque Firecrawl no extrae contenido de la página.
Sin contenido, no hay keywords para clasificar.

## Detalle por Empresa

### Atlas Housing - PASS
- **Tipo**: Correcto (MODULAR)
- **Modelos**: 6 modelos extraídos correctamente
- **Faltan m²**: Los modelos no tienen metros cuadrados asociados
- **Acción necesaria**: Mejorar extracción de m² (están en expandibles "+")

### ViBert - FAIL
- **Tipo**: Correcto (MODULAR)
- **Problema**: No extrajo modelos - ViBert tiene Casa Sara, Casa Julia, etc.
- **Causa probable**: La web usa un menú con "Casas ViBert" que necesita navegación
- **Contenido raw**: Solo muestra página principal, no llegó al catálogo

### Ecomod - FAIL
- **Tipo**: Correcto (MODULAR)
- **Problema**: No extrajo modelos del catálogo
- **Contenido raw**: Tiene "VER MODELOS" pero no navegó a esa página
- **Causa probable**: Firecrawl no siguió el link a /modelos

### Movilhauss - PASS
- **Tipo**: Correcto (MODULAR)
- **Modelos**: 5 modelos correctamente extraídos
- **Nota**: Los modelos son nombres (inquba, freestyle) pero no tienen m²
- **Mejora pendiente**: Extraer especificaciones técnicas (DVH, steel frame)

### MakenHaus - FAIL (CRÍTICO)
- **Tipo**: INCORRECTO - Dice MODULAR cuando es inmobiliaria/tradicional
- **Problema**: MakenHaus vende proyectos/emprendimientos, NO casas modulares
- **Descripción vacía**: No extrajo descripción de la empresa
- **INFORMACIÓN ADICIONAL**: Vacía - el scraper falló completamente
- **Causa probable**: Web con Cloudflare o protección que bloqueó el scrape

## Problemas Identificados

### 1. ViBert y Ecomod - No navega a páginas de catálogo
El scraper no sigue los links internos para llegar a las páginas de modelos.
- ViBert: tiene /proyectos/casas-vibert con el catálogo
- Ecomod: tiene /modelos con el catálogo

### 2. MakenHaus - Clasificación incorrecta + scrape fallido
- El scraper no pudo obtener contenido de la web
- Clasificó como MODULAR por defecto (sin datos para decidir)
- Debería haber detectado keywords como "emprendimiento", "lotes", "unidades"

### 3. Metros cuadrados no extraídos
Atlas Housing y Movilhauss extrajeron nombres de modelos pero sin m².
La información de m² suele estar en páginas individuales de cada modelo.

## Próximos Pasos

### Fase 2: Diagnóstico

1. **Verificar URLs encontradas por mapUrl**
   - Agregar logs en firecrawl.ts para ver qué URLs encuentra

2. **Probar MakenHaus manualmente**
   ```bash
   curl -I https://makenhaus.com.ar
   ```
   Ver si hay redirección o bloqueo

3. **Verificar ViBert/Ecomod**
   - Ver si mapUrl encuentra /modelos, /catalogo
   - Ver si extract falla en esas URLs

### Fase 3: Fixes Necesarios

1. **Clasificación**: Agregar keywords negativas para detectar inmobiliarias
   - "emprendimiento", "lotes", "unidades", "departamentos", "barrio cerrado"

2. **Navegación a catálogo**:
   - Mejorar identificación de URLs de catálogo
   - Forzar crawl de /modelos, /catalogo, /casas

3. **Extracción de m²**:
   - Usar regex más agresivos en el contenido raw
   - Considerar crawl de páginas individuales de modelos
