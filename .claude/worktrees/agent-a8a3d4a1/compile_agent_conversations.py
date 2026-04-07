#!/usr/bin/env python3
"""
Compila todas las conversaciones de agent-test.json en un solo markdown para Obsidian.
"""

import json
import os
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Any


def load_all_agent_tests(base_dir: str) -> List[Dict[str, Any]]:
    """Carga todos los archivos agent-test.json encontrados."""
    agent_tests = []
    ground_truth_path = Path(base_dir) / "ground-truth"

    for json_file in ground_truth_path.glob("*/agent-test.json"):
        try:
            with open(json_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
                agent_tests.append(data)
        except Exception as e:
            print(f"Error leyendo {json_file}: {e}")

    return sorted(agent_tests, key=lambda x: x.get('company', '').lower())


def format_datetime(iso_str: str) -> str:
    """Formatea timestamp ISO a formato legible."""
    try:
        dt = datetime.fromisoformat(iso_str.replace('Z', '+00:00'))
        return dt.strftime("%d/%m/%Y %H:%M")
    except:
        return iso_str


def extract_whatsapp(system_prompt_type: str) -> str:
    """Intenta extraer el número de WhatsApp del system prompt."""
    return "No detectado"


def calculate_stats(agent_tests: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Calcula estadísticas generales."""
    total_companies = len(agent_tests)
    total_questions = sum(len(test.get('conversations', [])) for test in agent_tests)

    no_info_count = 0
    has_data_count = 0

    for test in agent_tests:
        for conv in test.get('conversations', []):
            if conv.get('saidNoInfo'):
                no_info_count += 1
            if conv.get('hasSpecificData'):
                has_data_count += 1

    no_info_pct = (no_info_count / total_questions * 100) if total_questions > 0 else 0
    has_data_pct = (has_data_count / total_questions * 100) if total_questions > 0 else 0

    return {
        'total_companies': total_companies,
        'total_questions': total_questions,
        'no_info_count': no_info_count,
        'no_info_pct': no_info_pct,
        'has_data_count': has_data_count,
        'has_data_pct': has_data_pct
    }


def generate_markdown(agent_tests: List[Dict[str, Any]]) -> str:
    """Genera el contenido markdown."""
    stats = calculate_stats(agent_tests)
    today = datetime.now().strftime("%d/%m/%Y")

    md = f"""# Conversaciones Agent Test - Constructor AI Simulator

> Fecha de generación: {today}
> Total empresas: {stats['total_companies']} | Total preguntas: {stats['total_questions']} | No-info: {stats['no_info_pct']:.1f}% | Con datos específicos: {stats['has_data_pct']:.1f}%

---

"""

    for test in agent_tests:
        company_name = test.get('company', 'Unknown')
        url = test.get('url', 'N/A')
        tested_at = format_datetime(test.get('testedAt', ''))
        models_count = len(test.get('systemPromptModelsFound', []))
        whatsapp = extract_whatsapp(test.get('systemPromptType', ''))

        md += f"""## {company_name}
**URL:** {url}
**Testeado:** {tested_at}
**Modelos en prompt:** {models_count} modelos
**WhatsApp:** {whatsapp}

"""

        conversations = test.get('conversations', [])
        for i, conv in enumerate(conversations, 1):
            question = conv.get('question', '')
            question_type = conv.get('questionType', 'unknown')
            response = conv.get('response', '')
            response_time = conv.get('responseTimeMs', 0) / 1000
            no_info = conv.get('saidNoInfo', False)
            has_data = conv.get('hasSpecificData', False)
            mentioned_models = conv.get('mentionedModels', [])

            no_info_icon = "✅" if not no_info else "❌"
            has_data_icon = "✅" if has_data else "❌"

            md += f"""### Pregunta {i}: {question}
> **Tipo:** {question_type} | **Tiempo:** {response_time:.1f}s | **No info:** {no_info_icon} | **Datos específicos:** {has_data_icon}

{response}

**Modelos mencionados:** {', '.join(mentioned_models) if mentioned_models else 'ninguno'}

---

"""

        md += "\n"

    return md


def main():
    """Función principal."""
    base_dir = "/Users/joaquingonzalez/Documents/dev/constructor-ai-simulator"
    output_path = "/Users/joaquingonzalez/Documents/PHA Notes/proyectos/constructor-ai-conversaciones.md"

    print(f"Buscando archivos agent-test.json en {base_dir}/ground-truth...")
    agent_tests = load_all_agent_tests(base_dir)
    print(f"Encontrados {len(agent_tests)} archivos")

    if not agent_tests:
        print("No se encontraron archivos agent-test.json")
        return

    print("Generando markdown...")
    markdown_content = generate_markdown(agent_tests)

    output_dir = Path(output_path).parent
    output_dir.mkdir(parents=True, exist_ok=True)

    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(markdown_content)

    print(f"Archivo generado: {output_path}")
    print(f"Total de empresas: {len(agent_tests)}")
    total_questions = sum(len(test.get('conversations', [])) for test in agent_tests)
    print(f"Total de preguntas: {total_questions}")


if __name__ == "__main__":
    main()
