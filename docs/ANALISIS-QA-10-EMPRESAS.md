# Analisis QA - 10 Empresas de Construccion Modular

**Fecha:** 2026-02-04 15:50
**Objetivo:** Detectar problemas en el chatbot del simulador
**Tester:** QA Verifier (automated + manual review)

## Resumen Ejecutivo

Se testearon 10 empresas de construccion modular de Argentina, Chile y Mexico. Se encontraron **27 issues** distribuidos en 3 categorias principales:

| Categoria | Cantidad | Severidad |
|-----------|----------|-----------|
| Markdown no renderizado | 17 | Media |
| Datos posiblemente inventados | 7 | Alta |
| Contaminacion de datos | 3 | Alta (FALSO POSITIVO - ver nota) |

**NOTA IMPORTANTE sobre Contaminacion:** El test automatico detecto "HANDY" como contaminacion en Lucy House, pero al verificar manualmente el system prompt, se confirmo que Lucy's House SI tiene productos llamados "HANDY 1", "HANDY 2", "HANDY 3" en su catalogo real. **NO es contaminacion, es un falso positivo del detector.**

## Problemas Detectados

| Tipo | Descripcion |
|------|-------------|
| MARKDOWN_RAW | Asteriscos `**` aparecen sin renderizar como negrita |
| CONTAMINACION | Modelos de una empresa aparecen en otra (requiere verificacion manual) |
| DATOS_INVENTADOS | Precios o datos que parecen estimados, no reales |
| PRECIO_SOSPECHOSO | Precios muy redondos que pueden ser inventados |

## Resumen por Empresa

| Empresa | Pais | Status | Markdown | Contaminacion | Inventados | Total |
|---------|------|--------|----------|---------------|------------|-------|
| Lucy House Argentina | ARG | OK | 3 | 0* | 0 | 3 |
| Handy Home Argentina | ARG | OK | 0 | 0 | 0 | 0 |
| ViBert Argentina | ARG | OK | 3 | 0 | 0 | 3 |
| Casa Prefabricada Chile | CHL | OK | 3 | 0 | 0 | 3 |
| Bauhaus Chile | CHL | OK | 0 | 0 | 0 | 0 |
| Casa Seco Chile | CHL | OK | 0 | 0 | 1 | 1 |
| Casa Flexible Chile | CHL | OK | 0 | 0 | 0 | 0 |
| SmartPod Mexico | MEX | OK | 3 | 0 | 1 | 4 |
| Fincah Mexico | MEX | OK | 3 | 0 | 0 | 3 |
| VMD Mexico | MEX | OK | 2 | 0 | 5 | 7 |

---

## Detalle por Empresa

### Lucy House Argentina

- **URL:** https://lucyshousearg.com/
- **Session ID:** `cb8e953a-800c-4819-98c9-50d39ed231d5`
- **Company Name (detectado):** Lucy’s House
- **Status:** OK

**Mensaje de Bienvenida:**
> ¡Hola! Soy Sofia, asesora de Lucy’s House. ¿En qué puedo ayudarte hoy? Contame qué estás buscando y te oriento con todo gusto.

#### Conversacion Completa

**Pregunta 1:** Hola, qué modelos de casas tienen?

**Respuesta (raw):**
```
¡Hola! Tenemos varios modelos de casas modulares, desde entregas inmediatas hasta proyectos 100% a medida.  
Algunos ejemplos:

- **Módulo 19,20 m² / 25,5 m² / 28,30 m² / 28,56 m² / 30,00 m² / 30,6 m² / 32,00 m² / 35,70 m² / 37,50 m² / 38 m² / 40,8 m² / 150 m²**, todos con distintas tipologías internas (monoambiente, 1 o 2 dormitorios según el caso).  
- Línea **HANDY**: Handy 1 (4 m² – USD 1800), Handy 2 (6 m² – USD 2600), Handy 3 (9,2 m² – USD 3700), ideales como oficina, estudio o microcabaña.  
- **Casa INVERNADERO 9,2 m²** (USD 10.000 + IVA) y módulos **Comfort** desde **USD 1290/m²**.

Para ayudarte mejor, ¿qué superficie aproximada estás buscando (por ejemplo, 20 m², 30 m², 40 m² o más grande)?
```

**Issues detectados en esta respuesta:**
- `MARKDOWN_RAW`: Asteriscos ** aparecen sin renderizar
- `CONTAMINACION`: Modelo 'Handy' de Handy Home aparece en Lucy House Argentina

**Pregunta 2:** Cuánto cuesta el modelo más económico?

**Respuesta (raw):**
```
El modelo más económico que tenemos es el **Casa HANDY 1**, de **4 m²**, a **USD 1800**. Es ideal como micro oficina, espacio de trabajo, depósito o un primer módulo que después podés ampliar.

Para saber si te sirve, ¿la idea es usarlo como vivienda, oficina, quincho o algo similar?
```

**Issues detectados en esta respuesta:**
- `MARKDOWN_RAW`: Asteriscos ** aparecen sin renderizar
- `CONTAMINACION`: Modelo 'Handy' de Handy Home aparece en Lucy House Argentina

**Pregunta 3:** De qué material están hechas?

**Respuesta (raw):**
```
Los HANDY son módulos **constructivos**, no tipo casilla liviana: se fabrican con estructura resistente y cerramientos pensados para uso real (oficina, estudio, etc.).  
En la info que tengo no figura el detalle técnico completo de cada capa (estructura, aislaciones, terminaciones), pero sí que trabajamos con **estándar de vivienda modular**, no contenedor ni chapa pelada.

Si querés las especificaciones técnicas exactas (tipo de perfilería, aislantes, paneles, etc.), podés pedirlas directo por WhatsApp y te mandan la ficha completa: https://wa.me/5493512077113. ¿La idea es poner el módulo en exterior a la intemperie o bajo techo?
```

