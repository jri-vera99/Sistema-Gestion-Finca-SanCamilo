/* ================================================================
   auth.js — Gestión de sesión JWT para la intranet
   Finca Agroecológica San Camilo
   ================================================================ */

const API_BASE = '/api';

/* ── Gestión del token ──────────────────────────────────────── */

export function guardarSesion(token, usuario, modulosPermitidos) {
  localStorage.setItem('sc_token',    token);
  localStorage.setItem('sc_usuario',  JSON.stringify(usuario));
  localStorage.setItem('sc_modulos',  JSON.stringify(modulosPermitidos));
}

export function limpiarSesion() {
  localStorage.removeItem('sc_token');
  localStorage.removeItem('sc_usuario');
  localStorage.removeItem('sc_modulos');
}

export function obtenerToken() {
  return localStorage.getItem('sc_token');
}

export function obtenerUsuario() {
  try { return JSON.parse(localStorage.getItem('sc_usuario')); }
  catch { return null; }
}

export function obtenerModulosPermitidos() {
  try { return JSON.parse(localStorage.getItem('sc_modulos')); }
  catch { return null; } // null = acceso total (superadmin)
}

export function esSuperAdmin() {
  const u = obtenerUsuario();
  return u?.es_superadmin === true;
}

/* ── Verificar acceso ───────────────────────────────────────── */

/**
 * Llama esta función en el DOMContentLoaded de cada página de intranet.
 * Si no hay sesión activa, redirige al login.
 * @param {string} [moduloRequerido] - Slug del módulo que la página necesita
 * @returns {object|null} usuario
 */
export async function verificarAcceso(moduloRequerido = null) {
  const token = obtenerToken();

  if (!token) {
    redirigirLogin();
    return null;
  }

  // Verifica que el token siga válido consultando /api/auth/me
  try {
    const res  = await fetch(`${API_BASE}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });

    if (!res.ok) {
      limpiarSesion();
      redirigirLogin();
      return null;
    }

    const data = await res.json();

    if (!data.success) {
      limpiarSesion();
      redirigirLogin();
      return null;
    }

    // Actualiza datos en localStorage por si cambiaron
    const { usuario, modulos_permitidos } = data;
    guardarSesion(token, usuario, modulos_permitidos);

    // Verifica permiso del módulo (si aplica)
    if (moduloRequerido && moduloRequerido !== 'dashboard' && !usuario.es_superadmin) {
      const modulos = modulos_permitidos || [];
      const tieneAcceso = modulos.some(m => m.slug === moduloRequerido);
      if (!tieneAcceso) {
        const primerModulo = modulos.length > 0 ? modulos[0].slug + '.html' : 'dashboard.html';
        window.location.href = `/intranet/${primerModulo}`;
        return null;
      }
    }

    return usuario;

  } catch {
    // Si el servidor no responde, no desloguear (puede ser problema de red temporal)
    return obtenerUsuario();
  }
}

function redirigirLogin() {
  const actual = window.location.pathname + window.location.search;
  window.location.href = `/intranet/login.html?redir=${encodeURIComponent(actual)}`;
}

export function cerrarSesion() {
  limpiarSesion();
  window.location.href = '/intranet/login.html';
}

/* ── Render del sidebar según permisos ─────────────────────── */

export function renderSidebar(paginaActual = '') {
  const usuario = obtenerUsuario();
  const modulos = obtenerModulosPermitidos() || [];

  // Asegurar que el dashboard siempre aparezca en el menú
  if (!modulos.some(m => m.slug === 'dashboard')) {
    modulos.unshift({ slug: 'dashboard', nombre: 'Dashboard', icono: 'fa-solid fa-gauge' });
  }

  // Función para determinar el grupo (ya que la DB no tiene la columna grupo)
  const getGrupo = (slug) => {
    if (['dashboard'].includes(slug)) return 'Principal';
    if (['colmenas', 'cosechas', 'inventario'].includes(slug)) return 'Producción';
    if (['hospedaje', 'solicitudes', 'clientes'].includes(slug)) return 'Servicios';
    if (['usuarios', 'configuracion', 'dispositivos'].includes(slug)) return 'Administración';
    if (['reportes', 'auditoria'].includes(slug)) return 'Informes';
    return 'Otros';
  };

  // Agrupar y mapear
  const grupos = {};
  modulos.forEach(m => {
    const grupo = getGrupo(m.slug);
    if (!grupos[grupo]) grupos[grupo] = [];
    grupos[grupo].push({
      slug: m.slug,
      nombre: m.nombre,
      icono: m.icono,
      href: m.slug === 'dashboard' ? 'dashboard.html' : `${m.slug}.html`
    });
  });

  let navHTML = '';
  for (const [grupo, items] of Object.entries(grupos)) {
    navHTML += `<div class="sidebar-group-label">${grupo}</div>`;
    items.forEach(item => {
      const esActivo = paginaActual === item.slug;
      navHTML += `
        <a href="${item.href}" class="sidebar-item ${esActivo ? 'activo' : ''}"
           ${esActivo ? 'aria-current="page"' : ''}>
          <i class="${item.icono}" aria-hidden="true"></i>
          ${item.nombre}
        </a>`;
    });
  }

  // Iniciales del usuario para avatar
  const iniciales = usuario?.nombres
    ? usuario.nombres.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
    : 'U';

  const sidebarHTML = `
    <div class="sidebar-logo">
      <div class="sidebar-logo-icon" aria-hidden="true"><i class="fa-solid fa-leaf"></i></div>
      <div class="sidebar-logo-text">
        <strong>San Camilo</strong>
        <span>Panel de Gestión</span>
      </div>
    </div>
    <nav class="sidebar-nav" aria-label="Navegación del sistema">${navHTML}</nav>
    <div class="sidebar-user">
      <div class="sidebar-user-avatar" aria-hidden="true">${iniciales}</div>
      <div class="sidebar-user-info">
        <span>${usuario?.nombres || 'Usuario'}</span>
        <small>${usuario?.nombre_rol || 'Sin rol'}</small>
      </div>
      <button class="sidebar-user-logout" onclick="logout()" title="Cerrar sesión" aria-label="Cerrar sesión">
        <i class="fa-solid fa-right-from-bracket" aria-hidden="true"></i>
      </button>
    </div>
  `;

  const sidebar = document.getElementById('sidebar');
  if (sidebar) sidebar.innerHTML = sidebarHTML;
}
