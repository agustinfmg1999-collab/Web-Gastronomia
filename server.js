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

app.use(express.json());
app.use(express.static(path.join(__dirname, './')));

const PEDIDOS_FILE = path.join(__dirname, 'pedidos.json');
const MOZO_FILE = path.join(__dirname, 'mozo.json');
const MESAS_FILE = path.join(__dirname, 'mesas.json');
const MENU_FILE = path.join(__dirname, 'menu.json');
const TICKET_FILE = path.join(__dirname, 'ticket.json');
const RESENAS_FILE = path.join(__dirname, 'resenas.json');
const AUTH_FILE = path.join(__dirname, 'auth.json');
const INSUMOS_FILE = path.join(__dirname, 'insumos.json');
const RECETAS_FILE = path.join(__dirname, 'recetas.json');
const BACKUP_DIR = path.join(__dirname, 'backups');

const ADMIN_PASSWORD = 'admin123';
let activeTokens = new Set();

function generateToken() {
  const token = crypto.randomBytes(32).toString('hex');
  activeTokens.add(token);
  return token;
}

function authMiddleware(req, res, next) {
  const token = req.headers['x-auth-token'];
  if (!token || !activeTokens.has(token)) {
    return res.status(401).json({ error: 'No autorizado' });
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
app.get('/api/pedidos', (req, res) => res.json(pedidos));

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
  const nuevoPedido = {
    id: `PED-${Math.floor(100000 + Math.random() * 900000)}`,
    mesa: req.body.mesa || '1',
    items: req.body.items || [],
    total: req.body.total || 0,
    estado: 'pendiente',
    tiempoEstimado: calcularTiempoEstimado(),
    fecha: new Date().toISOString()
  };
  pedidos.push(nuevoPedido);
  saveData(PEDIDOS_FILE, pedidos);
  
  descontarStockDeItems(nuevoPedido.items);

  // Notificamos a la cocina de nuevos pedidos en tiempo real
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
  res.status(201).json(nuevaLlamada);
});

app.patch('/api/mozo/:id', (req, res) => {
  const llamada = llamadasMozo.find(l => l.id === req.params.id);
  if (!llamada) return res.status(404).json({ error: 'Llamada no encontrada' });

  llamada.atendido = true;
  saveData(MOZO_FILE, llamadasMozo);
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
  const fecha = req.query.fecha || new Date().toISOString().slice(0, 10);
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

// BACKUP AUTOMÁTICO
function crearBackup() {
  try {
    const now = new Date();
    const carpeta = path.join(BACKUP_DIR, now.toISOString().slice(0, 13).replace(':', ''));
    if (!fs.existsSync(carpeta)) fs.mkdirSync(carpeta, { recursive: true });
    [PEDIDOS_FILE, MOZO_FILE, MESAS_FILE, MENU_FILE, TICKET_FILE, RESENAS_FILE, INSUMOS_FILE, RECETAS_FILE].forEach(f => {
      if (fs.existsSync(f)) {
        fs.copyFileSync(f, path.join(carpeta, path.basename(f)));
      }
    });
    console.log(`📦 Backup creado en ${carpeta}`);
  } catch (err) {
    console.error('Error al crear backup:', err);
  }
}
setInterval(crearBackup, 3600000);

// TIEMPO ESTIMADO DE ESPERA
function calcularTiempoEstimado() {
  const activos = pedidos.filter(p => !p.pagado && p.estado !== 'entregado');
  const porEstado = { pendiente: 0, en_preparacion: 0 };
  activos.forEach(p => { if (porEstado[p.estado] !== undefined) porEstado[p.estado]++; });
  return 5 + (porEstado.pendiente * 3) + (porEstado.en_preparacion * 2);
}

// IMPORTANTE: Usamos server.listen en lugar de app.listen para soportar Socket.io
server.listen(PORT, '0.0.0.0', () => console.log(`🚀 Servidor ejecutándose en http://localhost:${PORT}`));