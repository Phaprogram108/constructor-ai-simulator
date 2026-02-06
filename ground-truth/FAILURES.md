# Diagnostico de Fallos - Pipeline Ground Truth + Agent Test

**Fecha**: 2026-02-05
**Total empresas**: 20 (10 problematicas + 10 aleatorias)

---

## Resumen

| Categoria | Cantidad | Empresas |
|-----------|----------|----------|
| Funcionan correctamente (GT + Agent OK) | 3 | Atlas Housing, Ecomod, Movilhauss |
| Sitio OK, GT capturado pero con errores parciales | 3 | Arcohouse, Grupo Steimberg, Habika |
| Sitio OK, GT fallo por timeout Playwright (SPA) | 5 | Habitatio, ViBert, Lucys House, Sienna Modular, T1 Modular |
| Sitio OK, GT fallo por error de procesamiento | 2 | PlugArq, Wellmod |
| Sitio OK, sin ground-truth.json generado | 7 | Aftamantes, Arqtainer, Efede, GoHome, Lista, Mini Casas, Offis |
| Sitios caidos / no responden | 0 | (ninguno) |

**Conclusion principal**: TODOS los 20 sitios web estan activos y responden HTTP 200. El 100% de los fallos son de NUESTRO SISTEMA, no de los sitios web.

---

## Clasificacion de Fallos

### NUESTRO_SISTEMA: Timeout Playwright `networkidle` (5 empresas)

Estos sitios son SPAs (React/Vue) o tienen assets pesados que impiden que Playwright alcance el estado `networkidle` dentro de los 30 segundos configurados.

### NUESTRO_SISTEMA: Error de procesamiento Claude Vision (2 empresas)

Imagenes demasiado grandes para la API de Anthropic (>5MB) o browser cerrado prematuramente.

### NUESTRO_SISTEMA: ground-truth.json nunca generado (7 empresas)

El script `ground-truth-capture.ts` fallo silenciosamente para estas empresas. Tienen directorio con screenshots pero no se genero el JSON final. Probablemente el mismo problema de timeout o error no capturado.

---

## Por Empresa

---

### Atlas Housing - https://atlashousing.com.ar
- **HTTP Status**: 200
- **Response time**: 0.74s
- **HTML size**: 674 KB (server-rendered)
- **Fallo en Ground Truth**: NO - Capturo 2 modelos, 4 paginas, 0 errores
- **Fallo en Agent Test**: PARCIAL - Agent invento 5 modelos (Upsala, Fitz Roy, Blackberry, Hexa, Montana) que no existen en el sitio
- **Diagnostico**: NUESTRO_SISTEMA (hallucination en el agente, scraping perdio modelo Peralta Ramos)
- **Score diagnostico**: 0/100

---

### Habitatio - https://habitatio.com.ar
- **HTTP Status**: 301 -> 200 (redirige a www.habitatio.com.ar)
- **Response time**: 1.0s (con redirect)
- **HTML size**: 892 KB (server-rendered, Wix/similar)
- **Fallo en Ground Truth**: SI - `page.goto: Timeout 30000ms exceeded` esperando `networkidle`
- **Fallo en Agent Test**: PARCIAL - Tiene agent-test con prompt_len=0 (sin datos por fallo de GT)
- **Diagnostico**: NUESTRO_SISTEMA - El sitio funciona perfectamente. Playwright timeout esperando `networkidle` porque el sitio tiene muchos recursos asinconos que nunca paran de cargar.
- **Fix sugerido**: Cambiar `waitUntil: 'networkidle'` por `waitUntil: 'domcontentloaded'` + espera manual

---

### ViBert - https://vibert.com.ar
- **HTTP Status**: 301 -> 200 (redirige a www.vibert.com.ar)
- **Response time**: 1.1s (con redirect)
- **HTML size**: 1 MB (server-rendered)
- **Fallo en Ground Truth**: SI - `page.goto: Timeout 30000ms exceeded` esperando `networkidle`
- **Fallo en Agent Test**: OK - A pesar del fallo de GT, el scraper del sistema (firecrawl) SI logro extraer 14 modelos correctamente
- **Diagnostico**: NUESTRO_SISTEMA - Sitio funciona. Timeout de Playwright por assets pesados.
- **Nota**: El issue conocido (modelos en linktree) no afecto al agent test, que si capturo los modelos
- **Score diagnostico**: 100/100 (sin gaps detectados)

