#!/usr/bin/env python3
"""
Genera un reporte Markdown legible de todas las conversaciones del agent-test.
Lee todos los archivos agent-test.json y ground-truth.json de ground-truth/*/
"""

import json
import os
from pathlib import Path
from typing import Any, Dict, List, Optional


def load_json(file_path: Path) -> Optional[Dict[str, Any]]:
    """Carga un archivo JSON, retorna None si no existe o falla."""
    try:
        with open(file_path) as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return None


def format_list(items: List[str]) -> str:
    """Formatea una lista como string comma-separated."""
    if not items:
        return "N/A"
    return ", ".join(items)


def format_boolean(value: bool) -> str:
    """Formatea boolean como SI/NO."""
    return "SI" if value else "NO"


def format_response_time(ms: int) -> str:
    """Formatea tiempo de respuesta en formato legible."""
    if ms >= 1000:
        return f"{ms/1000:.1f}s"
    return f"{ms}ms"


def get_company_slug(company_name: str) -> str:
    """Genera slug del nombre de empresa (similar a slugify de TS)."""
    slug = company_name.lower()
    slug = slug.replace(" ", "-")
    slug = "".join(c for c in slug if c.isalnum() or c == "-")
    return slug


def generate_report(ground_truth_dir: Path, output_file: Path) -> None:
    """Genera el reporte completo de conversaciones."""

    # Recolectar todos los datos
    companies_data = []
    failed_companies = []
    total_questions = 0

    # Buscar todas las carpetas en ground-truth/
    if not ground_truth_dir.exists():
        print(f"❌ No existe directorio: {ground_truth_dir}")
        return

    company_dirs = [d for d in ground_truth_dir.iterdir() if d.is_dir()]

    for company_dir in sorted(company_dirs):
        agent_test_path = company_dir / "agent-test.json"
        ground_truth_path = company_dir / "ground-truth.json"

        agent_data = load_json(agent_test_path)
        ground_truth = load_json(ground_truth_path)

        if not agent_data:
            continue

        # Verificar si hay errores
        if agent_data.get("errors"):
            failed_companies.append({
                "name": agent_data.get("company", company_dir.name),
                "url": agent_data.get("url", "N/A"),
                "reason": agent_data["errors"][0]
            })
            continue

        # Datos de conversaciones válidas
        conversations = agent_data.get("conversations", [])
        total_questions += len(conversations)

        companies_data.append({
            "agent": agent_data,
            "ground_truth": ground_truth,
            "dir_name": company_dir.name
        })

    # Generar Markdown
    lines = []
    lines.append("# Conversaciones del Agente - Reporte Completo\n")
    lines.append("## Resumen\n")
    lines.append(f"- **Total empresas testeadas**: {len(companies_data)}")
    lines.append(f"- **Total preguntas realizadas**: {total_questions}")
    lines.append(f"- **Empresas fallidas**: {len(failed_companies)}")

    if failed_companies:
        lines.append("\n### Empresas Fallidas")
        for fc in failed_companies:
            lines.append(f"- **{fc['name']}** ({fc['url']}): {fc['reason']}")

    lines.append("\n---\n")

    # Reportar cada empresa exitosa
    for idx, data in enumerate(companies_data, 1):
        agent = data["agent"]
        ground_truth = data["ground_truth"]

        lines.append(f"## {idx}. {agent.get('company', 'Sin Nombre')} - {agent.get('url', 'N/A')}\n")
        lines.append(f"**Estado**: ✅ OK")
        lines.append(f"**Tipo detectado**: {agent.get('systemPromptType', 'N/A')}")

        models_in_prompt = agent.get('systemPromptModelsFound', [])
        lines.append(f"**Modelos en system prompt**: {format_list(models_in_prompt)}")

        whatsapp = agent.get('systemPromptWhatsApp', 'N/A')
        lines.append(f"**WhatsApp en prompt**: {whatsapp}")

        if ground_truth:
            gt_models = [m.get('name', 'Unknown') for m in ground_truth.get('models', [])]
            lines.append(f"**Ground Truth (Playwright)**: {len(gt_models)} modelos encontrados")

        lines.append(f"**Session ID**: `{agent.get('sessionId', 'N/A')}`")
        lines.append(f"**System Prompt Length**: {agent.get('systemPromptLength', 0)} caracteres\n")

        # Conversaciones
        lines.append("### Conversación\n")

        conversations = agent.get('conversations', [])
        for q_idx, conv in enumerate(conversations, 1):
            question = conv.get('question', '[Sin pregunta]')
            question_type = conv.get('questionType', 'unknown')
            response = conv.get('response', '[Sin respuesta]')
            response_time = conv.get('responseTimeMs', 0)
            has_specific_data = conv.get('hasSpecificData', False)
            said_no_info = conv.get('saidNoInfo', False)
            mentioned_models = conv.get('mentionedModels', [])

            lines.append(f"**Pregunta {q_idx}** (tipo: `{question_type}`)")
            lines.append(f"> {question}\n")

            metadata = f"{format_response_time(response_time)} | "
            metadata += f"info específica: {format_boolean(has_specific_data)} | "
            metadata += f"dijo no tener info: {format_boolean(said_no_info)}"

            if mentioned_models:
                metadata += f" | modelos mencionados: {format_list(mentioned_models)}"

            lines.append(f"**Respuesta** ({metadata})")
            lines.append(f"> {response}\n")

        # Diagnóstico comparativo
        if ground_truth:
            lines.append("### Diagnóstico Comparativo\n")

            gt_models = set(m.get('name', '') for m in ground_truth.get('models', []))

            # Recolectar todos los modelos mencionados en las conversaciones
            agent_mentioned = set()
            for conv in conversations:
                agent_mentioned.update(conv.get('mentionedModels', []))

            # También incluir los del system prompt
            agent_mentioned.update(models_in_prompt)

            # Modelos del GT no mencionados por el agente
            missing_in_agent = gt_models - agent_mentioned
            if missing_in_agent:
                lines.append(f"⚠️ **Modelos del Ground Truth NO mencionados por el agente**: {format_list(sorted(missing_in_agent))}")
            else:
                lines.append("✅ **Todos los modelos del Ground Truth fueron mencionados**")

            # Modelos mencionados por el agente no en GT
            extra_in_agent = agent_mentioned - gt_models
            if extra_in_agent:
                lines.append(f"⚠️ **Modelos mencionados por el agente NO en Ground Truth**: {format_list(sorted(extra_in_agent))}")
            else:
                lines.append("✅ **No hay modelos extra mencionados**")

        lines.append("\n---\n")

    # Reportar empresas fallidas al final
    if failed_companies:
        lines.append("## Empresas con Errores\n")
        for idx, fc in enumerate(failed_companies, 1):
            lines.append(f"### {idx}. {fc['name']} - {fc['url']}\n")
            lines.append(f"**Estado**: ❌ FAILED")
            lines.append(f"**Razón**: {fc['reason']}\n")
            lines.append("---\n")

    # Escribir archivo
    output_content = "\n".join(lines)
    output_file.write_text(output_content, encoding="utf-8")

    print(f"✅ Reporte generado: {output_file}")
    print(f"   - {len(companies_data)} empresas exitosas")
    print(f"   - {total_questions} preguntas totales")
    print(f"   - {len(failed_companies)} empresas fallidas")


def main():
    """Función principal."""
    project_root = Path(__file__).parent.parent
    ground_truth_dir = project_root / "ground-truth"
    output_file = ground_truth_dir / "CONVERSATIONS.md"

    print(f"📁 Buscando datos en: {ground_truth_dir}")
    generate_report(ground_truth_dir, output_file)


if __name__ == "__main__":
    main()
