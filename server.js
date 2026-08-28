import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import webPush from 'web-push';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app); // Creamos el servidor HTTP para Socket.io
const io = new Server(server);         // Inicializamos Socket.io

const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '1mb' }));

// Body guard: si no llega JSON body en POST/PATCH, retorna 400 en vez de crashear
app.use((req, res, next) => {
  if ((req.method === 'POST' || req.method === 'PATCH') && req.headers['content-type']?.includes('application/json') && req.body === undefined) {
    return res.status(400).json({ error: 'Body JSON inválido' });
  }
  next();
});

// Utilidad para escapar HTML (prevenir XSS en innerHTML)
function escHtml(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// SERVIR SOLO DIRECTORIOS SEGUROS (no exponer JSON de datos, backups, ni archivos sensibles)
app.use(express.static(path.join(__dirname, 'public')));      // /sounds, /brand, /assets
app.use('/src', express.static(path.join(__dirname, 'src'))); // /src/js, /src/styles
app.get('/sw.js', (req, res) => res.sendFile(path.join(__dirname, 'sw.js')));
app.get('/push-sw.js', (req, res) => res.sendFile(path.join(__dirname, 'push-sw.js')));

// --- PUSH NOTIFICATIONS ---
app.get('/api/push/vapid-key', (req, res) => {
  res.json({ publicKey: vapidKeys.publicKey });
});

app.post('/api/push/subscribe', (req, res) => {
  const subscription = req.body;
  if (!subscription || !subscription.endpoint) return res.status(400).json({ error: 'Invalid subscription' });
  const subs = loadPushSubs();
  const exists = subs.find(s => s.endpoint === subscription.endpoint);
  if (!exists) {
    subs.push(subscription);
    savePushSubs(subs);
  }
  res.json({ ok: true });
});

app.delete('/api/push/subscribe', (req, res) => {
  const subscription = req.body;
  if (!subscription || !subscription.endpoint) return res.status(400).json({ error: 'Invalid subscription' });
  let subs = loadPushSubs();
  subs = subs.filter(s => s.endpoint !== subscription.endpoint);
  savePushSubs(subs);
  res.json({ ok: true });
});

// --- LISTA DE ESPERA ---
app.get('/api/lista-espera', (req, res) => {
  res.json(loadData(LISTA_ESPERA_FILE, []));
});

app.post('/api/lista-espera', (req, res) => {
  const { nombre, personas, telefono } = req.body;
  if (!nombre || !personas) return res.status(400).json({ error: 'nombre y personas requeridos' });
  const lista = loadData(LISTA_ESPERA_FILE, []);
  const entry = {
    id: crypto.randomUUID(),
    nombre: String(nombre).trim(),
    personas: Number(personas),
    telefono: String(telefono || '').trim(),
    estado: 'esperando',
    createdAt: new Date().toISOString()
  };
  lista.push(entry);
  saveData(LISTA_ESPERA_FILE, lista);
  io.emit('lista_espera_actualizada', lista);
  res.status(201).json(entry);
});

app.patch('/api/lista-espera/:id', authMiddleware, (req, res) => {
  const lista = loadData(LISTA_ESPERA_FILE, []);
  const entry = lista.find(e => e.id === req.params.id);
  if (!entry) return res.status(404).json({ error: 'No encontrado' });
  if (req.body.estado !== undefined) entry.estado = req.body.estado;
  if (req.body.notificadoAt !== undefined) entry.notificadoAt = req.body.notificadoAt;
  saveData(LISTA_ESPERA_FILE, lista);
  io.emit('lista_espera_actualizada', lista);
  res.json(entry);
});

app.delete('/api/lista-espera/:id', authMiddleware, (req, res) => {
  let lista = loadData(LISTA_ESPERA_FILE, []);
  lista = lista.filter(e => e.id !== req.params.id);
  saveData(LISTA_ESPERA_FILE, lista);
  io.emit('lista_espera_actualizada', lista);
  res.json({ ok: true });
});

// Subdomain routing: menu → cliente, mozo → mozo, cocina → cocina, admin → admin
app.get('/', (req, res) => {
  const host = (req.headers.host || '').split(':')[0];
  if (host.startsWith('mozo.')) return res.sendFile(path.join(__dirname, 'mozo.html'));
  if (host.startsWith('cocina.')) return res.sendFile(path.join(__dirname, 'cocina.html'));
  if (host.startsWith('admin.')) return res.sendFile(path.join(__dirname, 'index.html'));
  if (host.startsWith('menu.')) return res.sendFile(path.join(__dirname, 'cliente.html'));
  return res.sendFile(path.join(__dirname, 'cliente.html'));
});

app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/admin.html', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/index.html', (req, res) => res.redirect('/admin'));
app.get('/cliente.html', (req, res) => res.sendFile(path.join(__dirname, 'cliente.html')));
app.get('/cocina.html', (req, res) => res.sendFile(path.join(__dirname, 'cocina.html')));
app.get('/mozo.html', (req, res) => res.sendFile(path.join(__dirname, 'mozo.html')));

const PEDIDOS_FILE = path.join(__dirname, 'pedidos.json');
const MOZO_FILE = path.join(__dirname, 'mozo.json');
const MESAS_FILE = path.join(__dirname, 'mesas.json');
const MENU_FILE = path.join(__dirname, 'menu.json');
const TICKET_FILE = path.join(__dirname, 'ticket.json');
const RESENAS_FILE = path.join(__dirname, 'resenas.json');
const AUTH_FILE = path.join(__dirname, 'auth.json');
const USERS_FILE = path.join(__dirname, 'usuarios.json');
const INSUMOS_FILE = path.join(__dirname, 'insumos.json');
const RECETAS_FILE = path.join(__dirname, 'recetas.json');
const ARCA_FILE = path.join(__dirname, 'arca.json');
const FACTURAS_FILE = path.join(__dirname, 'facturas.json');
const CAJA_FILE = path.join(__dirname, 'caja.json');
const TURNOS_FILE = path.join(__dirname, 'turnos.json');
const PUSH_SUBS_FILE = path.join(__dirname, 'push-subs.json');
const VAPID_FILE = path.join(__dirname, 'vapid.json');
const LISTA_ESPERA_FILE = path.join(__dirname, 'lista-espera.json');
const BACKUP_DIR = path.join(__dirname, 'backups');

// Web Push VAPID setup
let vapidKeys;
try {
  vapidKeys = JSON.parse(fs.readFileSync(VAPID_FILE, 'utf8'));
  webPush.setVapidDetails('mailto:admin@elpatio.com', vapidKeys.publicKey, vapidKeys.privateKey);
} catch (e) {
  vapidKeys = webPush.generateVAPIDKeys();
  fs.writeFileSync(VAPID_FILE, JSON.stringify(vapidKeys, null, 2));
  webPush.setVapidDetails('mailto:admin@elpatio.com', vapidKeys.publicKey, vapidKeys.privateKey);
}

function loadPushSubs() { return loadData(PUSH_SUBS_FILE, []); }
function savePushSubs(subs) { saveData(PUSH_SUBS_FILE, subs); }

function sendPushToMozos(title, body, url) {
  const subs = loadPushSubs();
  for (const sub of subs) {
    webPush.sendNotification(sub, JSON.stringify({ title, body, url }))
      .catch(err => {
        if (err.statusCode === 410 || err.statusCode === 404) {
          savePushSubs(subs.filter(s => s.endpoint !== sub.endpoint));
        }
      });
  }
}

const ADMIN_PASSWORD = 'admin123';
let activeTokens = new Map(); // token → { createdAt, usuario, rol }
const TOKEN_TTL = 24 * 60 * 60 * 1000; // 24 horas

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

// --- SISTEMA DE USUARIOS Y ROLES ---
const ROLES = {
  admin:  { label: 'Administrador', tabs: ['dashboard','menu','qrs','resenas','promos','insumos','historial','reportes','ticket','usuarios'] },
  cajero: { label: 'Cajero',        tabs: ['dashboard','historial','reportes','resenas'] },
  mozo:   { label: 'Mozo',          tabs: ['dashboard','resenas'] },
  cocina: { label: 'Cocinero',      tabs: ['pedidos'] }
};

let usuarios = readData(USERS_FILE);
if (!usuarios || !Array.isArray(usuarios) || usuarios.length === 0) {
  usuarios = [{
    id: 'USR-001',
    usuario: 'admin',
    nombre: 'Administrador',
    password: 'admin123',
    rol: 'admin',
    activo: true,
    creado: new Date().toISOString()
  }];
  saveData(USERS_FILE, usuarios);
}

