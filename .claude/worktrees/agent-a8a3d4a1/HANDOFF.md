# HANDOFF - Constructor AI Simulator
## Fecha: 2026-02-06

---

## Estado Actual del Proyecto

### App en Produccion
- **URL**: https://agenteiagratis.com (Vercel)
- **Repo**: https://github.com/Phaprogram108/constructor-ai-simulator
- **Branch**: main
- **Ultimo commit**: `2bb7ba1` - Add 20 new companies (fase2) and 7 new question types

### Cambios UX/UI Realizados Hoy
1. **Links clickeables en chat** - URLs en respuestas ahora son hipervinculos azules (Message.tsx)
2. **Boton fullscreen en slides** - Hover sobre Canva muestra "Ver en pantalla completa" (page.tsx)
3. **Video Loom mas grande** - Saco caja verde restrictiva, max-w-5xl (page.tsx)
4. **Typo arreglado** - "tamano" → "tamaño" (SimulatorForm.tsx)
5. **Texto mobile mas grande** - Chat 15px en mobile con leading-relaxed (Message.tsx)
6. **Lint fixes** - eslint-disable comments en firecrawl.ts para que builde en Vercel

### Testing Completado
- **Fase 1**: 19/20 empresas (Arqtainer timeout) - 228 preguntas, 11% no-info
- **Fase 2**: 19/20 empresas (FullHouse timeout) - 380 preguntas, 24.7% no-info
- **Total**: 38/40 empresas, 608 preguntas testeadas
- Reportes en Obsidian vault: `PHA Notes/proyectos/constructor-ai-conversaciones.md` y `constructor-ai-conversaciones-fase2.md`

### Preguntas Nuevas Agregadas (7 tipos)
- images_catalog, pricing, includes, installation, warranty, model_comparison, recommendation

---

## TAREAS PENDIENTES

### 1. Mejorar Presentacion Canva (PRIORIDAD ALTA)

**Feedback**: "Hay mucho texto"

**Canva URL editable**: https://www.canva.com/design/DAG_55ZBoGI/GwXnXbatf04ZnSTdIy6mOQ/edit

**Problema**: Claude no puede acceder a Canva directamente. El usuario debe:
1. Exportar como PDF y guardarlo en el proyecto
2. O copiar/pegar el texto de cada slide

**Approach sugerido**:
- Reducir texto a bullets cortos (max 3-4 por slide)
- Usar mas visuales/screenshots del producto
- Mantener el mensaje core pero resumirlo
- Estructura: Problema → Solucion → Prueba social → CTA

### 2. Cold Outreach Message (PRIORIDAD ALTA)

**Contexto**: El usuario quiere un mensaje para enviar a constructoras invitandolas a probar agenteiagratis.com

**Mensaje actual del usuario**:
```
Buen día, como estas? Sabías que ahora podes generar un agente IA profesional para tu constructora en 60 segundos gratis y fácil?
Solo tenes que pegar el link de tu sitio web para generarlo acá! —> https://agenteiagratis.com/
Contame qué te parece… Te vas a caer de la silla cuando veas lo bien que responde.
Que te diviertas! Saludos, Joaquin.
```

**Feedback recibido**: "No esta tan profesional"

**Datos del analisis de conversaciones PHA (408 convos)**:
Los mensajes de PHA que mejor funcionan tienen esta estructura:
1. **Opener corto**: "Buen día! Me encanta su sistema de construcción"
2. **Value prop concreta**: "Te puedo ayudar a vender más sin perder tiempo"
3. **Proof**: Link al video Loom del caso de exito
4. **CTA claro**: Invitacion a probar o coordinar llamada

**Lo que NO funciona**:
- Mensajes demasiado largos de primera (el bot PHA manda mucho texto junto)
- Mucho emoji
- Pedir que "pasen el mensaje al dueño" (genera friccion)
- "Te vas a caer de la silla" es informal/poco profesional

**Propuesta de mensaje mejorado** (para refinar con el usuario):
```
Buen día [nombre]! Soy Joaquín de PHA Program.

Creamos una herramienta gratuita donde podés generar un agente IA de ventas personalizado para tu constructora en 60 segundos.

Solo pegás el link de tu web y listo: https://agenteiagratis.com

¿Lo probás y me contás qué te parece? Me interesa tu feedback.

Saludos!
Joaquín
```

