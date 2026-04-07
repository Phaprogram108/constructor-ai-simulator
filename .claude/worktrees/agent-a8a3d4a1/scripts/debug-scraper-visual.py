#!/usr/bin/env python3
"""
Script de debugging visual para identificar por qué el scraper inventa información.
Compara lo que Claude Vision ve en screenshots vs lo que el scraper extrae.
"""

import os
import sys
import json
import base64
import asyncio
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional
import aiohttp
from playwright.async_api import async_playwright, Browser, Page

# Config
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
API_BASE_URL = "http://localhost:3000"
SCREENSHOTS_DIR = Path("/tmp/debug-scraper")
REPORT_PATH = Path("/Users/joaquingonzalez/Documents/dev/constructor-ai-simulator/docs/DEBUG-SCRAPER-VISUAL.md")

# Crear directorio de screenshots
SCREENSHOTS_DIR.mkdir(parents=True, exist_ok=True)

# Empresas a testear
TEST_COMPANIES = [
    {
        "name": "ViBert",
        "url": "https://www.vibert.com.ar/",
        "expected_models": [],  # Llenar después de ver
        "expected_coverage": None
    },
    {
        "name": "T1 Modular",
        "url": "https://www.t1modular.com.ar/",
        "expected_models": [],
        "expected_coverage": None
    },
    {
        "name": "Casas Cube",
        "url": "https://www.casascube.com/",
        "expected_models": [],
        "expected_coverage": None
    }
]


async def take_screenshot(page: Page, name: str) -> str:
    """Toma screenshot y retorna el path."""
    filename = f"{name}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.jpg"
    filepath = SCREENSHOTS_DIR / filename

    # JPEG con quality para no exceder 5MB de Claude Vision
    await page.screenshot(path=str(filepath), full_page=False, type="jpeg", quality=75)
    print(f"[Screenshot] Guardado: {filepath}")

    return str(filepath)


async def encode_image(image_path: str) -> str:
    """Codifica imagen en base64."""
    with open(image_path, "rb") as f:
        return base64.b64encode(f.read()).decode("utf-8")


async def analyze_with_vision(image_path: str, prompt: str, max_retries: int = 3) -> str:
    """Usa Claude Vision (Haiku) para analizar un screenshot."""
    print(f"[Vision] Analizando {Path(image_path).name}...")

    image_b64 = await encode_image(image_path)

    for attempt in range(max_retries):
        try:
            connector = aiohttp.TCPConnector(ssl=False)  # Desactivar verificación SSL para evitar errores
            async with aiohttp.ClientSession(connector=connector) as session:
                headers = {
                    "x-api-key": ANTHROPIC_API_KEY,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json"
                }

                payload = {
                    "model": "claude-3-haiku-20240307",
                    "max_tokens": 2000,
                    "messages": [
                        {
                            "role": "user",
                            "content": [
                                {
                                    "type": "image",
                                    "source": {
                                        "type": "base64",
                                        "media_type": "image/jpeg",
                                        "data": image_b64
                                    }
                                },
                                {
                                    "type": "text",
                                    "text": prompt
                                }
                            ]
                        }
                    ]
                }

                async with session.post(
                    "https://api.anthropic.com/v1/messages",
                    headers=headers,
                    json=payload,
                    timeout=aiohttp.ClientTimeout(total=60)
                ) as response:
                    if response.status != 200:
                        error = await response.text()
                        raise Exception(f"API error: {error}")

                    data = await response.json()
                    return data["content"][0]["text"]

        except Exception as e:
            if attempt < max_retries - 1:
                print(f"[Vision] Intento {attempt + 1} falló, reintentando... ({e})")
                await asyncio.sleep(2 ** attempt)  # Backoff exponencial
            else:
                raise


