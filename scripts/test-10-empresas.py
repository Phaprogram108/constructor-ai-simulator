#!/usr/bin/env python3
"""Test robusto de 10 empresas con preguntas rotadas"""

import json
import requests
import time
from datetime import datetime

BASE_URL = "http://localhost:3000"

# 10 Empresas a testear
EMPRESAS = [
    {"url": "https://www.t1modular.com.ar/", "name": "T1 Modular", "pais": "Argentina"},
    {"url": "https://gohomeconstrucciones.com.ar/", "name": "GoHome", "pais": "Argentina"},
    {"url": "https://www.boxercontainers.com.ar/", "name": "Boxer Containers", "pais": "Argentina"},
    {"url": "https://www.casasimple.uy/", "name": "Casa Simple", "pais": "Uruguay"},
    {"url": "https://enkasa.com.co/", "name": "Enkasa", "pais": "Colombia"},
    {"url": "https://blockhouse-chile.com/", "name": "BlockHouse Chile", "pais": "Chile"},
    {"url": "https://www.promet.cl/promet-habitacional/", "name": "Promet", "pais": "Chile"},
    {"url": "https://www.smartpod.mx/", "name": "SmartPod", "pais": "Mexico"},
    {"url": "https://fincah.com/", "name": "Fincah", "pais": "Mexico"},
    {"url": "https://www.vmd.com.mx/", "name": "VMD", "pais": "Mexico"},
]

# Preguntas base por categoría
PREGUNTAS = {
    "basica_1": "Hola, qué modelos de casas tienen disponibles?",
    "basica_2": "Cuánto cuesta aproximadamente el modelo más económico?",
    "basica_3": "Qué superficie tiene el modelo más grande?",
    "proceso_4": "Cuánto tiempo demora la construcción?",
    "proceso_5": "Qué incluye la obra gris?",
    "proceso_6": "El precio incluye las terminaciones o van aparte?",
    "cobertura_7": "En qué zonas construyen?",
    "cobertura_8": "Hacen envíos a todo el país?",
    "finanzas_9": "Qué formas de pago tienen?",
    "finanzas_10": "Trabajan con créditos hipotecarios?",
    "custom_11": "Puedo modificar el diseño de un modelo?",
    "custom_12": "Hacen proyectos a medida o solo los del catálogo?",
    "tecnica_13": "De qué material están hechas las casas?",
    "tecnica_14": "Qué garantía ofrecen?",
    "tecnica_15": "Ya tengo un plano hecho, pueden construirlo?",
}

