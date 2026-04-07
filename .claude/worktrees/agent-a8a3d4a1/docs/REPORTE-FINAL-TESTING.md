# Reporte Final - Testing 16 Empresas Constructoras

**Fecha:** 2026-02-04
**Empresas testeadas:** 14/16
**Creditos Firecrawl usados:** ~420

---

## Resumen Ejecutivo

| Metrica | Valor |
|---------|-------|
| Empresas testeadas | 14/16 |
| Con modelos especificos (m2) | 8 (57%) |
| Con precios detectados | 2 (14%) |
| Respuestas genericas | 6 (43%) |

**Conclusion:** El sistema funciona bien para empresas con catalogos estructurados. Hay oportunidad de mejora en la extraccion de precios y en el manejo de empresas sin catalogo fijo.

---

## Clasificacion de Empresas por Calidad

### Tier 1: Excelente (2 empresas)
Respuestas con modelos especificos Y precios.

| Empresa | Modelos | Precios | Ejemplo |
|---------|---------|---------|---------|
| **Arcohouse** | 5 refugios | ARS $41.5M - $121.5M | "Montanesito 20m2 ARS $41.500.000" |
| **Aftamantes** | 4 modulos | USD $91.000 | "Casa Compacta 70m2 U$S 91.000" |

### Tier 2: Bueno (6 empresas)
Respuestas con modelos especificos pero SIN precios.

| Empresa | Modelos extraidos | Ejemplo de respuesta |
|---------|-------------------|----------------------|
| **Ecomod** | 6 modelos | "Eco Studio 11.5m2, Turistico 25m2, Eco Mini 30m2" |
| **Movilhauss** | 6 modelos | "Inquba Tiny 19.2m2, Inquba Plus 32m2" |
| **Atlas Housing** | 7 modelos | "Katerra 60m2, Upsala 41m2, Fitz Roy 41m2" |
| **Offis** | 12 modelos | "Offis STUDIO 12.25m2, SLIM 15.25m2, FAMILY 18.13m2" |
| **Efede** | 6 modelos | "MHZ 32m2, MC1 29m2, MZB2 54m2" |
| **Wellmod** | Multiples | "Modulos 20m2 combinables" |

### Tier 3: Regular (6 empresas)
Respuestas sin modelos especificos con m2.

| Empresa | Problema identificado |
|---------|----------------------|
| **Lista** | Menciona modelos (Maca S, M, L) pero NO extrae m2 |
| **PlugArq** | No tiene catalogo fijo, diseno personalizado |
| **Lucys House** | No tiene catalogo fijo, diseno personalizado |
| **Sienna** | Solo menciona "Casa Dora" sin especificaciones |
| **Grupo Steimberg** | Menciona modelos (Cabin 28, 70) pero NO extrae m2 |
| **Arqtainer** | Dice "dejame consultarlo" - NO tiene datos |

### Tier 4: No testeadas (2 empresas)
- **Habika** - Pendiente de testing
- **Mini Casas** - Sitio muy simple (3 URLs)

---

## Analisis de Problemas Detectados

### Problema 1: Empresas sin catalogo fijo (3 casos)
**Afectados:** PlugArq, Lucys House, parcialmente Arqtainer

**Sintoma:** El agente responde "disenamos segun los m2 que vos necesitas" sin dar ejemplos concretos.

**Causa:** Estas empresas trabajan con diseno 100% personalizado, no tienen modelos predefinidos.

**Solucion propuesta:**
1. Detectar este patron durante el scraping
2. Cambiar el prompt para que el agente pregunte "Cuantos m2 y dormitorios buscas?" en lugar de intentar listar modelos
3. Agregar flag `hasFixedCatalog: false` en la sesion

### Problema 2: Modelos sin m2 extraidos (2 casos)
**Afectados:** Lista, Grupo Steimberg

**Sintoma:** El agente menciona nombres de modelos (Maca S, M, L / Cabin 28, 70) pero no los m2.

**Causa:** El scraping extrae los nombres pero no encuentra los m2 en la estructura del sitio.

