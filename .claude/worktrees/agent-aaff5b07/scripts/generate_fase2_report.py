#!/usr/bin/env python3
"""
Genera reporte Markdown de conversaciones con agentes de fase 2.
Lee agent-test.json files y crea reporte para Obsidian.
"""

import json
from pathlib import Path
from typing import Dict, List, Any, Optional
from datetime import datetime

# Constantes
GROUND_TRUTH_DIR = Path("/Users/joaquingonzalez/Documents/dev/constructor-ai-simulator/ground-truth")
OUTPUT_FILE = Path("/Users/joaquingonzalez/Documents/PHA Notes/proyectos/constructor-ai-conversaciones-fase2.md")

FASE2_COMPANIES = [
    "modular-homes", "casa-real-viviendas", "viviendas-rolon", "gauros-viviendas",
    "viviendas-apolo", "la-casa-mia", "viviendas-tecnohouse", "fullhouse-vivienda",
    "viviendas-el-fuerte", "viviendas-el-calafate", "dice-containers", "importainer",
    "contenedores-argentina", "buro-steel-framing", "steel-framing-america", "mashouse",
    "steel-tres-arroyos", "elemental-constructora", "steel-frame-constructora", "nova-viviendas"
]

def load_agent_test(company_slug: str) -> Optional[Dict[str, Any]]:
    """Carga el agent-test.json de una empresa."""
    file_path = GROUND_TRUTH_DIR / company_slug / "agent-test.json"

    if not file_path.exists():
        return None

    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            # Normalizar: conversations -> interactions
            if 'conversations' in data:
                data['interactions'] = data['conversations']
            return data
    except Exception as e:
        print(f"Error leyendo {file_path}: {e}")
        return None

def classify_response(interaction: Dict[str, Any]) -> str:
    """Clasifica el tipo de respuesta usando flags del JSON."""
    # Usar los flags del JSON si están disponibles
    if interaction.get('saidNoInfo', False):
        return "❌ NO INFO"

    if interaction.get('hasSpecificData', False):
        return "✅ SPECIFIC"

    # Fallback: analizar el texto
    response = interaction.get('response', '')
    response_lower = response.lower()

    no_info_phrases = [
        "no tengo",
        "no encuentro",
        "no está disponible",
        "no figura",
        "contactar directamente"
    ]

    if any(phrase in response_lower for phrase in no_info_phrases):
        return "❌ NO INFO"

    if len(response) > 100:
        return "✅ SPECIFIC"

    return "⚠️ VAGUE"