**Issues detectados en esta respuesta:**
- `MARKDOWN_RAW`: Asteriscos ** aparecen sin renderizar
- `CONTAMINACION`: Modelo 'Handy' de Handy Home aparece en Lucy House Argentina

#### Resumen de Issues (6 total)

- **MARKDOWN_RAW** (en pregunta: "Hola, qué modelos de casas tie..."): Asteriscos ** aparecen sin renderizar
- **CONTAMINACION** (en pregunta: "Hola, qué modelos de casas tie..."): Modelo 'Handy' de Handy Home aparece en Lucy House Argentina
- **MARKDOWN_RAW** (en pregunta: "Cuánto cuesta el modelo más ec..."): Asteriscos ** aparecen sin renderizar
- **CONTAMINACION** (en pregunta: "Cuánto cuesta el modelo más ec..."): Modelo 'Handy' de Handy Home aparece en Lucy House Argentina
- **MARKDOWN_RAW** (en pregunta: "De qué material están hechas?..."): Asteriscos ** aparecen sin renderizar
- **CONTAMINACION** (en pregunta: "De qué material están hechas?..."): Modelo 'Handy' de Handy Home aparece en Lucy House Argentina

---

### Handy Home Argentina

- **URL:** https://handyhome.com.ar/
- **Session ID:** `d80dfc2c-9306-4a5f-af53-4d68c6b7e278`
- **Company Name (detectado):** Empresa Constructora
- **Status:** OK

**Mensaje de Bienvenida:**
> ¡Hola! Soy Sofia, asesora de Empresa Constructora. ¿En qué puedo ayudarte hoy? Contame qué estás buscando y te oriento con todo gusto.

#### Conversacion Completa

**Pregunta 1:** Hola, qué modelos de casas tienen?

**Respuesta (raw):**
```
¡Hola! Qué bueno que estés buscando modelos de casas.  
No tengo el catálogo completo cargado como para listarte todos los modelos con detalle, pero trabajamos con casas llave en mano y en obra gris, de 1 a 4 dormitorios, con opciones de galería, quincho y ampliaciones según los m² que necesites.  

Para poder orientarte mejor, ¿ya tenés terreno o todavía estás en búsqueda?
```

**Pregunta 2:** Cuánto cuesta el modelo más económico?

**Respuesta (raw):**
```
El modelo más económico siempre va a depender de los m², la terminación (llave en mano u obra gris) y la zona donde se construya.  
No tengo el listado de precios cargado como para darte un número exacto, pero podés contactarnos por WhatsApp para que te pasen los valores actualizados del modelo base y las opciones de financiación.  

Para acercarte mejor el rango, ¿pensás en algo chico tipo 1 dormitorio o ya te gustaría mínimo 2?
```

**Pregunta 3:** De qué material están hechas?

**Respuesta (raw):**
```
Trabajamos con sistemas constructivos tradicionales y modernos, según el tipo de obra que elijas.  
En general usamos estructura de hormigón y/o perfiles, cerramientos con mampostería o paneles según el modelo, buena aislación térmica y carpinterías de calidad pensadas para vivienda permanente.  

Para orientarte mejor, ¿la querés para uso permanente o tipo casa de fin de semana?
```

---

### ViBert Argentina

- **URL:** https://www.vibert.com.ar/
- **Session ID:** `2517cb27-262e-4342-9d49-e87d784c642c`
- **Company Name (detectado):** ViBert
- **Status:** OK

**Mensaje de Bienvenida:**
> ¡Hola! Soy Sofia, asesora de ViBert. ¿En qué puedo ayudarte hoy? Contame qué estás buscando y te oriento con todo gusto.

#### Conversacion Completa

**Pregunta 1:** Hola, qué modelos de casas tienen?

**Respuesta (raw):**
```
¡Hola! Mirá, en casas tenemos varios modelos bien definidos:  

- **Casa Estefanía** – 100 m² – 3 dorm – 2 baños – **USD 150.000**  
- **Casa Micaela** – 90 m² – 2 dorm – 1 baño – **USD 120.000**  
- **Casa Sara** – 110 m² – 3 dorm – 2 baños – **USD 160.000**  
- **Casa Selene** – 95 m² – 2 dorm – 1 baño – **USD 130.000**  
- **Casa Carmela** – 125 m² – 4 dorm – 3 baños – **USD 200.000**  
- **Casa Daniela** – 115 m² – 3 dorm – 2 baños – **USD 170.000**  
- **Casa Justina** – 105 m² – 3 dorm – 2 baños – **USD 150.000**  
- **Casa Dora** – 100 m² – 3 dorm – 2 baños – **USD 145.000**  
- **Casa María** – 90 m² – 2 dorm – 1 baño – **USD 115.000**  

Todos se construyen con sistema tradicional y tenemos opciones de financiación. Para orientarte mejor, ¿estás buscando algo de 2 o 3 dormitorios (o más)?
```

**Issues detectados en esta respuesta:**
- `MARKDOWN_RAW`: Asteriscos ** aparecen sin renderizar

**Pregunta 2:** Cuánto cuesta el modelo más económico?

**Respuesta (raw):**
```
El modelo más económico que tenemos es la **Casa María**, de **90 m²**, con **2 dormitorios y 1 baño**, a **USD 115.000**. Se construye en sistema tradicional y podemos verlo con opción de financiación según la zona.  

Para saber si te encaja, ¿ya tenés terreno?
```