async def scrape_website(url: str, browser: Browser) -> Dict:
    """Toma screenshots de las páginas clave y analiza con Vision."""
    print(f"\n[Scrape] Procesando: {url}")
    company_slug = url.split("//")[1].split("/")[0].replace(".", "_")

    context = await browser.new_context(
        user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        viewport={"width": 1280, "height": 720}
    )
    page = await context.new_page()

    screenshots = {}
    vision_results = {}

    try:
        # 1. Homepage
        print(f"[Scrape] Navegando a homepage...")
        try:
            await page.goto(url, wait_until="networkidle", timeout=60000)
        except Exception as e:
            print(f"[Scrape] networkidle timeout, usando domcontentloaded: {e}")
            await page.goto(url, wait_until="domcontentloaded", timeout=60000)
        await page.wait_for_timeout(3000)

        # Scroll para cargar contenido lazy
        await page.evaluate("""
            async () => {
                const delay = ms => new Promise(r => setTimeout(r, ms));
                for (let i = 0; i < 3; i++) {
                    window.scrollBy(0, window.innerHeight);
                    await delay(500);
                }
                window.scrollTo(0, 0);
            }
        """)
        await page.wait_for_timeout(2000)

        homepage_screenshot = await take_screenshot(page, f"{company_slug}_homepage")
        screenshots["homepage"] = homepage_screenshot

        # Analizar homepage con Vision
        homepage_prompt = """Analiza este screenshot de la homepage de una constructora.

Extrae SOLO la información que VES en la imagen:
1. Nombre de la empresa
2. Modelos/productos mencionados (nombres exactos)
3. Precios mencionados (exactos)
4. Cobertura geográfica/zonas de trabajo
5. Servicios ofrecidos

Responde en JSON:
{
  "company_name": "",
  "models": ["modelo 1", "modelo 2"],
  "prices": ["precio 1", "precio 2"],
  "coverage": "",
  "services": []
}

NO INVENTES nada. Solo lo que REALMENTE ves en la imagen."""

        vision_results["homepage"] = await analyze_with_vision(homepage_screenshot, homepage_prompt)

        # 2. Buscar y navegar a página de modelos/catálogo
        print(f"[Scrape] Buscando página de modelos...")
        model_keywords = ["modelo", "modelos", "casa", "casas", "catálogo", "productos", "viviendas"]

        # Buscar links con keywords de modelos
        links = await page.evaluate("""
            () => {
                const anchors = Array.from(document.querySelectorAll('a[href]'));
                return anchors.map(a => ({
                    href: a.href,
                    text: a.textContent.toLowerCase()
                }));
            }
        """)

        model_link = None
        for link in links:
            if any(kw in link["text"] for kw in model_keywords):
                model_link = link["href"]
                break

        if model_link:
            print(f"[Scrape] Navegando a: {model_link}")
            try:
                await page.goto(model_link, wait_until="networkidle", timeout=60000)
            except Exception as e:
                print(f"[Scrape] networkidle timeout en modelos: {e}")
                await page.goto(model_link, wait_until="domcontentloaded", timeout=60000)
            await page.wait_for_timeout(3000)

            # Scroll
            await page.evaluate("""
                async () => {
                    const delay = ms => new Promise(r => setTimeout(r, ms));
                    for (let i = 0; i < 5; i++) {
                        window.scrollBy(0, window.innerHeight);
                        await delay(500);
                    }
                    window.scrollTo(0, 0);
                }
            """)
            await page.wait_for_timeout(2000)

            models_screenshot = await take_screenshot(page, f"{company_slug}_models")
            screenshots["models"] = models_screenshot

            # Analizar modelos con Vision
            models_prompt = """Analiza este screenshot de la página de modelos/catálogo.

Extrae TODOS los modelos que VES:
- Nombre exacto del modelo
- Metros cuadrados (m²)
- Número de dormitorios
- Número de baños
- Precio (si visible)
- Características destacadas

Responde en JSON:
{
  "models": [
    {
      "name": "nombre exacto",
      "area_m2": "X m²",
      "bedrooms": X,
      "bathrooms": X,
      "price": "USD XXXXX o vacío",
      "features": ["característica 1", "característica 2"]
    }
  ]
}

IMPORTANTE: SOLO extrae lo que VES. No inventes."""

            vision_results["models"] = await analyze_with_vision(models_screenshot, models_prompt)
        else:
            print(f"[Scrape] No se encontró página de modelos")

        # 3. Buscar página de cobertura/envíos
        print(f"[Scrape] Buscando página de cobertura...")
        coverage_keywords = ["cobertura", "envíos", "zonas", "dónde trabajamos", "alcance"]

        coverage_link = None
        for link in links:
            if any(kw in link["text"] for kw in coverage_keywords):
                coverage_link = link["href"]
                break

        if coverage_link:
            print(f"[Scrape] Navegando a: {coverage_link}")
            try:
                await page.goto(coverage_link, wait_until="networkidle", timeout=60000)
            except Exception as e:
                print(f"[Scrape] networkidle timeout en cobertura: {e}")
                await page.goto(coverage_link, wait_until="domcontentloaded", timeout=60000)
            await page.wait_for_timeout(3000)

            coverage_screenshot = await take_screenshot(page, f"{company_slug}_coverage")
            screenshots["coverage"] = coverage_screenshot

            coverage_prompt = """Analiza este screenshot sobre cobertura geográfica.

Extrae:
- Provincias/ciudades mencionadas
- Alcance del servicio
- Frases exactas sobre cobertura

Responde en JSON:
{
  "locations": ["ciudad/provincia 1", "ciudad/provincia 2"],
  "scope": "descripción del alcance",
  "exact_phrases": ["frase 1", "frase 2"]
}"""

            vision_results["coverage"] = await analyze_with_vision(coverage_screenshot, coverage_prompt)
        else:
            print(f"[Scrape] No se encontró página de cobertura")

    finally:
        await context.close()

    return {
        "screenshots": screenshots,
        "vision_results": vision_results
    }


