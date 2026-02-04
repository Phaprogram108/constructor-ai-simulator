# Plan de Implementacion: Testing de 16 Empresas Constructoras

## Resumen

Este plan detalla como ejecutar testing sistematico de 16 empresas constructoras argentinas usando el Constructor AI Simulator. El objetivo es evaluar la calidad del scraping con Firecrawl y la capacidad del agente Sofia para responder preguntas especificas sobre modelos, precios y servicios.

**Tiempo estimado**: 2-3 horas (scraping ~3 min/empresa + chat ~2 min/empresa)
**Creditos Firecrawl estimados**: ~480 creditos (30 creditos x 16 empresas)

---

## Fases de Ejecucion

### Fase 0: Preparacion del Entorno
**Dependencias**: Ninguna
**Tiempo estimado**: 5 minutos

**Tareas**:
1. [ ] Verificar que el servidor Next.js este corriendo (`npm run dev`)
2. [ ] Confirmar creditos disponibles en Firecrawl (necesarios ~500)
3. [ ] Crear directorio para resultados: `/docs/testing-results/`
4. [ ] Verificar API keys configuradas (FIRECRAWL_API_KEY, ANTHROPIC_API_KEY)

**Comandos**:
```bash
cd /Users/joaquingonzalez/Documents/dev/constructor-ai-simulator
npm run dev  # En terminal separada
mkdir -p docs/testing-results
```

---

### Fase 1: Actualizar Fixtures de Test
**Dependencias**: Fase 0
**Tiempo estimado**: 10 minutos
**Archivos a modificar**:
- `/tests/e2e/fixtures/test-companies.json` - Reemplazar con las 16 empresas

**Tareas**:
1. [ ] Actualizar `test-companies.json` con las 16 empresas del analisis
2. [ ] Agregar metadatos de cada empresa (URL, notas, comportamiento esperado)