**Variante mas agresiva (con social proof)**:
```
Buen día [nombre]!

¿Sabías que una constructora en Argentina está consiguiendo llamadas calificadas a $20 USD c/u con un agente IA que responde 24/7?

Hicimos una herramienta gratuita para que pruebes cómo quedaría en tu empresa: https://agenteiagratis.com

Pegás tu web, se genera en 60 segundos, y podés chatear con tu propio agente. Sin compromiso.

¿Lo probás?

Joaquín - PHA Program
```

### 3. Archivos de Referencia para Messaging

**PHA Conversations (408 convos)**:
`/Users/joaquingonzalez/Documents/PHA Claude/Prometeo Scraper/pha_exports/full/pha_all_conversations.txt`
- 28,146 lineas de conversaciones WhatsApp reales
- Patrones de apertura, objeciones, y cierre
- Labels: responde_apertura, mostro_interes, lead_caliente, lead_en_pausa, lead_descalificado

**ViBert Conversations**:
`/Users/joaquingonzalez/Documents/PHA Notes/PHA Claude/Prometeo Scraper/exports/VIBERT_all_conversaciones.txt`
- 78,111 lineas de conversaciones de un cliente real

**Sales Call Transcripts (9 llamadas .docx)**:
`/Users/joaquingonzalez/Documents/PHA Notes/sales-transcripts/`
- Llamadas con: Diego, Hector, Juan Manuel Garcia, Laure, Lista, PHA Nacho, Santiago, Sienna, Intro PHA
- Formato: Google Meet Gemini notes (.docx - necesita conversion a texto)

**Notion Call Notes (8 empresas)**:
`/Users/joaquingonzalez/Documents/PHA Notes/notion-exports/Notion PHA Export/PHA (Prefab House Accelerator)/Llamadas/`
- Habitatio, Lista, Offis, Sienna, Valencia, Vibert, Wellmod, Inspiracion Industrial

### 4. Garbage Filter Improvements

**Empresas con muchos falsos positivos en modelos detectados**:
- **Casa Real Viviendas**: Detecta "Consultanos", "Cómo llegar", "Read more", ciudades como modelos
- **Gauros Viviendas**: Detecta "WhatsApp chat", "Back to top", "Showroom Virtual", años de entregas
- **La Casa Mia**: Detecta "Últimas Entregas", "Productos Relacionados", "Saber más", codigos MdA/MdM
- **Viviendas Tecnohouse**: Detecta sucursales como modelos ("Sucursal Cañuelas", etc.)
- **Nova Viviendas**: Portal con 130+ items, detecta iconos y articulos de blog como productos
- **Contenedores Argentina**: Detecta "Quiero saber más", "Muchas más soluciones"

**Filtros a agregar en firecrawl.ts validateProductName()**:
- Sucursal + ciudad
- CTA buttons: "Read more", "Back to top", "Saber más"
- Blog/content: "Cómo + verbo"
- Ciudades/provincias argentinas sueltas
- Navigation UI: "Close Menu", "Left Menu Button"

### 5. Mejoras Futuras del Producto

**Basado en testing**:
- Compartir links de catalogos cuando la empresa los tiene (ej: PlugArq)
- WhatsApp no detectado en ~40% de empresas
- Preguntas de pricing/warranty generan ~40% no-info → el prompt podria manejar mejor "no tengo precio exacto pero..."
- Session creation timeout en 2/40 empresas (FullHouse, Arqtainer)

---

## Archivos Clave del Proyecto

```
src/components/Message.tsx          - Chat message rendering (links, markdown)
src/components/ChatInterface.tsx    - Chat UI completa
src/components/SimulatorForm.tsx    - Form de generacion de agente
src/app/page.tsx                    - Landing page
src/lib/firecrawl.ts               - Scraper con garbage filter (~1200 lineas)
scripts/agent-test.ts              - Test automatizado con 18 tipos de preguntas
src/scripts/test-companies.json    - 40 empresas (problematicas + aleatorias + fase2)
```

## Dev Server
```bash
cd /Users/joaquingonzalez/Documents/dev/constructor-ai-simulator
npm run dev  # localhost:3000
```

## Test Commands
```bash
npm run agent-test -- --company "ViBert"     # Test 1 empresa
npm run agent-test -- --fase2                 # Test 20 empresas fase2
npm run agent-test                            # Test todas
```
