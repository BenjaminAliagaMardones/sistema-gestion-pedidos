# 🚀 Guía de Despliegue en Render

Sistema Shoper — Guía completa para desplegar el backend (FastAPI), frontend (React) y base de datos (PostgreSQL) en **Render.com**, de forma gratuita.

---

## 📋 Requisitos previos

1. Cuenta en [render.com](https://render.com) (gratuita)
2. Repositorio en GitHub con este proyecto
3. Git instalado localmente

---

## Paso 1: Subir el proyecto a GitHub

```bash
git init
git add .
git commit -m "feat: initial commit - Sistema Shoper"
git remote add origin https://github.com/TU-USUARIO/shoper-sistema.git
git push -u origin main
```

---

## Paso 2: Crear la Base de Datos PostgreSQL en Render

1. En el dashboard de Render → **New +** → **PostgreSQL**
2. Configurar:
   - **Name**: `shoper-db`
   - **Plan**: Free
3. Click **Create Database**
4. ✅ Guarda el **Internal Database URL** (lo usarás en el siguiente paso)

---

## Paso 3: Desplegar el Backend (FastAPI)

1. **New +** → **Web Service**
2. Conecta tu repositorio de GitHub
3. Configurar:
   - **Name**: `shoper-backend`
   - **Root Directory**: `backend`
   - **Runtime**: **Docker**
   - **Plan**: Free
4. Agregar **Environment Variables**:
   | Variable | Valor |
   |---|---|
   | `DATABASE_URL` | *Internal URL de la DB creada en paso 2* |
   | `JWT_SECRET` | *Genera una clave aleatoria larga* |
   | `ADMIN_USERNAME` | `admin` |
   | `ADMIN_PASSWORD` | *Tu contraseña segura* |
   | `FRONTEND_URL` | *URL del frontend (puedes actualizar después)* |
5. Click **Create Web Service**
6. ✅ Espera el primer deploy (puede tardar 5-10 min)
7. Copia la URL del backend (ej: `https://shoper-backend.onrender.com`)

> **Nota**: El sistema creará automáticamente el usuario administrador al iniciar.

---

## Paso 4: Desplegar el Frontend (React)

1. **New +** → **Static Site**
2. Conecta el mismo repositorio
3. Configurar:
   - **Name**: `shoper-frontend`
   - **Root Directory**: `frontend`
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `dist`
4. Agregar **Environment Variable**:
   | Variable | Valor |
   |---|---|
   | `VITE_API_URL` | `https://shoper-backend.onrender.com` |
5. En **Redirects/Rewrites**, agregar: `/* → /index.html` (Rewrite)
6. Click **Create Static Site**

---

## Paso 5: Actualizar CORS del Backend

Una vez que tengas la URL del frontend, ve al servicio del backend en Render:
- Variables de entorno → Agrega/actualiza `FRONTEND_URL` con la URL del frontend

---

## ✅ Verificación Final

1. Abre la URL del frontend en el navegador
2. Inicia sesión con las credenciales configuradas en `ADMIN_USERNAME` y `ADMIN_PASSWORD`
3. Verifica que el dashboard carga correctamente
4. Crea un cliente de prueba
5. Crea un pedido de prueba y descarga el PDF

---

## 📌 URLs de Producción (completar)

| Servicio | URL |
|---|---|
| Frontend | `https://shoper-frontend.onrender.com` |
| Backend | `https://shoper-backend.onrender.com` |
| API Docs | `https://shoper-backend.onrender.com/docs` |

---

## 🔧 Ejecución Local (Desarrollo)

### Backend
```bash
cd backend
pip install -r requirements.txt
# Copiar y configurar .env
cp .env.example .env
uvicorn app.main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
# Crear .env.local
echo "VITE_API_URL=http://localhost:8000" > .env.local
npm run dev
```

Abrir: http://localhost:5173
