# 🤖 WhatsApp Auto-Responder — CDKeysPeru

Auto-responder inteligente para WhatsApp Business usando la **API oficial de Meta** con modo **Coexistence** (mantienes acceso a tu app del celular).

## 🚀 Quick Start

### 1. Configurar Meta Cloud API

1. Ir a [developers.facebook.com](https://developers.facebook.com)
2. Crear app tipo "Business" → Agregar producto "WhatsApp"
3. En el setup, elegir **"Usar número existente de WhatsApp Business App"**
4. Escanear QR code desde tu app WhatsApp Business
5. Copiar los tokens (Access Token + Phone Number ID)

### 2. Configurar el proyecto

```bash
# Copiar configuración
cp .env.example .env

# Editar con tus tokens
nano .env
```

### 3. Desplegar con Docker

```bash
# Levantar todos los servicios
docker compose up -d

# Descargar modelo de IA (primera vez)
docker exec wa-ollama ollama pull llama3.2:3b

# Ver logs
docker compose logs -f webhook
```

### 4. Configurar Cloudflare Tunnel

1. Ir a [dash.cloudflare.com](https://dash.cloudflare.com) → Zero Trust → Tunnels
2. Crear tunnel → Copiar token
3. Pegar token en `.env` → `CLOUDFLARE_TUNNEL_TOKEN`
4. Configurar public hostname: `api.cdkeysperu.com` → `http://webhook:3000`

### 5. Configurar Webhook en Meta

1. En Meta Developer Dashboard → WhatsApp → Configuration
2. Callback URL: `https://api.cdkeysperu.com/webhook`
3. Verify Token: (el que pusiste en `.env`)
4. Suscribirse a: `messages`

## 📊 Panel de Admin

- URL: `http://tu-servidor:8080`
- Login: (configurado en `.env`)

## 💰 Costo: $0/mes

- WhatsApp Cloud API (respuestas en 24h): GRATIS
- Ollama IA local: GRATIS
- Cloudflare Tunnel: GRATIS