**Issues detectados en esta respuesta:**
- `MARKDOWN_RAW`: Asteriscos ** aparecen sin renderizar

**Pregunta 3:** De qué material están hechas?

**Respuesta (raw):**
```
Nuestras casas se construyen en **sistema tradicional**, con estructura de **hormigón y mampostería**, no son casas livianas ni prefabricadas tipo drywall. Usamos materiales de obra húmeda (ladrillos, hormigón, revoques, etc.), pensados para una vivienda permanente, sólida y durable.  

Así te queda una casa “de toda la vida”, con muy buen aislamiento y terminaciones de calidad. ¿En qué zona tenés pensado construir?
```

**Issues detectados en esta respuesta:**
- `MARKDOWN_RAW`: Asteriscos ** aparecen sin renderizar

#### Resumen de Issues (3 total)

- **MARKDOWN_RAW** (en pregunta: "Hola, qué modelos de casas tie..."): Asteriscos ** aparecen sin renderizar
- **MARKDOWN_RAW** (en pregunta: "Cuánto cuesta el modelo más ec..."): Asteriscos ** aparecen sin renderizar
- **MARKDOWN_RAW** (en pregunta: "De qué material están hechas?..."): Asteriscos ** aparecen sin renderizar

---

### Casa Prefabricada Chile

- **URL:** https://www.casaprefabricada.cl/
- **Session ID:** `f395c8b2-ab6b-4979-b368-e563947895ba`
- **Company Name (detectado):** Casa Prefabricada
- **Status:** OK

**Mensaje de Bienvenida:**
> ¡Hola! Soy Sofia, asesora de Casa Prefabricada. ¿En qué puedo ayudarte hoy? Contame qué estás buscando y te oriento con todo gusto.

#### Conversacion Completa

**Pregunta 1:** Hola, qué modelos de casas tienen?

**Respuesta (raw):**
```
¡Hola! Tenemos varios modelos de casas prefabricadas, todos sostenibles y con opción de financiación.  
Algunos ejemplos:

- **Casa Modelo A** – 60m² – 2 dorm – 1 baño – **USD 30.000**  
- **Casa Modelo B** – 120m² – 3 dorm – 2 baños – **USD 50.000**  
- **Casa Cabaña** – 50m² – 2 dorm – 1 baño – **USD 25.000**  
- **Casa Alpina** – 70m² – 3 dorm – 2 baños – **USD 30.000**  
- **Casa Americana** – 85m² – 4 dorm – 2 baños – **USD 40.000**  
- **Casa de Campo** – 90m² – 3 dorm – 2 baños – **USD 50.000**  
- **Casa Mediterránea** – 80m² – 3 dorm – 2 baños – **USD 45.000**  
- **Casa Modular** – 60m² – 2 dorm – 1 baño – **USD 35.000**  
- **Casa Contenedor** – 50m² – 2 dorm – 1 baño – **USD 20.000**  
- **Casa Domo** – 40m² – 1 dorm – 1 baño – **USD 15.000**  
- **Casa Tiny House** – 30m² – 1 dorm – 1 baño – **USD 10.000**

Además hacemos **quinchos** de 40m² y 60m².  
Para ayudarte mejor a elegir: ¿cuántos dormitorios estás buscando aproximadamente?
```

**Issues detectados en esta respuesta:**
- `MARKDOWN_RAW`: Asteriscos ** aparecen sin renderizar

**Pregunta 2:** Cuánto cuesta el modelo más económico?

**Respuesta (raw):**
```
El modelo más económico que tenemos es la **Casa Tiny House**, de **30m²**, con **1 dormitorio y 1 baño**, a **USD 10.000**.  
Si querés algo chico pero un poco más amplio, el siguiente en precio es el **Casa Domo**, de **40m²**, 1 dormitorio y 1 baño, a **USD 15.000**.  

¿Ya tenés terreno o estás todavía en etapa de planificación?
```

**Issues detectados en esta respuesta:**
- `MARKDOWN_RAW`: Asteriscos ** aparecen sin renderizar

**Pregunta 3:** De qué material están hechas?

**Respuesta (raw):**
```
Nuestras casas son **prefabricadas** con un sistema constructivo sostenible, combinando estructura liviana y materiales pensados para buena aislación térmica y eficiencia energética.  
Los detalles finos de cada modelo (tipo exacto de paneles, aislantes, terminaciones) no los tengo cargados acá, pero te los pueden pasar al detalle por WhatsApp o mail.  

Para orientarte mejor con el tipo de construcción: ¿en qué zona de Chile pensás instalar la casa (Santiago, Valparaíso o Concepción)?
```

**Issues detectados en esta respuesta:**
- `MARKDOWN_RAW`: Asteriscos ** aparecen sin renderizar

#### Resumen de Issues (3 total)

- **MARKDOWN_RAW** (en pregunta: "Hola, qué modelos de casas tie..."): Asteriscos ** aparecen sin renderizar
- **MARKDOWN_RAW** (en pregunta: "Cuánto cuesta el modelo más ec..."): Asteriscos ** aparecen sin renderizar
- **MARKDOWN_RAW** (en pregunta: "De qué material están hechas?..."): Asteriscos ** aparecen sin renderizar

---

### Bauhaus Chile

- **URL:** https://www.bauhaus.cl/
- **Session ID:** `184ce693-f74a-452f-b321-3b15f056410b`
- **Company Name (detectado):** Empresa Constructora
- **Status:** OK

