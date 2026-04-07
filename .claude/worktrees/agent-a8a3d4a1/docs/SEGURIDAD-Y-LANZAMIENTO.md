# Seguridad y Preparación para Lanzamiento

## 1. MEDIDAS DE SEGURIDAD

### 1.1 Protección de API Keys (CRÍTICO)

**Estado actual**: Las API keys están en `.env.local` (bien)

**Mejoras recomendadas**:

```bash
# Verificar que .env.local está en .gitignore
grep ".env" .gitignore
```

| Acción | Prioridad | Status |
|--------|-----------|--------|
| Verificar `.env.local` en `.gitignore` | 🔴 Alta | Pendiente |
| NO subir `.env.local` a GitHub | 🔴 Alta | Verificar |
| Usar variables de entorno en Vercel/servidor | 🔴 Alta | Pendiente |
| Rotar API keys regularmente | 🟡 Media | Opcional |

### 1.2 Rate Limiting

**Estado actual**: Existe rate limiting básico (20 req/min)

**Mejoras recomendadas**:

```typescript
// src/lib/rate-limiter.ts - Mejorar con:
- IP-based limiting (no solo por sesión)
- Bloqueo progresivo (1 min, 5 min, 1 hora)
- Captcha después de muchos intentos
```

| Acción | Prioridad | Impacto |
|--------|-----------|---------|
| Rate limit por IP | 🔴 Alta | Evita abuso masivo |
| Límite diario por IP | 🟡 Media | Evita scraping |
| Honeypot para bots | 🟢 Baja | Detecta bots |

### 1.3 Protección de Endpoints API

**Vulnerabilidades potenciales**:

| Endpoint | Riesgo | Mitigación |
|----------|--------|------------|
| `/api/simulator/create` | Abuso de scraping | Rate limit + CAPTCHA |
| `/api/chat` | Consumo de tokens OpenAI | Límite de mensajes |
| `/api/upload` | Archivos maliciosos | Validación de tipo + tamaño |

**Implementaciones sugeridas**:

```typescript
// 1. Validar origen de requests
const allowedOrigins = ['https://tudominio.com', 'http://localhost:3000'];

// 2. Headers de seguridad
headers: {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin'
}

// 3. CORS restrictivo
cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST'],
})
```

### 1.4 Protección del Código Fuente

| Medida | Descripción | Prioridad |
|--------|-------------|-----------|
| Repositorio privado | GitHub private repo | 🔴 Alta |
| No exponer `.git` | Verificar en producción | 🔴 Alta |
| Obfuscación (opcional) | Para código cliente | 🟢 Baja |
| Source maps deshabilitados | En producción | 🟡 Media |

```javascript
// next.config.js
module.exports = {
  productionBrowserSourceMaps: false, // Ocultar source maps
}
```

### 1.5 Protección de Sesiones

**Estado actual**: Sesiones en memoria (se pierden al reiniciar)

**Mejoras para producción**:

| Opción | Pros | Contras |
|--------|------|---------|
| Redis | Rápido, persistente | Costo adicional |
| Supabase | Fácil, incluye auth | Dependencia externa |
| JWT + localStorage | Sin servidor | Menos seguro |

### 1.6 Monitoreo y Alertas

```bash
# Herramientas recomendadas:
- Sentry (errores en producción)
- Vercel Analytics (tráfico)
- Uptime Robot (disponibilidad)
```

---

## 2. CAMBIO DE DOMINIO

### 2.1 Pasos para Dominio Personalizado

#### Opción A: Deploy en Vercel (Recomendado)

```bash
# 1. Instalar Vercel CLI
npm i -g vercel

# 2. Login
vercel login

# 3. Deploy
vercel

# 4. Configurar dominio en Vercel Dashboard:
# - Settings > Domains > Add
# - Agregar: tudominio.com y www.tudominio.com
```

#### Opción B: Deploy en VPS (más control)

```bash
# En tu VPS (ej: Hostinger 72.62.106.169):

# 1. Clonar repo
git clone [tu-repo] /var/www/constructor-ai

# 2. Instalar dependencias
cd /var/www/constructor-ai
npm install

# 3. Build
npm run build

# 4. Configurar PM2
pm2 start npm --name "constructor-ai" -- start

# 5. Configurar Nginx
server {
    listen 80;
    server_name tudominio.com www.tudominio.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

# 6. SSL con Certbot
sudo certbot --nginx -d tudominio.com -d www.tudominio.com
```

### 2.2 Configuración de DNS

En tu proveedor de dominio (GoDaddy, Namecheap, etc.):

```
Tipo    Nombre    Valor                  TTL
A       @         76.76.21.21 (Vercel)   300
CNAME   www       cname.vercel-dns.com   300
```

### 2.3 Variables de Entorno en Producción

```bash
# En Vercel Dashboard > Settings > Environment Variables:
OPENAI_API_KEY=sk-proj-...
ANTHROPIC_API_KEY=sk-ant-api03-...
FIRECRAWL_API_KEY=fc-...

# IMPORTANTE: Marcar como "Production" y "Preview"
```

---

## 3. CHECKLIST PRE-LANZAMIENTO

### Seguridad
- [ ] `.env.local` en `.gitignore`
- [ ] API keys solo en variables de entorno del servidor
- [ ] Rate limiting activado
- [ ] CORS configurado
- [ ] Headers de seguridad
- [ ] Repositorio privado

### Funcionalidad
- [ ] Todas las empresas test < 3 min
- [ ] No invención de datos
- [ ] UI de progreso funcionando
- [ ] Mensajes de error claros

### Infraestructura
- [ ] Dominio configurado
- [ ] SSL/HTTPS activo
- [ ] Monitoreo (Sentry/Analytics)
- [ ] Backup de código

### Legal (opcional pero recomendado)
- [ ] Términos de servicio
- [ ] Política de privacidad
- [ ] Aviso de cookies (si aplica)

---

## 4. COSAS ADICIONALES A CONSIDERAR

### 4.1 Analytics y Métricas

```javascript
// Implementar tracking de:
- Empresas más consultadas
- Preguntas más frecuentes
- Tasa de conversión (visita → chat completo)
- Tiempo promedio de sesión
```

### 4.2 Backup de Datos

```bash
# Si usás persistencia en BD:
- Backup automático diario
- Retención de 30 días
- Test de restauración mensual
```

### 4.3 Escalabilidad

| Componente | Límite Actual | Para Escalar |
|------------|---------------|--------------|
| Firecrawl | 100k páginas/mes | Upgrade plan |
| OpenAI | Por tokens | Monitorear uso |
| Vercel | Free tier | Pro si >100 usuarios/día |

### 4.4 Plan de Contingencia

```
Si Firecrawl falla → Fallback a Playwright (ya implementado)
Si OpenAI falla → Mensaje de error "servicio ocupado"
Si servidor cae → Vercel auto-recupera / PM2 restart
```

---

## 5. TIMELINE SUGERIDO

| Día | Tareas |
|-----|--------|
| Día 1 | Testing de 10 empresas + ajustes |
| Día 2 | Implementar seguridad básica |
| Día 3 | Configurar dominio + SSL |
| Día 4 | Deploy a producción |
| Día 5 | Monitoreo y ajustes finales |
| Día 6 | **Lanzamiento soft** (beta cerrada) |
| Día 7+ | Iteración según feedback |
