# Especificacion Fase 5: Sistema de Logging y Analisis

## Resumen Ejecutivo

Esta fase reescribe completamente el sistema de logging para capturar datos estructurados que permitan analizar la calidad de las conversaciones, detectar patrones de fallos y medir el rendimiento del scraping.

**Objetivo principal**: Transformar logs de texto plano en JSON estructurado con metricas de calidad.

---

## Estado Actual

### Archivo: `src/lib/conversation-logger.ts` (62 lineas)

**Problemas identificados**:
1. Guarda logs como texto plano (.txt) - dificil de analizar
2. No captura metadata del scraping (metodo, duracion, modelos encontrados)
3. No guarda companyUrl, solo companyName
4. No calcula metricas de calidad de conversacion
5. No detecta flags importantes (saidNoInfo, hallucinations)
6. No identifica tipo de constructora (modular/tradicional/mixta)

**Estructura actual de logs**:
```
logs/conversations/2026-02-04T00-34-42-646Z_Arcohouse.txt

=== Conversacion: Arcohouse ===
Fecha: 2026-02-04T00:34:42.646Z
Session ID: 89fb0672-ca66-4fef-b5f1-6c1287d19bc9
==================================================

[USUARIO]
Que modelos tienen?

[SOFIA]
Tenemos varios refugios modulares...
```

### Integracion existente

El sistema ya tiene:
- `response-validator.ts` con deteccion de alucinaciones (ValidationResult)
- `Message.flags` en types con: saidNoInfo, possibleHallucination, validationConfidence
- ScrapedContent con: socialLinks, constructoraType
- Chat route que ya llama a `validateResponse()` y setea flags

**Lo que falta**: Capturar esta metadata en los logs estructurados.

---

## Requisitos Fase 5

### 5.1 Reescribir conversation-logger.ts

**Nueva interface EnhancedConversationLog**:

```typescript
interface EnhancedConversationLog {
  // Identificadores
  sessionId: string;
  companyName: string;
  companyUrl: string;
  constructoraType: 'modular' | 'tradicional' | 'mixta' | 'unknown';

  // Metadata del scraping
  scraping: {
    method: 'firecrawl' | 'playwright' | 'fetch' | 'vision' | 'mixed';
    duration: number; // ms
    modelsFound: number;
    whatsappFound: boolean;
    instagramFound: boolean;
    linktreeExplored: boolean;
    pdfAnalyzed: boolean;
  };

  // Conversacion con flags
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    flags?: {
      saidNoInfo: boolean;
      possibleHallucination: boolean;
      validationConfidence?: number;
    };
  }>;

  // Analisis automatico
  analysis: {
    conversationQuality: number;  // 0-100
    totalMessages: number;
    userMessages: number;
    assistantMessages: number;
    noInfoResponses: number;
    possibleHallucinations: number;
    issues: string[];
  };

  // Timestamps
  createdAt: Date;
  lastMessageAt: Date;
}
```

**Funciones requeridas**:

```typescript
// Crear nuevo log cuando se inicia sesion
function createEnhancedLog(params: {
  sessionId: string;
  companyName: string;
  companyUrl: string;
  constructoraType?: 'modular' | 'tradicional' | 'mixta';
  scrapingMetadata: {
    method: string;
    duration: number;
    modelsFound: number;
    whatsappFound: boolean;
    instagramFound: boolean;
    linktreeExplored?: boolean;
    pdfAnalyzed?: boolean;
  };
}): EnhancedConversationLog;

// Agregar mensaje al log existente
function appendEnhancedMessage(
  sessionId: string,
  message: Message,
  validationResult?: ValidationResult
): void;

// Guardar log a disco
function saveEnhancedLog(log: EnhancedConversationLog): string;

// Calcular calidad de conversacion (0-100)
function calculateConversationQuality(log: EnhancedConversationLog): number;

// Cargar log por sessionId
function loadEnhancedLog(sessionId: string): EnhancedConversationLog | null;
```

### 5.2 Dashboard de Analisis (Opcional)

**Archivo**: `src/app/analytics/page.tsx`

**Funcionalidades**:
1. Tabla de empresas probadas (ordenable por score)
2. Metricas agregadas:
   - Score promedio de conversaciones
   - Tasa de extraccion de WhatsApp
   - Tasa de respuestas "no tengo info"
   - Distribucion por tipo de constructora
