# Propuesta de Corrección del Scraper

## Problema Identificado

El scraper está alucinando datos debido a un prompt demasiado permisivo en la fase de extracción con AI.

### Prompt Actual (Problemático)

Ubicación: `src/lib/scraper.ts`, línea 441-472

```typescript
const prompt = `Analiza el siguiente contenido...

Extrae y responde SOLO con un JSON válido:
{
  "models": ["lista COMPLETA de modelos/productos - incluir TODOS los que encuentres con formato: 'Nombre del Modelo - X m² - Y dormitorios - Z baños - características'"],
  ...
}

IMPORTANTE:
- BUSCA EN TODO EL CONTENIDO los nombres de modelos que aparezcan en el sitio web (NO inventes nombres)
- Para cada modelo incluye TODOS los detalles: metros cuadrados, dormitorios, baños, características
- Si hay precios, inclúyelos exactamente como aparecen junto al modelo
- Si no encuentras algún dato, usa un array vacío [] o string vacío ""
- ES CRÍTICO que extraigas la lista completa de modelos con sus especificaciones
`;
```

### Por Qué Falla

1. **Contradicción interna**: Dice "NO inventes" pero luego demanda "lista COMPLETA" y "ES CRÍTICO"
2. **Presión implícita**: La urgencia ("ES CRÍTICO") hace que Claude prefiera inventar antes que devolver vacío
3. **Falta de consecuencias**: No hay advertencia de qué hacer si NO encuentra modelos
4. **Sin validación**: No pide evidencia de dónde encontró los datos

### Evidencia del Problema

#### Caso 1: ViBert

**Contenido real scrapeado** (según logs):
```
PÁGINA: ViBert | ViBert
Secciones: ¿Por qué ViBert? | Proyectos | Nosotros | Premoldeados | Contacto
[Contenido sobre sistema constructivo de hormigón premoldeado]
```

**Datos extraídos por Claude**:
```json
{
  "models": [
    "Casa Estafania - 100m2 - 3 dorm - 2 banos - USD 100,000",
    "Casa Micaela - 90m2 - 2 dorm - 1 bano - USD 80,000",
    "Casa Sara - 110m2 - 3 dorm - 2 banos - USD 120,000",
    ...15 modelos en total
  ]
}
```

**Análisis**: Los nombres (Estafania, Micaela, Sara) son nombres femeninos argentinos típicos. Los precios siguen un patrón muy regular. NO aparecen en el contenido scrapeado.

#### Caso 2: T1 Modular

**Contenido real visible** (screenshot):
```
CONSTRUCCIONES EN SECO CON STEEL FRAME
Obras llave en mano. Nos ocupamos de todo.
Trabajamos en todo el país
```

**Datos extraídos**:
```json
{
  "locations": [
    "Buenos Aires", "Córdoba", "Mendoza", "CABA",
    "La Plata", "Argentina", "Chile", "Uruguay",
    "Republica de Irlanda y Pueyrredon", "Venado Tuerto"
  ]
}
```

**Análisis**: "Trabajamos en todo el país" claramente se refiere a Argentina. El scraper agregó países extranjeros (Chile, Uruguay, Irlanda) que NO están en el texto.

---

## Solución Propuesta

### Prompt Corregido

```typescript
const prompt = `Sos un extractor de datos CONSERVADOR. Tu trabajo es extraer SOLO información que REALMENTE aparezca en el texto.

URL: ${content.url}
Título de página: ${content.metaTitle}
Meta descripción: ${content.metaDescription}
Nombre del sitio: ${content.ogSiteName}
${content.pagesScraped ? `Páginas analizadas: ${content.pagesScraped}` : ''}

CONTENIDO DEL SITIO (múltiples páginas combinadas):
${content.rawText}

${content.structuredData ? `DATOS ESTRUCTURADOS:\n${content.structuredData}` : ''}

REGLAS CRÍTICAS - NO NEGOCIABLES:

