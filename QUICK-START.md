# Constructor AI Simulator - Quick Start

## En 30 segundos

```bash
cd /Users/joaquingonzalez/Documents/dev/constructor-ai-simulator
npm run dev
# Abre http://localhost:3000
```

---

## ¿Qué hace?

1. **Ingresa una URL de catálogo** (ej: vibert.com.ar)
2. **Sistema extrae datos** automáticamente (casas, precios, etc)
3. **Chatéa con un agente IA** que conoce los productos
4. **Pregunta lo que quieras** y responde específicamente

---

## Empresas que funciona

- ViBert (casas prefabricadas)
- Steel Framing Argentina
- Casarella
- Y más...

---

## Problema conocido

Las conversaciones se guardan **solo en memoria**. Se pierden al reiniciar el servidor.

**Solución**: Implementar DB (Supabase) - próxima tarea prioritaria.

---

## Tests

```bash
npm run test:e2e           # Todos los tests
npx playwright test --grep "ViBert" --headed  # Test específico
```

---

## Archivos importantes

- `src/lib/firecrawl.ts` - Scraper (extrae datos)
- `src/lib/session-manager.ts` - Gestión de chats
- `src/components/SimulatorForm.tsx` - Interfaz
- `docs/ESTADO-ACTUAL.md` - Detalles técnicos

---

## Siguientes pasos

1. Guardar chats en base de datos
2. Agregar más empresas
3. Mejorar detección automática

---

**Proyecto activo y funcional. Status: ✅ PRODUCTION**