**Mensaje de Bienvenida:**
> ¡Hola! Soy Sofia, asesora de Empresa Constructora. ¿En qué puedo ayudarte hoy? Contame qué estás buscando y te oriento con todo gusto.

#### Conversacion Completa

**Pregunta 1:** Hola, qué modelos de casas tienen?

**Respuesta (raw):**
```
¡Hola! Mirá, no tengo el catálogo completo cargado como para pasarte nombres y medidas exactas de cada modelo desde acá.  

Pero trabajamos con varios tipos de casas: modelos compactos de 1 y 2 dormitorios, familiares de 3 dormitorios con 1 o 2 baños, y proyectos más grandes con galería, quincho y opción de pileta, tanto en sistema llave en mano como en obra gris.  
Si querés ver todos los modelos con m², planos y precios, podés contactarnos por WhatsApp y te pasan el catálogo completo.  
Para ayudarte mejor desde acá: ¿estás buscando algo más tipo casa chica, familiar estándar o algo más grande/premium?
```

**Pregunta 2:** Cuánto cuesta el modelo más económico?

**Respuesta (raw):**
```
El modelo más económico que manejamos depende mucho del sistema (llave en mano u obra gris), la superficie y la zona donde se construye, así que desde acá no tengo un precio único y exacto para pasarte.  
No tengo el catálogo completo cargado como para decirte el valor puntual del modelo base, pero por WhatsApp te pueden pasar la lista actualizada con precios por m² y opciones económicas.  

Para orientarte mejor: ¿ya tenés terreno o todavía estás viendo eso?
```

**Pregunta 3:** De qué material están hechas?

**Respuesta (raw):**
```
Trabajamos con construcción tradicional y sistemas industrializados según el proyecto: lo más común es mampostería (ladrillo) con estructura de hormigón, buena aislación y terminaciones pensadas para bajo mantenimiento.  
También se pueden hacer opciones más livianas tipo steel frame o mixtas, dependiendo de la zona y el presupuesto.  
Para orientarte mejor: ¿tenés preferencia por construcción tradicional o estás abierto/a a sistemas como steel frame?
```

---

### Casa Seco Chile

- **URL:** https://casaseco.cl/
- **Session ID:** `71a17467-9550-4c33-a886-8f94c76ab91e`
- **Company Name (detectado):** Empresa Constructora
- **Status:** OK

**Mensaje de Bienvenida:**
> ¡Hola! Soy Sofia, asesora de Empresa Constructora. ¿En qué puedo ayudarte hoy? Contame qué estás buscando y te oriento con todo gusto.

#### Conversacion Completa

**Pregunta 1:** Hola, qué modelos de casas tienen?

**Respuesta (raw):**
```
¡Hola! Mirá, no tengo el catálogo completo cargado acá como para listarte todos los modelos uno por uno con m² y distribución.  

Pero tenemos opciones tipo casa compacta de 1 y 2 dormitorios, familiares de 3 dormitorios con 1 o 2 baños, y modelos más grandes con galería/quincho y posibilidad de ampliación. Si querés ver el detalle de cada modelo con planos, m² y precios, podés contactarnos por WhatsApp y te pasan todo el catálogo actualizado.  
Para orientarte mejor: ¿estás pensando en 1, 2 o 3 dormitorios?
```

**Pregunta 2:** Cuánto cuesta el modelo más económico?

**Respuesta (raw):**
```
El modelo más económico que manejamos es siempre el de menor superficie cubierta, tipo casa compacta, pero no tengo acá el listado completo con precios actualizados como para darte un número exacto y responsable.  

No tengo el catálogo completo cargado, pero podés contactarnos por WhatsApp para que te pasen todos los modelos con valores al día y formas de pago.  
Para acercarte mejor el rango de precios, contame: ¿ya tenés terreno?
```

**Issues detectados en esta respuesta:**
- `DATOS_INVENTADOS`: Contiene indicador 'rango de precios'

**Pregunta 3:** De qué material están hechas?

**Respuesta (raw):**
```
Nuestras casas se construyen con sistema tradicional de obra, con estructura resistente y materiales pensados para vivienda permanente, no tipo “prefabricada liviana”. Trabajamos con muros sólidos, losa o techo según el modelo, y terminaciones que pueden ser llave en mano u obra gris, según lo que elijas.  

No tengo el detalle técnico fino de cada modelo cargado acá, pero por WhatsApp te pueden pasar fichas técnicas completas. Así te asesoro mejor: ¿la querés para vivienda permanente o tipo casa de fin de semana?
```

#### Resumen de Issues (1 total)

- **DATOS_INVENTADOS** (en pregunta: "Cuánto cuesta el modelo más ec..."): Contiene indicador 'rango de precios'

---

### Casa Flexible Chile

- **URL:** https://www.casaflexible.cl/
- **Session ID:** `e6f784b4-2705-4d7f-894e-240b98fa95c5`
- **Company Name (detectado):** Empresa Constructora
- **Status:** OK

**Mensaje de Bienvenida:**
> ¡Hola! Soy Sofia, asesora de Empresa Constructora. ¿En qué puedo ayudarte hoy? Contame qué estás buscando y te oriento con todo gusto.

#### Conversacion Completa

**Pregunta 1:** Hola, qué modelos de casas tienen?

**Respuesta (raw):**
```
¡Hola! Qué bueno que estés averiguando modelos 😊  
No tengo el catálogo completo cargado como para listarte todos ahora, pero trabajamos con varios diseños tipo: casas de 1 y 2 dormitorios más compactas (ideal primera vivienda), modelos de 3 dormitorios con 2 baños y galería/quincho, y también opciones más grandes arriba de 120 m² pensadas para familias.

Para pasarte modelos concretos con m², cantidad de dormitorios y precios, podés escribirnos por WhatsApp y te mandan el catálogo actualizado con planos e imágenes.  
Para ayudarte mejor desde acá: ¿ya tenés terreno o todavía estás en la etapa de ver todo?
```