1. **NO INVENTES**: Si un dato no aparece en el contenido, devolvé un array vacío [] o string vacío ""
2. **EVIDENCIA REQUERIDA**: Solo extraé datos que puedas citar textualmente del contenido
3. **CONSERVADOR > COMPLETO**: Es mejor devolver menos información que inventar
4. **SIN SUPOSICIONES**: No completes datos faltantes con valores típicos o plausibles
5. **NOMBRES EXACTOS**: Si dice "Modelo A", extraé "Modelo A", NO inventes "Casa Modelo A con cocina"
6. **PRECIOS EXACTOS**: Solo incluir si el precio está explícitamente mencionado
7. **UBICACIONES LITERALES**: Si dice "todo el país", extraé exactamente eso, NO listes provincias

Extrae y responde SOLO con un JSON válido (sin explicaciones ni markdown):
{
  "companyName": "nombre de la empresa (NO incluir 'Home', 'Inicio' u otras palabras genéricas)",
  "description": "descripción breve de la empresa y qué hace",
  "services": ["lista de servicios que ofrece"],
  "models": ["SOLO modelos que realmente encuentres. Formato: 'Nombre del Modelo - X m² - Y dormitorios - Z baños - características'"],
  "prices": ["SOLO precios que estén explícitamente en el texto junto al modelo"],
  "contactInfo": "teléfonos, emails, WhatsApp encontrados",
  "locations": ["zonas o localidades EXACTAS mencionadas"],
  "keyFeatures": ["características destacadas como 'llave en mano', 'financiación', 'steel frame', etc."],
  "dataQuality": {
    "foundModels": true/false,
    "foundPrices": true/false,
    "foundLocations": true/false,
    "confidence": "high/medium/low",
    "notes": "explicación breve de la calidad de los datos encontrados"
  }
}

IMPORTANTE:
- Si NO encontrás modelos en el contenido, "models": [] - NO inventes nombres
- Si NO hay precios específicos, "prices": [] - NO estimes valores
- Si dice "trabajamos en todo el país", "locations": ["todo el país"] - NO listes provincias
- Si tenés dudas sobre un dato, NO lo incluyas
- El campo "dataQuality" es obligatorio para auditoría`;
```

### Cambios Clave

1. **Tono diferente**: "Extractor CONSERVADOR" vs "lista COMPLETA"
2. **Reglas explícitas**: 7 reglas numeradas y claras
3. **Campo de auditoría**: `dataQuality` para saber qué encontró realmente
4. **Ejemplos negativos**: Muestra qué NO hacer
5. **Consecuencias claras**: "Es mejor devolver menos"

---

## Implementación

### 1. Modificar `src/lib/scraper.ts`

```typescript
// Línea 440-472, reemplazar toda la función extractWithAI

async function extractWithAI(content: RawContent): Promise<ScrapedContent> {
  const prompt = `[USAR PROMPT CORREGIDO DE ARRIBA]`;

  try {
    const response = await getAnthropic().messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const responseText = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map(block => block.text)
      .join('');

    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const extracted = JSON.parse(jsonMatch[0]);

    // NUEVO: Validación de calidad
    if (extracted.dataQuality) {
      console.log('[Scraper] Data quality:', extracted.dataQuality);

      // Alerta si hay baja confianza
      if (extracted.dataQuality.confidence === 'low') {
        console.warn('[Scraper] Low confidence extraction:', extracted.dataQuality.notes);
      }

      // Alerta si extrae muchos modelos sin precios (posible invención)
      if (extracted.models.length > 5 && !extracted.dataQuality.foundPrices) {
        console.warn('[Scraper] WARNING: Many models but no prices - possible hallucination');
      }
    }

    // Build comprehensive rawText with all extracted info
    const comprehensiveText = buildComprehensiveText(extracted, content.rawText);

    return {
      title: extracted.companyName || cleanCompanyName(content.metaTitle) || 'Empresa Constructora',
      description: extracted.description || content.metaDescription,
      services: Array.isArray(extracted.services) ? extracted.services : [],
      models: Array.isArray(extracted.models) ? extracted.models : [],
      contactInfo: extracted.contactInfo || '',
      rawText: comprehensiveText,
    };
  } catch (error) {
    console.error('[Scraper] AI extraction error:', error);
    // Return basic extraction if AI fails
    return {
      title: cleanCompanyName(content.metaTitle) || 'Empresa Constructora',
      description: content.metaDescription,
      services: [],
      models: [],
      contactInfo: '',
      rawText: content.rawText,
    };
  }
}
```

