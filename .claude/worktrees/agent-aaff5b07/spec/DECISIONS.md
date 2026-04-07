# Decisiones - Mejoras Pre-Lanzamiento (Feb 8)

## Contexto
- Lanzamiento oficial: Feb 9
- Test case principal: Lucy's House (lucyshousearg.com)
- El agente actual no capta info detallada de modelos/tipologias en sub-paginas

## Prioridades Acordadas

### TODO ANTES DEL LANZAMIENTO (en orden):

1. **Validacion de URL** - Si la pagina no existe o tiene error, NO iniciar conversacion
   - Mostrar mensaje claro: "No pudimos cargar la pagina, verifica la URL"
   - Evitar que el agente invente info de una empresa inexistente

2. **Crawling profundo de modelos** - Seguir links a sub-paginas de modelos
   - Detectar secciones tipo "Tipologias", "Modelos", "Ver mas"
   - Seguir esos links para captar specs, precios, detalles tecnicos
   - Caso concreto: Lucy's House tiene precio/m2, lista de materiales, calculadora en sub-paginas

3. **Re-busqueda on-demand** - Si el agente no tiene info de un modelo especifico:
   - En vez de decir "no tengo acceso", intentar buscar en la web de la empresa
   - OK con 10-15 segundos de latencia
   - Puede mostrar "Estoy buscando esa info..." mientras carga

## Decisiones Tecnicas

- **Playwright**: Solo para testing/debugging, NO para produccion
- **Firecrawl**: Sigue siendo el crawler principal
- **Latencia re-crawl**: 10-15s aceptable si hay feedback visual
- **Restriccion critica**: NO romper nada que ya funcione

## Metricas de Exito

- Lucy's House: el agente debe saber responder sobre modelos especificos (ej: Modulo 32m2, Full Premium)
- El agente debe tener precios por m2 y specs de equipamiento
- URLs invalidas deben ser rechazadas antes de crear sesion
