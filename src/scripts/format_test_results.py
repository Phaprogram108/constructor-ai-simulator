#!/usr/bin/env python3
"""Format dynamic-test-results.json into a nicely formatted text file."""

import json
from pathlib import Path
from datetime import datetime

# Paths
RESULTS_FILE = Path("/Users/joaquingonzalez/Documents/dev/constructor-ai-simulator/src/scripts/dynamic-test-results.json")
OUTPUT_FILE = Path("/Users/joaquingonzalez/Documents/dev/constructor-ai-simulator/src/scripts/conversaciones-test.txt")


def format_company(result: dict) -> str:
    """Format a single company result."""
    company = result.get("company", "N/A")
    url = result.get("url", "N/A")
    status = result.get("status", "UNKNOWN")
    quality_score = result.get("qualityScore", 1)
    models_count = len(result.get("modelsFound", []))
    garbage_found = "Y" if result.get("garbageDetected") else "N"

    # Build header
    header = f"""================================================================================
EMPRESA: {company}
URL: {url}
Score: {quality_score}/5 | Status: {status} | Modelos: {models_count} | Garbage: {garbage_found}
================================================================================
"""

    # If failed, show error
    if status == "FAIL":
        error_messages = result.get("errorMessages", [])
        error_text = ", ".join(error_messages) if error_messages else "Unknown error"
        return header + f"ERROR: {error_text}\n" + "=" * 80 + "\n\n"

    # Build conversation
    conversation = result.get("conversation", [])
    if not conversation:
        return header + "ERROR: No conversation data\n" + "=" * 80 + "\n\n"

    messages = [header]

    # First message is usually the welcome (assistant)
    first_msg = conversation[0] if conversation else None
    if first_msg and first_msg.get("role") == "assistant":
        messages.append(f"\n[Bienvenida]\nBot: {first_msg.get('content', '')}\n")

    # Process remaining messages
    msg_counter = 1
    start_idx = 1 if (first_msg and first_msg.get("role") == "assistant") else 0

    for i in range(start_idx, len(conversation)):
        msg = conversation[i]
        role = msg.get("role", "unknown")
        content = msg.get("content", "")

        if role == "user":
            messages.append(f"\n[Mensaje {msg_counter}]\nUsuario: {content}")
            msg_counter += 1
        elif role == "assistant":
            messages.append(f"\nBot: {content}")

    # Add models and garbage info
    models_found = result.get("modelsFound", [])
    garbage_detected = result.get("garbageDetected", [])
    notes = result.get("notes", "")

    messages.append("\n\n---")

    if models_found:
        models_text = ", ".join(models_found)
        messages.append(f"\nModelos detectados: {models_text}")

    if garbage_detected:
        garbage_text = ", ".join(garbage_detected)
        messages.append(f"Garbage detectado: {garbage_text}")
    else:
        messages.append("\nGarbage detectado: Ninguno")

    if notes:
        messages.append(f"\nNotas: {notes}")

    messages.append("\n" + "=" * 80 + "\n\n")

    return "".join(messages)


def main():
    """Main function."""
    print(f"Reading {RESULTS_FILE}...")

    with open(RESULTS_FILE) as f:
        data = json.load(f)

    metadata = data.get("metadata", {})
    results = data.get("results", [])

    # Build header section
    created_at = metadata.get("createdAt", "Unknown")
    total_companies = metadata.get("totalCompanies", 0)
    total_time_ms = metadata.get("totalTimeMs", 0)
    skipped = metadata.get("skipped", [])

    total_time_sec = total_time_ms / 1000

    header = f"""================================================================================
                    REPORTE DE PRUEBAS - CONVERSACIONES
================================================================================

Fecha de generación: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
Fecha de test: {created_at}
Total de empresas: {total_companies}
Tiempo total: {total_time_sec:.1f}s ({total_time_ms}ms)

Empresas saltadas: {', '.join(skipped) if skipped else 'Ninguna'}

================================================================================
                               RESUMEN POR ESTADO
================================================================================

"""

    # Count by status
    status_counts = {}
    for result in results:
        status = result.get("status", "UNKNOWN")
        status_counts[status] = status_counts.get(status, 0) + 1

    status_lines = []
    for status, count in sorted(status_counts.items()):
        status_lines.append(f"  {status}: {count}")

    header += "\n".join(status_lines) + "\n"

    # Summary table
    header += f"""
================================================================================
                            TABLA DE EMPRESAS
================================================================================

{f'{"Empresa":<30} {"Score":<8} {"Status":<8} {"Modelos":<10} {"Garbage":<10}':<80}
{"-" * 80}
"""

    for result in results:
        company = result.get("company", "N/A")[:28]
        score = f"{result.get('qualityScore', 1)}/5"
        status = result.get("status", "UNKNOWN")
        models = len(result.get("modelsFound", []))
        garbage = "Y" if result.get("garbageDetected") else "N"

        line = f"{company:<30} {score:<8} {status:<8} {models:<10} {garbage:<10}"
        header += line + "\n"

    header += "\n" + "=" * 80 + "\n\n"
    header += "CONVERSACIONES DETALLADAS\n"
    header += "=" * 80 + "\n\n"

    # Build all company sections
    all_content = header

    for result in results:
        all_content += format_company(result)

    # Write output
    print(f"Writing to {OUTPUT_FILE}...")
    OUTPUT_FILE.write_text(all_content)

    print(f"\nDone! File created at {OUTPUT_FILE}")
    print(f"Total companies processed: {len(results)}")
    print(f"Output file size: {len(all_content) / 1024:.1f} KB")


if __name__ == "__main__":
    main()
