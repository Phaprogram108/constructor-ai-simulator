# Resultados de Testing - 4 de Febrero 2026

## Resumen Ejecutivo

- **Total empresas testeadas**: 15
- **Éxito (< 3 min)**: 15/15 (100%)
- **Tiempo promedio**: ~32 segundos
- **Tiempo más rápido**: 10.5s (builderpack.cl)
- **Tiempo más lento**: 70.2s (mexicoalcubo.com)

## Resultados Detallados

### Argentina (10 empresas)

| # | URL | Tiempo | Company Detectada | Status |
|---|-----|--------|-------------------|--------|
| 1 | lista.com.ar | 38.9s | Lista | ✅ |
| 2 | attila.com.ar | 36.2s | Attila | ✅ |
| 3 | 4housing.com.ar | 38.2s | 4housing | ✅ |
| 4 | offis.ar | 61.1s | Offis | ⚠️ |
| 5 | cititek.com.ar | 27.3s | Archzilla | ✅ |
| 6 | habika.ar | 53.3s | Hábika construcción modular | ✅ |
| 7 | modularte.com.ar | 12.7s | Modularte | ✅ |
| 8 | naturenest.design | 22.0s | NatureNest | ✅ |
| 9 | moduloshousing.com.ar | 12.9s | Housing Steel | ✅ |
| 10 | factoryxspace.com | 29.5s | Factory Xspace | ✅ |

**Promedio Argentina**: 33.2s

### Chile (4 empresas)

| # | URL | Tiempo | Company Detectada | Status |
|---|-----|--------|-------------------|--------|
| 11 | linkhome.cl | 19.4s | LinkHome | ✅ |
| 12 | builderpack.cl | 10.5s | Builderpack | ✅ |
| 13 | rentech.cl | 22.8s | Rentech | ✅ |
| 14 | tecnofasthome.cl | 36.9s | Tecno Fast Home | ✅ |

**Promedio Chile**: 22.4s

### México (1 empresa)

| # | URL | Tiempo | Company Detectada | Status |
|---|-----|--------|-------------------|--------|
| 15 | mexicoalcubo.com | 70.2s | México al Cubo | ⚠️ |

## Distribución de Tiempos

- **< 20s**: 4 empresas (27%)
- **20-40s**: 7 empresas (47%)
- **40-60s**: 2 empresas (13%)
- **> 60s**: 2 empresas (13%)

## Observaciones

1. **Detección de nombres correcta**: 14/15 empresas detectaron el nombre correcto
   - Excepción: cititek.com.ar detectó "Archzilla" (posible nombre alternativo o error)

2. **Sitios más lentos**: offis.ar y mexicoalcubo.com (probablemente tienen más páginas)

3. **Sitios más rápidos**: builderpack.cl, modularte.com.ar, moduloshousing.com.ar (sitios simples)

4. **Todos bajo 3 minutos**: ✅ Objetivo cumplido

## Optimizaciones Implementadas

- BATCH_SIZE: 10 URLs en paralelo
- Rate limit: 50ms (reducido de 500ms)
- Homepage scrape en paralelo
- Web + PDF en paralelo
- Playwright fallback optimizado

## Próximos Pasos

1. [ ] Testear 15 empresas más para llegar a 30
2. [ ] Verificar calidad de extracción de modelos
3. [ ] Probar conversaciones con cada agente
4. [ ] Identificar patrones en sitios lentos