function hashPassword(pw) {
  return crypto.createHash('sha256').update(pw).digest('hex');
}

function authMiddleware(req, res, next) {
  const token = req.headers['x-auth-token'];
  if (!token) return res.status(401).json({ error: 'No autorizado' });
  const tokenData = activeTokens.get(token);
  if (!tokenData || Date.now() - tokenData.createdAt > TOKEN_TTL) {
    activeTokens.delete(token);
    return res.status(401).json({ error: 'Sesión expirada' });
  }
  req.user = tokenData;
  next();
}

// Middleware: requiere que el usuario tenga uno de los roles permitidos
function roleMiddleware(...rolesPermitidos) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'No autorizado' });
    if (!rolesPermitidos.includes(req.user.rol)) {
      return res.status(403).json({ error: 'Sin permisos para esta acción' });
    }
    next();
  };
}

// Lectura y escritura persistente en disco
function readData(filePath) {
  if (!fs.existsSync(filePath)) return [];
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    return [];
  }
}

// Helper: fecha local YYYY-MM-DD (evita problemas de timezone con toISOString)
function localDate(d) {
  const dt = d instanceof Date ? d : new Date(d);
  return dt.toLocaleDateString('sv-SE'); // YYYY-MM-DD en locale español
}

function saveData(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('Error al guardar datos:', err);
  }
}

let pedidos = readData(PEDIDOS_FILE);
let llamadasMozo = readData(MOZO_FILE);
let mesas = readData(MESAS_FILE);
let menuData = readData(MENU_FILE);

