# STATE - Constructor AI Simulator

## Status: PENDING CHANGES
## Last updated: 2026-03-09

---

## Context

Análisis competitivo (Arquitex, Renova Plus) + frameworks Hormozi identificaron que la landing atrae leads no calificados (ej: plomeros, empresas sin presupuesto). Se necesitan cambios en copy, CTAs, y agregar calificación pre-WhatsApp.

## Cambios a implementar

### CAMBIO 1: Sección "Esto NO es para vos si..."
**Archivo:** `src/app/page.tsx`
**Ubicación:** Después de la sección de pain points (sección 4, dark bg), ANTES del simulador
**Acción:** Agregar nueva sección con fondo contrastante

**Copy exacto:**
```
Esto NO es para vos si...

- No invertís en publicidad digital ni tenés intención de hacerlo
- Recibís menos de 20 consultas por semana
- No tenés presupuesto para invertir en crecimiento — si buscás una solución gratuita o muy barata, esto no es para vos (lo barato sale caro)
```

**Diseño:** Fondo rojo/oscuro sutil, ícono ❌ por cada punto. Corto, directo, sin suavizar.

---

### CAMBIO 2: CTAs actualizados
**Archivo:** `src/app/page.tsx` + `src/components/NavBar.tsx`

| CTA actual | CTA nuevo | Ubicación |
|---|---|---|
| "Quiero implementarlo" (hero) | **"Aplicá al Programa PHA"** | Hero section, botón secundario |
| "Implementar ahora" (nav) | **"Aplicá al Programa"** | NavBar |
| "Quiero implementarlo" (final) | **"Verificá si tu constructora califica"** | Sección final, lleva al formulario |

**"Probalo gratis"** y **"Probar simulador"** quedan igual — son el hook del agente gratis.

---

### CAMBIO 3: Formulario de calificación inline
**Archivo:** `src/app/page.tsx` (nueva sección) o nuevo componente `src/components/QualificationForm.tsx`
**Ubicación:** Después del simulador, ANTES de la sección de solución. Es el paso entre "probé el agente gratis" y "quiero el sistema completo".

**Título de sección:** "Verificá si tu constructora califica"

**2 preguntas (botones de opción, NO selects):**

**Pregunta 1:** ¿Invertís actualmente en publicidad digital o tenés intención de hacerlo en los próximos 3 meses?
- Sí, ya invierto
- Sí, quiero empezar
- No, por ahora no

**Pregunta 2:** ¿Cuántas consultas nuevas recibís por mes?
- Menos de 10
- 10-50
- 50-100
- Más de 100

**Lógica de scoring:**
- Pregunta 1 = "Ya invierto" o "Quiero empezar" → PASA
- Pregunta 1 = "No, por ahora no" → NO CALIFICA
- Pregunta 2 = 10+ → PASA
- Pregunta 2 = Menos de 10 → NO CALIFICA

**Si CALIFICA (ambas pasan):**
Mostrar botón de WhatsApp: "Coordiná una llamada con Joaquín →"
Mensaje pre-llenado: "Hola! Completé el formulario en agenteiagratis.com. Me interesa el Programa PHA. [Respuestas del form]"

**Si NO CALIFICA:**
Mostrar mensaje: "Por ahora el Programa PHA no es el mejor fit para tu empresa. Seguí usando la herramienta gratis de arriba — es tuya sin costo. Cuando tu volumen de consultas crezca, volvé a aplicar."
NO mostrar botón de WhatsApp.

**Diseño:** Cards/botones grandes clickeables (no dropdowns). Resultado inmediato sin recargar página. Animación suave al mostrar resultado.

---

### CAMBIO 4: Pain points actualizados
**Archivo:** `src/app/page.tsx` (sección 4, líneas ~155-167)

**Reemplazar los 7 pain points actuales por estos 4:**

1. **Te llegan consultas pero tu equipo tarda horas en responder y los leads se enfrían**
2. **Invertís en publicidad pero no sabés cuántas consultas se convierten en presupuestos reales**
3. **Tenés un CRM pero nadie lo actualiza como debería — cargar cada lead, hacer seguimiento, mover etapas... requiere tiempo que tu equipo no tiene**
4. **Tus asesores comerciales solo atienden al lead que responde primero — el resto se pierde**

**Diseño:** Mantener el mismo estilo visual (dark bg, ícono por punto). 4 en vez de 7 = más impacto, menos scroll.

---

### CAMBIO 5: Sección Done-for-you vs DIY
**Archivo:** `src/app/page.tsx`
**Ubicación:** Después de la sección de caso de éxito/resultados, ANTES de la sección del equipo

**Título:** "Hay mucho software barato. Y hay una razón por la que es barato."

**Copy exacto:**
```
Suena tentador: un agente IA por pocos dólares al mes. Pero cuando lo empezás a configurar, necesitás integraciones. Después necesitás tokens de IA — créditos que se pagan aparte. Después descubrís que nadie lo monitorea, nadie lo optimiza, y tu "agente" le responde cualquier cosa a tus clientes.

Al final, lo que parecía barato te costó más tiempo, más plata, y más dolores de cabeza de los que tenías antes.
```

**Separador visual, luego:**

```
PHA funciona diferente.

Somos un equipo de 4 personas + tecnología dedicado a tu constructora. No te vendemos software para que te arregles solo. Nosotros lo creamos, lo instalamos, lo entrenamos, lo monitoreamos y lo optimizamos.

Vos solo te ocupás de atender a los clientes que te mandamos listos para comprar.
```

**Diseño:** Primera parte (DIY) en fondo gris/oscuro. Segunda parte (PHA) en fondo claro/blanco con acento de color. Contraste visual que refuerce el mensaje.

---

### CAMBIO 6: Fixes técnicos
**Archivo:** `src/app/layout.tsx` o `src/app/page.tsx` (head/metadata)

1. **Quitar `noindex`** — el sitio está invisible para Google. Si es intencional, ignorar.
2. **Arreglar OG metadata** — actualmente muestra metadata del Loom embebido en vez de PHA cuando se comparte en WhatsApp/redes.

---

## Orden de implementación sugerido

1. **Pain points** (CAMBIO 4) — es el más simple, solo reemplazar texto
2. **CTAs** (CAMBIO 2) — cambiar strings en 2 archivos
3. **Sección "No es para vos"** (CAMBIO 1) — agregar sección nueva
4. **Sección Done-for-you** (CAMBIO 5) — agregar sección nueva
5. **Formulario de calificación** (CAMBIO 3) — nuevo componente + lógica
6. **Fixes técnicos** (CAMBIO 6) — verificar y arreglar metadata

## Archivos que se tocan

| Archivo | Cambios |
|---|---|
| `src/app/page.tsx` | Cambios 1, 2, 3, 4, 5 (pain points, CTAs, 2 secciones nuevas, form) |
| `src/components/NavBar.tsx` | Cambio 2 (CTA text) |
| `src/components/QualificationForm.tsx` | Cambio 3 (componente NUEVO) |
| `src/app/layout.tsx` | Cambio 6 (metadata) |

## Origen del análisis

- Competidores analizados: @arquitex.app (VSL funnel, "aplicá"), @renovaplus.ag (Método Prisma, guarantee)
- Frameworks aplicados: Hormozi Value Equation, Damaging Admissions, Lead Scoring, Close Rate vs Price, Supply vs Demand Constraint
- Problema raíz: avatar targeting — landing page habla a "constructoras" en general, atrae leads sin presupuesto ni volumen