**Pregunta 2:** Cuánto cuesta el modelo más económico?

**Respuesta (raw):**
```
El modelo más económico siempre suele ser una vivienda compacta, tipo 1 dormitorio o 2 dormitorios chicos, en una sola planta y sin tantos adicionales (galería, quincho, etc.).  
No tengo los precios actualizados cargados como para decirte un número real ahora, pero podés escribirnos por WhatsApp y te pasan el valor del modelo base más económico, con y sin opción llave en mano.

Para orientarte mejor desde acá y que no te pasen algo que no te sirva: ¿ya tenés terreno o todavía estás viendo zona y opciones?
```

**Pregunta 3:** De qué material están hechas?

**Respuesta (raw):**
```
Trabajamos con construcción tradicional y sistemas industrializados según el proyecto: lo más común es mampostería (ladrillo común o hueco), estructura de hormigón armado y losa o techo de chapa con aislación, pero también se pueden hacer soluciones más livianas según la necesidad.  

Como hay varias opciones posibles, lo ideal es ver qué estás buscando vos: ¿pensás en una casa permanente (vivienda fija) o algo tipo casa de fin de semana?
```

---

### SmartPod Mexico

- **URL:** https://www.smartpod.mx/
- **Session ID:** `bbcfff8c-79e1-4377-ab8c-0dbcc40a417e`
- **Company Name (detectado):** SmartPod
- **Status:** OK

**Mensaje de Bienvenida:**
> ¡Hola! Soy Sofia, asesora de SmartPod. ¿En qué puedo ayudarte hoy? Contame qué estás buscando y te oriento con todo gusto.

#### Conversacion Completa

**Pregunta 1:** Hola, qué modelos de casas tienen?

**Respuesta (raw):**
```
¡Hola! Tenemos varios modelos de casas en steel frame, todos con opción de financiación:

- **Casa Smart Pod One**: 40 m² – 1 dormitorio – 1 baño – **USD 29,999**  
- **Casa Smart Pod Two**: 60 m² – 2 dormitorios – 2 baños – **USD 49,999**  
- **Casa Tiny House**: 30 m² – 1 dormitorio – 1 baño – **USD 30,000**  
- **Casa SmartPod Studio / Casa Studio**: 14.4 m² – 1 dormitorio – 1 baño – **desde USD 25,000**  
- **Casa SmartHouse**: 99 m² – 3 dormitorios – 2 baños – **desde USD 110,000**  
- **Casa Modelo A**: 100 m² – 2 dormitorios – 1 baño – **USD 100,000**  
- **Casa Modelo B**: 150 m² – 3 dormitorios – 2 baños – **USD 150,000**

¿Más o menos de cuántos m² o cuántos dormitorios estás buscando vos?
```

**Issues detectados en esta respuesta:**
- `MARKDOWN_RAW`: Asteriscos ** aparecen sin renderizar
- `DATOS_INVENTADOS`: Contiene indicador 'desde USD'

**Pregunta 2:** Cuánto cuesta el modelo más económico?

**Respuesta (raw):**
```
El modelo más económico es el **SmartPod Studio / Casa Studio**, de **14,4 m²**, con 1 dormitorio y 1 baño, desde **USD 25,000** llave en mano.  

Para orientarte mejor con opciones y financiación: ¿ya tenés terreno o todavía estás en la etapa de planificación?
```

**Issues detectados en esta respuesta:**
- `MARKDOWN_RAW`: Asteriscos ** aparecen sin renderizar

**Pregunta 3:** De qué material están hechas?

**Respuesta (raw):**
```
Todas nuestras casas están construidas con **sistema steel frame**, es decir, estructura de perfiles de acero galvanizado, cerramientos con paneles y aislaciones térmicas y acústicas de alta eficiencia. Es un sistema liviano, muy resistente y mucho más rápido de ejecutar que la obra húmeda tradicional.  

Así puedo recomendarte mejor: ¿la querés para vivienda permanente, fin de semana o tipo Airbnb/renta?
```

**Issues detectados en esta respuesta:**
- `MARKDOWN_RAW`: Asteriscos ** aparecen sin renderizar

#### Resumen de Issues (4 total)

- **MARKDOWN_RAW** (en pregunta: "Hola, qué modelos de casas tie..."): Asteriscos ** aparecen sin renderizar
- **DATOS_INVENTADOS** (en pregunta: "Hola, qué modelos de casas tie..."): Contiene indicador 'desde USD'
- **MARKDOWN_RAW** (en pregunta: "Cuánto cuesta el modelo más ec..."): Asteriscos ** aparecen sin renderizar
- **MARKDOWN_RAW** (en pregunta: "De qué material están hechas?..."): Asteriscos ** aparecen sin renderizar

---

### Fincah Mexico

- **URL:** https://fincah.com/
- **Session ID:** `74e3c555-a7cc-4d82-972f-736099478252`
- **Company Name (detectado):** Fincah
- **Status:** OK

**Mensaje de Bienvenida:**
> ¡Hola! Soy Sofia, asesora de Fincah. ¿En qué puedo ayudarte hoy? Contame qué estás buscando y te oriento con todo gusto.

#### Conversacion Completa

**Pregunta 1:** Hola, qué modelos de casas tienen?