if (!menuData || !menuData.productos) {
  menuData = {
    categorias: ['Carnes & Parrilla', 'Entrantes', 'Pescados & Mariscos', 'Bebidas', 'Postres'],
    productos: [
      { id: "1", nombre: "Milanesa Napolitana", categoria: "Carnes & Parrilla", precio: 11.50, disponible: true, tag: "Menú del Día", descripcion: "Milanesa de ternera gratinada con mozzarella y salsa casera.", imagen: "https://images.unsplash.com/photo-1544025162-d76694265947?w=400" },
      { id: "2", nombre: "Tapas Variadas", categoria: "Entrantes", precio: 8.00, disponible: true, tag: "Especialidad", descripcion: "Surtido de jamón ibérico, quesos y patatas bravas.", imagen: "https://images.unsplash.com/photo-1541529086526-db283c563270?w=400" },
      { id: "3", nombre: "Cerveza Artesanal 500ml", categoria: "Bebidas", precio: 3.50, disponible: true, tag: "", descripcion: "Cerveza rubia tirada super fría.", imagen: "https://images.unsplash.com/photo-1608270586620-248524c67de9?w=400" }
    ],
    promos: [
      { id: "101", titulo: "Happy Hour Cervezas", precio: 5.00, dias: ["Lun", "Mar", "Mié", "Jue", "Vie"], disponible: true, descripcion: "2x1 en pintas artesanales seleccionadas de 18 a 20hs.", imagen: "https://images.unsplash.com/photo-1535958636474-b021ee887b13?w=400" },
      { id: "102", titulo: "Combo Tapeo para Dos", precio: 14.00, dias: ["Vie", "Sáb", "Dom"], disponible: true, descripcion: "Incluye tabla de embutidos, patatas bravas y jarra de sangría.", imagen: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=400" }
    ]
  };
  saveData(MENU_FILE, menuData);
}

// Si está vacío, creamos algunas por defecto
if (mesas.length === 0) {
  mesas = [
    { id: '1', nombre: 'Mesa 1' },
    { id: '2', nombre: 'Mesa 2' },
    { id: '3', nombre: 'Mesa 1 Terraza' }
  ];
  saveData(MESAS_FILE, mesas);
}

let ticketConfig = readData(TICKET_FILE);
if (!ticketConfig || !ticketConfig.nombre) {
  ticketConfig = {
    nombre: 'El Patio Tapas Bar',
    direccion: 'Av. Corrientes 1234, CABA',
    telefono: '+54 11 1234-5678',
    cuit: '20-12345678-9',
    encabezado: '¡Gracias por su visita!',
    pie: 'Consultas: info@elpatio.com',
    leyenda: 'No hay factura sin ticket fiscal'
  };
  saveData(TICKET_FILE, ticketConfig);
}

let resenas = readData(RESENAS_FILE);
if (!resenas || !Array.isArray(resenas)) {
  resenas = [];
  saveData(RESENAS_FILE, resenas);
}

let insumos = readData(INSUMOS_FILE);
if (!insumos || !Array.isArray(insumos)) {
  insumos = [];
  saveData(INSUMOS_FILE, insumos);
}

let recetas = readData(RECETAS_FILE);
if (!recetas || !Array.isArray(recetas)) {
  recetas = [];
  saveData(RECETAS_FILE, recetas);
}

let arcaConfig = readData(ARCA_FILE);
if (!arcaConfig || typeof arcaConfig !== 'object') {
  arcaConfig = { habilitado: false, cuit: '', cert: '', key: '', puntoVenta: 1, tipoComprobante: 6, production: false };
  saveData(ARCA_FILE, arcaConfig);
}

let facturas = readData(FACTURAS_FILE);
if (!facturas || !Array.isArray(facturas)) {
  facturas = [];
  saveData(FACTURAS_FILE, facturas);
}

let cajaEventos = readData(CAJA_FILE);
if (!cajaEventos || !Array.isArray(cajaEventos)) {
  cajaEventos = [];
  saveData(CAJA_FILE, cajaEventos);
}

let turnos = readData(TURNOS_FILE);
if (!turnos || !Array.isArray(turnos)) {
  turnos = [];
  saveData(TURNOS_FILE, turnos);
}

// --- CONFIGURACIÓN DE SOCKET.IO ---
const mesasActivas = {};
const socketMesaMap = {};

io.on('connection', (socket) => {
  console.log('⚡ Un cliente o la cocina se ha conectado');

  socket.on('mesa_viewing', (data) => {
    if (data && data.mesa) {
      if (data.active) {
        mesasActivas[data.mesa] = { active: true, since: Date.now() };
      } else {
        delete mesasActivas[data.mesa];
      }
      socketMesaMap[socket.id] = data.mesa;
      io.emit('mesas_viewer_update', mesasActivas);
    }
  });

  socket.on('toggle_dish_status', (data) => {
    io.emit('dish_status_updated', data);
  });

  socket.on('mesa_liberada', (data) => {
    io.emit('mesa_liberada', data);
  });

  socket.on('pedido_listo', (data) => {
    io.emit('pedido_listo', data);
  });

  socket.on('disconnect', () => {
    console.log('❌ Un cliente se ha desconectado');
    const mesa = socketMesaMap[socket.id];
    if (mesa && mesasActivas[mesa]) {
      delete mesasActivas[mesa];
      delete socketMesaMap[socket.id];
      io.emit('mesas_viewer_update', mesasActivas);
    }
  });
});

// Función para transformar datos del admin al formato del cliente
function menuToClientFormat(data) {
  if (!data) return { categories: [], products: [], promos: [] };

  const categories = ['Todos', ...(data.categorias || [])];

  const products = (data.productos || []).map(p => ({
    id: p.id,
    name: p.nombre,
    category: p.categoria,
    price: p.precio,
    image: p.imagen,
    description: p.descripcion || '',
    badge: p.tag || '',
    rating: '4.5',
    disponible: p.disponible !== false,
    options: p.opciones || []
  }));

  const promos = (data.promos || []).filter(p => p.disponible !== false).map(p => ({
    id: p.id,
    name: p.titulo,
    image: p.imagen,
    description: p.descripcion || '',
    price: p.precio,
    badge: 'Promoción',
    rating: '5.0'
  }));

  return { categories, products, promos };
}

// ENDPOINTS MENÚ
app.get('/api/menu', (req, res) => {
  res.json(menuToClientFormat(menuData));
});

app.post('/api/menu', authMiddleware, roleMiddleware('admin'), (req, res) => {
  menuData = req.body;
  saveData(MENU_FILE, menuData);
  io.emit('menu_updated');
  res.json({ ok: true });
});

// Endpoints de Config
const CONFIG_FILE = path.join(__dirname, 'config.json');
let appConfig = readData(CONFIG_FILE);
app.get('/api/config', (req, res) => res.json(appConfig));
app.post('/api/config', authMiddleware, roleMiddleware('admin'), (req, res) => {
  if (req.body.publicUrl !== undefined) appConfig.publicUrl = req.body.publicUrl;
  saveData(CONFIG_FILE, appConfig);
  res.json(appConfig);
});

// Endpoints de Mesas
app.get('/api/mesas', (req, res) => res.json(mesas));
app.get('/api/mesas-activas', (req, res) => res.json(mesasActivas));

app.post('/api/mesas', authMiddleware, roleMiddleware('admin'), (req, res) => {
  if (Array.isArray(req.body)) {
    mesas = req.body;
    saveData(MESAS_FILE, mesas);
  }
  res.json(mesas);
});

// ENDPOINTS PEDIDOS
app.get('/api/pedidos', authMiddleware, (req, res) => res.json(pedidos));

function descontarStockDeItems(items) {
  let descontado = [];
  items.forEach(item => {
    const receta = recetas.find(r => r.dishId === String(item.id));
    if (!receta) return;
    receta.ingredientes.forEach(ing => {
      const insumo = insumos.find(i => i.id === ing.insumoId);
      if (!insumo) return;
      const cantidadTotal = ing.cantidad * (item.cantidad || 1);
      insumo.cantidad -= cantidadTotal;
      if (insumo.cantidad < 0) insumo.cantidad = 0;
      descontado.push({ insumo: insumo.nombre, cantidad: cantidadTotal, unidad: insumo.unidad, restante: insumo.cantidad });
    });
  });
  if (descontado.length) {
    saveData(INSUMOS_FILE, insumos);
    io.emit('stock_actualizado');
  }
  return descontado;
}

app.post('/api/pedidos', (req, res) => {
  const clientItems = req.body.items || [];
  if (!Array.isArray(clientItems)) return res.status(400).json({ error: 'items debe ser un array' });

  // Recalcular precios server-side desde el menú para evitar manipulación del cliente
  const recalculatedItems = clientItems.map(item => {
    const menuItems = Array.isArray(menuData) ? menuData : (menuData.productos || []);
    const menuItem = menuItems.find(m => String(m.id) === String(item.id) || m.nombre === item.nombre);
    const precio = menuItem ? menuItem.precio : (item.precio || item.precioUnitario || 0);
    const cantidad = Math.max(1, parseInt(item.cantidad) || 1);
    return { ...item, precioUnitario: precio, cantidad, subtotal: precio * cantidad };
  });
  const serverTotal = recalculatedItems.reduce((sum, i) => sum + i.subtotal, 0);

  const isProgramado = req.body.fechaProgramada && new Date(req.body.fechaProgramada) > new Date();

  const nuevoPedido = {
    id: `PED-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
    mesa: req.body.mesa || '1',
    items: recalculatedItems,
    total: serverTotal,
    propina: 0,
    estado: isProgramado ? 'programado' : 'pendiente',
    tiempoEstimado: isProgramado ? null : calcularTiempoEstimado(),
    fecha: new Date().toISOString(),
    fechaProgramada: isProgramado ? req.body.fechaProgramada : null
  };
  pedidos.push(nuevoPedido);
  saveData(PEDIDOS_FILE, pedidos);
  
  if (!isProgramado) {
    descontarStockDeItems(nuevoPedido.items);
    io.emit('nuevo_pedido', nuevoPedido);
    sendPushToMozos('Nuevo Pedido', `${nuevoPedido.mesa}: ${nuevoPedido.items.map(i => i.nombre).join(', ')}`, '/mozo.html');
  }

  res.status(201).json(nuevoPedido);
});

app.patch('/api/pedidos/:id/propina', (req, res) => {
  const pedido = pedidos.find(p => p.id === req.params.id);
  if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado' });
  if (req.body.propina !== undefined) pedido.propina = Math.max(0, Number(req.body.propina) || 0);
  saveData(PEDIDOS_FILE, pedidos);
  res.json({ ok: true, propina: pedido.propina });
});

// Público: pedidos activos de una mesa (sin auth)
app.get('/api/pedidos/mesa/:mesa', (req, res) => {
  const mesa = decodeURIComponent(req.params.mesa);
  const activos = pedidos.filter(p =>
    (p.mesa || '').toLowerCase() === mesa.toLowerCase() && !p.pagado
  ).sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
  res.json(activos);
});

app.patch('/api/pedidos/:id', authMiddleware, (req, res) => {
  const pedido = pedidos.find(p => p.id === req.params.id);
  if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado' });
  
  if (req.body.estado) pedido.estado = req.body.estado;
  if (req.body.pagado !== undefined) pedido.pagado = req.body.pagado;
  if (req.body.propina !== undefined) pedido.propina = req.body.propina;
  if (req.body.medioPago !== undefined) pedido.medioPago = req.body.medioPago;
  if (req.body.tiempoEstimado !== undefined) pedido.tiempoEstimado = req.body.tiempoEstimado;
  if (req.body.addItem) {
    pedido.items.push(req.body.addItem);
    pedido.total = pedido.items.reduce((s, i) => s + (i.subtotal || i.precio * i.cantidad), 0);
    descontarStockDeItems([req.body.addItem]);
  }
  saveData(PEDIDOS_FILE, pedidos);

  // Notificar cambio de estado del pedido en tiempo real
  io.emit('pedido_actualizado', pedido);

  if (req.body.estado === 'entregado') {
    pedido.fechaEntrega = new Date().toISOString();
    io.emit('pedido_listo', { mesa: pedido.mesa, pedidoId: pedido.id });
  }

  res.json(pedido);
});

app.delete('/api/pedidos', authMiddleware, roleMiddleware('admin'), (req, res) => {
  const { desde, hasta } = req.query;
  if (desde && hasta) {
    const fechaDesde = new Date(desde);
    const fechaHasta = new Date(hasta);
    fechaHasta.setHours(23, 59, 59, 999);
    pedidos = pedidos.filter(p => {
      const f = new Date(p.fecha);
      return f < fechaDesde || f > fechaHasta;
    });
  } else {
    pedidos = [];
  }
  saveData(PEDIDOS_FILE, pedidos);
  res.json({ ok: true, eliminados: true });
});

// ENDPOINTS RESEÑAS
app.get('/api/resenas', (req, res) => res.json(resenas));

app.post('/api/resenas', (req, res) => {
  const mesa = req.body.mesa || 'Desconocida';

  const pedidosMesa = pedidos.filter(p =>
    (p.mesa || 'Mesa 1').toLowerCase() === mesa.toLowerCase() && p.pagado
  );
  const allItems = [];
  pedidosMesa.forEach(p => {
    (p.items || []).forEach(i => {
      const existing = allItems.find(x => x.nombre === i.nombre);
      if (existing) {
        existing.cantidad += i.cantidad;
      } else {
        allItems.push({ nombre: i.nombre, cantidad: i.cantidad });
      }
    });
  });

  const nuevaResena = {
    id: `RES-${Date.now()}`,
    mesa,
    nombre: req.body.nombre || 'Anónimo',
    estrellas: req.body.estrellas || 5,
    texto: req.body.texto || '',
    platos: allItems,
    fecha: new Date().toISOString()
  };
  resenas.push(nuevaResena);
  saveData(RESENAS_FILE, resenas);
  io.emit('nueva_resena', nuevaResena);
  res.status(201).json(nuevaResena);
});

// ENDPOINTS MOZO
app.get('/api/mozo', (req, res) => res.json(llamadasMozo));

app.post('/api/mozo', (req, res) => {
  const nuevaLlamada = {
    id: `LLM-${Date.now()}`,
    mesa: req.body.mesa || '1',
    tipo: req.body.tipo || 'Llamado a Mozo',
    atendido: false,
    fecha: new Date().toISOString()
  };
  llamadasMozo.push(nuevaLlamada);
  saveData(MOZO_FILE, llamadasMozo);
  io.emit('nueva_llamada_mozo', nuevaLlamada);
  res.status(201).json(nuevaLlamada);
});

app.patch('/api/mozo/:id', authMiddleware, (req, res) => {
  const llamada = llamadasMozo.find(l => l.id === req.params.id);
  if (!llamada) return res.status(404).json({ error: 'Llamada no encontrada' });

  llamada.atendido = true;
  llamada.atendidoEn = new Date().toISOString();
  saveData(MOZO_FILE, llamadasMozo);
  io.emit('llamada_atendida', { id: llamada.id, mesa: llamada.mesa, tipo: llamada.tipo });
  res.json(llamada);
});

app.get('/api/ticket-config', (req, res) => {
  res.json(ticketConfig);
});

app.post('/api/ticket-config', authMiddleware, roleMiddleware('admin'), (req, res) => {
  const { nombre, direccion, telefono, cuit, encabezado, pie, leyenda } = req.body;
  if (nombre !== undefined) ticketConfig.nombre = nombre;
  if (direccion !== undefined) ticketConfig.direccion = direccion;
  if (telefono !== undefined) ticketConfig.telefono = telefono;
  if (cuit !== undefined) ticketConfig.cuit = cuit;
  if (encabezado !== undefined) ticketConfig.encabezado = encabezado;
  if (pie !== undefined) ticketConfig.pie = pie;
  if (leyenda !== undefined) ticketConfig.leyenda = leyenda;
  saveData(TICKET_FILE, ticketConfig);
  res.json(ticketConfig);
});

// ENDPOINTS INSUMOS Y STOCK
app.get('/api/insumos', authMiddleware, (req, res) => res.json(insumos));

app.post('/api/insumos', authMiddleware, (req, res) => {
  const insumo = {
    id: `INS-${Date.now()}`,
    nombre: req.body.nombre || '',
    unidad: req.body.unidad || 'unidades',
    cantidad: req.body.cantidad || 0,
    stockMinimo: req.body.stockMinimo || 5,
    costoPorUnidad: req.body.costoPorUnidad || 0,
    proveedor: req.body.proveedor || ''
  };
  insumos.push(insumo);
  saveData(INSUMOS_FILE, insumos);
  io.emit('stock_actualizado');
  res.status(201).json(insumo);
});

app.put('/api/insumos/:id', authMiddleware, (req, res) => {
  const insumo = insumos.find(i => i.id === req.params.id);
  if (!insumo) return res.status(404).json({ error: 'Insumo no encontrado' });
  if (req.body.nombre !== undefined) insumo.nombre = req.body.nombre;
  if (req.body.unidad !== undefined) insumo.unidad = req.body.unidad;
  if (req.body.cantidad !== undefined) insumo.cantidad = req.body.cantidad;
  if (req.body.stockMinimo !== undefined) insumo.stockMinimo = req.body.stockMinimo;
  if (req.body.costoPorUnidad !== undefined) insumo.costoPorUnidad = req.body.costoPorUnidad;
  if (req.body.proveedor !== undefined) insumo.proveedor = req.body.proveedor;
  saveData(INSUMOS_FILE, insumos);
  io.emit('stock_actualizado');
  res.json(insumo);
});

app.delete('/api/insumos/:id', authMiddleware, (req, res) => {
  insumos = insumos.filter(i => i.id !== req.params.id);
  saveData(INSUMOS_FILE, insumos);
  io.emit('stock_actualizado');
  res.json({ ok: true });
});

app.post('/api/insumos/:id/ajuste', authMiddleware, (req, res) => {
  const insumo = insumos.find(i => i.id === req.params.id);
  if (!insumo) return res.status(404).json({ error: 'Insumo no encontrado' });
  const cantidad = parseFloat(req.body.cantidad) || 0;
  const motivo = req.body.motivo || 'Ajuste manual';
  insumo.cantidad += cantidad;
  if (insumo.cantidad < 0) insumo.cantidad = 0;
  saveData(INSUMOS_FILE, insumos);
  io.emit('stock_actualizado');
  res.json(insumo);
});

app.get('/api/stock-alertas', authMiddleware, (req, res) => {
  const alertas = insumos.filter(i => i.cantidad <= i.stockMinimo);
  res.json(alertas);
});

// RECETAS (ingredientes por plato)
app.get('/api/recetas', authMiddleware, (req, res) => res.json(recetas));

app.post('/api/recetas', authMiddleware, (req, res) => {
  const { dishId, dishNombre, ingredientes } = req.body;
  const existente = recetas.find(r => r.dishId === dishId);
  if (existente) {
    existente.dishNombre = dishNombre || existente.dishNombre;
    existente.ingredientes = ingredientes || existente.ingredientes;
  } else {
    recetas.push({ dishId, dishNombre: dishNombre || '', ingredientes: ingredientes || [] });
  }
  saveData(RECETAS_FILE, recetas);
  res.json({ ok: true });
});

app.delete('/api/recetas/:dishId', authMiddleware, (req, res) => {
  recetas = recetas.filter(r => r.dishId !== req.params.dishId);
  saveData(RECETAS_FILE, recetas);
  res.json({ ok: true });
});

// ENDPOINTS AUTH
app.post('/api/auth/login', (req, res) => {
  const { usuario, password } = req.body;
  if (!usuario || !password) {
    return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
  }
  const user = usuarios.find(u => u.usuario === usuario && u.activo);
  if (!user || user.password !== password) {
    return res.status(401).json({ error: 'Credenciales incorrectas' });
  }
  const token = generateToken();
  activeTokens.set(token, { createdAt: Date.now(), usuario: user.usuario, nombre: user.nombre, rol: user.rol, id: user.id });
  res.json({ token, usuario: user.usuario, nombre: user.nombre, rol: user.rol });
});

app.post('/api/auth/logout', (req, res) => {
  const token = req.headers['x-auth-token'];
  if (token) activeTokens.delete(token);
  res.json({ ok: true });
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
  res.json({ usuario: req.user.usuario, nombre: req.user.nombre, rol: req.user.rol });
});

// ENDPOINTS USUARIOS (solo admin)
app.get('/api/usuarios', authMiddleware, roleMiddleware('admin'), (req, res) => {
  const safeUsers = usuarios.map(({ password, ...u }) => u);
  res.json(safeUsers);
});

app.post('/api/usuarios', authMiddleware, roleMiddleware('admin'), (req, res) => {
  const { usuario, nombre, password, rol } = req.body;
  if (!usuario || !password || !rol) {
    return res.status(400).json({ error: 'usuario, password y rol son requeridos' });
  }
  if (!ROLES[rol]) return res.status(400).json({ error: 'Rol inválido' });
  if (usuarios.find(u => u.usuario === usuario)) {
    return res.status(409).json({ error: 'El usuario ya existe' });
  }
  const nuevo = {
    id: `USR-${Date.now().toString(36)}`,
    usuario, nombre: nombre || usuario, password, rol,
    activo: true, creado: new Date().toISOString()
  };
  usuarios.push(nuevo);
  saveData(USERS_FILE, usuarios);
  const { password: _, ...safe } = nuevo;
  res.status(201).json(safe);
});

app.put('/api/usuarios/:id', authMiddleware, roleMiddleware('admin'), (req, res) => {
  const user = usuarios.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
  const { nombre, password, rol, activo } = req.body;
  if (nombre !== undefined) user.nombre = nombre;
  if (password) user.password = password;
  if (rol && ROLES[rol]) user.rol = rol;
  if (activo !== undefined) user.activo = activo;
  saveData(USERS_FILE, usuarios);
  const { password: _, ...safe } = user;
  res.json(safe);
});

app.delete('/api/usuarios/:id', authMiddleware, roleMiddleware('admin'), (req, res) => {
  const user = usuarios.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
  if (user.usuario === 'admin') return res.status(400).json({ error: 'No se puede eliminar el usuario admin' });
  usuarios = usuarios.filter(u => u.id !== req.params.id);
  saveData(USERS_FILE, usuarios);
  res.json({ ok: true });
});

// ENDPOINTS CIERRE DE CAJA
app.get('/api/cierre-caja', authMiddleware, (req, res) => {
  const fecha = req.query.fecha || localDate(new Date());
  const diaInicio = new Date(fecha + 'T00:00:00');
  const diaFin = new Date(fecha + 'T23:59:59.999');

  const pedidosDelDia = pedidos.filter(p => {
    const f = new Date(p.fecha);
    return f >= diaInicio && f <= diaFin;
  });

  const pedidosPagados = pedidosDelDia.filter(p => p.pagado);
  const totalVentas = pedidosPagados.reduce((s, p) => s + (p.total || 0), 0);
  const totalPropinas = pedidosPagados.reduce((s, p) => s + (p.propina || 0), 0);
  const totalGeneral = totalVentas + totalPropinas;

  const pedidosPorMesa = {};
  pedidosPagados.forEach(p => {
    const m = p.mesa || 'Mesa 1';
    if (!pedidosPorMesa[m]) pedidosPorMesa[m] = { cantidad: 0, total: 0 };
    pedidosPorMesa[m].cantidad++;
    pedidosPorMesa[m].total += (p.total || 0);
  });

  const platosVendidos = {};
  pedidosPagados.forEach(p => {
    (p.items || []).forEach(i => {
      if (!platosVendidos[i.nombre]) platosVendidos[i.nombre] = { cantidad: 0, total: 0 };
      platosVendidos[i.nombre].cantidad += i.cantidad;
      platosVendidos[i.nombre].total += i.precio * i.cantidad;
    });
  });

  const rankingPlatos = Object.entries(platosVendidos)
    .map(([nombre, d]) => ({ nombre, ...d }))
    .sort((a, b) => b.cantidad - a.cantidad);

  res.json({
    fecha,
    totalPedidos: pedidosDelDia.length,
    pedidosPagados: pedidosPagados.length,
    pedidosPendientes: pedidosDelDia.length - pedidosPagados.length,
    totalVentas,
    totalPropinas,
    totalGeneral,
    pedidosPorMesa,
    rankingPlatos
  });
});

// ENDPOINTS REPORTES Y ESTADÍSTICAS
app.get('/api/reportes', authMiddleware, (req, res) => {
  const desde = req.query.desde || localDate(new Date());
  const hasta = req.query.hasta || desde;
  const fechaDesde = new Date(desde + 'T00:00:00');
  const fechaHasta = new Date(hasta + 'T23:59:59.999');

  const pedidosRango = pedidos.filter(p => {
    const f = new Date(p.fecha);
    return f >= fechaDesde && f <= fechaHasta && p.pagado;
  });

  // Facturación total
  const totalVentas = pedidosRango.reduce((s, p) => s + (p.total || 0), 0);
  const totalPropinas = pedidosRango.reduce((s, p) => s + (p.propina || 0), 0);
  const totalPedidos = pedidosRango.length;
  const ticketPromedio = totalPedidos > 0 ? totalVentas / totalPedidos : 0;

  // Platos más vendidos
  const platosMap = {};
  pedidosRango.forEach(p => {
    (p.items || []).forEach(i => {
      if (!platosMap[i.nombre]) platosMap[i.nombre] = { nombre: i.nombre, cantidad: 0, total: 0 };
      platosMap[i.nombre].cantidad += i.cantidad;
      platosMap[i.nombre].total += (i.subtotal || i.precioUnitario * i.cantidad || 0);
    });
  });
  const topPlatos = Object.values(platosMap).sort((a, b) => b.cantidad - a.cantidad);

  // Horarios pico (agrupar por hora)
  const horariosMap = {};
  for (let h = 8; h <= 23; h++) horariosMap[h] = 0;
  pedidosRango.forEach(p => {
    const hora = new Date(p.fecha).getHours();
    if (horariosMap[hora] !== undefined) horariosMap[hora]++;
  });
  const horariosPico = Object.entries(horariosMap).map(([hora, cantidad]) => ({
    hora: parseInt(hora),
    cantidad,
    label: `${hora}:00`
  })).sort((a, b) => a.hora - b.hora);

  // Margen de ganancia
  let costoTotalInsumos = 0;
  const margenesPorPlato = {};
  pedidosRango.forEach(p => {
    (p.items || []).forEach(i => {
      const receta = recetas.find(r => r.dishId === String(i.id));
      if (!receta) return;
      let costoItem = 0;
      receta.ingredientes.forEach(ing => {
        const insumo = insumos.find(ins => ins.id === ing.insumoId);
        if (insumo) costoItem += ing.cantidad * insumo.costoPorUnidad * (i.cantidad || 1);
      });
      costoTotalInsumos += costoItem;
      if (!margenesPorPlato[i.nombre]) margenesPorPlato[i.nombre] = { nombre: i.nombre, ingreso: 0, costo: 0, cantidad: 0 };
      margenesPorPlato[i.nombre].ingreso += (i.subtotal || i.precioUnitario * i.cantidad || 0);
      margenesPorPlato[i.nombre].costo += costoItem;
      margenesPorPlato[i.nombre].cantidad += (i.cantidad || 1);
    });
  });

  const margenBruto = totalVentas - costoTotalInsumos;
  const margenPorcentaje = totalVentas > 0 ? ((margenBruto / totalVentas) * 100) : 0;

  const rankingMargen = Object.values(margenesPorPlato)
    .map(m => ({
      ...m,
      ganancia: m.ingreso - m.costo,
      margenPct: m.ingreso > 0 ? (((m.ingreso - m.costo) / m.ingreso) * 100).toFixed(1) : 0
    }))
    .sort((a, b) => b.ganancia - a.ganancia);

  // Pedidos por día (para tendencia)
  const pedidosPorDia = {};
  pedidosRango.forEach(p => {
    const dia = localDate(new Date(p.fecha));
    if (!pedidosPorDia[dia]) pedidosPorDia[dia] = { ventas: 0, pedidos: 0, propinas: 0 };
    pedidosPorDia[dia].ventas += (p.total || 0);
    pedidosPorDia[dia].pedidos++;
    pedidosPorDia[dia].propinas += (p.propina || 0);
  });

  // Desglose por medio de pago
  const pagosMap = {};
  pedidosRango.forEach(p => {
    const mp = p.medioPago || 'No especificado';
    if (!pagosMap[mp]) pagosMap[mp] = { medio: mp, cantidad: 0, total: 0 };
    pagosMap[mp].cantidad++;
    pagosMap[mp].total += (p.total || 0);
  });
  const pagosPorMedio = Object.values(pagosMap).sort((a, b) => b.total - a.total);

  res.json({
    desde,
    hasta,
    totalVentas,
    totalPropinas,
    totalPedidos,
    ticketPromedio,
    costoInsumos: costoTotalInsumos,
    margenBruto,
    margenPorcentaje,
    topPlatos,
    horariosPico,
    rankingMargen,
    pedidosPorDia,
    pagosPorMedio
  });
});

// MÉTRICAS EN TIEMPO REAL (para dashboard admin)
app.get('/api/metricas', authMiddleware, (req, res) => {
  const now = new Date();
  const hoy = localDate(now);
  const fechaDesde = new Date(hoy + 'T00:00:00');
  const fechaHasta = new Date(hoy + 'T23:59:59.999');

  const pedidosHoy = pedidos.filter(p => {
    const f = new Date(p.fecha);
    return f >= fechaDesde && f <= fechaHasta && p.pagado;
  });

  // Pedidos activos (no pagados)
  const activos = pedidos.filter(p => !p.pagado && p.estado !== 'entregado' && p.estado !== 'programado');

  // Pedidos de hoy
  const totalVentasHoy = pedidosHoy.reduce((s, p) => s + (p.total || 0), 0);
  const totalPropinasHoy = pedidosHoy.reduce((s, p) => s + (p.propina || 0), 0);
  const totalPedidosHoy = pedidosHoy.length;
  const ticketPromedio = totalPedidosHoy > 0 ? totalVentasHoy / totalPedidosHoy : 0;

  // Tiempo promedio de preparación (entre pendiente y entregado)
  let tiempos = [];
  pedidosHoy.forEach(p => {
    if (p.fechaEntrega) {
      const preparacion = (new Date(p.fechaEntrega) - new Date(p.fecha)) / 60000;
      if (preparacion > 0 && preparacion < 120) tiempos.push(preparacion);
    }
  });
  const tiempoPromPreparacion = tiempos.length > 0 ? Math.round(tiempos.reduce((a, b) => a + b, 0) / tiempos.length) : 0;

  // Ocupación de mesas
  const mesasActivas = new Set(activos.map(p => p.mesa)).size;
  const totalMesas = mesasCache.length || 1;

  // Pedidos por hora (hoy)
  const pedidosPorHora = {};
  for (let h = 8; h <= 23; h++) pedidosPorHora[h] = 0;
  pedidosHoy.forEach(p => {
    const hora = new Date(p.fecha).getHours();
    if (pedidosPorHora[hora] !== undefined) pedidosPorHora[hora]++;
  });
  const horariosData = Object.entries(pedidosPorHora).map(([hora, cantidad]) => ({
    hora: parseInt(hora), cantidad, label: `${hora}:00`
  }));

  // Top 5 platos hoy
  const platosMap = {};
  pedidosHoy.forEach(p => {
    (p.items || []).forEach(i => {
      if (!platosMap[i.nombre]) platosMap[i.nombre] = { nombre: i.nombre, cantidad: 0, total: 0 };
      platosMap[i.nombre].cantidad += i.cantidad;
      platosMap[i.nombre].total += (i.subtotal || i.precioUnitario * i.cantidad || 0);
    });
  });
  const topPlatos = Object.values(platosMap).sort((a, b) => b.cantidad - a.cantidad).slice(0, 5);

  // Estado de pedidos activos
  const porEstado = { pendiente: 0, en_preparacion: 0, programado: 0 };
  activos.forEach(p => { if (porEstado[p.estado] !== undefined) porEstado[p.estado]++; });
  const programados = pedidos.filter(p => p.estado === 'programado').length;

  res.json({
    hoy,
    totalVentasHoy,
    totalPropinasHoy,
    totalPedidosHoy,
    ticketPromedio,
    tiempoPromPreparacion,
    mesasActivas,
    totalMesas,
    ocupacionMesas: totalMesas > 0 ? Math.round((mesasActivas / totalMesas) * 100) : 0,
    pedidosPorHora: horariosData,
    topPlatos,
    pedidosActivos: activos.length,
    porEstado,
    programados
  });
});

// ENDPOINTS ARCA - FACTURACIÓN ELECTRÓNICA (OPCIONAL)
let arcaInstance = null;

async function getArcaInstance() {
  if (arcaInstance) return arcaInstance;
  if (!arcaConfig.habilitado || !arcaConfig.cuit || !arcaConfig.cert || !arcaConfig.key) return null;
  try {
    const { Arca } = await import('@ramiidv/arca-facturacion');
    arcaInstance = new Arca({
      cuit: parseInt(arcaConfig.cuit),
      cert: arcaConfig.cert,
      key: arcaConfig.key,
      production: arcaConfig.production || false
    });
    return arcaInstance;
  } catch (err) {
    console.error('Error inicializando ARCA:', err.message);
    return null;
  }
}

app.get('/api/arca/config', authMiddleware, (req, res) => {
  const safe = { ...arcaConfig };
  if (safe.cert) safe.cert = safe.cert.slice(0, 20) + '...';
  if (safe.key) safe.key = '***';
  res.json(safe);
});

app.post('/api/arca/config', authMiddleware, (req, res) => {
  if (req.body.habilitado !== undefined) arcaConfig.habilitado = req.body.habilitado;
  if (req.body.cuit !== undefined) arcaConfig.cuit = req.body.cuit;
  if (req.body.cert !== undefined) arcaConfig.cert = req.body.cert;
  if (req.body.key !== undefined) arcaConfig.key = req.body.key;
  if (req.body.puntoVenta !== undefined) arcaConfig.puntoVenta = parseInt(req.body.puntoVenta) || 1;
  if (req.body.tipoComprobante !== undefined) arcaConfig.tipoComprobante = parseInt(req.body.tipoComprobante) || 6;
  if (req.body.production !== undefined) arcaConfig.production = req.body.production;
  arcaInstance = null;
  saveData(ARCA_FILE, arcaConfig);
  res.json({ ok: true, habilitado: arcaConfig.habilitado });
});

app.post('/api/arca/test', authMiddleware, async (req, res) => {
  try {
    arcaInstance = null;
    const arca = await getArcaInstance();
    if (!arca) return res.status(400).json({ ok: false, error: 'ARCA no está habilitado o falta configuración' });
    const ultimo = await arca.ultimoComprobante(arcaConfig.puntoVenta, arcaConfig.tipoComprobante);
    res.json({ ok: true, ultimoComprobante: ultimo, puntoVenta: arcaConfig.puntoVenta, modo: arcaConfig.production ? 'Producción' : 'Homologación' });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/facturas', authMiddleware, async (req, res) => {
  try {
    const arca = await getArcaInstance();
    if (!arca) return res.status(400).json({ error: 'ARCA no habilitado' });

    const { pedidoId, cliente, items, total, propina } = req.body;
    const pedido = pedidos.find(p => p.id === pedidoId);

    const condIvaReceptor = cliente?.condicionIva || 5;
    const docTipo = cliente?.tipoDoc || 99;
    const docNro = cliente?.nroDoc || 0;
    const razonSocial = cliente?.razonSocial || '';

    const itemsArca = (items || []).map(i => ({
      neto: Number(((i.subtotal || i.precio * i.cantidad) / 1.21).toFixed(2)),
      iva: 21
    }));

    if (!itemsArca.length) {
      itemsArca.push({ neto: Number((total / 1.21).toFixed(2)), iva: 21 });
    }

    const result = await arca.facturar({
      ptoVta: arcaConfig.puntoVenta,
      cbteTipo: arcaConfig.tipoComprobante,
      docTipo,
      docNro: docNro ? BigInt(docNro) : undefined,
      condicionIvaReceptor: condIvaReceptor,
      razonSocial: razonSocial || undefined,
      items: itemsArca
    });

    const cae = result.cae;
    const vto = result.vencimientoCae;
    const numero = result.numeroComprobante;

    const qrData = {
      ver: 1,
      fecha: localDate(new Date()).replace(/-/g, ''),
      cuit: arcaConfig.cuit,
      ptoVta: arcaConfig.puntoVenta,
      tipoCmp: arcaConfig.tipoComprobante,
      nroCmp: numero,
      importe: total,
      moneda: 'PES',
      ctz: 1,
      tipoDocRec: docTipo,
      nroDocRec: docNro,
      tipoCodAut: 'E',
      codAut: cae
    };
    const qrUrl = `https://www.afip.gob.ar/facturacion/QR/?qr=${Buffer.from(JSON.stringify(qrData)).toString('base64')}`;

    const factura = {
      id: `FCB-${Date.now()}`,
      pedidoId: pedidoId || null,
      fecha: new Date().toISOString(),
      cae,
      caeVencimiento: vto,
      tipoComprobante: arcaConfig.tipoComprobante,
      puntoVenta: arcaConfig.puntoVenta,
      numeroComprobante: numero,
      cliente: {
        tipoDoc: docTipo,
        nroDoc: docNro,
        razonSocial: razonSocial || 'Consumidor Final',
        condicionIva: condIvaReceptor
      },
      items: items || pedido?.items || [],
      netoGravado: itemsArca.reduce((s, i) => s + i.neto, 0),
      iva: itemsArca.reduce((s, i) => s + (i.neto * i.iva / 100), 0),
      total,
      propina: propina || 0,
      qrUrl,
      estado: 'autorizada'
    };

    facturas.push(factura);
    saveData(FACTURAS_FILE, facturas);

    if (pedido) {
      pedido.facturaId = factura.id;
      pedido.facturaCae = cae;
      saveData(PEDIDOS_FILE, pedidos);
    }

    res.status(201).json(factura);
  } catch (err) {
    console.error('Error emitiendo factura ARCA:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/facturas', authMiddleware, (req, res) => {
  const { desde, hasta } = req.query;
  let result = facturas;
  if (desde && hasta) {
    const fDesde = new Date(desde + 'T00:00:00');
    const fHasta = new Date(hasta + 'T23:59:59.999');
    result = facturas.filter(f => { const f2 = new Date(f.fecha); return f2 >= fDesde && f2 <= fHasta; });
  }
  res.json(result);
});

app.get('/api/facturas/:id', authMiddleware, (req, res) => {
  const factura = facturas.find(f => f.id === req.params.id);
  if (!factura) return res.status(404).json({ error: 'Factura no encontrada' });
  res.json(factura);
});

// ========== CAJA DIARIA ==========
// Un turno de caja tiene: apertura, eventos (arqueos, egresos, ingresos), cierre

app.get('/api/caja/turno-actual', authMiddleware, roleMiddleware('admin', 'cajero'), (req, res) => {
  const abierto = cajaEventos.filter(e => e.tipo === 'apertura' && !e.cerradoEn).pop();
  if (!abierto) return res.json({ abierto: false });
  const eventos = cajaEventos.filter(e => e.turnoId === abierto.turnoId);
  const totalEgresos = eventos.filter(e => e.tipo === 'egreso').reduce((s, e) => s + (e.monto || 0), 0);
  const totalIngresosExtra = eventos.filter(e => e.tipo === 'ingreso_extra').reduce((s, e) => s + (e.monto || 0), 0);
  const arqueos = eventos.filter(e => e.tipo === 'arqueo');
  res.json({
    abierto: true,
    turnoId: abierto.turnoId,
    usuario: abierto.usuario,
    montoApertura: abierto.monto,
    abiertoEn: abierto.fecha,
    totalEgresos,
    totalIngresosExtra,
    eventos: eventos.filter(e => e.tipo !== 'apertura'),
    arqueos
  });
});

app.post('/api/caja/abrir', authMiddleware, roleMiddleware('admin', 'cajero'), (req, res) => {
  const abierto = cajaEventos.find(e => e.tipo === 'apertura' && !e.cerradoEn);
  if (abierto) return res.status(409).json({ error: 'Ya hay una caja abierta por ' + abierto.usuario });

  const monto = parseFloat(req.body.monto) || 0;
  const evento = {
    id: `CAJ-${Date.now().toString(36)}`,
    tipo: 'apertura',
    turnoId: `TUR-${Date.now().toString(36)}`,
    usuario: req.user.usuario,
    nombre: req.user.nombre,
    monto,
    fecha: new Date().toISOString(),
    cerradoEn: null
  };
  cajaEventos.push(evento);
  saveData(CAJA_FILE, cajaEventos);
  res.status(201).json(evento);
});

app.post('/api/caja/arqueo', authMiddleware, roleMiddleware('admin', 'cajero'), (req, res) => {
  const apertura = cajaEventos.find(e => e.tipo === 'apertura' && !e.cerradoEn);
  if (!apertura) return res.status(400).json({ error: 'No hay caja abierta' });

  const montoContado = parseFloat(req.body.montoContado) || 0;
  const observaciones = req.body.observaciones || '';
  const eventos = cajaEventos.filter(e => e.turnoId === apertura.turnoId && e.tipo !== 'apertura');
  const totalEgresos = eventos.filter(e => e.tipo === 'egreso').reduce((s, e) => s + (e.monto || 0), 0);
  const totalIngresosExtra = eventos.filter(e => e.tipo === 'ingreso_extra').reduce((s, e) => s + (e.monto || 0), 0);

  const ventasPagadas = pedidos.filter(p => {
    if (!p.pagado) return false;
    const f = localDate(new Date(p.fecha));
    return f === localDate(new Date()) && p.formaPago !== 'tarjeta';
  });
  const totalVentasEfectivo = ventasPagadas.reduce((s, p) => s + (p.total || 0), 0);
  const totalPropinasEfectivo = ventasPagadas.reduce((s, p) => s + (p.propina || 0), 0);

  const esperado = apertura.monto + totalVentasEfectivo + totalPropinasEfectivo + totalIngresosExtra - totalEgresos;
  const diferencia = montoContado - esperado;

  const evento = {
    id: `CAJ-${Date.now().toString(36)}`,
    tipo: 'arqueo',
    turnoId: apertura.turnoId,
    usuario: req.user.usuario,
    montoContado,
    esperado,
    diferencia,
    observaciones,
    fecha: new Date().toISOString()
  };
  cajaEventos.push(evento);
  saveData(CAJA_FILE, cajaEventos);
  res.status(201).json(evento);
});

app.post('/api/caja/egreso', authMiddleware, roleMiddleware('admin', 'cajero'), (req, res) => {
  const apertura = cajaEventos.find(e => e.tipo === 'apertura' && !e.cerradoEn);
  if (!apertura) return res.status(400).json({ error: 'No hay caja abierta' });

  const monto = parseFloat(req.body.monto) || 0;
  if (monto <= 0) return res.status(400).json({ error: 'Monto inválido' });

  const evento = {
    id: `CAJ-${Date.now().toString(36)}`,
    tipo: 'egreso',
    turnoId: apertura.turnoId,
    usuario: req.user.usuario,
    monto,
    motivo: req.body.motivo || 'Egreso informado',
    categoria: req.body.categoria || 'general',
    fecha: new Date().toISOString()
  };
  cajaEventos.push(evento);
  saveData(CAJA_FILE, cajaEventos);
  res.status(201).json(evento);
});

app.post('/api/caja/ingreso-extra', authMiddleware, roleMiddleware('admin', 'cajero'), (req, res) => {
  const apertura = cajaEventos.find(e => e.tipo === 'apertura' && !e.cerradoEn);
  if (!apertura) return res.status(400).json({ error: 'No hay caja abierta' });

  const monto = parseFloat(req.body.monto) || 0;
  const evento = {
    id: `CAJ-${Date.now().toString(36)}`,
    tipo: 'ingreso_extra',
    turnoId: apertura.turnoId,
    usuario: req.user.usuario,
    monto,
    motivo: req.body.motivo || 'Ingreso extra',
    fecha: new Date().toISOString()
  };
  cajaEventos.push(evento);
  saveData(CAJA_FILE, cajaEventos);
  res.status(201).json(evento);
});

app.post('/api/caja/cerrar', authMiddleware, roleMiddleware('admin', 'cajero'), (req, res) => {
  const apertura = cajaEventos.find(e => e.tipo === 'apertura' && !e.cerradoEn);
  if (!apertura) return res.status(400).json({ error: 'No hay caja abierta' });

  const montoCierre = parseFloat(req.body.montoCierre) || 0;
  const observaciones = req.body.observaciones || '';
  const eventos = cajaEventos.filter(e => e.turnoId === apertura.turnoId && e.tipo !== 'apertura');
  const totalEgresos = eventos.filter(e => e.tipo === 'egreso').reduce((s, e) => s + (e.monto || 0), 0);
  const totalIngresosExtra = eventos.filter(e => e.tipo === 'ingreso_extra').reduce((s, e) => s + (e.monto || 0), 0);

  const ventasPagadas = pedidos.filter(p => {
    if (!p.pagado) return false;
    const f = localDate(new Date(p.fecha));
    return f === localDate(new Date()) && p.formaPago !== 'tarjeta';
  });
  const totalVentasEfectivo = ventasPagadas.reduce((s, p) => s + (p.total || 0), 0);
  const totalPropinasEfectivo = ventasPagadas.reduce((s, p) => s + (p.propina || 0), 0);

  const esperado = apertura.monto + totalVentasEfectivo + totalPropinasEfectivo + totalIngresosExtra - totalEgresos;
  const diferencia = montoCierre - esperado;

  const evento = {
    id: `CAJ-${Date.now().toString(36)}`,
    tipo: 'cierre',
    turnoId: apertura.turnoId,
    usuario: req.user.usuario,
    montoCierre,
    esperado,
    diferencia,
    observaciones,
    fecha: new Date().toISOString()
  };

  apertura.cerradoEn = new Date().toISOString();
  cajaEventos.push(evento);
  saveData(CAJA_FILE, cajaEventos);

  // Registrar turno
  turnos.push({
    id: apertura.turnoId,
    usuario: apertura.usuario,
    nombre: apertura.nombre,
    apertura: apertura.fecha,
    cierre: new Date().toISOString(),
    montoApertura: apertura.monto,
    montoCierre,
    totalEgresos,
    totalIngresosExtra,
    ventasEfectivo: totalVentasEfectivo,
    propinasEfectivo: totalPropinasEfectivo,
    diferencia
  });
  saveData(TURNOS_FILE, turnos);

  res.json(evento);
});

app.get('/api/caja/historial', authMiddleware, roleMiddleware('admin', 'cajero'), (req, res) => {
  const fecha = req.query.fecha || localDate(new Date());
  const eventos = cajaEventos.filter(e => localDate(new Date(e.fecha)) === fecha);
  res.json(eventos);
});

// ========== TURNOS ==========

app.get('/api/turnos', authMiddleware, roleMiddleware('admin', 'cajero'), (req, res) => {
  const desde = req.query.desde || localDate(new Date());
  const hasta = req.query.hasta || desde;
  const filtrados = turnos.filter(t => {
    const f = localDate(new Date(t.apertura));
    return f >= desde && f <= hasta;
  }).reverse();
  res.json(filtrados);
});

// ========== TURNOS DE MOZOS (asignación por admin) ==========

let turnosMozos = readData(path.join(__dirname, 'turnos-mozos.json'));
if (!turnosMozos || !Array.isArray(turnosMozos)) {
  turnosMozos = [];
  saveData(path.join(__dirname, 'turnos-mozos.json'), turnosMozos);
}

// Admin: listar turnos de mozos (puede filtrar por fecha)
app.get('/api/turnos-mozos', authMiddleware, roleMiddleware('admin', 'cajero'), (req, res) => {
  const desde = req.query.desde || localDate(new Date());
  const hasta = req.query.hasta || desde;
  const filtrados = turnosMozos.filter(t => {
    const f = localDate(new Date(t.inicio));
    return f >= desde && f <= hasta;
  }).reverse();
  res.json(filtrados);
});

// Admin: obtener turnos activos de mozos (los que están trabajando ahora)
app.get('/api/turnos-mozos/activos', authMiddleware, (req, res) => {
  const activos = turnosMozos.filter(t => t.estado === 'activo');
  res.json(activos);
});

// Admin: iniciar turno para un mozo
app.post('/api/turnos-mozos', authMiddleware, roleMiddleware('admin', 'cajero'), (req, res) => {
  const { mozoId } = req.body;
  if (!mozoId) return res.status(400).json({ error: 'mozoId requerido' });

  const mozo = usuarios.find(u => u.id === mozoId);
  if (!mozo) return res.status(404).json({ error: 'Usuario no encontrado' });

  const yaActivo = turnosMozos.find(t => t.mozoId === mozoId && t.estado === 'activo');
  if (yaActivo) return res.status(409).json({ error: `${mozo.nombre} ya tiene un turno activo` });

  const turno = {
    id: `TMZ-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
    mozoId: mozo.id,
    mozoNombre: mozo.nombre,
    mozoUsuario: mozo.usuario,
    adminAsigno: req.user.nombre || req.user.usuario,
    estado: 'activo',
    inicio: new Date().toISOString(),
    fin: null
  };
  turnosMozos.push(turno);
  saveData(path.join(__dirname, 'turnos-mozos.json'), turnosMozos);
  io.emit('turno_mozo_actualizado', turno);
  res.status(201).json(turno);
});

// Admin: finalizar turno de un mozo
app.patch('/api/turnos-mozos/:id/cerrar', authMiddleware, roleMiddleware('admin', 'cajero'), (req, res) => {
  const turno = turnosMozos.find(t => t.id === req.params.id);
  if (!turno) return res.status(404).json({ error: 'Turno no encontrado' });
  if (turno.estado !== 'activo') return res.status(400).json({ error: 'El turno ya está cerrado' });

  turno.estado = 'finalizado';
  turno.fin = new Date().toISOString();
  turno.adminCerro = req.user.nombre || req.user.usuario;
  saveData(path.join(__dirname, 'turnos-mozos.json'), turnosMozos);
  io.emit('turno_mozo_actualizado', turno);
  res.json(turno);
});

// Admin: editar inicio/fin de turno
app.patch('/api/turnos-mozos/:id/editar-inicio', authMiddleware, roleMiddleware('admin', 'cajero'), (req, res) => {
  const turno = turnosMozos.find(t => t.id === req.params.id);
  if (!turno) return res.status(404).json({ error: 'Turno no encontrado' });

  const { inicio, fin } = req.body;
  if (inicio) turno.inicio = new Date(inicio).toISOString();
  if (fin) {
    turno.fin = new Date(fin).toISOString();
    turno.estado = 'finalizado';
    turno.adminCerro = req.user.nombre || req.user.usuario;
  }
  saveData(path.join(__dirname, 'turnos-mozos.json'), turnosMozos);
  io.emit('turno_mozo_actualizado', turno);
  res.json(turno);
});

// Mozo: obtener su turno activo (requiere auth de mozo)
app.get('/api/turnos-mozos/mi-turno', authMiddleware, (req, res) => {
  const turno = turnosMozos.find(t => t.mozoId === req.user.id && t.estado === 'activo');
  if (!turno) return res.json({ activo: false });
  res.json({ activo: true, turno });
});

// Mozo: ver solo sus pedidos activos
app.get('/api/pedidos/mis-pedidos', authMiddleware, (req, res) => {
  const turno = turnosMozos.find(t => t.mozoId === req.user.id && t.estado === 'activo');
  const misPedidos = pedidos.filter(p => p.mozoAsignado === req.user.id && !p.pagado);
  res.json({ turnoActivo: !!turno, pedidos: misPedidos });
});

// Admin: asignar pedido a mozo
app.patch('/api/pedidos/:id/asignar-mozo', authMiddleware, roleMiddleware('admin', 'cajero'), (req, res) => {
  const pedido = pedidos.find(p => p.id === req.params.id);
  if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado' });

  const { mozoId } = req.body;
  if (mozoId) {
    const mozo = usuarios.find(u => u.id === mozoId && u.rol === 'mozo');
    if (!mozo) return res.status(404).json({ error: 'Mozo no encontrado' });
    pedido.mozoAsignado = mozoId;
    pedido.mozoNombre = mozo.nombre;
  } else {
    delete pedido.mozoAsignado;
    delete pedido.mozoNombre;
  }
  saveData(PEDIDOS_FILE, pedidos);
  io.emit('pedido_actualizado', pedido);
  res.json(pedido);
});

// ========== FIN TURNOS DE MOZOS ==========

// BACKUP AUTOMÁTICO
const MAX_BACKUPS = 72; // ~3 días de backups por hora
function crearBackup() {
  try {
    const now = new Date();
    const carpeta = path.join(BACKUP_DIR, now.toISOString().slice(0, 13).replace(':', ''));
    if (!fs.existsSync(carpeta)) fs.mkdirSync(carpeta, { recursive: true });
    [PEDIDOS_FILE, MOZO_FILE, MESAS_FILE, MENU_FILE, TICKET_FILE, RESENAS_FILE, USERS_FILE, INSUMOS_FILE, RECETAS_FILE, ARCA_FILE, FACTURAS_FILE, CAJA_FILE, TURNOS_FILE, path.join(__dirname, 'turnos-mozos.json')].forEach(f => {
      if (fs.existsSync(f)) {
        fs.copyFileSync(f, path.join(carpeta, path.basename(f)));
      }
    });

    // Prune backups antiguos
    if (fs.existsSync(BACKUP_DIR)) {
      const dirs = fs.readdirSync(BACKUP_DIR).sort().reverse();
      if (dirs.length > MAX_BACKUPS) {
        dirs.slice(MAX_BACKUPS).forEach(d => {
          const dirPath = path.join(BACKUP_DIR, d);
          if (fs.statSync(dirPath).isDirectory()) {
            fs.readdirSync(dirPath).forEach(f => fs.unlinkSync(path.join(dirPath, f)));
            fs.rmdirSync(dirPath);
          }
        });
      }
    }

    console.log(`📦 Backup creado en ${carpeta}`);
  } catch (err) {
    console.error('Error al crear backup:', err);
  }
}
setInterval(crearBackup, 3600000);

// LIMPIEZA AUTOMÁTICA DE LLAMADAS ATENDIDAS (>30 min)
function limpiarLlamadasAtendidas() {
  const limite = Date.now() - 30 * 60 * 1000;
  const antes = llamadasMozo.length;
  llamadasMozo = llamadasMozo.filter(l => {
    if (!l.atendido) return true;
    const fechaAtendido = new Date(l.atendidoEn || l.fecha).getTime();
    return fechaAtendido > limite;
  });
  if (llamadasMozo.length !== antes) {
    saveData(MOZO_FILE, llamadasMozo);
  }
}
setInterval(limpiarLlamadasAtendidas, 5 * 60 * 1000);

// TIEMPO ESTIMADO DE ESPERA
function calcularTiempoEstimado() {
  const activos = pedidos.filter(p => !p.pagado && p.estado !== 'entregado');
  const porEstado = { pendiente: 0, en_preparacion: 0 };
  activos.forEach(p => { if (porEstado[p.estado] !== undefined) porEstado[p.estado]++; });
  return 5 + (porEstado.pendiente * 3) + (porEstado.en_preparacion * 2);
}

// Scheduler: pedidos programados → pendientes cuando llega la hora
setInterval(() => {
  const now = new Date();
  let changed = false;
  pedidos.forEach(p => {
    if (p.estado === 'programado' && p.fechaProgramada && new Date(p.fechaProgramada) <= now) {
      p.estado = 'pendiente';
      p.tiempoEstimado = calcularTiempoEstimado();
      changed = true;
      descontarStockDeItems(p.items);
      io.emit('nuevo_pedido', p);
      sendPushToMozos('Pedido Programado', `${p.mesa}: ${p.items.map(i => i.nombre).join(', ')}`, '/mozo.html');
    }
  });
  if (changed) saveData(PEDIDOS_FILE, pedidos);
}, 30000);

// IMPORTANTE: Usamos server.listen en lugar de app.listen para soportar Socket.io
server.listen(PORT, '0.0.0.0', () => console.log(`🚀 Servidor ejecutándose en http://localhost:${PORT}`));