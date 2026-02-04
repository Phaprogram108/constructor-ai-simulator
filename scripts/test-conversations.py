#!/usr/bin/env python3
"""Test de conversaciones completas con 5 empresas"""

import json
import requests
import time
from datetime import datetime

BASE_URL = "http://localhost:3000"

# Empresas a testear
EMPRESAS = [
    {"url": "https://habika.ar/", "name": "Habika"},
    {"url": "https://www.modularte.com.ar/", "name": "Modularte"},
    {"url": "https://linkhome.cl/", "name": "LinkHome"},
    {"url": "https://www.builderpack.cl/", "name": "Builderpack"},
    {"url": "https://www.modularika.com/", "name": "Modularika"},
]

# Preguntas típicas de un cliente
PREGUNTAS = [
    "Hola, qué modelos de casas tienen disponibles?",
    "Cuánto cuesta aproximadamente el modelo más económico?",
    "Qué superficie tiene el modelo más grande?",
    "Cuánto tiempo demora la construcción?",
    "Hacen envíos a todo el país?",
]

def create_session(url):
    """Crea una sesión para una empresa"""
    try:
        resp = requests.post(
            f"{BASE_URL}/api/simulator/create",
            json={"websiteUrl": url},
            timeout=180
        )
        return resp.json()
    except Exception as e:
        return {"error": str(e)}

def send_message(session_id, system_prompt, message, history, company_name):
    """Envía un mensaje al chat"""
    try:
        resp = requests.post(
            f"{BASE_URL}/api/chat",
            json={
                "sessionId": session_id,
                "message": message,
                "systemPrompt": system_prompt,
                "conversationHistory": history,
                "companyName": company_name
            },
            timeout=60
        )
        data = resp.json()
        return data.get("message") or data.get("response") or data.get("error", "Sin respuesta")
    except Exception as e:
        return f"ERROR: {e}"

def test_empresa(empresa):
    """Testea una empresa con todas las preguntas"""
    print(f"\n{'='*60}")
    print(f"EMPRESA: {empresa['name']}")
    print(f"URL: {empresa['url']}")
    print('='*60)

    # Crear sesión
    print("\nCreando sesión...")
    start = time.time()
    session = create_session(empresa['url'])
    duration = time.time() - start

    if "error" in session and session["error"]:
        print(f"ERROR al crear sesión: {session['error']}")
        return {
            "empresa": empresa['name'],
            "url": empresa['url'],
            "status": "FAIL",
            "error": session['error'],
            "conversacion": []
        }

    session_id = session.get("sessionId", "")
    system_prompt = session.get("systemPrompt", "")
    company_name = session.get("companyName", empresa['name'])
    welcome = session.get("welcomeMessage", "")

    print(f"✓ Sesión creada en {duration:.1f}s")
    print(f"Company detectada: {company_name}")
    print(f"\n🤖 BIENVENIDA: {welcome[:200]}...")

    conversacion = []
    history = []

    # Hacer las preguntas
    for i, pregunta in enumerate(PREGUNTAS, 1):
        print(f"\n--- Pregunta {i}/{len(PREGUNTAS)} ---")
        print(f"👤 USUARIO: {pregunta}")

        respuesta = send_message(session_id, system_prompt, pregunta, history, company_name)
        print(f"🤖 SOFIA: {respuesta[:500]}{'...' if len(respuesta) > 500 else ''}")

        conversacion.append({
            "pregunta": pregunta,
            "respuesta": respuesta
        })

        # Actualizar historial
        history.append({"role": "user", "content": pregunta})
        history.append({"role": "assistant", "content": respuesta})

        time.sleep(1)  # Pequeña pausa entre mensajes

    return {
        "empresa": empresa['name'],
        "url": empresa['url'],
        "company_detectada": company_name,
        "tiempo_scraping": f"{duration:.1f}s",
        "status": "OK",
        "bienvenida": welcome,
        "conversacion": conversacion
    }

def main():
    print("="*60)
    print("TEST DE CONVERSACIONES - 5 EMPRESAS")
    print(f"Fecha: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("="*60)

    resultados = []

    for empresa in EMPRESAS:
        resultado = test_empresa(empresa)
        resultados.append(resultado)
        print("\n" + "-"*60)
        time.sleep(2)  # Pausa entre empresas

    # Guardar resultados
    output_file = f"logs/conversaciones-test-{datetime.now().strftime('%Y%m%d-%H%M%S')}.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(resultados, f, ensure_ascii=False, indent=2)

    print(f"\n\n{'='*60}")
    print("RESUMEN FINAL")
    print("="*60)

    for r in resultados:
        status = "✅" if r["status"] == "OK" else "❌"
        print(f"{status} {r['empresa']}: {r.get('tiempo_scraping', 'N/A')} - {r['status']}")

    print(f"\nResultados guardados en: {output_file}")

    # También guardar versión markdown
    md_file = f"docs/ANALISIS-CONVERSACIONES-{datetime.now().strftime('%Y%m%d')}.md"
    with open(md_file, 'w', encoding='utf-8') as f:
        f.write(f"# Análisis de Conversaciones - {datetime.now().strftime('%Y-%m-%d')}\n\n")

        for r in resultados:
            f.write(f"\n## {r['empresa']}\n")
            f.write(f"- **URL**: {r['url']}\n")
            f.write(f"- **Company detectada**: {r.get('company_detectada', 'N/A')}\n")
            f.write(f"- **Tiempo scraping**: {r.get('tiempo_scraping', 'N/A')}\n")
            f.write(f"- **Status**: {r['status']}\n")
            f.write(f"\n### Bienvenida\n{r.get('bienvenida', 'N/A')}\n")
            f.write(f"\n### Conversación\n")

            for i, conv in enumerate(r.get('conversacion', []), 1):
                f.write(f"\n**Pregunta {i}**: {conv['pregunta']}\n")
                f.write(f"\n**Respuesta**: {conv['respuesta']}\n")
                f.write("\n---\n")

    print(f"Análisis markdown guardado en: {md_file}")

if __name__ == "__main__":
    main()