**Respuesta (raw):**
```
¡Hola! Tenemos varios modelos de casas, todos en sistema modular y prefabricado, con opción de financiación.  
Por ejemplo:  
- **Casa Fincah Tipo 1** – 60 m² – 2 dorm – 1 baño – **USD 50.000**  
- **Casa Fincah Tipo 2** – 75 m² – 3 dorm – 2 baños – **USD 70.000**  
- **Casa Modelo A** – 100 m² – 2 dorm – 1 baño – **USD 100.000**  
- **Casa Modelo B** – 150 m² – 3 dorm – 2 baños – **USD 150.000**  
- **Casa Tipo 0** – 50 m² – 1 dorm – 1 baño – **USD 90.000**  
- **Casa Tipo 3** – 60 m² – 2 dorm – 1 baño – **USD 100.000**  
- **Casa Tipo 1** – 80 m² – 3 dorm – 2 baños – **USD 150.000**  
- **Casa Tipo 2** – 70 m² – 2 dorm – 1 baño – **USD 120.000**  
- **Casa Tipo 4** – 90 m² – 3 dorm – 2 baños – **USD 180.000**  
- **Casa Tipo 5** – 100 m² – 4 dorm – 3 baños – **USD 200.000**  

Para orientarte mejor, ¿cuántos dormitorios estás buscando aproximadamente?
```

**Issues detectados en esta respuesta:**
- `MARKDOWN_RAW`: Asteriscos ** aparecen sin renderizar

**Pregunta 2:** Cuánto cuesta el modelo más económico?

**Respuesta (raw):**
```
El modelo más económico que tenemos es la **Casa Fincah Tipo 1 de 60 m²**, con **2 dormitorios y 1 baño**, a **USD 50.000** en sistema modular prefabricado. También ofrecemos financiación para facilitar el acceso.  

Para ver si se ajusta bien a lo que necesitás, ¿ya tenés terreno donde te gustaría construir?
```

**Issues detectados en esta respuesta:**
- `MARKDOWN_RAW`: Asteriscos ** aparecen sin renderizar

**Pregunta 3:** De qué material están hechas?

**Respuesta (raw):**
```
Nuestras casas modulares son **prefabricadas** con un sistema constructivo moderno: estructura principal industrializada y paneles que combinan materiales livianos de alta prestación (tipo steel frame/paneles estructurales) con **aislación térmica y acústica** integrada.  
Esto permite una obra rápida, limpia y muy eficiente energéticamente, manteniendo la solidez y durabilidad similares a una construcción tradicional.  

Así te puedo orientar mejor: ¿la pensás para vivienda permanente o más como casa de fin de semana?
```

**Issues detectados en esta respuesta:**
- `MARKDOWN_RAW`: Asteriscos ** aparecen sin renderizar

#### Resumen de Issues (3 total)

- **MARKDOWN_RAW** (en pregunta: "Hola, qué modelos de casas tie..."): Asteriscos ** aparecen sin renderizar
- **MARKDOWN_RAW** (en pregunta: "Cuánto cuesta el modelo más ec..."): Asteriscos ** aparecen sin renderizar
- **MARKDOWN_RAW** (en pregunta: "De qué material están hechas?..."): Asteriscos ** aparecen sin renderizar

---

### VMD Mexico

- **URL:** https://www.vmd.com.mx/
- **Session ID:** `12d13c62-ec71-4662-a239-44b848607bf5`
- **Company Name (detectado):** VMD Construcciones
- **Status:** OK

**Mensaje de Bienvenida:**
> ¡Hola! Soy Sofia, asesora de VMD Construcciones. ¿En qué puedo ayudarte hoy? Contame qué estás buscando y te oriento con todo gusto.

#### Conversacion Completa

**Pregunta 1:** Hola, qué modelos de casas tienen?

**Respuesta (raw):**
```
¡Hola! Tenemos varios modelos de casas, todos en sistema tradicional y con posibilidad de financiación. Te cuento algunos:

- Casa Modelo 620 – 100 m² – 3 dorm – 2 baños – $1,200,000  
- Casa Modelo 720 – 120 m² – 3 dorm – 2 baños – $1,500,000  
- Casa Modelo 220 – 95 m² – 3 dorm – 2 baños – $1,100,000  
- Casa Modelo 120 – 90 m² – 2 dorm – 1 baño – $950,000  
- Casa Modelo 420 – 80 m² – 2 dorm – 1 baño – $800,000  
- Casa Modelo 320 – 75 m² – 2 dorm – 1 baño – $750,000  
- Casa Modelo 520 – 110 m² – 3 dorm – 2 baños – $1,250,000  

También tenemos modelos más compactos como Casa Modelo 1 (37 m², 1 dorm, 1 baño – $950,000) y modelos más grandes como Casa Modelo 5 (190 m², 2 dorm, 2 baños – $2,550,000).  
Para ayudarte mejor a elegir, ¿ya tenés terreno o todavía estás viendo esa parte?
```

**Issues detectados en esta respuesta:**
- `PRECIO_SOSPECHOSO`: Precio $950,000 es multiplo exacto de 5000
- `PRECIO_SOSPECHOSO`: Precio $800,000 es multiplo exacto de 5000
- `PRECIO_SOSPECHOSO`: Precio $750,000 es multiplo exacto de 5000
- `PRECIO_SOSPECHOSO`: Precio $950,000 es multiplo exacto de 5000

**Pregunta 2:** Cuánto cuesta el modelo más económico?