**Nuevo contenido para `test-companies.json`**:
```json
{
  "companies": [
    {
      "id": "ecomod",
      "name": "Ecomod",
      "websiteUrl": "https://ecomod.com.ar/",
      "pdfUrl": null,
      "expectedBehavior": "Casas modulares eco-friendly",
      "notes": "Verificar modelos Eco Studio, Turistico, Eco Mini"
    },
    {
      "id": "lista",
      "name": "Lista",
      "websiteUrl": "https://lista.com.ar/",
      "pdfUrl": null,
      "expectedBehavior": "Constructora con catalogo online",
      "notes": "Empresa conocida, deberia tener buena info"
    },
    {
      "id": "movilhauss",
      "name": "Movilhauss",
      "websiteUrl": "https://movilhauss.com",
      "pdfUrl": null,
      "expectedBehavior": "Casas moviles/modulares",
      "notes": "Verificar modelos y precios"
    },
    {
      "id": "plugarq",
      "name": "PlugArq",
      "websiteUrl": "https://www.plugarq.com/",
      "pdfUrl": null,
      "expectedBehavior": "Arquitectura modular",
      "notes": "Estilo arquitectonico moderno"
    },
    {
      "id": "habika",
      "name": "Habika",
      "websiteUrl": "https://habika.ar/",
      "pdfUrl": null,
      "expectedBehavior": "Viviendas modulares",
      "notes": "Verificar catalogo de modelos"
    },
    {
      "id": "arcohouse",
      "name": "Arcohouse",
      "websiteUrl": "https://arcohouse.com.ar/",
      "pdfUrl": null,
      "expectedBehavior": "Steel frame construction",
      "notes": "Verificar metodo constructivo"
    },
    {
      "id": "atlas-housing",
      "name": "Atlas Housing",
      "websiteUrl": "https://atlashousing.com.ar/",
      "pdfUrl": null,
      "expectedBehavior": "Viviendas industrializadas",
      "notes": "Empresa grande, multiples modelos"
    },
    {
      "id": "lucys-house",
      "name": "Lucys House",
      "websiteUrl": "https://www.lucyshousearg.com/",
      "pdfUrl": null,
      "expectedBehavior": "Tiny houses / casas pequenas",
      "notes": "Nicho especifico de casas chicas"
    },
    {
      "id": "sienna-modular",
      "name": "Sienna Modular",
      "websiteUrl": "https://www.siennamodular.com.ar/",
      "pdfUrl": null,
      "expectedBehavior": "Construccion modular",
      "notes": "Verificar linea de productos"
    },
    {
      "id": "offis",
      "name": "Offis",
      "websiteUrl": "https://www.offis.ar/",
      "pdfUrl": null,
      "expectedBehavior": "Oficinas y espacios modulares",
      "notes": "Puede tener foco en oficinas"
    },
    {
      "id": "efede",
      "name": "Efede Casas Modulares",
      "websiteUrl": "https://efede.com.ar/casas-modulares/",
      "pdfUrl": null,
      "expectedBehavior": "Casas modulares especializadas",
      "notes": "URL especifica de modulo casas"
    },
    {
      "id": "minicasas",
      "name": "Mini Casas",
      "websiteUrl": "https://www.minicasas.com.ar/",
      "pdfUrl": null,
      "expectedBehavior": "Tiny houses / mini casas",
      "notes": "Foco en casas pequenas"
    },
    {
      "id": "wellmod",
      "name": "Wellmod",
      "websiteUrl": "https://www.wellmod.com.ar/",
      "pdfUrl": null,
      "expectedBehavior": "Construccion modular wellness",
      "notes": "Verificar linea de productos"
    },
    {
      "id": "grupo-steimberg",
      "name": "Grupo Steimberg",
      "websiteUrl": "https://www.gruposteimberg.com/",
      "pdfUrl": null,
      "expectedBehavior": "Grupo constructor diversificado",
      "notes": "Empresa grande, verificar alcance"
    },
    {
      "id": "aftamantes",
      "name": "Aftamantes Refugios",
      "websiteUrl": "https://aftamantes.net/refugios/",
      "pdfUrl": null,
      "expectedBehavior": "Refugios y cabanas",
      "notes": "Nicho especifico de refugios"
    },
    {
      "id": "arqtainer",
      "name": "Arqtainer",
      "websiteUrl": "https://arqtainer.com.ar/",
      "pdfUrl": null,
      "expectedBehavior": "Casas container",
      "notes": "Construccion con containers"
    }
  ]
}
```

---

### Fase 2: Ejecutar Testing Automatizado con Playwright
**Dependencias**: Fase 1
**Tiempo estimado**: 90-120 minutos (automatico)
**Archivos que genera**:
- `/tests/e2e/results/[timestamp]/[company-id]/conversation.json`
- `/tests/e2e/results/[timestamp]/[company-id]/evaluation.json`
- `/tests/e2e/results/[timestamp]/[company-id]/screenshots/*.png`

**Tareas**:
1. [ ] Ejecutar batch test runner para todas las empresas
2. [ ] Monitorear progreso en terminal
3. [ ] Guardar screenshots de errores si los hay

**Comandos**:
```bash
# Opcion A: Ejecutar tests en modo headless (recomendado)
npx ts-node tests/e2e/run-batch-test.ts --companies 16

# Opcion B: Ejecutar con browser visible para debug
npx ts-node tests/e2e/run-batch-test.ts --companies 16 --headed

# Opcion C: Ejecutar Playwright directamente
npx playwright test --config=tests/e2e/playwright.config.ts
```

**Nota**: El test automatizado ya hace:
- Scraping de cada empresa (~3 min)
- Envio de 6 preguntas estandar
- Screenshots despues de cada respuesta
- Evaluacion de calidad de respuestas
- Generacion de report

---

### Fase 3: Testing Manual Complementario (Opcional)
**Dependencias**: Fase 2 completada o en paralelo
**Tiempo estimado**: 30 minutos
**Para**: Empresas que fallen el test automatizado o casos especiales

**Preguntas estandar a usar manualmente**:
1. "Que modelos tienen?" - Esperar lista con m2 y dormitorios
2. "Cuanto cuesta el modelo mas chico?" - Esperar precio o pedido de ubicacion
3. "Construyen en Cordoba?" - Esperar respuesta sobre zonas
4. "Que incluye la obra gris?" - Esperar detalle de inclusiones
5. "Tienen financiamiento?" - Esperar opciones de pago

