# Web Gastronomico - Sistema de Menu Digital

Sistema completo para restaurantes: menu digital con QR, panel de administracion, cocina, pedidos en tiempo real, resenas, propinas y cierre de caja.

## Funcionalidades

- **Panel Admin** — Gestionar menu, mesas, QR, promos, historial, ticket, cierre de caja
- **Menu Digital** — Carta interactiva con carrito, propinas, split de cuenta
- **Cocina** — Vista de pedidos con estados en tiempo real
- **Socket.io** — Actualizaciones instantaneas entre admin, cliente y cocina
- **Auth** — Login protegido para el panel admin
- **Offline** — Service Worker para funciona sin internet en el cliente
- **Tickets** — Impresion termica configurable
- **Backup** — Copias automaticas de seguridad

## Instalacion Local

```bash
git clone https://github.com/agustinfmg1999-collab/Web-Gastronomia.git
cd Web-Gastronomia
npm install
npm start
```

El servidor arranca en `http://localhost:3000`

- Admin: `http://localhost:3000`
- Cliente: `http://localhost:3000/cliente.html?mesa=Mesa%201`

## Deploy en Render (Gratis)

1. Crear cuenta en [render.com](https://render.com) con GitHub
2. **New > Web Service**
3. Seleccionar este repo
4. Configurar:
   - Build Command: `npm install`
   - Start Command: `npm start`
5. Click **Deploy**

Cada push a `main` genera un deploy automatico.

## Deploy Manual (VPS / PC del Local)

```bash
git clone https://github.com/agustinfmg1999-collab/Web-Gastronomia.git
cd Web-Gastronomia
npm install
npm start
```

## Contraseña Admin

Por defecto: `admin123` (configurable en `auth.json`)

## Stack

- Node.js + Express
- Socket.io (tiempo real)
- HTML/CSS/JS vanilla
- JSON como almacenamiento
