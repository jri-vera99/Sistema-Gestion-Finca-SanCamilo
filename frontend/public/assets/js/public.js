/* ================================================================
   public.js — Lógica del portal público
   Finca Agroecológica San Camilo
   ================================================================ */

const API_BASE = '/api';

/* ── Utilidades ─────────────────────────────────────────────── */

function toast(mensaje, tipo = 'info') {
  const cont = document.getElementById('toast-contenedor');
  if (!cont) return;
  const el = document.createElement('div');
  el.className = `toast ${tipo}`;
  el.setAttribute('role', 'status');
  el.textContent = mensaje;
  cont.appendChild(el);
  setTimeout(() => el.remove(), 5000);
}

function formatPrecio(precio) {
  return `$${parseFloat(precio).toFixed(2)}`;
}

const CATEGORIAS_ICONOS = {
  miel:    'fa-jar',
  cera:    'fa-cubes',
  citrico: 'fa-lemon',
  fruta:   'fa-apple-whole',
  otro:    'fa-box'
};

/* ── Productos en home ──────────────────────────────────────── */

async function cargarProductosHome() {
  const grid = document.getElementById('grid-productos-home');
  if (!grid) return;

  try {
    const res  = await fetch(`${API_BASE}/public/productos`);
    const data = await res.json();

    if (!data.success || !data.data.length) {
      grid.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:var(--cafe-medio);">No hay productos disponibles en este momento.</p>';
      return;
    }

    // Mostrar solo los primeros 4 en home
    const primeros = data.data.slice(0, 4);

    grid.innerHTML = primeros.map(p => `
      <article class="tarjeta-producto" aria-label="${p.nombre}">
        ${p.imagen_url
          ? `<img class="tarjeta-producto-img" src="${p.imagen_url}&w=400&auto=format&fit=crop" alt="${p.nombre} — Finca San Camilo" loading="lazy" />`
          : `<div class="tarjeta-producto-img-placeholder" aria-hidden="true">
               <i class="fa-solid ${CATEGORIAS_ICONOS[p.categoria] || 'fa-leaf'}"></i>
             </div>`
        }
        <div class="tarjeta-producto-cuerpo">
          <div class="tarjeta-producto-categoria">${p.categoria}</div>
          <h3 class="tarjeta-producto-nombre">${p.nombre}</h3>
          <p class="tarjeta-producto-descripcion">${p.descripcion || ''}</p>
          <div class="tarjeta-producto-pie">
            <div>
              <span class="tarjeta-producto-precio">${formatPrecio(p.precio)}</span>
              <span class="tarjeta-producto-unidad">/ ${p.unidad}</span>
            </div>
            <span class="${p.estado === 'bajo_stock' ? 'badge-bajo-stock' : 'badge-disponible'}">
              ${p.estado === 'bajo_stock' ? 'Últimas unidades' : 'Disponible'}
            </span>
          </div>
        </div>
      </article>
    `).join('');

  } catch (err) {
    grid.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:var(--cafe-medio);">Error al cargar productos.</p>';
  }
}

/* ── Hospedaje en home ──────────────────────────────────────── */

async function cargarHospedajeHome() {
  const grid = document.getElementById('grid-hospedaje-home');
  if (!grid) return;

  try {
    const res  = await fetch(`${API_BASE}/public/hospedaje`);
    const data = await res.json();

    if (!data.success || !data.data.length) {
      grid.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:var(--cafe-medio);">Consulta disponibilidad por teléfono o WhatsApp.</p>';
      return;
    }

    const primeros = data.data.slice(0, 3);

    grid.innerHTML = primeros.map(h => `
      <article class="tarjeta-hospedaje" aria-label="${h.tipo || 'Alojamiento'}">
        ${h.imagen_url
          ? `<img class="tarjeta-hospedaje-img"
               src="${h.imagen_url}?w=500&auto=format&fit=crop"
               alt="${h.tipo || 'Alojamiento'} en la Finca San Camilo"
               loading="lazy" />`
          : `<div class="tarjeta-hospedaje-img" style="display:flex;align-items:center;justify-content:center;color:var(--verde-hoja);font-size:3rem;" aria-hidden="true">
               <i class="fa-solid fa-house-chimney-window"></i>
             </div>`
        }
        <div class="tarjeta-hospedaje-cuerpo">
          <div class="tarjeta-hospedaje-tipo">Hospedaje rural</div>
          <h3 class="tarjeta-hospedaje-nombre">${h.tipo || 'Alojamiento'}</h3>
          <p class="tarjeta-hospedaje-descripcion">${h.descripcion || 'Habitación en entorno natural, Valle del Chota.'}</p>
          <div class="tarjeta-hospedaje-datos">
            ${h.capacidad ? `<div class="dato-item"><i class="fa-solid fa-person" aria-hidden="true"></i> Hasta ${h.capacidad} persona(s)</div>` : ''}
          </div>
          <div class="tarjeta-hospedaje-tarifa">
            <span class="tarifa-precio">${formatPrecio(h.tarifa_base)}</span>
            <span class="tarifa-noche">/ noche</span>
          </div>
          <a href="reservar.html?habitacion=${h.id_habitacion}" class="btn-primario" style="width:100%;justify-content:center;">
            <i class="fa-solid fa-calendar-check" aria-hidden="true"></i>
            Solicitar reserva
          </a>
        </div>
      </article>
    `).join('');

  } catch {
    grid.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:var(--cafe-medio);">Información de hospedaje no disponible momentáneamente.</p>';
  }
}

/* ── Galería en home ────────────────────────────────────────── */

async function cargarGaleriaHome() {
  const grid = document.getElementById('galeria-home');
  if (!grid) return;

  try {
    const res  = await fetch(`${API_BASE}/public/solicitudes/galeria`);
    const data = await res.json();

    if (!data.success || !data.data.length) return;

    grid.innerHTML = data.data.slice(0, 6).map(img => `
      <div class="galeria-item" aria-label="${img.alt_text || img.titulo || 'Imagen de la finca'}">
        <img
          src="${img.url}"
          alt="${img.alt_text || img.titulo || 'Imagen de la Finca San Camilo'}"
          loading="lazy"
        />
        <div class="galeria-overlay" aria-hidden="true">
          <span>${img.titulo || ''}</span>
        </div>
      </div>
    `).join('');

  } catch {}
}

/* ── Inicialización ─────────────────────────────────────────── */

document.addEventListener('DOMContentLoaded', () => {
  cargarProductosHome();
  cargarHospedajeHome();
  cargarGaleriaHome();

  // Marcar nav activa según la página actual
  const rutaActual = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.navbar-nav a').forEach(a => {
    const href = a.getAttribute('href');
    if (href && (href === rutaActual || (rutaActual === '' && href === '/'))) {
      a.classList.add('activo');
      a.setAttribute('aria-current', 'page');
    } else if (a.classList.contains('activo') && href !== '/') {
      a.classList.remove('activo');
      a.removeAttribute('aria-current');
    }
  });
});
