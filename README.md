# 🍽️ Web Gastronómico - Base Marca Blanca

Estructura modular y personalizable diseñada para desplegar cartas digitales interactivas con códigos QR por mesa y sistema de llamada a mozo en tiempo real para restaurantes, bares y cafés.

---

## 📂 Estructura del Proyecto

```text
web gastronomico/
├── package.json               # Configuración del paquete y scripts
├── README.md                  # Guía de instalación y personalización
├── index.html                 # Punto de entrada HTML con vista previa interactiva
├── public/
│   ├── brand/                 # Logos e isotipos del cliente
│   │   └── logo.svg
│   └── assets/                # Favicon e imágenes estáticas
└── src/
    ├── config/
    │   └── client.config.js   # ⚙️ ARCHIVO CLAVE: Toda la data y feature flags del local
    ├── styles/
    │   ├── theme.css          # 🎨 Variables CSS de color, tipografía y bordes
    │   └── animations.css     # ☁️ Animaciones de fondo (nubes, luces, partículas)
    ├── components/
    │   ├── Navbar.js          # Encabezado con logo e indicador de mesa
    │   ├── Categories.js      # Selector horizontal de categorías
    │   ├── ProductCard.js     # Tarjeta de producto con imagen, precio y badge
    │   ├── ProductModal.js    # Detalle con personalización y reseñas
    │   ├── CallWaiterModal.js # Modal para llamar al mozo / pedir la cuenta
    │   ├── BackgroundAnimation.js # Renderizado de fondos animados dinámicos
    │   └── AdminPanel.js      # Panel Admin para generar QR por mesa y personalizar tema
    ├── services/
    │   └── socketService.js   # Servicio de comunicación en tiempo real (WebSockets / Supabase)
    └── app.js                 # Inicializador principal y selector de vistas
```

---

## 🚀 Cómo Usar para un Nuevo Cliente

### 1. Personalización de Marca (`src/config/client.config.js`)
Edita este archivo para configurar:
- Nombre, eslogan y logo.
- Paleta de colores primaria, secundaria y fondos.
- Tipo de animación de fondo (`'clouds'`, `'particles'`, `'glow'`, `'none'`).
- Activar o desactivar botones (Llamar al mozo, Pedir cuenta, Reseñas).
- Lista de mesas, categorías y productos del menú.

### 2. Estilos Globales (`src/styles/theme.css`)
Las variables CSS se inyectan automáticamente desde `client.config.js`, pero puedes modificar los valores por defecto o agregar nuevos tokens en este archivo.

### 3. Probar Localmente
Podes abrir directamente el archivo `index.html` en el navegador o ejecutar:
```bash
npx serve .
```

---

## 🔔 Sistema de Llamada al Mozo
El proyecto incluye simulación de sockets e integración lista para conectar con **Socket.io**, **Supabase Realtime** o **Firebase Realtime Database**.
When a customer presses "Llamar al mozo", an event is emitted with `{ mesaId, mesaNumero, tipo: 'atencion' | 'cuenta' | 'cubiertos', timestamp }`.

---

## 🖨️ Generador de QR por Mesa
Ingresa a la pestaña **Panel Admin** en la demo para seleccionar cualquier mesa, visualizar la URL mapeada (`/m/3`) y generar/descargar el código QR listo para imprimir.
