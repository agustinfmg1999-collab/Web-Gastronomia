// ==========================================
// APLICACIÓN INTEGRADA DE CARTA DIGITAL & CARRITO
// ==========================================

function escHtml(str) {
  if (typeof str !== 'string') return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// --- ESTADO GLOBAL CARRITO & LOCALSTORAGE ---
const CART_STORAGE_KEY = 'el_patio_cart_v1';

function loadCartFromStorage() {
  try {
    const saved = localStorage.getItem(CART_STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch (e) {
    console.error('Error al recuperar el carrito:', e);
    return [];
  }
}

function saveCartToStorage() {
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  } catch (e) {
    console.error('Error al guardar el carrito:', e);
  }
}

var cart = loadCartFromStorage();

// --- ESTADO GLOBAL CARRUSEL PRODUCTOS ---
let currentIndex = 0;
let isDragging = false;
let startX = 0;
let currentTranslate = 0;
let dragDistance = 0;
let carouselEventsBound = false;

// --- ESTADO GLOBAL CARRUSEL PROMOS ---
let promoCurrentIndex = 0;
let promoIsDragging = false;
let promoStartX = 0;
let promoDragDistance = 0;

function initClientApp() {
  renderPromos();
  renderCategories();
  renderProducts(getProductsByCategory('Todos'));
  updateCartUI();
}

document.addEventListener('DOMContentLoaded', () => {
  cart = loadCartFromStorage();
  initMesa();
  initClientApp();
  setupEvents();
});

// --- GESTIÓN DE MESA Y ESTADO ---
function getMesaNumber() {
  const params = new URLSearchParams(window.location.search);
  const mesa = params.get('mesa');
  if (mesa && mesa !== 'undefined' && mesa !== 'null' && mesa.trim() !== '') {
    return mesa.trim();
  }
  return '1';
}

function initMesa() {
  const mesa = getMesaNumber();
  const badge = document.getElementById('mesaBadge');
  if (badge) badge.innerHTML = `<span class="dot">●</span> Mesa ${mesa}`;
}

function getMenuData() {
  return window.MENU_DATA || {
    categories: ['Todos', 'Carnes & Parrilla', 'Entrantes', 'Pescados & Mariscos', 'Postres'],
    promos: [],
    products: []
  };
}

// --- SECCIÓN MENÚ DEL DÍA & PROMOS ---
function renderPromos() {
  const container = document.getElementById('promosContainer');
  const data = getMenuData();
  const section = document.querySelector('.promos-section');
  
  if (!container) return;

  if (!data.promos || data.promos.length === 0) {
    if (section) section.style.display = 'none';
    return;
  }

  if (section) section.style.display = '';
  container.innerHTML = data.promos.map((promo, index) => createPromoCard(promo, index === 0)).join('');
  promoCurrentIndex = 0;
  
  setupPromosEvents();
  setTimeout(updatePromosCarousel, 50);
}

function createPromoCard(promo, isActive = false) {
  const promoJson = JSON.stringify(promo).replace(/"/g, '&quot;');
  const price = typeof promo.price === 'number' ? promo.price.toFixed(2) : '0.00';
  const oldPrice = promo.originalPrice ? `$${promo.originalPrice.toFixed(2)}` : '';

  return `
    <div class="promo-card ${isActive ? 'active' : ''}" onclick="handlePromoClick(event, ${promoJson})">
      <div class="product-img-wrapper">
        <img src="${promo.image || 'https://via.placeholder.com/400'}" alt="${promo.name}" loading="lazy">
        <span class="promo-badge">${promo.badge || 'Promoción'}</span>
      </div>
      <div class="product-content">
        <h4>${promo.name}</h4>
        <p class="product-desc">${promo.description}</p>
        <div class="product-footer">
          <div class="promo-price-container">
            ${oldPrice ? `<span class="old-price">${oldPrice}</span>` : ''}
            <span class="promo-price">$${price}</span>
          </div>
          <button class="btn-detail" onclick="event.stopPropagation(); openProductDetail(${promoJson})">Personalizar</button>
        </div>
      </div>
    </div>
  `;
}

function handlePromoClick(event, promo) {
  if (Math.abs(promoDragDistance) > 10) return;
  openProductDetail(promo);
}

function updatePromosCarousel() {
  const track = document.getElementById('promosContainer');
  const items = track ? track.querySelectorAll('.promo-card') : [];
  const dotsContainer = document.getElementById('promosDots');

  if (!items.length || !track) return;

  const itemWidth = 280 + 16; // Ancho tarjeta + gap
  const containerWidth = track.parentElement ? track.parentElement.offsetWidth : window.innerWidth;
  const centerOffset = (containerWidth / 2) - (280 / 2);

  const translate = -promoCurrentIndex * itemWidth + centerOffset;
  track.style.transform = `translateX(${translate}px)`;

  items.forEach((item, index) => {
    item.classList.toggle('active', index === promoCurrentIndex);
  });

  if (dotsContainer) {
    dotsContainer.innerHTML = Array.from(items).map((_, i) => 
      `<div class="carousel-dot ${i === promoCurrentIndex ? 'active' : ''}" onclick="goToPromoSlide(${i})"></div>`
    ).join('');
  }
}

function goToPromoSlide(index) {
  promoCurrentIndex = index;
  updatePromosCarousel();
}

function setupPromosEvents() {
  const wrapper = document.querySelector('.promos-carousel-wrapper');
  if (!wrapper || wrapper.dataset.bound) return;
  wrapper.dataset.bound = "true";

  wrapper.addEventListener('touchstart', (e) => {
    promoIsDragging = true;
    promoStartX = e.touches[0].clientX;
    promoDragDistance = 0;
  }, { passive: true });

  wrapper.addEventListener('touchmove', (e) => {
    if (!promoIsDragging) return;
    const currentX = e.touches[0].clientX;
    promoDragDistance = currentX - promoStartX;

    if (Math.abs(promoDragDistance) > 40) {
      const items = wrapper.querySelectorAll('.promo-card');
      if (promoDragDistance < 0 && promoCurrentIndex < items.length - 1) {
        promoCurrentIndex++;
      } else if (promoDragDistance > 0 && promoCurrentIndex > 0) {
        promoCurrentIndex--;
      }
      updatePromosCarousel();
      promoIsDragging = false;
    }
  }, { passive: true });

  wrapper.addEventListener('touchend', () => { promoIsDragging = false; });
  window.addEventListener('resize', updatePromosCarousel);
}

// --- CATEGORÍAS ---
function renderCategories() {
  const container = document.getElementById('categoriesList');
  const data = getMenuData();
  if (!container || !data.categories) return;

  container.innerHTML = data.categories.map((cat, index) => `
    <li>
      <button class="category-btn ${index === 0 ? 'active' : ''}" onclick="filterCategory('${cat}', this)">
        ${cat}
      </button>
    </li>
  `).join('');
}

function filterCategory(category, btn) {
  document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');

  const filtered = getProductsByCategory(category);
  renderProducts(filtered);
}

function getProductsByCategory(category) {
  const data = getMenuData();
  if (!data.products) return [];
  if (category === 'Todos') return data.products;
  return data.products.filter(p => p.category === category || p.categoriaId === category);
}

// --- RENDERIZADO Y CARRUSEL 3D DE PRODUCTOS ---
function renderProducts(products) {
  const container = document.getElementById('productsContainer');
  if (!container) return;

  if (!products || products.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #a1a1aa;">
        No hay productos cargados en esta categoría.
      </div>`;
    return;
  }

  container.innerHTML = products.map((p, index) => createProductCard(p, index === 0)).join('');

  currentIndex = 0;
  setupCarouselEvents();
  setTimeout(updateCarousel, 50);
}

function createProductCard(product, isActive = false) {
  const productJson = JSON.stringify(product).replace(/"/g, '&quot;');
  const price = typeof product.price === 'number' ? product.price.toFixed(2) : '0.00';
  const isAvailable = product.disponible !== false;

  let badgesHtml = '';
  if (!isAvailable) {
    badgesHtml += '<span class="product-badge" style="background:rgba(220,38,38,0.85);color:#fff;border-color:#ef4444;">Agotado</span>';
  }
  if (product.badge) {
    const badges = product.badge.split(',');
    badgesHtml += badges.map(b => `<span class="product-badge">${b.trim()}</span>`).join('');
  }

  return `
    <div class="product-card carousel-item ${isActive ? 'active' : ''} ${!isAvailable ? 'sold-out' : ''}" data-product-id="${product.id}" onclick="handleCardClick(event, ${productJson})">
      <div class="product-img-wrapper">
        <img src="${product.image || product.imagen || 'https://via.placeholder.com/300'}" alt="${product.name || product.nombre}" loading="lazy">
        <div class="badges-container">
          ${badgesHtml}
        </div>
      </div>
      <div class="product-content">
        <h4>${product.name || product.nombre}</h4>
        <p class="product-desc">${product.description || product.descripcion || ''}</p>
        <div class="product-footer">
          <span class="price">$${price}</span>
          <div class="card-actions">
            <button class="btn-detail" onclick="event.stopPropagation(); openProductDetail(${productJson})">Ver detalle</button>
            ${isAvailable ? `<button class="btn-add-quick" onclick="event.stopPropagation(); addToCart(${productJson})" title="Agregar al pedido">+</button>` : ''}
          </div>
        </div>
      </div>
    </div>
  `;
}

function handleCardClick(event, product) {
  if (Math.abs(dragDistance) > 10) return;
  openProductDetail(product);
}

function updateCarousel() {
  const track = document.getElementById('productsContainer');
  const items = document.querySelectorAll('.carousel-item');
  const dotsContainer = document.getElementById('carouselDots');

  if (!items.length || !track) return;

  const itemWidth = 270 + 16;
  const containerWidth = track.parentElement ? track.parentElement.offsetWidth : window.innerWidth;
  const centerOffset = (containerWidth / 2) - (270 / 2);

  currentTranslate = -currentIndex * itemWidth + centerOffset;
  track.style.transform = `translateX(${currentTranslate}px)`;

  items.forEach((item, index) => {
    item.classList.toggle('active', index === currentIndex);
  });

  if (dotsContainer) {
    dotsContainer.innerHTML = Array.from(items).map((_, i) => 
      `<div class="carousel-dot ${i === currentIndex ? 'active' : ''}" onclick="goToSlide(${i})"></div>`
    ).join('');
  }
}

function goToSlide(index) {
  currentIndex = index;
  updateCarousel();
}

function navigateCarousel(direction) {
  const items = document.querySelectorAll('.carousel-item');
  if (!items.length) return;

  currentIndex += direction;

  if (currentIndex < 0) {
    currentIndex = items.length - 1;
  } else if (currentIndex >= items.length) {
    currentIndex = 0;
  }

  updateCarousel();
}

function setupCarouselEvents() {
  const wrapper = document.querySelector('.carousel-wrapper') || document.getElementById('productsContainer');
  if (!wrapper || carouselEventsBound) return;
  carouselEventsBound = true;

  wrapper.addEventListener('touchstart', touchStart, { passive: true });
  wrapper.addEventListener('touchend', touchEnd);
  wrapper.addEventListener('touchmove', touchMove, { passive: true });

  wrapper.addEventListener('mousedown', touchStart);
  wrapper.addEventListener('mouseup', touchEnd);
  wrapper.addEventListener('mouseleave', touchEnd);
  wrapper.addEventListener('mousemove', touchMove);

  function touchStart(e) {
    isDragging = true;
    startX = getPositionX(e);
    dragDistance = 0;
  }

  function touchMove(e) {
    if (!isDragging) return;
    const currentPosition = getPositionX(e);
    dragDistance = currentPosition - startX;

    if (Math.abs(dragDistance) > 40) {
      if (dragDistance < 0) {
        navigateCarousel(1);
      } else {
        navigateCarousel(-1);
      }
      isDragging = false;
    }
  }

  function touchEnd() {
    isDragging = false;
  }

  function getPositionX(e) {
    return e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
  }

  window.addEventListener('resize', updateCarousel);
}

// --- MODAL Y PERSONALIZACIÓN DE PRODUCTO / PROMOS ---
let currentSelectedOptions = {};

function openProductDetail(product) {
  if (typeof product === 'string') {
    try { product = JSON.parse(product); } catch(e) {}
  }
  
  currentSelectedOptions = {};
  
  document.getElementById('detailTitle').textContent = product.name || product.nombre;
  document.getElementById('detailImage').src = product.image || product.imagen || 'https://via.placeholder.com/500';
  document.getElementById('detailDesc').textContent = product.description || product.descripcion || 'Sin descripción disponible.';
  
  const price = typeof product.price === 'number' ? product.price.toFixed(2) : '0.00';
  document.getElementById('detailPrice').textContent = `$${price}`;
  
  const badgesContainer = document.getElementById('detailBadges');
  if (badgesContainer) {
    if (product.badge) {
      const badges = product.badge.split(',');
      badgesContainer.innerHTML = badges.map(b => `<span class="product-badge">${b.trim()}</span>`).join('');
    } else {
      badgesContainer.innerHTML = '';
    }
  }

  const notesInput = document.getElementById('detailNotes');
  if (notesInput) notesInput.value = '';

  const optionsContainer = document.getElementById('detailOptions');
  if (optionsContainer) {
    optionsContainer.innerHTML = '';

    const optionsList = product.options || [];

    if (optionsList && optionsList.length > 0) {
      optionsList.forEach((group) => {
        const groupEl = document.createElement('div');
        groupEl.className = 'option-group';

        if (group.choices && group.choices.length > 0) {
          currentSelectedOptions[group.title] = group.choices[0];
        }

        const choicesHtml = group.choices.map((choice, cIndex) => `
          <button 
            type="button"
            class="chip-btn ${cIndex === 0 ? 'selected' : ''}" 
            onclick="selectOption('${group.title}', '${choice}', this)"
          >
            ${choice}
          </button>
        `).join('');

        groupEl.innerHTML = `
          <div class="option-group-title">
            ${group.title}
            <span>${group.required ? 'Requerido' : 'Opcional'}</span>
          </div>
          <div class="options-chips">
            ${choicesHtml}
          </div>
        `;

        optionsContainer.appendChild(groupEl);
      });
    }
  }

  const addBtn = document.getElementById('detailAddBtn');
  if (addBtn) {
    addBtn.onclick = () => {
      const notes = notesInput ? notesInput.value.trim() : '';
      
      const itemToAdd = {
        ...product,
        selectedOptions: { ...currentSelectedOptions },
        notes: notes
      };

      if (typeof addToCart === 'function') {
        addToCart(itemToAdd);
      }
      
      toggleProductDetailModal(false);
    };
  }

  toggleProductDetailModal(true);
}

window.selectOption = function(groupTitle, choice, btnElement) {
  currentSelectedOptions[groupTitle] = choice;
  
  const parentContainer = btnElement.closest('.options-chips');
  if (parentContainer) {
    parentContainer.querySelectorAll('.chip-btn').forEach(btn => btn.classList.remove('selected'));
    btnElement.classList.add('selected');
  }
};

function closeProductDetail() {
  const detailModal = document.getElementById('productDetailModal');
  if (detailModal) detailModal.classList.remove('active');
}

// --- LÓGICA DE AGREGAR Y MODIFICAR EL CARRITO ---
function addToCart(product) {
  const optionsKey = JSON.stringify(product.selectedOptions || {});
  const notesKey = product.notes || '';

  // Buscamos si existe exactamente el mismo producto CON LAS MISMAS OPCIONES Y NOTAS
  const existingIndex = cart.findIndex(item => 
    String(item.id) === String(product.id) && 
    JSON.stringify(item.selectedOptions || {}) === optionsKey && 
    (item.notes || '') === notesKey
  );

  if (existingIndex !== -1) {
    cart[existingIndex].quantity += (product.quantity || 1);
  } else {
    cart.push({
      ...product,
      quantity: product.quantity || 1
    });
  }
  
  saveCartToStorage();
  updateCartUI();
}

function changeQuantity(itemIndex, delta) {
  const idx = parseInt(itemIndex);
  if (idx < 0 || idx >= cart.length) return;
  cart[idx].quantity += delta;

  if (cart[idx].quantity <= 0) {
    cart.splice(idx, 1);
  }

  saveCartToStorage();
  updateCartUI();
}

function removeFromCart(itemIndex) {
  const idx = parseInt(itemIndex);
  if (idx < 0 || idx >= cart.length) return;
  cart.splice(idx, 1);
  saveCartToStorage();
  updateCartUI();
}

function clearCart() {
  cart = [];
  saveCartToStorage();
  updateCartUI();
}

// --- ACTUALIZACIÓN DE INTERFAZ DEL CARRITO ---
function updateCartUI() {
  const countEl = document.getElementById('cartCount');
  const totalEl = document.getElementById('cartTotal');
  const modalTotalEl = document.getElementById('modalTotal') || document.getElementById('modalTotalAmount');
  const itemsContainer = document.getElementById('cartItemsContainer') || document.getElementById('cartItemsList');
  const floatBtn = document.getElementById('cartFloatingBtn');

  const currentCart = typeof cart !== 'undefined' ? cart : [];
  const totalCount = typeof getCartCount === 'function' ? getCartCount() : currentCart.reduce((acc, item) => acc + item.quantity, 0);
  const totalPrice = typeof getCartTotal === 'function' ? getCartTotal() : currentCart.reduce((acc, item) => acc + (item.price * item.quantity), 0);

  if (countEl) countEl.textContent = totalCount;
  if (totalEl) totalEl.textContent = `$${totalPrice.toFixed(2)}`;
  if (modalTotalEl) modalTotalEl.textContent = `$${totalPrice.toFixed(2)}`;

  if (floatBtn) {
    floatBtn.style.display = currentCart.length > 0 ? 'flex' : 'none';
  }

  if (itemsContainer) {
    if (currentCart.length === 0) {
      itemsContainer.innerHTML = '<p style="text-align:center; color:#a1a1aa; padding: 20px 0;">El carrito está vacío</p>';
      return;
    }

    const clearCartHeader = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 12px; padding-bottom: 6px; border-bottom: 1px solid #3f3f46;">
        <span style="font-size:0.85rem; color:#a1a1aa;">Tu pedido</span>
        <button onclick="clearCart()" style="background:transparent; color:#ef4444; border:none; font-size:0.78rem; font-weight:700; cursor:pointer;">
          🗑️ Vaciar carrito
        </button>
      </div>
    `;

    const itemsHtml = currentCart.map((item, idx) => `
      <div class="cart-item" style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 12px; border-bottom: 1px solid #27272a; padding-bottom: 8px;">
        <div style="flex:1;">
          <strong style="color:#fff;">${escHtml(item.name || item.nombre)}</strong>
          <div style="color:#a1a1aa; font-size: 0.85rem;">$${(item.price * item.quantity).toFixed(2)}</div>
        </div>
        
        <div style="display:flex; align-items:center; gap: 8px;">
          <button onclick="changeQuantity(${idx}, -1)" style="padding: 4px 10px; cursor:pointer; background:#27272a; color:#fff; border:1px solid #3f3f46; border-radius:6px; font-weight:bold;">-</button>
          <span style="font-weight:bold; min-width:18px; text-align:center;">${item.quantity}</span>
          <button onclick="changeQuantity(${idx}, 1)" style="padding: 4px 10px; cursor:pointer; background:#27272a; color:#fff; border:1px solid #3f3f46; border-radius:6px; font-weight:bold;">+</button>
          
          <button onclick="removeFromCart(${idx})" style="margin-left:6px; background:transparent; color:#ef4444; border:none; font-size:1.1rem; cursor:pointer; padding:2px 6px;" title="Eliminar del pedido">
            ✕
          </button>
        </div>
      </div>
    `).join('');

    itemsContainer.innerHTML = clearCartHeader + itemsHtml;
  }
  if (typeof updateSplitDisplay === 'function') updateSplitDisplay();
}

// --- TOAST NOTIFICATIONS ---
function showToast(msg) {
  let toast = document.getElementById('orderReadyToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'orderReadyToast';
    toast.style.cssText = 'position:fixed; top:20px; left:50%; transform:translateX(-50%); background:#22c55e; color:#fff; padding:14px 24px; border-radius:12px; font-weight:600; font-size:1rem; z-index:10001; box-shadow:0 4px 20px rgba(0,0,0,0.4); display:none; text-align:center; max-width:90%;';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.display = 'block';
  toast.style.animation = 'toastIn 0.4s ease';
  setTimeout(() => {
    toast.style.animation = 'toastOut 0.4s ease forwards';
    setTimeout(() => { toast.style.display = 'none'; }, 400);
  }, 4000);
}

// --- EVENTOS GENERALES Y ENVÍO DE PEDIDO ---
function setupEvents() {
  const cartModal = document.getElementById('cartModal');
  const openBtn = document.getElementById('openCartBtn') || document.getElementById('cartFloatingBtn');
  const closeBtn = document.getElementById('closeCartBtn') || document.querySelector('#cartModal .close-btn');
  const sendBtn = document.getElementById('sendOrderBtn');

  if (openBtn && cartModal) {
    openBtn.addEventListener('click', () => cartModal.classList.add('active'));
  }
  if (closeBtn && cartModal) {
    closeBtn.addEventListener('click', closeModal);
  }
  if (sendBtn) {
    sendBtn.onclick = confirmAndSendOrder;
  }
}

function closeModal() {
  const cartModal = document.getElementById('cartModal');
  if (cartModal) {
    cartModal.classList.remove('active');
  }
}

let orderSending = false;

async function confirmAndSendOrder() {
  if (orderSending) return;
  const currentCart = typeof cart !== 'undefined' ? cart : [];
  if (currentCart.length === 0) {
    alert('El carrito está vacío. Agregá algún producto antes de enviar.');
    return;
  }

  orderSending = true;
  const sendBtn = document.getElementById('sendOrderBtn');
  if (sendBtn) { sendBtn.disabled = true; sendBtn.textContent = '⏳ Enviando...'; }

  const orderData = {
    mesa: getMesaNumber(),
    items: currentCart.map(item => ({
      id: item.id,
      nombre: item.name || item.nombre,
      cantidad: item.quantity,
      precioUnitario: item.price,
      subtotal: item.price * item.quantity,
      opciones: item.selectedOptions || {},
      notas: item.notes || ''
    })),
    total: typeof getCartTotal === 'function' ? getCartTotal() : currentCart.reduce((acc, item) => acc + (item.price * item.quantity), 0),
    estado: 'pendiente'
  };

  const programarCheck = document.getElementById('programarCheck');
  if (programarCheck && programarCheck.checked) {
    const fecha = document.getElementById('programarFecha').value;
    const hora = document.getElementById('programarHora').value;
    if (fecha && hora) {
      orderData.fechaProgramada = new Date(`${fecha}T${hora}:00`).toISOString();
    }
  }

  try {
    const response = await fetch('/api/pedidos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderData)
    });

    if (response.ok) {
      const result = await response.json();
      clearCart();
      closeModal();
      showPostOrderScreen(result);
    } else {
      throw new Error('Servidor indisponible');
    }
  } catch (error) {
    alert(`[MODO PRUEBA] Pedido registrado para la Mesa ${orderData.mesa}`);
    clearCart();
    closeModal();
  } finally {
    orderSending = false;
    const sendBtn = document.getElementById('sendOrderBtn');
    if (sendBtn) { sendBtn.disabled = false; sendBtn.textContent = '📲 Enviar Pedido a Cocina'; }
  }
}
// --- LÓGICA Y CONTROL DEL MODAL DE MOZO ---
let waiterCallCooldown = false;
const COOLDOWN_SECONDS = 60;

// Exponemos la función global para abrir/cerrar el modal
window.toggleWaiterModal = function(show) {
  const modal = document.getElementById('waiterModal');
  if (modal) {
    modal.classList.toggle('active', show);
  }
};

// Exponemos la función global para procesar la llamada
window.callWaiter = async function(tipo) {
  if (waiterCallCooldown) {
    if (typeof showToast === 'function') { showToast('⏳ Ya notificaste al mozo. Aguardá un momento.'); }
    else { alert('Ya notificaste al mozo. Por favor aguardá un momento antes de volver a llamar.'); }
    return;
  }

  waiterCallCooldown = true;
  startWaiterCooldown();
  const mesa = typeof getMesaNumber === 'function' ? getMesaNumber() : '1';
  const callPayload = {
    mesa: mesa,
    tipo: tipo
  };

  try {
    const response = await fetch('/api/mozo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(callPayload)
    });

    if (response.ok) {
      if (typeof showToast === 'function') {
        showToast(`🔔 ¡Mozo notificado! Te atienden pronto.`);
      } else {
        alert(`🔔 ¡Mozo notificado para la Mesa ${mesa}!`);
      }
    } else {
      throw new Error('Servidor no disponible');
    }
  } catch (error) {
    if (typeof showToast === 'function') {
      showToast('⚠️ No se pudo notificar al mozo. Intentá de nuevo.');
    } else {
      alert('No se pudo notificar al mozo. Intentá de nuevo.');
    }
  }

  window.toggleWaiterModal(false);
  startWaiterCooldown();
};

function startWaiterCooldown() {
  waiterCallCooldown = true;
  const fabBtn = document.querySelector('.fab-call-waiter');
  const headerBtn = document.querySelector('.btn-waiter-header');

  [fabBtn, headerBtn].forEach(btn => {
    if (btn) {
      btn.style.opacity = '0.5';
      btn.style.pointerEvents = 'none';
    }
  });

  let remaining = COOLDOWN_SECONDS;
  const interval = setInterval(() => {
    remaining--;
    if (headerBtn) headerBtn.innerHTML = `⏳ Aguardá (${remaining}s)`;
    
    if (remaining <= 0) {
      clearInterval(interval);
      waiterCallCooldown = false;
      [fabBtn, headerBtn].forEach(btn => {
        if (btn) {
          btn.style.opacity = '1';
          btn.style.pointerEvents = 'auto';
        }
      });
      if (headerBtn) headerBtn.innerHTML = `🔔 Mozo`;
    }
  }, 1000);
}

// --- PANTALLA POST-PEDIDO ---
let postOrderPedidoId = null;
let postOrderSocket = null;

const STATUS_CONFIG = {
  pendiente: { label: 'Recibido', icon: '📋', color: '#eab308' },
  en_preparacion: { label: 'En Cocina', icon: '🔥', color: '#3b82f6' },
  entregado: { label: 'Listo', icon: '✅', color: '#22c55e' }
};
const STATUS_ORDER = ['pendiente', 'en_preparacion', 'entregado'];

function showPostOrderScreen(pedido) {
  postOrderPedidoId = pedido.id;
  const screen = document.getElementById('postOrderScreen');
  screen.classList.add('active');

  document.getElementById('postOrderMesa').textContent = `Mesa ${pedido.mesa || '?'}`;

  const total = pedido.total || 0;
  document.getElementById('postOrderTotal').textContent = `$${total.toFixed(2)}`;

  const itemsContainer = document.getElementById('postOrderItems');
  itemsContainer.innerHTML = (pedido.items || []).map(i => `
    <div style="display:flex; justify-content:space-between; font-size:0.9rem;">
      <span style="color:#ccc;">${i.cantidad}x ${i.nombre}</span>
      <span style="color:#888;">$${(i.subtotal || i.precioUnitario * i.cantidad || 0).toFixed(2)}</span>
    </div>
  `).join('');

  if (pedido.estado === 'programado' && pedido.fechaProgramada) {
    document.getElementById('postOrderTiempo').textContent = `📅 ${new Date(pedido.fechaProgramada).toLocaleString('es-AR')}`;
    document.getElementById('postOrderTracker').innerHTML = `
      <div style="text-align:center; padding:20px 0;">
        <div style="font-size:2.5rem; margin-bottom:8px;">📅</div>
        <p style="color:#f97316; font-size:1.1rem; font-weight:700;">Pedido Programado</p>
        <p style="color:#888; font-size:0.85rem; margin-top:4px;">Se enviará a cocina automáticamente</p>
      </div>`;
    document.getElementById('postOrderStatusText').textContent = 'Programado';
    document.getElementById('postOrderStatusText').style.color = '#f97316';
  } else {
    if (pedido.tiempoEstimado) {
      document.getElementById('postOrderTiempo').textContent = `⏱ ~${pedido.tiempoEstimado} min`;
    }
    updatePostOrderTracker(pedido.estado || 'pendiente');
  }

  if (!postOrderSocket) {
    postOrderSocket = io();
    postOrderSocket.on('pedido_actualizado', (data) => {
      if (data && data.id === postOrderPedidoId) {
        updatePostOrderTracker(data.estado);
      }
    });
  }
}

function updatePostOrderTracker(estado) {
  const currentIdx = STATUS_ORDER.indexOf(estado);
  const tracker = document.getElementById('postOrderTracker');
  const statusText = document.getElementById('postOrderStatusText');

  let html = '';
  STATUS_ORDER.forEach((s, i) => {
    const cfg = STATUS_CONFIG[s];
    const isActive = i <= currentIdx;
    const isCurrent = i === currentIdx;

    if (i > 0) {
      html += `<div class="tracker-line" style="background:${i <= currentIdx ? cfg.color : '#333'};"></div>`;
    }
    html += `
      <div class="tracker-step">
        <div class="tracker-dot" style="background:${isActive ? cfg.color : '#333'}; color:${isActive ? '#fff' : '#666'}; box-shadow:${isCurrent ? '0 0 12px ' + cfg.color + '66' : 'none'};">
          ${cfg.icon}
        </div>
        <div class="tracker-label" style="color:${isCurrent ? '#fff' : '#666'}; font-weight:${isCurrent ? '700' : '400'};">${cfg.label}</div>
      </div>
    `;
  });
  tracker.innerHTML = html;

  const cfg = STATUS_CONFIG[estado] || STATUS_CONFIG.pendiente;
  statusText.textContent = cfg.label;
  statusText.style.color = cfg.color;
}

function volverAlMenu() {
  document.getElementById('postOrderScreen').classList.remove('active');
  postOrderPedidoId = null;
}