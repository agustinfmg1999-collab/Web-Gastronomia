# Web Gastronomico - Sistema de Menu Digital

Sistema completo para restaurantes: menu digital con QR, panel de administracion, cocina, pedidos en tiempo real, resenas, propinas y cierre de caja.

## Funcionalidades

- **Panel Admin** — Gestionar menu, mesas, QR, promos, historial, ticket, cierre de caja
- **Menu Digital** — Carta interactiva con carrito, propinas, split de cuenta
- **Cocina** — Vista de pedidos con estados en tiempo real
- **Socket.io** — Actualizaciones instantaneas entre admin, cliente y cocina
- **Auth** — Login protegido para el panel admin
- **Offline** — Service Worker para funcionar sin internet en el cliente
- **Tickets** — Impresion termica configurable
- **Backup** — Copias automaticas de seguridad

---

## Instalacion en la PC del Comprador (Local)

### Requisitos previos
- Windows 10 o superior
- Git instalado (https://git-scm.com)
- Node.js LTS instalado (https://nodejs.org)

### Paso a paso

1. Clonar el repo:
```
git clone https://github.com/agustinfmg1999-collab/Web-Gastronomia.git
cd Web-Gastronomia
```

2. Doble clic en `instalar.bat` — instala todo automaticamente

3. Doble clic en "Iniciar Menu Digital" desde el escritorio

4. Abrir en el navegador:
- Admin: `http://localhost:3000`
- Cliente: `http://localhost:3000/cliente.html?mesa=Mesa%201`

---

## Configuracion con Subdomenios (Para venderte el servicio)

### Concepto

Cada local que compre tu servicio corre su propio servidor Node.js en su PC.
Los clientes acceden via internet usando un subdomenio que apunta a Cloudflare Tunnel.

```
TU DOMINIO: tuplatillo.com
  elpatio.tuplatillo.com    → PC del local "El Patio"
  laparrilla.tuplatillo.com → PC del local "La Parrilla"
  cafecito.tuplatillo.com   → PC del local "Cafecito"
```

### Paso 1: Comprar un dominio

1. Comprar un dominio (ej: `tuplatillo.com`) en cualquier registrador
2. Puntear los nameservers a Cloudflare
3. Crear cuenta gratis en https://cloudflare.com
4. Agregar el dominio a Cloudflare

### Paso 2: Configurar en la PC del comprador

1. Ejecutar `instalar.bat`
2. Ejecutar `configurar-tunnel.bat` e ingresar:
   - Nombre del tunnel (ej: `tunnel-elpatio`)
   - Subdomenio (ej: `elpatio`)
   - Dominio (ej: `tuplatillo.com`)
3. Se abre una ventana del navegador para autorizar Cloudflare
4. El script crea el tunnel y configura el DNS automaticamente

### Paso 3: Configurar en el Panel Admin

1. Abrir `http://localhost:3000`
2. Ir a **Config** (pestaña de abajo)
3. En **URL Publica** pegar: `https://elpatio.tuplatillo.com`
4. Click en **Guardar**

### Paso 4: Generar QR

1. Ir a la pestaña **Mesas y QR**
2. Los QR ya apuntan a la URL publica automaticamente
3. Imprimir y poner en las mesas

### Flujo final

```
Cliente escanea QR
  → https://elpatio.tuplatillo.com/cliente.html?mesa=Mesa%201
  → Cloudflare Tunnel → localhost:3000
  → Ve el menu, hace pedido
  → Admin recibe en tiempo real (sin internet necesaria)
```

---

## Deploy en Render (Para demo/publicidad)

1. Crear cuenta en https://render.com con GitHub
2. **New > Web Service**
3. Seleccionar este repo
4. Configurar:
   - Build Command: `npm install`
   - Start Command: `npm start`
5. Click **Deploy**

---

## Contraseña Admin

Por defecto: `admin123` (configurable en `auth.json`)

## Stack

- Node.js + Express
- Socket.io (tiempo real)
- HTML/CSS/JS vanilla
- JSON como almacenamiento
- Cloudflare Tunnel (acceso publico)
