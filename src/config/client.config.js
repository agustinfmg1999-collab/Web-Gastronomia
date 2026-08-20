/**
 * CONFIGURACIÓN DEL CLIENTE (MARCA BLANCA)
 * Modifica este archivo para adaptar el sistema a un nuevo restaurante o café.
 */
export const clientConfig = {
  // Identidad Comercial
  id: "el-patio",
  nombre: "El Patio Tapas Bar",
  slogan: "Tapas, Copas & Buenos Momentos",
  logoText: "El Patio",
  subText: "Tapas Bar",

  // Tema y Apariencia Dinámica
  theme: {
    primaryColor: "#FF6B00",        // Color de acento (Botones, destacados)
    primaryHover: "#E05E00",        // Estado Hover
    backgroundColor: "#121212",     // Color de fondo principal
    surfaceColor: "#1E1E1E",         // Color de tarjetas y modales
    textColor: "#FFFFFF",            // Color de texto primario
    textMuted: "#A0A0A0",           // Color de texto secundario
    borderRadius: "16px",            // Esquinas redondeadas de tarjetas
    backgroundAnimation: "clouds"    // 'none' | 'clouds' | 'particles' | 'glow'
  },

  // Funcionalidades Activas por Local
  features: {
    llamarMozo: true,       // Habilita botón y modal para llamar al mozo
    pedirCuenta: true,      // Opción rápida para solicitar la cuenta
    pedirCubiertos: true,   // Opción rápida para pedir agua o cubiertos
    resenas: true,          // Muestra valoraciones de clientes en productos
    promosDia: true         // Banner superior de ofertas especiales
  },

  // Configuración de Mesas
  mesas: [
    { id: 1, numero: "Mesa 1", zona: "Salón Principal" },
    { id: 2, numero: "Mesa 2", zona: "Salón Principal" },
    { id: 3, numero: "Mesa 3", zona: "Terraza Nocturna" },
    { id: 4, numero: "Mesa 4", zona: "Terraza Nocturna" },
    { id: 5, numero: "Mesa 5", zona: "Barra Altas" },
    { id: 6, numero: "Mesa 6", zona: "Barra Altas" }
  ],

  // Categorías del Menú
  categorias: [
    { id: "entrantes", nombre: "Entrantes", icono: "🥗" },
    { id: "carnes", nombre: "Carnes & Parrilla", icono: "🥩" },
    { id: "pescados", nombre: "Pescados & Mariscos", icono: "🐟" },
    { id: "postres", nombre: "Postres", icono: "🍰" },
    { id: "bebidas", nombre: "Bebidas & Tragos", icono: "🍹" }
  ],

  // Promociones Destacadas
  promos: [
    {
      id: "promo-1",
      titulo: "Tapa del día: Jamón Ibérico & Vino",
      descripcion: "Copa de Vino Tinto Reserva + Tabla individual de jamón estacionado.",
      descuento: "20% OFF",
      precio: 8.50,
      imagen: "https://images.unsplash.com/photo-1541529086526-db283c563270?auto=format&fit=crop&w=600&q=80"
    }
  ],

  // Lista de Productos
  productos: [
    {
      id: "p1",
      categoriaId: "carnes",
      nombre: "Bistec de Lomo a la Parrilla",
      descripcion: "Bistec de lomo premium, madurado 30 días, cocinado a la leña, con guarnición de papas asadas.",
      precio: 14.50,
      rating: 4.9,
      resenasCount: 34,
      imagen: "https://images.unsplash.com/photo-1558030006-450675393462?auto=format&fit=crop&w=600&q=80",
      etiquetas: ["Especialidad", "Sin TACC"],
      opciones: {
        puntoCoccion: ["Medio", "Jugoso", "Bien Cocido"],
        guarniciones: ["Papas Asadas", "Ensalada Rústica", "Vegetales Grillados"]
      },
      resenasDestacadas: [
        { autor: "Juan P.", comentario: "¡Increíble sabor! El punto de cocción vino perfecto.", estrellas: 5 },
        { autor: "María G.", comentario: "El mejor lomo que probé en la zona.", estrellas: 5 }
      ]
    },
    {
      id: "p2",
      categoriaId: "carnes",
      nombre: "Pastas de Lomo a la Bolognesa",
      descripcion: "Fideos caseros al huevo con suave reducción de lomo y tuco artesanal.",
      precio: 7.50,
      rating: 4.5,
      resenasCount: 18,
      imagen: "https://images.unsplash.com/photo-1621996346565-e3d5d6281288?auto=format&fit=crop&w=600&q=80",
      etiquetas: ["Recomendado"],
      opciones: {
        quesoExtra: ["Sí (+ $0.50)", "No"]
      },
      resenasDestacadas: [
        { autor: "Carlos T.", comentario: "Muy abundante y bien servido.", estrellas: 4 }
      ]
    },
    {
      id: "p3",
      categoriaId: "postres",
      nombre: "Volcán de Chocolate & Helado",
      descripcion: "Bizcocho tibio de chocolate relleno de fondant fundido con helado de crema americana.",
      precio: 4.50,
      rating: 4.8,
      resenasCount: 52,
      imagen: "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=600&q=80",
      etiquetas: ["Dulce"],
      opciones: {},
      resenasDestacadas: [
        { autor: "Sofía L.", comentario: "Imperdible para el cierre de la cena.", estrellas: 5 }
      ]
    }
  ]
};