### 2. Agregar Validación con Vision (Opcional pero Recomendado)

```typescript
// Nueva función en src/lib/scraper.ts

async function validateWithVision(
  url: string,
  extractedModels: string[]
): Promise<{ valid: boolean; reason: string }> {

  if (extractedModels.length === 0) {
    return { valid: true, reason: 'No models to validate' };
  }

  // Capturar screenshot
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  const screenshot = await page.screenshot({ type: 'jpeg', quality: 75 });
  await browser.close();

  // Analizar con Vision
  const anthropic = getAnthropic();
  const response = await anthropic.messages.create({
    model: 'claude-3-haiku-20240307',
    max_tokens: 500,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: 'image/jpeg',
            data: screenshot.toString('base64')
          }
        },
        {
          type: 'text',
          text: `¿Esta página web muestra información sobre estos modelos: ${extractedModels.slice(0, 3).join(', ')}?

Responde SOLO con JSON:
{
  "showsModels": true/false,
  "reason": "breve explicación"
}`
        }
      ]
    }]
  });

  const result = JSON.parse(
    response.content.find(b => b.type === 'text')?.text || '{}'
  );

  if (!result.showsModels) {
    console.warn('[Scraper] Vision validation failed:', result.reason);
  }

  return {
    valid: result.showsModels,
    reason: result.reason
  };
}
```

### 3. Testing

Antes de deployar, ejecutar:

```bash
# 1. Re-scrapear empresas de test
python3 scripts/debug-scraper-visual.py

# 2. Verificar logs
grep "Data quality:" /tmp/scraper.log

# 3. Testear en empresas problemáticas
curl -X POST http://localhost:3000/api/simulator/create \
  -H "Content-Type: application/json" \
  -d '{"websiteUrl": "https://www.vibert.com.ar/"}'
```

---

## Métricas de Éxito

Después de implementar:

1. **Reducción de alucinaciones**: 0 modelos inventados en test
2. **Data quality**: Todas las extracciones con `confidence: "high"` o modelos vacíos
3. **Vision validation**: 100% de match entre Vision y scraper
4. **Logs limpios**: Sin warnings de "many models but no prices"

---

## Rollout Plan

1. **Día 1**: Implementar prompt corregido en staging
2. **Día 1**: Correr debug visual en 10 empresas de test
3. **Día 2**: Si tests pasan, implementar en producción
4. **Día 2**: Re-scrapear TODAS las empresas existentes
5. **Día 3**: Implementar Vision validation (opcional)
6. **Día 3-7**: Monitoring intensivo de logs y feedback de usuarios

---

## Consideraciones

### Tradeoff: Menos Datos vs Datos Correctos

Con el prompt corregido, es probable que:
- ✅ 0% de datos inventados
- ⚠️ Algunos sitios devuelvan `models: []` si el catálogo no está en texto plano
- ⚠️ Puede necesitar más trabajo manual para empresas con catálogos en imágenes

**Decisión recomendada**: Preferir datos correctos. Para sitios sin modelos detectables, agregar opción de carga manual de catálogo.

### Costo de Vision Validation

- Screenshot: gratis (Playwright)
- Análisis con Haiku Vision: ~$0.0004 por imagen
- Por 100 empresas: ~$0.04

**Decisión**: El costo es negligible vs el riesgo de datos incorrectos.

---

## Apéndice: Prompt Comparison

| Aspecto | Prompt Actual | Prompt Propuesto |
|---------|---------------|------------------|
| Tono | "BUSCA... ES CRÍTICO" | "Sos CONSERVADOR" |
| Instrucción principal | "lista COMPLETA" | "SOLO lo que aparezca" |
| Handling vacío | "Si no encuentras, []" (al final) | 7 reglas explícitas (al inicio) |
| Validación | Ninguna | Campo dataQuality obligatorio |
| Ejemplos | Solo positivos | Positivos y negativos |
| Consecuencias | Ninguna | "Mejor devolver menos" |