3. Filtros:
   - Por tipo de constructora (modular/tradicional/mixta)
   - Por rango de fechas
   - Por score minimo
4. Detalle de conversacion individual al clickear

---

## Plan de Implementacion

### Fase 5.1: Reescribir Logger (Prioridad Alta)

**Archivo a modificar**: `src/lib/conversation-logger.ts`

| Tarea | Descripcion | Complejidad |
|-------|-------------|-------------|
| 5.1.1 | Definir interfaces EnhancedConversationLog y ScrapingMetadata | Baja |
| 5.1.2 | Implementar createEnhancedLog() | Baja |
| 5.1.3 | Implementar appendEnhancedMessage() con flags | Media |
| 5.1.4 | Implementar calculateConversationQuality() | Media |
| 5.1.5 | Implementar saveEnhancedLog() con formato JSON | Baja |
| 5.1.6 | Implementar loadEnhancedLog() para cargar logs | Baja |
| 5.1.7 | Migrar funciones legacy (mantener backward compat) | Baja |

**Dependencias**: Ninguna (tipos ya existen en types/index.ts)

### Fase 5.2: Integracion con Create Route

**Archivo a modificar**: `src/app/api/simulator/create/route.ts`

| Tarea | Descripcion | Complejidad |
|-------|-------------|-------------|
| 5.2.1 | Capturar scrapingMetadata (metodo, duracion, etc) | Media |
| 5.2.2 | Llamar createEnhancedLog() al crear sesion | Baja |
| 5.2.3 | Pasar metadata al response para que chat la use | Baja |

### Fase 5.3: Integracion con Chat Route

**Archivo a modificar**: `src/app/api/chat/route.ts`

| Tarea | Descripcion | Complejidad |
|-------|-------------|-------------|
| 5.3.1 | Reemplazar logConversation() por appendEnhancedMessage() | Baja |
| 5.3.2 | Pasar validationResult al logger | Baja |
| 5.3.3 | Guardar log actualizado despues de cada mensaje | Baja |

### Fase 5.4: Dashboard Analytics (Opcional)

**Archivos a crear**:
- `src/app/analytics/page.tsx`
- `src/lib/analytics-loader.ts`

| Tarea | Descripcion | Complejidad |
|-------|-------------|-------------|
| 5.4.1 | Crear loader para leer todos los logs JSON | Media |
| 5.4.2 | Crear page.tsx con tabla de empresas | Media |
| 5.4.3 | Agregar metricas agregadas | Baja |
| 5.4.4 | Agregar filtros | Media |
| 5.4.5 | Vista de detalle de conversacion | Media |

---

## Archivos a Modificar/Crear

| Archivo | Accion | Lineas estimadas |
|---------|--------|------------------|
| `src/lib/conversation-logger.ts` | Reescribir | ~200 |
| `src/types/index.ts` | Agregar interfaces | ~40 |
| `src/app/api/simulator/create/route.ts` | Modificar | ~30 |
| `src/app/api/chat/route.ts` | Modificar | ~20 |
| `src/app/analytics/page.tsx` | Crear (opcional) | ~250 |
| `src/lib/analytics-loader.ts` | Crear (opcional) | ~80 |

---

## Algoritmo de Calidad de Conversacion

```typescript
function calculateConversationQuality(log: EnhancedConversationLog): number {
  let score = 100;
  const messages = log.messages;
  const assistantMessages = messages.filter(m => m.role === 'assistant');

  // Penalizar por respuestas "no tengo info"
  const noInfoCount = assistantMessages.filter(m => m.flags?.saidNoInfo).length;
  score -= noInfoCount * 15; // -15 por cada "no tengo info"

  // Penalizar por posibles alucinaciones
  const hallucinationCount = assistantMessages.filter(m => m.flags?.possibleHallucination).length;
  score -= hallucinationCount * 20; // -20 por cada alucinacion

  // Bonificar por conversacion larga (usuario enganchado)
  if (messages.length >= 6) score += 5;
  if (messages.length >= 10) score += 5;

  // Bonificar si tiene WhatsApp (usuario puede contactar)
  if (log.scraping.whatsappFound) score += 5;

  // Penalizar si no hay modelos
  if (log.scraping.modelsFound === 0) score -= 10;

  return Math.max(0, Math.min(100, score));
}
```

---

## Formato de Salida JSON

**Ubicacion**: `logs/enhanced/{sessionId}.json`