def calculate_stats(companies_data: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Calcula estadísticas generales."""
    total_companies = len(companies_data)
    total_questions = sum(len(c['interactions']) for c in companies_data)

    if total_questions == 0:
        return {
            'total_companies': total_companies,
            'total_questions': 0,
            'total_no_info': 0,
            'total_specific': 0,
            'avg_response_time': 0,
            'no_info_rate': 0
        }

    total_no_info = sum(
        1 for c in companies_data
        for i in c['interactions']
        if classify_response(i) == "❌ NO INFO"
    )
    total_specific = sum(
        1 for c in companies_data
        for i in c['interactions']
        if classify_response(i) == "✅ SPECIFIC"
    )

    avg_response_times = [
        i.get('responseTimeMs', 0)
        for c in companies_data
        for i in c['interactions']
    ]

    avg_response_time = sum(avg_response_times) / len(avg_response_times) if avg_response_times else 0

    return {
        'total_companies': total_companies,
        'total_questions': total_questions,
        'total_no_info': total_no_info,
        'total_specific': total_specific,
        'avg_response_time': avg_response_time,
        'no_info_rate': (total_no_info / total_questions * 100)
    }

def generate_markdown(companies_data: List[Dict[str, Any]]) -> str:
    """Genera el contenido Markdown completo."""
    stats = calculate_stats(companies_data)

    # Header
    md = f"""# Conversaciones Agentes IA - Fase 2

**Generado:** {datetime.now().strftime('%Y-%m-%d %H:%M')}

## Resumen Ejecutivo

- **Empresas analizadas:** {stats['total_companies']}
- **Total preguntas:** {stats['total_questions']}
- **Respuestas específicas:** {stats['total_specific']} ({stats['total_specific']/stats['total_questions']*100:.1f}%)
- **Sin información:** {stats['total_no_info']} ({stats['no_info_rate']:.1f}%)
- **Tiempo promedio de respuesta:** {stats['avg_response_time']/1000:.1f}s

### Top 5 Mejor Performance (menos respuestas sin info)

"""

    # Calcular performance por empresa
    performance = []
    for company in companies_data:
        questions = len(company['interactions'])
        no_info = sum(
            1 for i in company['interactions']
            if classify_response(i) == "❌ NO INFO"
        )
        no_info_rate = (no_info / questions * 100) if questions > 0 else 0
        performance.append((company['name'], no_info, no_info_rate))

    # Sort by no_info_rate ascending
    performance.sort(key=lambda x: x[2])

    for i, (name, no_info, rate) in enumerate(performance[:5], 1):
        md += f"{i}. **{name}** - {no_info}/20 sin info ({rate:.1f}%)\n"

    md += "\n### Top 5 Peor Performance (más respuestas sin info)\n\n"

    for i, (name, no_info, rate) in enumerate(performance[-5:][::-1], 1):
        md += f"{i}. **{name}** - {no_info}/20 sin info ({rate:.1f}%)\n"

    md += "\n---\n\n"

    # Sort companies alphabetically
    companies_data.sort(key=lambda c: c['name'])

    # Per company details
    for company in companies_data:
        md += f"\n## {company['name']}\n\n"
        md += f"**URL:** {company['url']}  \n"
        md += f"**Slug:** `{company['slug']}`  \n"
        md += f"**Modelos:** {company['models_count']}  \n"

        if company.get('whatsapp'):
            md += f"**WhatsApp:** {company['whatsapp']}  \n"

        md += f"**Preguntas:** {len(company['interactions'])}\n\n"

        # Interactions
        md += "### Conversaciones\n\n"

        for i, interaction in enumerate(company['interactions'], 1):
            classification = classify_response(interaction)
            response_time = interaction.get('responseTimeMs', 0) / 1000
            question_type = interaction.get('questionType', 'general')

            md += f"#### {i}. {interaction['question']} {classification}\n\n"
            md += f"**Tipo:** `{question_type}`  \n"
            md += f"**Respuesta:** {interaction['response']}\n\n"

            # Menciones de modelos si existen
            mentioned = interaction.get('mentionedModels', [])
            if mentioned:
                md += f"**Modelos mencionados:** {', '.join(mentioned)}  \n"

            md += f"*Tiempo: {response_time:.1f}s*\n\n"

        md += "---\n"

    return md

def print_summary_table(companies_data: List[Dict[str, Any]]):
    """Imprime tabla resumen en stdout."""
    print("\n" + "="*100)
    print("RESUMEN FASE 2 - AGENTES IA")
    print("="*100)
    print(f"{'Empresa':<35} {'Q':<5} {'NoInfo':<8} {'Specific':<10} {'AvgTime':<10} {'Models':<8}")
    print("-"*100)

    for company in sorted(companies_data, key=lambda c: c['name']):
        questions = len(company['interactions'])
        no_info = sum(
            1 for i in company['interactions']
            if classify_response(i) == "❌ NO INFO"
        )
        specific = sum(
            1 for i in company['interactions']
            if classify_response(i) == "✅ SPECIFIC"
        )

        avg_times = [
            i.get('responseTimeMs', 0)
            for i in company['interactions']
        ]
        avg_time = sum(avg_times) / len(avg_times) / 1000 if avg_times else 0

        name_short = company['name'][:33] + '..' if len(company['name']) > 35 else company['name']
        models = company.get('models_count', 0)

        print(f"{name_short:<35} {questions:<5} {no_info:<8} {specific:<10} {avg_time:.1f}s      {models:<8}")

    print("="*100 + "\n")

def main():
    """Función principal."""
    print("Cargando datos de agent-test.json de fase 2...")

    companies_data = []

    for slug in FASE2_COMPANIES:
        data = load_agent_test(slug)
        if data:
            companies_data.append({
                'slug': slug,
                'name': data.get('company', slug),
                'url': data.get('url', 'N/A'),
                'models_count': len(data.get('systemPromptModelsFound', [])),
                'whatsapp': data.get('whatsapp'),
                'interactions': data.get('interactions', [])
            })
            print(f"  ✓ {slug} - {len(data.get('interactions', []))} preguntas")
        else:
            print(f"  ✗ {slug} - No encontrado")

    if not companies_data:
        print("\nNo se encontraron datos. Verificar rutas.")
        return

    print(f"\nTotal cargado: {len(companies_data)} empresas")

    # Generar Markdown
    print("\nGenerando Markdown...")
    markdown_content = generate_markdown(companies_data)

    # Crear directorio si no existe
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)

    # Escribir archivo
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        f.write(markdown_content)

    print(f"✓ Archivo generado: {OUTPUT_FILE}")

    # Imprimir tabla resumen
    print_summary_table(companies_data)

if __name__ == "__main__":
    main()
