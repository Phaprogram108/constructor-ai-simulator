# Decisiones - V4 Exploratorio

**Fecha:** 2026-02-06
**Contexto:** El approach actual es rigido (clasifica empresas, hace preguntas fijas). Cada constructora es unica y el sistema debe adaptarse.

## Decisiones Tomadas

### 1. Eliminar clasificacion de constructoras
- NO mas MODULAR/TRADICIONAL/MIXTA/INMOBILIARIA
- Cada empresa se explora sin categorias previas
- El sistema descubre que ofrece cada empresa

### 2. Scope: Todo el sistema
- Cambiar el scraper de produccion (firecrawl.ts) para que explore en vez de buscar campos fijos
- Cambiar el pipeline de diagnostico para que sea adaptativo
- Cambiar el prompt generator para que no dependa de clasificacion

### 3. Approach exploratorio
El scraper debe:
1. Explorar la home y secciones principales
2. Entender QUE es la empresa y QUE ofrece
3. Extraer productos/servicios segun lo que encuentre (no schema fijo)
4. No asumir que hay "modelos" ni "quinchos" - descubrir la terminologia de cada empresa

### 4. Preguntas generales de exploracion
Base para entender cualquier constructora:
1. Que es la empresa y que hace?
2. Que productos/servicios ofrece?
3. Que caracteristicas diferenciales tiene?
4. Para cada producto: nombre, specs, precio
5. Contacto (WhatsApp, telefono, email)

### 5. Pipeline de diagnostico adaptativo
- Ground truth: exploratorio (que hay realmente en el sitio?)
- Preguntas de test: generadas POR EMPRESA segun lo encontrado
- Diagnostico: evalua contra lo explorado, no contra schema fijo

## Que NO cambiar
- GPT-5.1 para el chat
- Firecrawl como herramienta de scraping
- La estructura general de la app (Next.js)

## Metricas de exito
- El agente responde correctamente sobre lo que la empresa realmente ofrece
- No inventa categorias ni productos
- Las preguntas de test son relevantes para cada empresa
- Score promedio >70% con el nuevo approach