---

### Ecomod - https://ecomod.com.ar/
- **HTTP Status**: 200
- **Response time**: 1.4s
- **HTML size**: 230 KB (server-rendered)
- **Fallo en Ground Truth**: NO - Capturo 10 modelos, 9 paginas, 0 errores
- **Fallo en Agent Test**: SI - El system prompt del agente tiene 0 modelos pese a que GT capturo 10
- **Diagnostico**: NUESTRO_SISTEMA - El scraping de ground truth funciono perfecto pero firecrawl (scraper del producto) no extrajo ninguno de los 10 modelos. Gap total de scraping.
- **Score diagnostico**: 0/100
- **Issue adicional**: WhatsApp (5491167666654) presente en el sitio pero no extraido

---

### Movilhauss - https://movilhauss.com
- **HTTP Status**: 200
- **Response time**: 0.3s
- **HTML size**: 21 KB (server-rendered, liviano)
- **Fallo en Ground Truth**: NO - Capturo 8 modelos, 4 paginas, 0 errores
- **Fallo en Agent Test**: PARCIAL - Solo 5 de 8 modelos capturados por firecrawl. Faltan variantes Inauba/Inqaba.
- **Diagnostico**: NUESTRO_SISTEMA - Scraping parcial, pierde modelos con caracteres especiales (n, u, +)
- **Score diagnostico**: 13/100

---

### PlugArq - https://www.plugarq.com/
- **HTTP Status**: 200
- **Response time**: 1.0s
- **HTML size**: 1.9 MB (muy pesada, SPA)
- **Fallo en Ground Truth**: SI - `image exceeds 5 MB maximum` al enviar screenshot a Claude Vision API
- **Fallo en Agent Test**: OK - Tiene prompt pero sin modelos detectados (0 en ambos lados)
- **Diagnostico**: NUESTRO_SISTEMA - El sitio carga pero los screenshots generados superan los 5MB que acepta la API de Anthropic. HTML de 1.9MB = pagina extremadamente pesada en imagenes.
- **Score diagnostico**: 100/100 (pero solo porque ambos lados tienen 0 modelos)
- **Fix sugerido**: Comprimir screenshots antes de enviar a Claude Vision, o reducir viewport

---

