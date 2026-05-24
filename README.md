# PorCiento — Copy Trading Platform for Deriv

Plataforma de copy trading para Deriv.com que permite replicar automáticamente las operaciones de una cuenta maestra en múltiples cuentas esclavas con un ratio configurable.

## Stack Tecnológico

- **Backend**: Node.js + Express + TypeScript
- **WebSocket**: `ws` (conexión en tiempo real con Deriv)
- **Base de datos**: PostgreSQL con Drizzle ORM
- **Frontend**: React + Vite + Tailwind CSS
- **Auth**: OAuth 2.0 + PKCE de Deriv
- **Deploy**: Railway

## Requisitos Previos

- Node.js 18+
- PostgreSQL 14+
- Una cuenta de desarrollador en Deriv con app_id registrado

## Instalación Local

```bash
# Clonar el repositorio
git clone https://github.com/Elvispcol/App-Deriv-Copy-V2Prueba.git
cd App-Deriv-Copy-V2Prueba

# Instalar dependencias
npm install

# Copiar variables de entorno
cp .env.example .env
# Editar .env con tus valores reales

# Generar migraciones de base de datos
npm run db:generate
npm run db:migrate

# Construir el proyecto
npm run build

# Iniciar el servidor
npm start
```

## Variables de Entorno

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `DATABASE_URL` | URL de conexión PostgreSQL | `postgresql://user:pass@localhost:5432/porciento_copy_trading` |
| `DERIV_CLIENT_ID` | Client ID de la app Deriv | `33mgrWPTeAQXoB8hjy8HE` |
| `DERIV_APP_ID` | App ID de Deriv para WebSocket | `33mgrWPTeAQXoB8hjy8HE` |
| `SESSION_SECRET` | Secreto para sesiones | `un_string_aleatorio_seguro` |
| `PORT` | Puerto del servidor | `3000` |

## Despliegue en Railway

### Paso 1 — Crear proyecto en Railway

1. Ve a [railway.app](https://railway.app) y crea una cuenta
2. Crea un **New Project**
3. Selecciona **"Deploy from GitHub repo"** y elige `App-Deriv-Copy-V2Prueba`

### Paso 2 — Agregar PostgreSQL

1. Dentro del proyecto, haz clic en **"New"** → **"Database"** → **"Add PostgreSQL"**
2. Railway creará automáticamente la variable `DATABASE_URL`

### Paso 3 — Configurar variables de entorno

En el servicio web, ve a **Variables** y agrega:

```
DERIV_CLIENT_ID=33mgrWPTeAQXoB8hjy8HE
DERIV_APP_ID=33mgrWPTeAQXoB8hjy8HE
SESSION_SECRET=genera_un_string_aleatorio_largo
```

### Paso 4 — Configurar redirect_uri en Deriv

1. Ve a [api.deriv.com](https://api.deriv.com) y edita tu aplicación
2. En **Redirect URI**, agrega: `https://TU-APP.up.railway.app/callback`
3. Reemplaza `TU-APP` con el dominio que Railway te asigne

### Paso 5 — Ejecutar migraciones

Una vez desplegado, ejecuta las migraciones desde el panel de Railway:

```bash
npm run db:migrate
```

O usa el comando de Railway CLI:

```bash
railway run npm run db:migrate
```

### Paso 6 — Verificar

Visita `https://TU-APP.up.railway.app` y deberías ver la landing page con el botón "Conectar con Deriv".

## Estructura del Proyecto

```
porciento-copy-trading/
├── package.json
├── tsconfig.json
├── vite.config.ts
├── .env.example
├── drizzle.config.ts
├── server/
│   ├── index.ts              ← Entry point Express
│   ├── db.ts                 ← Conexión PostgreSQL
│   ├── schema.ts             ← Tablas Drizzle ORM
│   ├── oauth.ts              ← Flujo OAuth Deriv
│   ├── routes.ts             ← API REST endpoints
│   ├── websocket-manager.ts  ← Pool de conexiones WS a Deriv
│   └── copy-engine.ts        ← Motor de replicación
├── client/
│   ├── index.html
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── pages/
│       │   ├── Home.tsx       ← Landing + botón conectar con Deriv
│       │   ├── Callback.tsx   ← Procesa el OAuth callback
│       │   └── Dashboard.tsx  ← Panel maestro/esclavos
│       └── api.ts             ← fetch helper
```

## API Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/auth/callback` | Intercambia código OAuth por sesión |
| GET | `/api/auth/me` | Info del usuario actual |
| POST | `/api/auth/logout` | Cerrar sesión |
| GET | `/api/accounts` | Cuentas Deriv del usuario |
| POST | `/api/accounts/connect` | Conectar cuenta al WebSocket |
| POST | `/api/accounts/disconnect` | Desconectar cuenta del WebSocket |
| GET | `/api/copy/configs` | Configuraciones copy trading |
| POST | `/api/copy/configs` | Crear nueva configuración |
| POST | `/api/copy/configs/:id/enable` | Habilitar copy trading |
| POST | `/api/copy/configs/:id/disable` | Deshabilitar copy trading |
| POST | `/api/copy/configs/:id/slaves` | Agregar cuenta esclava |
| GET | `/api/copy/logs` | Historial de replicaciones |

## Flujo OAuth

1. El frontend genera un `code_verifier` y `code_challenge` PKCE
2. Redirige a `https://auth.deriv.com/oauth2/auth` con los parámetros PKCE
3. Deriv redirige a `/callback` con un `code` de autorización
4. El frontend envía el `code` + `code_verifier` al backend
5. El backend intercambia el código por un `access_token` (sin client_secret)
6. Se crea una sesión y se redirige al Dashboard

## Licencia

MIT
