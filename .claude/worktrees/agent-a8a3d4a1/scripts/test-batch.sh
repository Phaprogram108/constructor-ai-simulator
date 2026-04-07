#!/bin/bash
# Test batch de empresas - Mide tiempo y guarda resultados

PORT=${1:-3000}
OUTPUT_FILE="logs/test-results-$(date +%Y%m%d-%H%M%S).json"

mkdir -p logs

echo "["  > "$OUTPUT_FILE"

test_company() {
  local url="$1"
  local name="$2"

  echo "Testing: $name ($url)"

  START=$(date +%s.%N)

  RESPONSE=$(curl -s -X POST "http://localhost:$PORT/api/simulator/create" \
    -H "Content-Type: application/json" \
    -d "{\"websiteUrl\":\"$url\"}" \
    --max-time 180)

  END=$(date +%s.%N)
  DURATION=$(echo "$END - $START" | bc)

  # Extraer datos del response
  SESSION_ID=$(echo "$RESPONSE" | grep -o '"sessionId":"[^"]*"' | cut -d'"' -f4)
  COMPANY_NAME=$(echo "$RESPONSE" | grep -o '"companyName":"[^"]*"' | cut -d'"' -f4)
  ERROR=$(echo "$RESPONSE" | grep -o '"error":"[^"]*"' | cut -d'"' -f4)

  # Determinar status
  if [ -n "$SESSION_ID" ]; then
    STATUS="OK"
  else
    STATUS="FAIL"
  fi

  echo "  -> $STATUS in ${DURATION}s (Company: $COMPANY_NAME)"

  # Guardar resultado
  echo "  {\"url\": \"$url\", \"name\": \"$name\", \"status\": \"$STATUS\", \"duration\": $DURATION, \"companyName\": \"$COMPANY_NAME\", \"sessionId\": \"$SESSION_ID\", \"error\": \"$ERROR\"}," >> "$OUTPUT_FILE"
}

echo "=== BATCH TEST - $(date) ==="
echo ""

# Argentina - Primeras 5
test_company "https://lista.com.ar/" "Lista"
test_company "https://www.attila.com.ar/" "Attila"
test_company "https://4housing.com.ar/" "4Housing"
test_company "https://www.offis.ar/" "Offis"
test_company "https://cititek.com.ar/" "Cititek"

# Cerrar JSON
sed -i '' '$ s/,$//' "$OUTPUT_FILE"  # Remover ultima coma
echo "]" >> "$OUTPUT_FILE"

echo ""
echo "=== RESULTADOS GUARDADOS EN: $OUTPUT_FILE ==="
cat "$OUTPUT_FILE"