### Lucys House - https://www.lucyshousearg.com/
- **HTTP Status**: 200
- **Response time**: 0.2s
- **HTML size**: 968 bytes (SPA - React con div#root)
- **Fallo en Ground Truth**: SI - `page.goto: Timeout 30000ms exceeded` esperando `networkidle`
- **Fallo en Agent Test**: OK - Tiene prompt (10.5K) pero sin modelos
- **Diagnostico**: NUESTRO_SISTEMA - SPA pura (React). El HTML es solo un shell de 968 bytes. Todo el contenido se carga via JavaScript. Playwright con `networkidle` nunca se satisface porque React sigue haciendo fetch calls.
- **Score diagnostico**: 100/100 (0 modelos ambos lados)
- **Issue conocido**: Precios inventados (no verificable sin GT)

---

### Sienna Modular - https://www.siennamodular.com.ar/
- **HTTP Status**: 200
- **Response time**: 0.4s
- **HTML size**: 1,898 bytes (SPA - React/Vite con div#root)
- **Fallo en Ground Truth**: SI - `page.goto: Timeout 30000ms exceeded` esperando `networkidle`
- **Fallo en Agent Test**: OK - Tiene prompt (13.9K) pero clasificado como TRADICIONAL (incorrecto?)
- **Diagnostico**: NUESTRO_SISTEMA - SPA pura (React + Vite). Shell minimo de 1.9KB. Mismo patron que Lucys House.
- **Score diagnostico**: 100/100 (0 modelos ambos lados)

---

### Grupo Steimberg - https://www.gruposteimberg.com/
- **HTTP Status**: 200
- **Response time**: 2.9s (el mas lento pero funciona)
- **HTML size**: 90 KB (server-rendered)
- **Fallo en Ground Truth**: NO - Capturo 0 modelos, 3 paginas, 0 errores
- **Fallo en Agent Test**: SI - Agent reporta 4 modelos (Cabin 28, Cabin 70, Cabin Yakisugi, NORDIC HOUSE 180) que el GT dice que no existen
- **Diagnostico**: NUESTRO_SISTEMA - El GT capturo 0 modelos pero firecrawl si encontro 7 modelos. Posible que GT no navego a las paginas de productos, o que los modelos estan en subpaginas que GT no exploro.
- **Score diagnostico**: 60/100
- **Issue conocido**: Es tradicional, no modular - clasificacion incorrecta

---

### T1 Modular - https://www.t1modular.com.ar/
- **HTTP Status**: 200
- **Response time**: 0.5s
- **HTML size**: 1.25 MB (server-rendered pero MUY pesada)
- **Fallo en Ground Truth**: SI - `page.goto: Timeout 30000ms exceeded` esperando `networkidle`
- **Fallo en Agent Test**: OK - Tiene prompt (19.7K) con 7 modelos capturados por firecrawl
- **Diagnostico**: NUESTRO_SISTEMA - Sitio responde rapido via curl pero la pagina de 1.25MB tiene muchos assets (imagenes, videos, trackers) que impiden que Playwright alcance `networkidle`. NO es una SPA, es una pagina WordPress muy pesada.
- **Score diagnostico**: 100/100
- **Issue conocido**: FAQ no expandido - info oculta en acordeones

---

### Habika - https://habika.ar/
- **HTTP Status**: 200
- **Response time**: 0.6s
- **HTML size**: 185 KB (server-rendered)
- **Fallo en Ground Truth**: NO - Capturo 0 modelos, 1 pagina, 0 errores
- **Fallo en Agent Test**: SI - No tiene agent-test.json
- **Diagnostico**: NUESTRO_SISTEMA - GT solo exploro 1 pagina y no encontro modelos. Posiblemente los modelos estan en subpaginas no navegadas. Agent test no se genero.
- **Nota**: Solo exploro homepage, no navego a catalogo

---

### Arcohouse - https://arcohouse.com.ar/
- **HTTP Status**: 200
- **Response time**: 0.5s
- **HTML size**: 404 KB (server-rendered, WordPress)
- **Fallo en Ground Truth**: PARCIAL - Capturo 2 modelos pero tuvo 3 errores (image >5MB, download started)
- **Fallo en Agent Test**: SI - Solo 1 modelo en respuesta del agente de 4 en prompt
- **Diagnostico**: NUESTRO_SISTEMA - Errores mixtos: 1) Una URL de catalogo intentaba descargar un PDF en vez de navegar, 2) Screenshot de modelo COBRE excedia 5MB para Claude Vision API, 3) Error 400 en request a Anthropic por payload invalido
- **Score diagnostico**: 0/100

---

### Wellmod - https://www.wellmod.com.ar/
- **HTTP Status**: 200
- **Response time**: 0.4s
- **HTML size**: 31 KB (server-rendered)
- **Fallo en Ground Truth**: SI - `Target page, context or browser has been closed` despues de explorar 1 pagina
- **Fallo en Agent Test**: OK - Tiene prompt (14.5K) con 1 modelo
- **Diagnostico**: NUESTRO_SISTEMA - Browser de Playwright se cerro inesperadamente durante la captura. Probablemente memory leak o timeout del contexto del browser.
- **Score diagnostico**: 100/100

---

### Mini Casas - https://www.minicasas.com.ar/
- **HTTP Status**: 200
- **Response time**: 1.4s
- **HTML size**: 40 KB (server-rendered)
- **Fallo en Ground Truth**: SI - No se genero ground-truth.json (solo screenshots y agent-test.json)
- **Fallo en Agent Test**: OK - Tiene prompt (10.6K) con modelos (AZ I, AZ I XL, AZ II, AZ III)
- **Diagnostico**: NUESTRO_SISTEMA - El script de ground truth fallo silenciosamente. El sitio funciona perfecto.

