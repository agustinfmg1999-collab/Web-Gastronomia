import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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
app.get('/index.html', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/cliente.html', (req, res) => res.sendFile(path.join(__dirname, 'cliente.html')));

const PEDIDOS_FILE = path.join(__dirname, 'pedidos.json');
const MOZO_FILE = path.join(__dirname, 'mozo.json');
const MESAS_FILE = path.join(__dirname, 'mesas.json');
const MENU_FILE = path.join(__dirname, 'menu.json');
const TICKET_FILE = path.join(__dirname, 'ticket.json');
const RESENAS_FILE = path.join(__dirname, 'resenas.json');
const AUTH_FILE = path.join(__dirname, 'auth.json');
const INSUMOS_FILE = path.join(__dirname, 'insumos.json');
const RECETAS_FILE = path.join(__dirname, 'recetas.json');
const ARCA_FILE = path.join(__dirname, 'arca.json');
const FACTURAS_FILE = path.join(__dirname, 'facturas.json');
const BACKUP_DIR = path.join(__dirname, 'backups');

const ADMIN_PASSWORD = 'admin123';
let activeTokens = new Map(); // token → createdAt (with TTL)
const TOKEN_TTL = 24 * 60 * 60 * 1000; // 24 horas

function generateToken() {
  const token = crypto.randomBytes(32).toString('hex');
  activeTokens.set(token, Date.now());
  return token;
}

function authMiddleware(req, res, next) {
  const token = req.headers['x-auth-token'];
  if (!token) return res.status(401).json({ error: 'No autorizado' });
  const createdAt = activeTokens.get(token);
  if (!createdAt || Date.now() - createdAt > TOKEN_TTL) {
    activeTokens.delete(token);
    return res.status(401).json({ error: 'Sesión expirada' });
  }
  next();
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

app.post('/api/menu', authMiddleware, (req, res) => {
  menuData = req.body;
  saveData(MENU_FILE, menuData);
  io.emit('menu_updated');
  res.json({ ok: true });
});

// Endpoints de Config
const CONFIG_FILE = path.join(__dirname, 'config.json');
let appConfig = readData(CONFIG_FILE);
app.get('/api/config', (req, res) => res.json(appConfig));
app.post('/api/config', authMiddleware, (req, res) => {
  if (req.body.publicUrl !== undefined) appConfig.publicUrl = req.body.publicUrl;
  saveData(CONFIG_FILE, appConfig);
  res.json(appConfig);
});

// Endpoints de Mesas
app.get('/api/mesas', (req, res) => res.json(mesas));
app.get('/api/mesas-activas', (req, res) => res.json(mesasActivas));

app.post('/api/mesas', authMiddleware, (req, res) => {
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
    const menuItem = menuData.find(m => String(m.id) === String(item.id) || m.nombre === item.nombre);
    const precio = menuItem ? menuItem.precio : (item.precio || 0);
    const cantidad = Math.max(1, parseInt(item.cantidad) || 1);
    return { ...item, precioUnitario: precio, cantidad, subtotal: precio * cantidad };
  });
  const serverTotal = recalculatedItems.reduce((sum, i) => sum + i.subtotal, 0);

  const nuevoPedido = {
    id: `PED-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
    mesa: req.body.mesa || '1',
    items: recalculatedItems,
    total: serverTotal,
    propina: 0,
    estado: 'pendiente',
    tiempoEstimado: calcularTiempoEstimado(),
    fecha: new Date().toISOString()
  };
  pedidos.push(nuevoPedido);
  saveData(PEDIDOS_FILE, pedidos);
  
  descontarStockDeItems(nuevoPedido.items);

  io.emit('nuevo_pedido', nuevoPedido);

  res.status(201).json(nuevoPedido);
});

app.patch('/api/pedidos/:id', authMiddleware, (req, res) => {
  const pedido = pedidos.find(p => p.id === req.params.id);
  if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado' });
  
  if (req.body.estado) pedido.estado = req.body.estado;
  if (req.body.pagado !== undefined) pedido.pagado = req.body.pagado;
  if (req.body.propina !== undefined) pedido.propina = req.body.propina;
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
    io.emit('pedido_listo', { mesa: pedido.mesa, pedidoId: pedido.id });
  }

  res.json(pedido);
});

app.delete('/api/pedidos', authMiddleware, (req, res) => {
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

app.post('/api/ticket-config', authMiddleware, (req, res) => {
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
  if (req.body.password === ADMIN_PASSWORD) {
    const token = generateToken();
    res.json({ token });
  } else {
    res.status(401).json({ error: 'Contraseña incorrecta' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  const token = req.headers['x-auth-token'];
  if (token) activeTokens.delete(token);
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
    pedidosPorDia
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

// BACKUP AUTOMÁTICO
const MAX_BACKUPS = 72; // ~3 días de backups por hora
function crearBackup() {
  try {
    const now = new Date();
    const carpeta = path.join(BACKUP_DIR, now.toISOString().slice(0, 13).replace(':', ''));
    if (!fs.existsSync(carpeta)) fs.mkdirSync(carpeta, { recursive: true });
    [PEDIDOS_FILE, MOZO_FILE, MESAS_FILE, MENU_FILE, TICKET_FILE, RESENAS_FILE, INSUMOS_FILE, RECETAS_FILE, ARCA_FILE, FACTURAS_FILE].forEach(f => {
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

// IMPORTANTE: Usamos server.listen en lugar de app.listen para soportar Socket.io
server.listen(PORT, '0.0.0.0', () => console.log(`🚀 Servidor ejecutándose en http://localhost:${PORT}`));