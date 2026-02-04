# Plan de Testing Robusto - Constructor AI Simulator

## Análisis de Conversaciones ViBert - Patrones Identificados

### Preguntas Más Frecuentes de Clientes Reales

Analicé las conversaciones de ViBert y extraje los patrones de preguntas más comunes. Las organicé en categorías:

---

## 15 Preguntas Base para Testing

### Categoría 1: INFORMACIÓN BÁSICA (obligatorias)
| # | Pregunta | Objetivo de Verificación |
|---|----------|-------------------------|
| 1 | "Hola, qué modelos de casas tienen disponibles?" | ¿Menciona modelos específicos con nombres? |
| 2 | "Cuánto cuesta aproximadamente el modelo más económico?" | ¿Da un rango de precios o dice que no tiene? |
| 3 | "Qué superficie tiene el modelo más grande?" | ¿Conoce los m² de sus modelos? |

### Categoría 2: PROCESO DE CONSTRUCCIÓN
| # | Pregunta | Objetivo de Verificación |
|---|----------|-------------------------|
| 4 | "Cuánto tiempo demora la construcción?" | ¿Da un estimado razonable (días/meses)? |
| 5 | "Qué incluye la obra gris?" | ¿Explica qué viene incluido y qué no? |
| 6 | "El precio incluye las terminaciones o van aparte?" | ¿Distingue obra gris de terminaciones? |

### Categoría 3: COBERTURA Y LOGÍSTICA
| # | Pregunta | Objetivo de Verificación |
|---|----------|-------------------------|
| 7 | "Construyen en [provincia/ciudad]?" | ¿Conoce su área de cobertura? |
| 8 | "Hacen envíos a todo el país?" | ¿Sabe dónde pueden entregar/construir? |

### Categoría 4: FINANCIAMIENTO
| # | Pregunta | Objetivo de Verificación |
|---|----------|-------------------------|
| 9 | "Qué formas de pago tienen?" | ¿Menciona opciones de financiación? |
| 10 | "Trabajan con créditos hipotecarios?" | ¿Sabe si aceptan créditos bancarios? |

### Categoría 5: PERSONALIZACIÓN
| # | Pregunta | Objetivo de Verificación |
|---|----------|-------------------------|
| 11 | "Puedo modificar el diseño de un modelo?" | ¿Permite customización? |
| 12 | "Hacen proyectos a medida o solo los del catálogo?" | ¿Trabajan con diseños personalizados? |

### Categoría 6: TÉCNICAS/ESPECÍFICAS
| # | Pregunta | Objetivo de Verificación |
|---|----------|-------------------------|
| 13 | "De qué material están hechas las casas?" | ¿Conoce el sistema constructivo? |
| 14 | "Qué garantía ofrecen?" | ¿Menciona garantía o no tiene info? |
| 15 | "Ya tengo un plano hecho, pueden construirlo?" | ¿Acepta proyectos con plano del cliente? |

---

## Preguntas Adicionales (Específicas por Empresa)

Estas se agregan si la empresa tiene características particulares:

### Si tiene PRECIOS publicados:
- "El modelo X de $XX.XXX incluye IVA?"
- "Ese precio es con o sin platea?"

### Si tiene QUINCHOS:
- "Qué modelos de quinchos tienen?"
- "El quincho viene con parrilla incluida?"

### Si trabaja con CONTAINERS:
- "Cuántos contenedores necesito para una casa de 3 dormitorios?"
- "El container viene aislado térmicamente?"

### Si es de CHILE (preguntas en chileno):
- "Construyen en la Región Metropolitana?"
- "Trabajan con subsidio DS49?"

### Si es de MÉXICO:
- "Construyen en CDMX o solo en el interior?"
- "El precio es en pesos mexicanos o dólares?"

---

## Matriz de Testing: 10 Empresas

### Distribución de Preguntas

En lugar de hacer las 15 preguntas a todas las empresas, vamos a rotar para maximizar cobertura:

| Empresa | Categoría 1 | Categoría 2 | Categoría 3 | Categoría 4 | Categoría 5 | Categoría 6 |
|---------|-------------|-------------|-------------|-------------|-------------|-------------|
| Empresa 1 | 1, 2, 3 | 4, 5 | 7 | 9 | 11 | 13 |
| Empresa 2 | 1, 2, 3 | 4, 6 | 8 | 10 | 12 | 14 |
| Empresa 3 | 1, 2, 3 | 5, 6 | 7 | 9 | 11 | 15 |
| Empresa 4 | 1, 2, 3 | 4, 5 | 8 | 10 | 12 | 13 |
| Empresa 5 | 1, 2, 3 | 4, 6 | 7 | 9 | 11 | 14 |
| Empresa 6 | 1, 2, 3 | 5, 6 | 8 | 10 | 12 | 15 |
| Empresa 7 | 1, 2, 3 | 4, 5 | 7 | 9 | 11 | 13 |
| Empresa 8 | 1, 2, 3 | 4, 6 | 8 | 10 | 12 | 14 |
| Empresa 9 | 1, 2, 3 | 5, 6 | 7 | 9 | 11 | 15 |
| Empresa 10 | 1, 2, 3 | 4, 5 | 8 | 10 | 12 | 13 |

**Total**: 8 preguntas por empresa, 80 interacciones en total

---

## Criterios de Evaluación

### Para cada respuesta, evaluar:

| Criterio | Peso | Descripción |
|----------|------|-------------|
| **Precisión** | 30% | ¿La info es específica de la empresa o genérica? |
| **Coherencia** | 25% | ¿No inventa datos que no tiene? |
| **Naturalidad** | 20% | ¿Suena como una persona real? |
| **Seguimiento** | 15% | ¿Hace preguntas para calificar al lead? |
| **Honestidad** | 10% | ¿Dice "no tengo esa info" cuando no la tiene? |

### Calificación por Empresa:
- **EXCELENTE** (90-100%): Responde todo con datos específicos
- **BUENO** (70-89%): Responde la mayoría, falla en algunos detalles
- **REGULAR** (50-69%): Respuestas genéricas, poca info específica
- **MALO** (<50%): Inventa datos, respuestas incorrectas

---

## Empresas a Testear (Lote de 10)

### Selección diversa por país y tamaño de catálogo:

| # | Empresa | País | URL | Catálogo Esperado |
|---|---------|------|-----|-------------------|
| 1 | T1 Modular | Argentina | t1modular.com.ar | Mediano |
| 2 | GoHome | Argentina | gohomeconstrucciones.com.ar | Mediano |
| 3 | Boxer Containers | Argentina | boxercontainers.com.ar | Containers |
| 4 | Casa Simple | Uruguay | casasimple.uy | Pequeño |
| 5 | Enkasa | Colombia | enkasa.com.co | Mediano |
| 6 | BlockHouse Chile | Chile | blockhouse-chile.com | Pequeño |
| 7 | Promet | Chile | promet.cl | Grande |
| 8 | SmartPod | México | smartpod.mx | Pequeño |
| 9 | Fincah | México | fincah.com | Mediano |
| 10 | VMD | México | vmd.com.mx | Grande |

---

## Métricas de Éxito

### Para considerar el sistema "listo para producción":

1. **Tiempo de scraping**: 100% de empresas < 3 minutos
2. **Precisión de respuestas**: 80% de empresas con calificación BUENO o mejor
3. **Sin invención de datos**: 0% de casos donde invente modelos/precios falsos
4. **Calificación de leads**: 70% de conversaciones incluyen preguntas de seguimiento

---

## Próximos Pasos

1. [ ] Ejecutar testing de 10 empresas con preguntas rotadas
2. [ ] Documentar resultados en tabla de análisis
3. [ ] Identificar patrones de fallas
4. [ ] Ajustar prompt-generator.ts si hay fallas sistemáticas
5. [ ] Re-testear empresas que fallaron
6. [ ] Implementar medidas de seguridad
7. [ ] Configurar dominio personalizado