async def call_scraper_api(url: str) -> Dict:
    """Llama al endpoint /api/simulator/create para obtener lo que el scraper extrae."""
    print(f"[API] Llamando a scraper API para: {url}")

    async with aiohttp.ClientSession() as session:
        async with session.post(
            f"{API_BASE_URL}/api/simulator/create",
            json={"websiteUrl": url},
            timeout=aiohttp.ClientTimeout(total=120)
        ) as response:
            if response.status != 200:
                error = await response.text()
                raise Exception(f"Scraper API error: {error}")

            data = await response.json()
            print(f"[API] Response: sessionId={data.get('sessionId')}")
            return data


def parse_vision_json(text: str) -> Dict:
    """Extrae JSON del texto de respuesta de Vision."""
    try:
        # Buscar JSON en el texto
        start = text.find("{")
        end = text.rfind("}") + 1
        if start >= 0 and end > start:
            json_str = text[start:end]
            return json.loads(json_str)
        return {}
    except Exception as e:
        print(f"[Error] No se pudo parsear JSON de Vision: {e}")
        return {}


def compare_results(vision_data: Dict, scraper_data: Dict, company_name: str) -> Dict:
    """Compara los resultados de Vision vs Scraper."""
    print(f"\n[Compare] Comparando resultados para {company_name}")

    # Parsear resultados de Vision
    homepage_vision = parse_vision_json(vision_data["vision_results"].get("homepage", "{}"))
    models_vision = parse_vision_json(vision_data["vision_results"].get("models", "{}"))
    coverage_vision = parse_vision_json(vision_data["vision_results"].get("coverage", "{}"))

    # Extraer modelos del system prompt del scraper
    system_prompt = scraper_data.get("systemPrompt", "")

    comparison = {
        "company": company_name,
        "vision_homepage": homepage_vision,
        "vision_models": models_vision,
        "vision_coverage": coverage_vision,
        "scraper_system_prompt_excerpt": system_prompt[:2000] if system_prompt else "",
        "discrepancies": []
    }

    # Detectar discrepancias
    vision_models_list = [m.get("name", "") for m in models_vision.get("models", [])]

    # Buscar modelos en el system prompt
    scraper_has_models = "modelo" in system_prompt.lower() or "casa" in system_prompt.lower()

    if vision_models_list and not scraper_has_models:
        comparison["discrepancies"].append({
            "type": "missing_models",
            "description": f"Vision detectó {len(vision_models_list)} modelos pero el scraper no los mencionó",
            "vision_found": vision_models_list
        })

    # Comparar cobertura
    vision_coverage_text = coverage_vision.get("scope", "") or homepage_vision.get("coverage", "")
    if vision_coverage_text:
        if vision_coverage_text.lower() not in system_prompt.lower():
            comparison["discrepancies"].append({
                "type": "coverage_mismatch",
                "description": "La cobertura que Vision ve no coincide con el scraper",
                "vision_found": vision_coverage_text
            })

    return comparison