**Respuesta (raw):**
```
El modelo más económico que tenemos en el listado es la **Casa Modelo 2**, de **15.5 m²**, con **1 dormitorio y 1 baño**, a **$650,000.00 pesos**. Es una opción bien compacta, ideal como primer espacio, estudio o cabañita de fin de semana.  

Para ver si te encaja, ¿la idea es usarla como vivienda permanente o más tipo casa de descanso?
```

**Issues detectados en esta respuesta:**
- `MARKDOWN_RAW`: Asteriscos ** aparecen sin renderizar
- `PRECIO_SOSPECHOSO`: Precio $650,000 es multiplo exacto de 5000

**Pregunta 3:** De qué material están hechas?

**Respuesta (raw):**
```
Todas nuestras casas se construyen en **sistema tradicional**, es decir, con **estructura de mampostería (ladrillo/bloque), columnas y vigas de hormigón armado**, losas o techos tradicionales y revoques. Esto te garantiza **durabilidad, buen aislamiento térmico y acústico**, y la posibilidad de hacer ampliaciones futuras sin problema.  

Para saber si se adapta bien a lo que necesitás, ¿en qué ciudad o zona estás pensando construir?
```

**Issues detectados en esta respuesta:**
- `MARKDOWN_RAW`: Asteriscos ** aparecen sin renderizar

#### Resumen de Issues (7 total)

- **PRECIO_SOSPECHOSO** (en pregunta: "Hola, qué modelos de casas tie..."): Precio $950,000 es multiplo exacto de 5000
- **PRECIO_SOSPECHOSO** (en pregunta: "Hola, qué modelos de casas tie..."): Precio $800,000 es multiplo exacto de 5000
- **PRECIO_SOSPECHOSO** (en pregunta: "Hola, qué modelos de casas tie..."): Precio $750,000 es multiplo exacto de 5000
- **PRECIO_SOSPECHOSO** (en pregunta: "Hola, qué modelos de casas tie..."): Precio $950,000 es multiplo exacto de 5000
- **MARKDOWN_RAW** (en pregunta: "Cuánto cuesta el modelo más ec..."): Asteriscos ** aparecen sin renderizar
- **PRECIO_SOSPECHOSO** (en pregunta: "Cuánto cuesta el modelo más ec..."): Precio $650,000 es multiplo exacto de 5000
- **MARKDOWN_RAW** (en pregunta: "De qué material están hechas?..."): Asteriscos ** aparecen sin renderizar

---

## Lista Completa de Problemas por Tipo

### Markdown No Renderizado

- Lucy House Argentina: MARKDOWN_RAW: Asteriscos ** aparecen sin renderizar
- Lucy House Argentina: MARKDOWN_RAW: Asteriscos ** aparecen sin renderizar
- Lucy House Argentina: MARKDOWN_RAW: Asteriscos ** aparecen sin renderizar
- ViBert Argentina: MARKDOWN_RAW: Asteriscos ** aparecen sin renderizar
- ViBert Argentina: MARKDOWN_RAW: Asteriscos ** aparecen sin renderizar
- ViBert Argentina: MARKDOWN_RAW: Asteriscos ** aparecen sin renderizar
- Casa Prefabricada Chile: MARKDOWN_RAW: Asteriscos ** aparecen sin renderizar
- Casa Prefabricada Chile: MARKDOWN_RAW: Asteriscos ** aparecen sin renderizar
- Casa Prefabricada Chile: MARKDOWN_RAW: Asteriscos ** aparecen sin renderizar
- SmartPod Mexico: MARKDOWN_RAW: Asteriscos ** aparecen sin renderizar
- SmartPod Mexico: MARKDOWN_RAW: Asteriscos ** aparecen sin renderizar
- SmartPod Mexico: MARKDOWN_RAW: Asteriscos ** aparecen sin renderizar
- Fincah Mexico: MARKDOWN_RAW: Asteriscos ** aparecen sin renderizar
- Fincah Mexico: MARKDOWN_RAW: Asteriscos ** aparecen sin renderizar
- Fincah Mexico: MARKDOWN_RAW: Asteriscos ** aparecen sin renderizar
- VMD Mexico: MARKDOWN_RAW: Asteriscos ** aparecen sin renderizar
- VMD Mexico: MARKDOWN_RAW: Asteriscos ** aparecen sin renderizar

### Contaminacion de Datos

**NOTA:** Los 3 casos detectados en Lucy House fueron FALSOS POSITIVOS. Lucy's House SI tiene productos "HANDY" en su catalogo real (HANDY 1, HANDY 2, HANDY 3). El detector confundio esto con contaminacion de "Handy Home", pero son productos diferentes.

- ~~Lucy House Argentina: CONTAMINACION: Modelo 'Handy' de Handy Home aparece en Lucy House Argentina~~ **FALSO POSITIVO**
- ~~Lucy House Argentina: CONTAMINACION: Modelo 'Handy' de Handy Home aparece en Lucy House Argentina~~ **FALSO POSITIVO**
- ~~Lucy House Argentina: CONTAMINACION: Modelo 'Handy' de Handy Home aparece en Lucy House Argentina~~ **FALSO POSITIVO**

**No se encontraron casos reales de contaminacion de datos entre empresas.**

### Datos Posiblemente Inventados

- Casa Seco Chile: DATOS_INVENTADOS: Contiene indicador 'rango de precios'
- SmartPod Mexico: DATOS_INVENTADOS: Contiene indicador 'desde USD'
- VMD Mexico: PRECIO_SOSPECHOSO: Precio $950,000 es multiplo exacto de 5000
- VMD Mexico: PRECIO_SOSPECHOSO: Precio $800,000 es multiplo exacto de 5000
- VMD Mexico: PRECIO_SOSPECHOSO: Precio $750,000 es multiplo exacto de 5000
- VMD Mexico: PRECIO_SOSPECHOSO: Precio $950,000 es multiplo exacto de 5000
- VMD Mexico: PRECIO_SOSPECHOSO: Precio $650,000 es multiplo exacto de 5000