**Solucion propuesta:**
1. Mejorar el schema de Zod para buscar patrones como "Modelo X - XX m2"
2. Agregar parsing de markdown para extraer numeros seguidos de "m2" o "metros"
3. Si no hay m2, buscar en PDFs de catalogo

### Problema 3: Precios no extraidos (12 de 14 casos)
**Afectados:** Casi todas excepto Arcohouse y Aftamantes

**Sintoma:** El agente da informacion de modelos pero dice "los precios dependen de..." o simplemente no los menciona.

**Causa:**
- Muchas empresas no publican precios en la web
- Precios estan en PDFs o formularios de contacto
- Precios dinamicos segun ubicacion/tiempo

**Solucion propuesta:**
1. Agregar extraccion de PDFs de catalogo (ya existe pero no se usa consistentemente)
2. Entrenar al agente para que diga "Para precios actualizados, podes contactarnos por WhatsApp"
3. Agregar campo `pricesAvailable: boolean` en la sesion

### Problema 4: Respuesta "dejame consultarlo" (1 caso)
**Afectados:** Arqtainer

**Sintoma:** El agente dice "dejame consultarlo con el equipo tecnico"

**Causa:** El scraping no extrajo ningun modelo y el prompt no tiene datos para responder.

**Solucion propuesta:**
1. Detectar cuando `models.length === 0` despues del scraping
2. En esos casos, el agente debe admitir que no tiene el catalogo y ofrecer WhatsApp directo
3. NO inventar que va a "consultar" porque es un bot, no puede hacer eso

---

## Metricas por Tipo de Pregunta

Basado en la pregunta estandar "Que modelos tienen?":

| Tipo de Respuesta | Cantidad | Porcentaje |
|-------------------|----------|------------|
| Lista modelos con m2 | 8 | 57% |
| Lista modelos sin m2 | 4 | 29% |
| No tiene catalogo fijo | 2 | 14% |

---

## Recomendaciones de Mejora

### Prioridad Alta

1. **Mejorar extraccion de precios**
   - Scraping mas agresivo de paginas de precios/cotizacion
   - Buscar patrones: "$", "USD", "ARS", "pesos", numeros grandes
   - Extraccion de PDFs de catalogo

2. **Manejar empresas sin catalogo**
   - Detectar patron "diseno personalizado" en el texto
   - Cambiar comportamiento del agente para esas empresas
   - Prompt alternativo que pregunta requerimientos

3. **Eliminar respuesta "dejame consultarlo"**
   - Es enganoso para el usuario
   - Reemplazar con "No tengo esa informacion, pero podes escribirnos por WhatsApp"

### Prioridad Media

4. **Mejorar extraccion de m2 de modelos mencionados**
   - Regex mas completo: `/(\d+(?:[.,]\d+)?)\s*m[2]/gi`
   - Buscar en contexto cercano al nombre del modelo
   - Fallback a descripcion si no hay numero

5. **Agregar mas preguntas de test**
   - "Cuanto tarda la construccion?"
   - "Que garantia tienen?"
   - "Hacen instalacion electrica/sanitaria?"

6. **Mejorar tono del agente**
   - Algunas respuestas son muy largas
   - Agregar mas "vos" y menos "usted"
   - Cerrar siempre con CTA claro

### Prioridad Baja

7. **Analytics de conversaciones**
   - Dashboard con metricas por empresa
   - Tracking de preguntas mas frecuentes
   - Alertas cuando el agente no puede responder

8. **Base de datos de empresas**
   - Pre-cargar empresas conocidas
   - Evitar re-scraping si datos son recientes

---

## Proximos Pasos

1. [ ] Testear Habika y Mini Casas manualmente
2. [ ] Implementar deteccion de "empresas sin catalogo"
3. [ ] Mejorar extraccion de precios
4. [ ] Eliminar respuesta "dejame consultarlo"
5. [ ] Re-testear las 6 empresas Tier 3 despues de mejoras

---

## Apendice: Conversaciones Completas

Ver archivo: `/docs/ANALISIS-CONVERSACIONES.txt`

---

*Generado automaticamente por el sistema de testing*