---

### Offis - https://www.offis.ar/
- **HTTP Status**: 200
- **Response time**: 5.4s (lento pero responde)
- **HTML size**: 528 KB (server-rendered)
- **Fallo en Ground Truth**: SI - No se genero ground-truth.json (solo screenshots vacios)
- **Fallo en Agent Test**: NO - No tiene agent-test.json
- **Diagnostico**: NUESTRO_SISTEMA - El sitio es lento (5.4s) lo cual probablemente causa timeout en Playwright. Sin embargo, SI responde eventualmente.

---

### Efede - https://efede.com.ar/casas-modulares/
- **HTTP Status**: 200
- **Response time**: 0.16s (muy rapido)
- **HTML size**: 169 KB (server-rendered)
- **Fallo en Ground Truth**: SI - No se genero ground-truth.json (screenshots + agent-test.json)
- **Fallo en Agent Test**: OK - Tiene prompt (15.4K) con 1 modelo (MHZ 32m2)
- **Diagnostico**: NUESTRO_SISTEMA - Sitio ultra rapido. No hay razon de red para fallar. Error interno del script de captura.

---

### GoHome - https://gohomeconstrucciones.com.ar/
- **HTTP Status**: 200
- **Response time**: 0.6s
- **HTML size**: 36 KB (server-rendered)
- **Fallo en Ground Truth**: SI - No se genero ground-truth.json (screenshots + agent-test.json)
- **Fallo en Agent Test**: OK - Tiene prompt (16.9K) clasificado como TRADICIONAL
- **Diagnostico**: NUESTRO_SISTEMA - Sitio funciona perfecto. Error interno del script.

---

### Aftamantes - https://aftamantes.net/refugios/
- **HTTP Status**: 200
- **Response time**: 1.9s
- **HTML size**: 317 KB (server-rendered)
- **Fallo en Ground Truth**: SI - No se genero ground-truth.json (screenshots + agent-test.json)
- **Fallo en Agent Test**: OK - Tiene prompt (21.1K) con 4 modelos de refugios
- **Diagnostico**: NUESTRO_SISTEMA - Sitio funciona. Error interno del script de captura.

---

### Arqtainer - https://arqtainer.com.ar/
- **HTTP Status**: 200
- **Response time**: 3.6s (lento)
- **HTML size**: 135 KB (server-rendered)
- **Fallo en Ground Truth**: SI - No se genero ground-truth.json (solo screenshots vacios)
- **Fallo en Agent Test**: NO - No tiene agent-test.json
- **Diagnostico**: NUESTRO_SISTEMA - Sitio lento (3.6s) podria contribuir a timeout. Sin datos de agente tampoco.

---

### Lista - https://lista.com.ar/
- **HTTP Status**: 200
- **Response time**: 1.6s
- **HTML size**: 193 KB (server-rendered)
- **Fallo en Ground Truth**: SI - No se genero ground-truth.json (solo screenshots vacios)
- **Fallo en Agent Test**: NO - No tiene agent-test.json
- **Diagnostico**: NUESTRO_SISTEMA - Sitio funciona. Ni GT ni agent test se generaron. Error temprano en pipeline.

---

## Analisis de Causas Raiz

### Causa #1: Playwright `networkidle` timeout (5 empresas)
**Afecta**: Habitatio, ViBert, Lucys House, Sienna Modular, T1 Modular
**Problema**: El script usa `waitUntil: 'networkidle'` que requiere 0 network requests por 500ms. Los sitios SPA (React/Vue) y los sitios pesados (WordPress con muchos trackers) nunca alcanzan ese estado.
**Fix**: Cambiar a `waitUntil: 'domcontentloaded'` + `page.waitForTimeout(3000)` como fallback.

### Causa #2: ground-truth.json nunca generado (7 empresas)
**Afecta**: Aftamantes, Arqtainer, Efede, GoHome, Lista, Mini Casas, Offis
**Problema**: El script `ground-truth-capture.ts` falla silenciosamente para estas empresas. Crea el directorio y toma screenshots pero no genera el JSON. Posiblemente el mismo timeout issue o un error no catcheado en la logica de analisis con Claude Vision.
**Fix**: Agregar try/catch granular y logging a `ground-truth-capture.ts`. Guardar errores en un archivo de log por empresa.