```json
{
  "sessionId": "89fb0672-ca66-4fef-b5f1-6c1287d19bc9",
  "companyName": "Arcohouse",
  "companyUrl": "https://arcohouse.com.ar",
  "constructoraType": "modular",
  "scraping": {
    "method": "firecrawl",
    "duration": 12500,
    "modelsFound": 5,
    "whatsappFound": true,
    "instagramFound": true,
    "linktreeExplored": false,
    "pdfAnalyzed": false
  },
  "messages": [
    {
      "role": "user",
      "content": "Que modelos tienen?",
      "timestamp": "2026-02-04T00:34:40.123Z",
      "flags": null
    },
    {
      "role": "assistant",
      "content": "Tenemos varios refugios modulares...",
      "timestamp": "2026-02-04T00:34:42.646Z",
      "flags": {
        "saidNoInfo": false,
        "possibleHallucination": false,
        "validationConfidence": 0.95
      }
    }
  ],
  "analysis": {
    "conversationQuality": 94,
    "totalMessages": 6,
    "userMessages": 3,
    "assistantMessages": 3,
    "noInfoResponses": 0,
    "possibleHallucinations": 0,
    "issues": []
  },
  "createdAt": "2026-02-04T00:33:00.000Z",
  "lastMessageAt": "2026-02-04T00:35:10.000Z"
}
```

---

## Criterios de Aceptacion

### 5.1 Logger Mejorado
- [ ] Los logs se guardan como JSON en `logs/enhanced/`
- [ ] Cada log contiene metadata completa de scraping
- [ ] Los flags de mensajes (saidNoInfo, possibleHallucination) se capturan
- [ ] El score de calidad se calcula automaticamente
- [ ] Backward compatibility: funciones legacy siguen funcionando

### 5.2 Dashboard (Opcional)
- [ ] Tabla muestra todas las empresas probadas
- [ ] Score de calidad visible por empresa
- [ ] Filtros funcionan correctamente
- [ ] Click en empresa muestra detalle de conversacion

---

## Riesgos y Mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigacion |
|--------|--------------|---------|------------|
| Logs JSON muy grandes | Media | Bajo | Limitar rawText a 1000 chars, no guardar systemPrompt |
| Migracion de logs existentes | Baja | Bajo | Mantener formato legacy, solo nuevos logs en JSON |
| Performance al escribir JSON | Baja | Bajo | Escribir async, no bloquear response |

---

## Testing

```bash
# Test unitario del logger
npx ts-node -e "
import { createEnhancedLog, appendEnhancedMessage, calculateConversationQuality } from './src/lib/conversation-logger';

const log = createEnhancedLog({
  sessionId: 'test-123',
  companyName: 'Test Company',
  companyUrl: 'https://test.com',
  constructoraType: 'modular',
  scrapingMetadata: {
    method: 'firecrawl',
    duration: 5000,
    modelsFound: 3,
    whatsappFound: true,
    instagramFound: false,
  }
});

console.log('Log creado:', log);
console.log('Calidad:', calculateConversationQuality(log));
"

# Verificar formato de archivo
cat logs/enhanced/test-123.json | jq .
```

---

## Siguiente Paso

Una vez completada la Fase 5:
1. Ejecutar QA con las 20 empresas de test
2. Analizar logs JSON para identificar patrones de fallo
3. Comparar con baseline de Fase 1
4. Proceder a Fase 6 (QA Final y Comparativa)

---

## Notas de Implementacion

### Captura de Metadata de Scraping

El archivo `src/lib/scraper.ts` ya tiene logs de consola con la informacion necesaria:
```
[Scraper] Starting scrape for: URL
[Scraper] Firecrawl success! Models: N
[Firecrawl] Homepage scrape completed in Xms
```

Se debe modificar `scrapeWebsite()` para retornar metadata adicional:

```typescript
interface ScrapingResult {
  content: ScrapedContent;
  metadata: {
    method: 'firecrawl' | 'playwright' | 'fetch' | 'vision' | 'mixed';
    duration: number;
    pagesScraped: number;
  };
}
```

### Backward Compatibility

Mantener las funciones existentes:
- `logConversation()` - llama internamente a createEnhancedLog + saveEnhancedLog
- `appendMessageToLog()` - llama internamente a appendEnhancedMessage

Esto asegura que el codigo existente no se rompa durante la migracion.