**Proceso manual**:
1. Ir a http://localhost:3000
2. Ingresar URL de la empresa
3. Esperar scraping (~3 min)
4. Enviar las 5 preguntas
5. Copiar conversacion del archivo en `/logs/conversations/`

---

### Fase 4: Consolidar Conversaciones
**Dependencias**: Fases 2 y 3
**Tiempo estimado**: 15 minutos
**Archivos a crear**:
- `/docs/ANALISIS-CONVERSACIONES.md` - Documento consolidado

**Tareas**:
1. [ ] Ejecutar script de consolidacion (crear si no existe)
2. [ ] Revisar y formatear documento final
3. [ ] Agregar metricas de resumen

**Script de consolidacion** (crear en `/scripts/consolidar-conversaciones.ts`):
```typescript
import * as fs from 'fs';
import * as path from 'path';

const LOGS_DIR = './logs/conversations';
const OUTPUT_FILE = './docs/ANALISIS-CONVERSACIONES.md';

// Lista de empresas en orden
const EMPRESAS = [
  'Ecomod', 'Lista', 'Movilhauss', 'PlugArq', 'Habika', 'Arcohouse',
  'Atlas Housing', 'Lucys House', 'Sienna', 'Offis', 'EFEDE',
  'Mini Casas', 'Wellmod', 'Grupo Steimberg', 'AFT Amantes', 'Arqtainer'
];

function main() {
  let output = `# Analisis de Conversaciones - 16 Empresas Constructoras\n\n`;
  output += `Fecha de generacion: ${new Date().toISOString()}\n\n`;
  output += `---\n\n`;

  const files = fs.readdirSync(LOGS_DIR)
    .filter(f => f.endsWith('.txt'))
    .sort();

  let totalEmpresas = 0;
  let empresasConModelos = 0;

  for (const empresa of EMPRESAS) {
    const matchingFiles = files.filter(f =>
      f.toLowerCase().includes(empresa.toLowerCase().replace(/\s+/g, '_'))
    );

    if (matchingFiles.length > 0) {
      totalEmpresas++;
      // Usar el archivo mas reciente
      const latestFile = matchingFiles[matchingFiles.length - 1];
      const content = fs.readFileSync(path.join(LOGS_DIR, latestFile), 'utf-8');

      output += `## ${empresa}\n\n`;
      output += `\`\`\`\n${content}\n\`\`\`\n\n`;

      // Detectar si menciona modelos especificos
      if (content.match(/\d+\s*m[²2]/i)) {
        empresasConModelos++;
      }

      output += `---\n\n`;
    }
  }

  // Agregar resumen al inicio
  const resumen = `## Resumen Ejecutivo\n\n`;
    + `- **Empresas testeadas**: ${totalEmpresas}/16\n`
    + `- **Empresas con modelos especificos**: ${empresasConModelos}\n`
    + `- **Tasa de exito**: ${Math.round(empresasConModelos/totalEmpresas*100)}%\n\n`;

  output = output.replace('---\n\n', resumen + '---\n\n');

  fs.writeFileSync(OUTPUT_FILE, output);
  console.log(`Documento generado: ${OUTPUT_FILE}`);
}

main();
```

---

### Fase 5: Generar Analisis Final
**Dependencias**: Fase 4
**Tiempo estimado**: 20 minutos
**Archivos a crear**:
- `/docs/REPORTE-FINAL-TESTING.md` - Analisis con conclusiones

**Estructura del reporte final**:

```markdown
# Reporte Final - Testing 16 Empresas

## Resumen Ejecutivo
- Total empresas testeadas: X/16
- Empresas con scraping exitoso: X
- Empresas con modelos detectados: X
- Calidad promedio de respuestas: X/100

## Metricas por Pregunta

