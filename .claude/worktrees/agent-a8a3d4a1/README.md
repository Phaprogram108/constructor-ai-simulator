# Constructor AI Simulator

Sistema que scrapea sitios web de empresas constructoras y crea un chatbot personalizado que responde preguntas como si fuera un agente de ventas.

**URL Produccion**: https://agenteiagratis.com

## Como Funciona

1. El usuario ingresa la URL de una empresa constructora
2. El sistema scrapea el sitio web usando Firecrawl + Claude
3. Se genera un chatbot personalizado con la info de la empresa
4. El usuario puede hacer preguntas sobre modelos, precios, contacto, etc.

## Stack Tecnologico

- **Frontend**: Next.js 14, React, TailwindCSS, shadcn/ui
- **Backend**: Next.js API Routes
- **Scraping**: Firecrawl (con actions), Playwright, Claude Vision
- **AI**: Claude 3.5 Sonnet (Anthropic)
- **Deploy**: Vercel

## Quick Start

```bash
# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env.local
# Editar .env.local con tus API keys

# Iniciar servidor de desarrollo
npm run dev
```

## Variables de Entorno

```env
ANTHROPIC_API_KEY=sk-ant-...
FIRECRAWL_API_KEY=fc-...
```

## Estructura del Proyecto

```
src/
├── app/
│   ├── api/
│   │   ├── chat/route.ts          # Endpoint de chat
│   │   └── simulator/create/route.ts  # Crear sesion
│   ├── demo/[sessionId]/page.tsx  # Pagina de chat
│   └── page.tsx                   # Home
├── components/
│   ├── ChatInterface.tsx          # UI del chat
│   └── SimulatorForm.tsx          # Formulario inicial
└── lib/
    ├── scraper.ts                 # Orquestador de scraping
    ├── firecrawl.ts               # Integracion Firecrawl
    ├── vision-scraper.ts          # Claude Vision para tablas
    └── prompt-generator.ts        # Genera systemPrompt
```

## API Endpoints

### POST /api/simulator/create

Crea una nueva sesion de chat para una empresa.

```bash
curl -X POST http://localhost:3000/api/simulator/create \
  -H "Content-Type: application/json" \
  -d '{"websiteUrl":"https://www.wellmod.com.ar/"}'
```

Respuesta:
```json
{
  "sessionId": "abc123",
  "companyName": "WELLMOD",
  "welcomeMessage": "Hola! Soy Sofia...",
  "systemPrompt": "..."
}
```

### POST /api/chat

Envia un mensaje al chatbot.

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "abc123",
    "message": "Que modelos tienen?",
    "systemPrompt": "...",
    "conversationHistory": []
  }'
```

## Testing

```bash
# Test QA de 20 empresas
npx tsx scripts/test-20-empresas-qa.ts

# Test empresa especifica
node test-ecomod.mjs
```

## Documentacion

Ver carpeta `docs/` para documentacion detallada:
- `ESTADO-SESION-2026-02-04-V4.md` - Estado actual del proyecto
- `PLAN-SCRAPING-MEJORADO.md` - Arquitectura de scraping
- `ANALISIS-QA-10-EMPRESAS.md` - Resultados de QA

## Deploy

El proyecto se despliega automaticamente en Vercel cuando se hace push a `main`.

## Licencia

Privado - Todos los derechos reservados