def generate_markdown_report(results: List[Dict]) -> str:
    """Genera el reporte en Markdown."""
    report = f"""# Debug Scraper Visual - Reporte

**Fecha**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

**Objetivo**: Identificar por qué el agente inventa información comparando:
- Lo que Claude Vision VE en screenshots reales
- Lo que el scraper extrae y pasa al agente

---

"""

    for result in results:
        company = result["company"]
        vision_data = result["vision_data"]
        scraper_data = result["scraper_data"]
        comparison = result["comparison"]

        report += f"""## {company}

### URL
{result["url"]}

### Screenshots Capturados

"""

        # Listar screenshots
        for key, path in vision_data["screenshots"].items():
            report += f"- **{key.capitalize()}**: `{path}`\n"

        report += "\n### Análisis de Vision (Lo que realmente VE)\n\n"

        # Homepage
        homepage_vision = comparison["vision_homepage"]
        report += f"""#### Homepage
- **Empresa**: {homepage_vision.get('company_name', 'N/A')}
- **Modelos mencionados**: {', '.join(homepage_vision.get('models', [])) or 'Ninguno'}
- **Precios**: {', '.join(homepage_vision.get('prices', [])) or 'Ninguno'}
- **Cobertura**: {homepage_vision.get('coverage', 'N/A')}
- **Servicios**: {', '.join(homepage_vision.get('services', [])) or 'Ninguno'}

"""

        # Modelos
        models_vision = comparison["vision_models"]
        if models_vision.get("models"):
            report += "#### Página de Modelos\n\n"
            report += "| Nombre | m² | Dormitorios | Baños | Precio | Características |\n"
            report += "|--------|-----|-------------|-------|--------|----------------|\n"

            for model in models_vision["models"]:
                name = model.get("name", "N/A")
                area = model.get("area_m2", "N/A")
                beds = model.get("bedrooms", "N/A")
                baths = model.get("bathrooms", "N/A")
                price = model.get("price", "N/A")
                features = ", ".join(model.get("features", []))

                report += f"| {name} | {area} | {beds} | {baths} | {price} | {features} |\n"

            report += "\n"

        # Cobertura
        coverage_vision = comparison["vision_coverage"]
        if coverage_vision:
            report += f"""#### Cobertura Geográfica
- **Alcance**: {coverage_vision.get('scope', 'N/A')}
- **Localidades**: {', '.join(coverage_vision.get('locations', [])) or 'N/A'}
- **Frases exactas**: {', '.join(coverage_vision.get('exact_phrases', [])) or 'N/A'}

"""

        report += "\n### Lo que el Scraper Extrajo\n\n"
        report += f"""**Empresa**: {scraper_data.get('companyName', 'N/A')}

**Excerpt del System Prompt** (primeros 2000 caracteres):
```
{comparison["scraper_system_prompt_excerpt"]}
```

"""

        # Discrepancias
        report += "\n### Discrepancias Detectadas\n\n"

        if comparison["discrepancies"]:
            for i, discrepancy in enumerate(comparison["discrepancies"], 1):
                report += f"""#### {i}. {discrepancy['type'].replace('_', ' ').title()}

**Descripción**: {discrepancy['description']}

"""
                if "vision_found" in discrepancy:
                    report += f"**Vision encontró**: {discrepancy['vision_found']}\n\n"
        else:
            report += "_No se detectaron discrepancias mayores._\n\n"

        report += "\n---\n\n"

    # Conclusiones
    report += """## Conclusiones y Diagnóstico

### Problemas Identificados

[Basado en las discrepancias encontradas, listar los principales problemas]

### Causas Probables

1. **El scraper no está navegando a las páginas correctas**
   - Podría estar extrayendo solo de la homepage
   - No está siguiendo links a catálogos

2. **El contenido no se carga completamente**
   - Sitios con lazy loading no terminan de cargar
   - JavaScript no se ejecuta correctamente

3. **El prompt de extracción no está siendo específico**
   - Claude Sonnet está haciendo suposiciones
   - No hay suficiente contexto en el rawText

### Recomendaciones

1. **Mejorar navegación multi-página**: Asegurar que el scraper navega a TODAS las páginas relevantes
2. **Aumentar tiempos de espera**: Dar más tiempo para que JS renderice
3. **Validar extracción con Vision**: Usar Vision API antes de pasar datos al agente
4. **Prompt más estricto**: Agregar instrucciones explícitas de NO inventar

---

**Screenshots guardados en**: `/tmp/debug-scraper/`
"""

    return report


async def main():
    """Main function."""
    print("=" * 80)
    print("DEBUG SCRAPER VISUAL")
    print("=" * 80)

    if not ANTHROPIC_API_KEY:
        print("ERROR: ANTHROPIC_API_KEY no configurada")
        sys.exit(1)

    results = []

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)

        for company in TEST_COMPANIES:
            print(f"\n{'=' * 80}")
            print(f"Procesando: {company['name']}")
            print(f"{'=' * 80}")

            try:
                # 1. Scrape visual con screenshots
                vision_data = await scrape_website(company["url"], browser)

                # 2. Llamar al scraper API
                scraper_data = await call_scraper_api(company["url"])

                # 3. Comparar resultados
                comparison = compare_results(vision_data, scraper_data, company["name"])

                results.append({
                    "company": company["name"],
                    "url": company["url"],
                    "vision_data": vision_data,
                    "scraper_data": scraper_data,
                    "comparison": comparison
                })

            except Exception as e:
                print(f"[Error] Error procesando {company['name']}: {e}")
                import traceback
                traceback.print_exc()

        await browser.close()

    # Generar reporte
    print(f"\n{'=' * 80}")
    print("Generando reporte...")
    print(f"{'=' * 80}")

    report = generate_markdown_report(results)

    # Guardar reporte
    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(REPORT_PATH, "w", encoding="utf-8") as f:
        f.write(report)

    print(f"\n✓ Reporte generado: {REPORT_PATH}")
    print(f"✓ Screenshots: {SCREENSHOTS_DIR}")
    print("\nResumen:")

    for result in results:
        print(f"  - {result['company']}: {len(result['comparison']['discrepancies'])} discrepancias")


if __name__ == "__main__":
    asyncio.run(main())