## Recomendaciones de Mejora

### 1. Markdown Raw
**Problema:** Los asteriscos `**texto**` aparecen literalmente en vez de como negrita.

**Solucion sugerida:**
- Opcion A: Agregar al system prompt instruccion de no usar markdown
- Opcion B: Renderizar markdown en el frontend con una libreria como `react-markdown`
- Opcion C: Limpiar asteriscos en el backend antes de enviar la respuesta

### 2. Contaminacion de Datos
**Problema:** Modelos de una empresa aparecen en el chat de otra empresa.

**Posibles causas:**
- Cache compartido entre sesiones
- El LLM usa conocimiento previo de otras sesiones
- El scraper mezcla datos de diferentes sitios

**Solucion sugerida:**
- Verificar que cada sesion tenga datos aislados
- Agregar instruccion explicita al prompt: "Solo usa la informacion proporcionada, no inventes"

### 3. Datos Inventados
**Problema:** El chatbot inventa precios o usa frases como "valor de referencia".

**Solucion sugerida:**
- Mejorar el scraping para extraer precios reales
- Si no hay precio, que el bot diga "Contactanos para cotizacion" en vez de inventar
- Agregar validacion: si el precio no esta en los datos, no mencionarlo

### 4. Recomendaciones Generales
- Agregar al prompt: "NUNCA inventes datos. Si no tenes la informacion, deci que el cliente debe contactar para mas detalles."
- Implementar logging de fuente de datos para cada respuesta
- Agregar tests automatizados que detecten estos problemas

## Estadisticas Finales

- **Total empresas testeadas:** 10
- **Sesiones exitosas:** 10
- **Sesiones fallidas:** 0
- **Total issues detectados:** 24 (27 - 3 falsos positivos)
- **Empresas con markdown raw:** 6
- **Empresas con contaminacion real:** 0 (los 3 detectados fueron falsos positivos)
- **Empresas con datos inventados:** 3

## Observaciones Adicionales del Analisis Manual

### 1. Problema de Extraccion de Nombre de Empresa

Algunas empresas no fueron detectadas correctamente:
- **Handy Home** -> Detectado como "Empresa Constructora"
- **Bauhaus Chile** -> Detectado como "Empresa Constructora"
- **Casa Seco Chile** -> Detectado como "Empresa Constructora"
- **Casa Flexible Chile** -> Detectado como "Empresa Constructora"

Esto indica un problema en el scraper que no extrae correctamente el nombre de la empresa de algunos sitios web.

### 2. Comportamiento ante Falta de Datos

Cuando el scraper no extrae modelos especificos, el bot tiene dos comportamientos diferentes:

**Comportamiento BUENO (Handy Home, Bauhaus, Casa Seco, Casa Flexible):**
> "No tengo el catalogo completo cargado... podés contactarnos por WhatsApp"

**Comportamiento MALO (Casa Prefabricada Chile, Fincah):**
El bot inventa modelos genericos como "Casa Modelo A", "Casa Modelo B" con precios redondos. Ejemplo de Fincah:
- Casa Modelo A – 100 m2 – **USD 100.000** (precio sospechosamente redondo)
- Casa Modelo B – 150 m2 – **USD 150.000** (precio sospechosamente redondo)

### 3. Inconsistencia en Precios de ViBert

Al comparar los precios del system prompt vs lo que responde el bot:

**System Prompt dice:**
- Casa Estefania: $150,000
- Casa Micaela: $165,000 (120m2)

**Bot responde:**
- Casa Estefania: USD 150.000 (correcto)
- Casa Micaela: USD 120.000 (INCORRECTO - mezclo precio con m2?)

Hay confusion entre datos, posiblemente por como el LLM interpreta la informacion.

### 4. Variacion en Calidad de Respuestas por Pais

| Pais | Empresas con buen scraping | Empresas con scraping pobre |
|------|---------------------------|----------------------------|
| Argentina | ViBert, Lucy House | Handy Home |
| Chile | Ninguna | Todas (4 empresas) |
| Mexico | SmartPod | VMD, Fincah |

**Conclusion:** El scraper funciona mejor con sitios argentinos, especialmente los de Wix (ViBert).

### 5. Uso Inconsistente de Moneda

- Argentina: USD (correcto para el mercado)
- Chile: USD (deberia ser CLP o UF)
- Mexico: Mezcla de USD y pesos mexicanos

El bot deberia adaptarse a la moneda local de cada empresa.

## Veredicto Final

| Criterio | Estado |
|----------|--------|
| Markdown renderizado | FAIL - 6/10 empresas con asteriscos raw |
| Contaminacion de datos | PASS - No se encontro contaminacion real |
| Datos inventados | FAIL - 3/10 empresas con datos sospechosos |
| Deteccion de nombre | FAIL - 4/10 empresas mal detectadas |
| Calidad general | PARCIAL - Funciona bien con sitios Wix argentinos |

## Proximos Pasos Recomendados

1. **URGENTE:** Agregar instruccion al prompt para NO usar markdown con asteriscos
2. **URGENTE:** Mejorar deteccion de nombre de empresa en el scraper
3. **IMPORTANTE:** Agregar validacion para que el bot NO invente precios
4. **MEJORA:** Adaptar moneda segun pais de la empresa
5. **MEJORA:** Mejorar scraping de sitios chilenos y mexicanos