# Rotación de preguntas por empresa (8 preguntas cada una)
ROTACION = [
    ["basica_1", "basica_2", "basica_3", "proceso_4", "proceso_5", "cobertura_7", "finanzas_9", "tecnica_13"],
    ["basica_1", "basica_2", "basica_3", "proceso_4", "proceso_6", "cobertura_8", "finanzas_10", "tecnica_14"],
    ["basica_1", "basica_2", "basica_3", "proceso_5", "proceso_6", "cobertura_7", "custom_11", "tecnica_15"],
    ["basica_1", "basica_2", "basica_3", "proceso_4", "proceso_5", "cobertura_8", "finanzas_9", "custom_12"],
    ["basica_1", "basica_2", "basica_3", "proceso_4", "proceso_6", "cobertura_7", "finanzas_10", "tecnica_13"],
    ["basica_1", "basica_2", "basica_3", "proceso_5", "proceso_6", "cobertura_8", "custom_11", "tecnica_14"],
    ["basica_1", "basica_2", "basica_3", "proceso_4", "proceso_5", "cobertura_7", "custom_12", "tecnica_15"],
    ["basica_1", "basica_2", "basica_3", "proceso_4", "proceso_6", "cobertura_8", "finanzas_9", "tecnica_13"],
    ["basica_1", "basica_2", "basica_3", "proceso_5", "proceso_6", "cobertura_7", "finanzas_10", "custom_11"],
    ["basica_1", "basica_2", "basica_3", "proceso_4", "proceso_5", "cobertura_8", "custom_12", "tecnica_14"],
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


def evaluar_respuesta(pregunta_key, respuesta, empresa):
    """Evalúa la calidad de una respuesta"""
    evaluacion = {
        "tiene_info_especifica": False,
        "parece_inventado": False,
        "hace_seguimiento": False,
        "admite_no_saber": False,
    }

    resp_lower = respuesta.lower()

    # Detectar si tiene información específica
    if any(x in resp_lower for x in ["m²", "metros", "dormitorio", "baño", "usd", "$", "modelo"]):
        evaluacion["tiene_info_especifica"] = True

    # Detectar si hace preguntas de seguimiento
    if "?" in respuesta and any(x in resp_lower for x in ["terreno", "zona", "cuándo", "presupuesto"]):
        evaluacion["hace_seguimiento"] = True

    # Detectar si admite no tener info
    if any(x in resp_lower for x in ["no tengo", "no dispongo", "contactanos", "whatsapp"]):
        evaluacion["admite_no_saber"] = True

    return evaluacion


def test_empresa(empresa, preguntas_keys, idx):
    """Testea una empresa con sus preguntas asignadas"""
    print(f"\n{'='*60}")
    print(f"[{idx+1}/10] EMPRESA: {empresa['name']} ({empresa['pais']})")
    print(f"URL: {empresa['url']}")
    print('='*60)

    # Crear sesión
    print("\nCreando sesión...")
    start = time.time()
    session = create_session(empresa['url'])
    duration = time.time() - start

    if "error" in session and session["error"]:
        print(f"❌ ERROR al crear sesión: {session['error']}")
        return {
            "empresa": empresa['name'],
            "pais": empresa['pais'],
            "url": empresa['url'],
            "status": "FAIL_SESSION",
            "tiempo_scraping": f"{duration:.1f}s",
            "error": session['error'],
            "conversacion": []
        }

    session_id = session.get("sessionId", "")
    system_prompt = session.get("systemPrompt", "")
    company_name = session.get("companyName", empresa['name'])
    welcome = session.get("welcomeMessage", "")

    print(f"✓ Sesión creada en {duration:.1f}s")
    print(f"Company detectada: {company_name}")

    conversacion = []
    history = []
    evaluaciones = []

    # Hacer las preguntas asignadas
    for i, pregunta_key in enumerate(preguntas_keys, 1):
        pregunta = PREGUNTAS[pregunta_key]
        print(f"\n[{i}/8] {pregunta_key}")
        print(f"👤: {pregunta[:60]}...")

        respuesta = send_message(session_id, system_prompt, pregunta, history, company_name)
        print(f"🤖: {respuesta[:100]}...")

        evaluacion = evaluar_respuesta(pregunta_key, respuesta, empresa)
        evaluaciones.append(evaluacion)

        conversacion.append({
            "pregunta_key": pregunta_key,
            "pregunta": pregunta,
            "respuesta": respuesta,
            "evaluacion": evaluacion
        })

        # Actualizar historial
        history.append({"role": "user", "content": pregunta})
        history.append({"role": "assistant", "content": respuesta})

        time.sleep(1)

    # Calcular score
    total_especifica = sum(1 for e in evaluaciones if e["tiene_info_especifica"])
    total_seguimiento = sum(1 for e in evaluaciones if e["hace_seguimiento"])

    score = (total_especifica / len(evaluaciones)) * 100

    return {
        "empresa": empresa['name'],
        "pais": empresa['pais'],
        "url": empresa['url'],
        "company_detectada": company_name,
        "tiempo_scraping": f"{duration:.1f}s",
        "status": "OK" if duration < 180 else "SLOW",
        "bienvenida": welcome[:200],
        "conversacion": conversacion,
        "metricas": {
            "info_especifica": f"{total_especifica}/8",
            "seguimiento": f"{total_seguimiento}/8",
            "score": f"{score:.0f}%"
        }
    }


def main():
    print("="*60)
    print("TEST ROBUSTO - 10 EMPRESAS")
    print(f"Fecha: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("="*60)

    resultados = []

    for idx, empresa in enumerate(EMPRESAS):
        preguntas_keys = ROTACION[idx]
        resultado = test_empresa(empresa, preguntas_keys, idx)
        resultados.append(resultado)
        print("\n" + "-"*60)
        time.sleep(2)

    # Guardar resultados JSON
    output_file = f"logs/test-10-empresas-{datetime.now().strftime('%Y%m%d-%H%M%S')}.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(resultados, f, ensure_ascii=False, indent=2)

    # Resumen final
    print(f"\n\n{'='*60}")
    print("RESUMEN FINAL")
    print("="*60)
    print(f"\n{'Empresa':<25} {'País':<12} {'Tiempo':<10} {'Score':<10} {'Status'}")
    print("-"*70)

    for r in resultados:
        status_icon = "✅" if r["status"] == "OK" else "⚠️" if r["status"] == "SLOW" else "❌"
        score = r.get('metricas', {}).get('score', 'N/A')
        print(f"{r['empresa']:<25} {r['pais']:<12} {r['tiempo_scraping']:<10} {score:<10} {status_icon}")

    # Estadísticas
    tiempos = [float(r['tiempo_scraping'].replace('s','')) for r in resultados if r['status'] != 'FAIL_SESSION']
    if tiempos:
        print(f"\nTiempo promedio: {sum(tiempos)/len(tiempos):.1f}s")
        print(f"Tiempo máximo: {max(tiempos):.1f}s")
        print(f"Tiempo mínimo: {min(tiempos):.1f}s")

    ok_count = sum(1 for r in resultados if r['status'] == 'OK')
    print(f"\nEmpresas OK (<3 min): {ok_count}/10")

    print(f"\nResultados guardados en: {output_file}")

    # Guardar markdown
    md_file = f"docs/ANALISIS-10-EMPRESAS-{datetime.now().strftime('%Y%m%d')}.md"
    with open(md_file, 'w', encoding='utf-8') as f:
        f.write(f"# Análisis de 10 Empresas - {datetime.now().strftime('%Y-%m-%d')}\n\n")

        f.write("## Resumen\n\n")
        f.write("| Empresa | País | Tiempo | Score | Status |\n")
        f.write("|---------|------|--------|-------|--------|\n")
        for r in resultados:
            status = "✅" if r["status"] == "OK" else "⚠️" if r["status"] == "SLOW" else "❌"
            score = r.get('metricas', {}).get('score', 'N/A')
            f.write(f"| {r['empresa']} | {r['pais']} | {r['tiempo_scraping']} | {score} | {status} |\n")

        f.write("\n---\n\n")

        for r in resultados:
            f.write(f"\n## {r['empresa']} ({r['pais']})\n")
            f.write(f"- **URL**: {r['url']}\n")
            f.write(f"- **Company detectada**: {r.get('company_detectada', 'N/A')}\n")
            f.write(f"- **Tiempo scraping**: {r['tiempo_scraping']}\n")
            f.write(f"- **Status**: {r['status']}\n")

            if 'metricas' in r:
                f.write(f"- **Info específica**: {r['metricas']['info_especifica']}\n")
                f.write(f"- **Seguimiento**: {r['metricas']['seguimiento']}\n")
                f.write(f"- **Score**: {r['metricas']['score']}\n")

            f.write(f"\n### Conversación\n")
            for conv in r.get('conversacion', []):
                f.write(f"\n**{conv['pregunta_key']}**: {conv['pregunta']}\n")
                f.write(f"\n> {conv['respuesta'][:500]}{'...' if len(conv['respuesta']) > 500 else ''}\n")
            f.write("\n---\n")

    print(f"Análisis markdown guardado en: {md_file}")


if __name__ == "__main__":
    main()
