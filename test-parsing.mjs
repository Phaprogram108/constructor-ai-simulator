// Test del parsing de modelos desde markdown de ViBert
const markdown = `
##### Modelo de Casa Sara   -   2 personas   65.55 m2 TOTALES   Estar-comedor | 1 dormitorio | Cocina | 1 baño

## [VER FICHA](https://www.vibert.com.ar/casa-sara)

##### Modelo de Casa Daniela   -   5 personas   79.45 m2 TOTALES   Estar-comedor | 2 dormitorios | Cocina | 1 baño

##### Modelo de Casa Justina   -   4 personas   87.94 m2 TOTALES   Estar-comedor | 2 dormitorios | Cocina | 1 baño

##### Modelo de Casa Dora   -  2 personas  55.82 m2 TOTALES  Estar-comedor | 1 dormitorio | Cocina | 1 baño

##### Modelo de Casa Micaela   -  4 personas  76.50 m2 TOTALES  Estar-comedor | 2 dormitorios | Cocina | 1 baño

##### Modelo de Casa Estefanía   -  4 personas  96.20 m2 TOTALES  Estar-comedor | 2 dormitorios | Cocina | 1 baño

##### Modelo de Casa Carmela   -  4 personas  67.78 m2 TOTALES  Estar-comedor | 2 dormitorios | Cocina | 1 baño

##### Modelo de Casa Selene   -  4 personas  82.40 m2 TOTALES  Estar-comedor | 2 dormitorios | Cocina | 1 baño

##### Modelo de Casa Valeria   -  6 personas  97.65 m2 TOTALES  Estar-comedor | 3 dormitorios | Cocina | 2 baños

##### Modelo de Casa María   -   6 personas   110.98 m2 TOTALES   Estar-comedor | 3 dormitorios | Cocina | 2 baños

##### Modelo de Quincho S   -   27,50 m2 TOTALES   Cocina-comedor | Galería | 1 baño

##### Modelo de Quincho M   -  47,48 m2 TOTALES  Cocina-comedor | Galería | 1 baño

##### Modelo de Quincho L   -  58,00 m2 TOTALES  Cocina-comedor | Galería | 1 baño

##### Modelo de Quincho A   -   68,00 m2 TOTALES  Cocina-comedor | Galería | 1 baño
`;

function parseModelsFromMarkdown(markdown) {
  const models = [];

  // Patrones para detectar modelos de casas/quinchos
  const modelPatterns = [
    // Patrón ViBert Casas: "Modelo de Casa Sara - 2 personas 65.55 m2 TOTALES"
    /Modelo de Casa\s+([A-Za-záéíóúñÁÉÍÓÚÑ]+)\s*[-–]\s*\d+\s*personas?\s+(\d+[.,]?\d*)\s*m2/gi,
    // Patrón ViBert Quinchos: "Modelo de Quincho S - 27,50 m2 TOTALES" (sin personas)
    /Modelo de (Quincho\s+[A-Za-záéíóúñÁÉÍÓÚÑ]+)\s*[-–]\s*(\d+[.,]?\d*)\s*m2/gi,
    // Patrón genérico: "Casa/Vivienda X - 100m² - 3 dormitorios" (excluir quinchos ya capturados)
    /(?:Casa|Vivienda)\s+([A-Za-záéíóúñÁÉÍÓÚÑ0-9\s\-]+?)\s*[-–|]\s*(\d+[.,]?\d*)\s*m[²2]/gi,
  ];

  // Buscar con cada patrón
  for (const pattern of modelPatterns) {
    let match;
    while ((match = pattern.exec(markdown)) !== null) {
      const name = match[1]?.trim();
      if (name && name.length > 0 && name.length < 50) {
        // Evitar duplicados - solo si el nombre es casi idéntico (no substring match)
        const nameLower = name.toLowerCase();
        const exists = models.some(m => {
          const existingLower = m.name.toLowerCase();
          // Considerar duplicado solo si:
          // 1. Son exactamente iguales
          // 2. Uno contiene al otro Y la diferencia de longitud es menor a 3 caracteres
          if (existingLower === nameLower) return true;
          if (existingLower.includes(nameLower) && Math.abs(existingLower.length - nameLower.length) < 3) return true;
          if (nameLower.includes(existingLower) && Math.abs(nameLower.length - existingLower.length) < 3) return true;
          return false;
        });
        if (!exists) {
          const model = { name, category: 'casa' };

          // Extraer metros cuadrados
          const sqmMatch = markdown.match(new RegExp(name + '[^]*?(\\d+[.,]?\\d*)\\s*m[²2]', 'i'));
          if (sqmMatch) {
            model.squareMeters = parseFloat(sqmMatch[1].replace(',', '.'));
          } else if (match[2]) {
            model.squareMeters = parseFloat(match[2].replace(',', '.'));
          }

          // Extraer dormitorios
          const bedroomMatch = markdown.match(new RegExp(name + '[^]*?(\\d+)\\s*(?:dormitorio|dorm|habitacion)', 'i'));
          if (bedroomMatch) {
            model.bedrooms = parseInt(bedroomMatch[1]);
          }

          // Extraer baños
          const bathMatch = markdown.match(new RegExp(name + '[^]*?(\\d+)\\s*(?:baño|bano|bath)', 'i'));
          if (bathMatch) {
            model.bathrooms = parseInt(bathMatch[1]);
          }

          // Extraer precio SOLO si aparece explícitamente cerca del nombre
          const priceMatch = markdown.match(new RegExp(name + '[^]{0,100}(?:U\\$?D|USD|\\$)\\s*([\\d.,]+)', 'i'));
          if (priceMatch) {
            model.price = `USD ${priceMatch[1]}`;
          }
          // NO inventar precio si no existe

          // Detectar si es quincho
          if (name.toLowerCase().includes('quincho') || markdown.toLowerCase().includes(`quincho ${name.toLowerCase()}`)) {
            model.category = 'quincho';
          }

          models.push(model);
        }
      }
    }
  }

  return models;
}

console.log("=== TEST PARSING VIBERT ===\n");
const models = parseModelsFromMarkdown(markdown);
console.log("Modelos encontrados:", models.length);
console.log("\n--- DETALLE ---");
models.forEach((m, i) => {
  console.log(`${i+1}. ${m.name} - ${m.squareMeters}m² - ${m.bedrooms || '?'} dorm - ${m.bathrooms || '?'} baños - ${m.price || 'SIN PRECIO'} [${m.category}]`);
});

// Verificar que NO haya precios inventados
const withPrices = models.filter(m => m.price);
console.log("\n--- PRECIOS ---");
console.log(`Modelos con precio: ${withPrices.length} (debería ser 0 porque ViBert NO tiene precios en el web)`);
if (withPrices.length > 0) {
  console.log("ERROR: Se inventaron precios!");
  withPrices.forEach(m => console.log(`  - ${m.name}: ${m.price}`));
} else {
  console.log("OK: No se inventaron precios");
}