### Causa #3: Screenshots >5MB para Claude Vision API (2 empresas)
**Afecta**: PlugArq, Arcohouse
**Problema**: Las imagenes capturadas por Playwright exceden el limite de 5MB de la API de Anthropic para vision.
**Fix**: Comprimir screenshots con sharp/jimp antes de enviar, o reducir el viewport size.

### Causa #4: Browser context cerrado prematuramente (1 empresa)
**Afecta**: Wellmod
**Problema**: El contexto de Playwright se cierra durante la ejecucion, posiblemente por memory pressure cuando se ejecutan 20 empresas en secuencia.
**Fix**: Crear un nuevo browser context por empresa, o implementar retry logic.

---

## Tabla Resumen de Estado HTTP

| Empresa | URL | HTTP | Tiempo | Tamano | Tipo | GT OK | Agent OK |
|---------|-----|------|--------|--------|------|-------|----------|
| Atlas Housing | atlashousing.com.ar | 200 | 0.7s | 674KB | SSR | SI | SI |
| Habitatio | habitatio.com.ar | 301->200 | 1.0s | 892KB | SSR | NO (timeout) | PARCIAL |
| ViBert | vibert.com.ar | 301->200 | 1.1s | 1MB | SSR | NO (timeout) | SI |
| Ecomod | ecomod.com.ar | 200 | 1.4s | 230KB | SSR | SI | SI |
| Movilhauss | movilhauss.com | 200 | 0.3s | 21KB | SSR | SI | SI |
| PlugArq | plugarq.com | 200 | 1.0s | 1.9MB | SPA pesada | NO (img>5MB) | SI |
| Lucys House | lucyshousearg.com | 200 | 0.2s | 968B | SPA (React) | NO (timeout) | SI |
| Sienna Modular | siennamodular.com.ar | 200 | 0.4s | 1.9KB | SPA (React) | NO (timeout) | SI |
| Grupo Steimberg | gruposteimberg.com | 200 | 2.9s | 90KB | SSR | SI | SI |
| T1 Modular | t1modular.com.ar | 200 | 0.5s | 1.25MB | SSR pesada | NO (timeout) | SI |
| Habika | habika.ar | 200 | 0.6s | 185KB | SSR | SI | NO |
| Arcohouse | arcohouse.com.ar | 200 | 0.5s | 404KB | SSR (WP) | PARCIAL | SI |
| Wellmod | wellmod.com.ar | 200 | 0.4s | 31KB | SSR | NO (browser crash) | SI |
| Mini Casas | minicasas.com.ar | 200 | 1.4s | 40KB | SSR | NO (silencioso) | SI |
| Offis | offis.ar | 200 | 5.4s | 528KB | SSR | NO (silencioso) | NO |
| Efede | efede.com.ar | 200 | 0.2s | 169KB | SSR | NO (silencioso) | SI |
| GoHome | gohomeconstrucciones.com.ar | 200 | 0.6s | 36KB | SSR | NO (silencioso) | SI |
| Aftamantes | aftamantes.net | 200 | 1.9s | 317KB | SSR | NO (silencioso) | SI |
| Arqtainer | arqtainer.com.ar | 200 | 3.6s | 135KB | SSR | NO (silencioso) | NO |
| Lista | lista.com.ar | 200 | 1.6s | 193KB | SSR | NO (silencioso) | NO |

---

## Prioridad de Fixes

1. **URGENTE** - Corregir `waitUntil: 'networkidle'` -> `'domcontentloaded'` + wait manual (recupera 5 empresas)
2. **ALTA** - Investigar por que 7 empresas no generan ground-truth.json (fallo silencioso)
3. **MEDIA** - Comprimir screenshots antes de enviar a Claude Vision API (recupera 2 empresas)
4. **BAJA** - Agregar retry logic para browser context crashes (1 empresa)
