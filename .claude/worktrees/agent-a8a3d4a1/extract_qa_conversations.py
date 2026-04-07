#!/usr/bin/env python3
"""Extrae conversaciones QA del archivo JSON y genera markdown legible."""

import json
from pathlib import Path

def main():
    # Leer JSON
    json_path = Path("/Users/joaquingonzalez/Documents/dev/constructor-ai-simulator/logs/qa-baseline-after.json")
    with open(json_path) as f:
        data = json.load(f)

    # Preparar output
    output = ["# Conversaciones QA - 20 Empresas\n"]

    # Procesar cada empresa
    results = data.get("results", [])

    for idx, empresa in enumerate(results, 1):
        # Header empresa
        nombre = empresa.get("company_name", "Sin nombre")
        score = empresa.get("scorecard", {}).get("overall_score", 0)
        url = empresa.get("url", "N/A")
        modelos = empresa.get("models_extracted", 0)
        whatsapp = "Sí" if empresa.get("whatsapp_found") else "No"

        output.append(f"## {idx}. {nombre} (Score: {score}%)")
        output.append(f"**URL:** {url}")
        output.append(f"**Modelos extraídos:** {modelos}")
        output.append(f"**WhatsApp:** {whatsapp}\n")

        # Conversaciones
        conversations = empresa.get("conversations", [])

        for conv_idx, conv in enumerate(conversations, 1):
            pregunta = conv.get("question", "N/A")
            respuesta = conv.get("response", "N/A")
            analisis = conv.get("analysis", {})
            status = analisis.get("status", "N/A")

            output.append(f"### Pregunta {conv_idx}: {pregunta}")
            output.append(f"**Respuesta:** {respuesta}")
            output.append(f"**Análisis:** {status}")

            # Detalles del análisis si hay
            if analisis.get("reasoning"):
                output.append(f"**Razonamiento:** {analisis['reasoning']}")

            output.append("")  # Línea en blanco

        output.append("---\n")

    # Guardar
    output_path = Path("/Users/joaquingonzalez/Documents/dev/constructor-ai-simulator/logs/conversaciones-qa.md")
    output_path.write_text("\n".join(output), encoding="utf-8")

    print(f"✓ Conversaciones extraídas: {len(results)} empresas")
    print(f"✓ Guardado en: {output_path}")

if __name__ == "__main__":
    main()