| Pregunta | Exito | Respuesta Especifica | Respuesta Generica |
|----------|-------|---------------------|-------------------|
| Modelos  | X%    | X                   | X                 |
| Precios  | X%    | X                   | X                 |
| Ubicacion| X%    | X                   | X                 |
| Obra gris| X%    | X                   | X                 |
| Financ.  | X%    | X                   | X                 |

## Clasificacion de Empresas

### Tier 1: Excelente (Score >80)
- Empresa A: X modelos detectados
- ...

### Tier 2: Bueno (Score 60-80)
- ...

### Tier 3: Regular (Score 40-60)
- ...

### Tier 4: Problematico (Score <40)
- Empresa X: Problema identificado
- ...

## Problemas Comunes Detectados
1. Sitios sin catalogo de modelos
2. Precios no publicados
3. Estructura de web no estandar

## Recomendaciones
1. Mejorar parser de markdown para sitios tipo X
2. Agregar soporte para PDFs de catalogo
3. ...
```

---

## Tracks Paralelos

```
Track A (Automatizado):
  Fase 1 -> Fase 2 (Playwright tests)
           |
           v
        Fase 4 (Consolidar)
           |
           v
        Fase 5 (Analisis)

Track B (Manual - Opcional):
  Fase 3 (Testing manual de empresas problematicas)
           |
           v
        Fase 4 (Se une al consolidado)
```

**Fases que pueden ejecutarse en paralelo**:
- Fase 2 y Fase 3 pueden correr simultaneamente si hay 2 personas
- La consolidacion (Fase 4) espera que terminen ambas

---

## Riesgos y Mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigacion |
|--------|--------------|---------|------------|
| Sitio web caido | Media | Alto | Reintentar al dia siguiente |
| Rate limit Firecrawl | Baja | Alto | Espaciar requests, usar modo filtrado |
| Scraping timeout | Media | Medio | Reintentar con exhaustive=false |
| Sitio bloquea scraping | Baja | Alto | Usar catalogo PDF como fallback |
| Respuestas muy genericas | Alta | Medio | Mejorar system prompt |

---

## Criterios de Exito

1. **Minimo**: 12/16 empresas testeadas exitosamente
2. **Target**: Todas las empresas testeadas con documento consolidado
3. **Excelente**: Reporte con metricas y recomendaciones accionables

### Metricas de Calidad por Respuesta

| Calidad | Descripcion | Ejemplo |
|---------|-------------|---------|
| Excelente | Menciona modelos especificos con m2, dorms, precio | "Casa Sara de 65m2, 2 dorms, USD 45.000" |
| Buena | Menciona modelos pero sin todos los datos | "Casa Sara de 65m2" |
| Regular | Responde pero de forma generica | "Tenemos varios modelos de diferentes tamanos" |
| Mala | No responde o dice que no tiene info | "No tengo esa informacion" |

---

## Siguiente Paso

Una vez completado este plan:
1. Usar `@coder` para implementar Fase 1 (actualizar fixtures)
2. Ejecutar Fase 2 manualmente (batch tests)
3. Usar `@coder` para crear script de consolidacion si es necesario
4. Revisar resultados y generar reporte final

---

## Archivos Clave del Proyecto

| Archivo | Proposito |
|---------|-----------|
| `/tests/e2e/fixtures/test-companies.json` | Lista de empresas a testear |
| `/tests/e2e/fixtures/test-questions.json` | Preguntas estandar (ya existe) |
| `/tests/e2e/run-batch-test.ts` | Runner de tests automatizados |
| `/logs/conversations/*.txt` | Conversaciones guardadas automaticamente |
| `/src/lib/firecrawl.ts` | Logica de scraping |
| `/src/lib/conversation-logger.ts` | Logger de conversaciones |

---

## Comandos Rapidos

```bash
# Iniciar servidor de desarrollo
npm run dev

# Ejecutar todos los tests
npx playwright test --config=tests/e2e/playwright.config.ts

# Ejecutar con runner personalizado
npx ts-node tests/e2e/run-batch-test.ts

# Ver logs de conversaciones
ls -la logs/conversations/

# Consolidar conversaciones (despues de crear el script)
npx ts-node scripts/consolidar-conversaciones.ts
```
