/* ================================================================
   api.js — Cliente HTTP reutilizable para la intranet
   Finca Agroecológica San Camilo
   ================================================================ */

import { obtenerToken, limpiarSesion } from './auth.js';

const API_BASE = '/api';

/* ── Función base de fetch con JWT ──────────────────────────── */

export async function apiFetch(ruta, opciones = {}) {
  const token = obtenerToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(opciones.headers || {})
  };

  const respuesta = await fetch(`${API_BASE}${ruta}`, {
    ...opciones,
    headers
  });

  // Si el token expiró, limpiar sesión y redirigir
  if (respuesta.status === 401) {
    limpiarSesion();
    window.location.href = '/intranet/login.html?razon=sesion_expirada';
    return null;
  }

  const data = await respuesta.json();
  return data;
}

/* ── Atajos por método ──────────────────────────────────────── */

export const api = {
  get:    (ruta)           => apiFetch(ruta, { method: 'GET' }),
  post:   (ruta, cuerpo)   => apiFetch(ruta, { method: 'POST',   body: JSON.stringify(cuerpo) }),
  put:    (ruta, cuerpo)   => apiFetch(ruta, { method: 'PUT',    body: JSON.stringify(cuerpo) }),
  delete: (ruta)           => apiFetch(ruta, { method: 'DELETE' })
};

/* ── Utilidades de UI ───────────────────────────────────────── */

/**
 * Muestra un toast en la esquina inferior derecha.
 * @param {string} mensaje
 * @param {'exito'|'error'|'info'} tipo
 */
export function toast(mensaje, tipo = 'info') {
  let cont = document.getElementById('toast-contenedor');
  if (!cont) {
    cont = document.createElement('div');
    cont.id = 'toast-contenedor';
    cont.className = 'toast-contenedor';
    cont.setAttribute('aria-live', 'polite');
    document.body.appendChild(cont);
  }

  const iconos = { exito: 'fa-circle-check', error: 'fa-circle-xmark', info: 'fa-circle-info' };
  const el = document.createElement('div');
  el.className = `toast ${tipo}`;
  el.setAttribute('role', 'status');
  el.innerHTML = `<i class="fa-solid ${iconos[tipo] || 'fa-circle-info'}" aria-hidden="true"></i> ${mensaje}`;
  cont.appendChild(el);
  setTimeout(() => el.remove(), 5000);
}

/**
 * Muestra spinner de carga en un contenedor.
 * @param {HTMLElement} elemento
 * @param {string} texto
 */
export function mostrarCargando(elemento, texto = 'Cargando...') {
  if (!elemento) return;
  elemento.innerHTML = `
    <div style="text-align:center;padding:2rem;color:var(--texto-suave);">
      <div class="spinner" style="margin:0 auto 0.75rem;"></div>
      <div>${texto}</div>
    </div>`;
}

/**
 * Formatea una fecha ISO en formato legible local.
 */
export function fmtFecha(fecha) {
  if (!fecha) return '—';
  return new Date(fecha).toLocaleDateString('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function fmtFechaHora(fecha) {
  if (!fecha) return '—';
  return new Date(fecha).toLocaleString('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function fmtMoneda(valor) {
  if (valor == null) return '—';
  return `$${parseFloat(valor).toFixed(2)}`;
}

/**
 * Genera HTML de badge de modo (real/simulado).
 */
export function badgeModo(modo) {
  if (modo === 'simulado') return '<span class="badge badge-simulado">Simulado</span>';
  if (modo === 'real')     return '<span class="badge badge-real">Real</span>';
  return `<span class="badge badge-info">${modo || '—'}</span>`;
}

export function badgeEstado(estado) {
  const mapa = {
    bueno:      'badge-bueno',
    regular:    'badge-regular',
    malo:       'badge-malo',
    pendiente:  'badge-pendiente',
    confirmada: 'badge-confirmada',
    cancelada:  'badge-cancelada',
    activo:     'badge-bueno',
    inactivo:   'badge-malo',
    disponible: 'badge-bueno',
    bajo_stock: 'badge-regular',
    agotado:    'badge-malo'
  };
  const clase = mapa[estado] || 'badge-info';
  return `<span class="badge ${clase}">${estado || '—'}</span>`;
}

/**
 * Abre o cierra un modal.
 * @param {string} id — ID del elemento .modal-overlay
 * @param {boolean} abrir
 */
export function toggleModal(id, abrir) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.classList.toggle('visible', abrir);
  if (abrir) {
    const primerCampo = modal.querySelector('input, select, textarea');
    if (primerCampo) setTimeout(() => primerCampo.focus(), 100);
  }
}

/**
 * Rellena la fila "sin datos" en una tabla.
 * @param {HTMLElement} tbody
 * @param {number} colspan
 */
export function filaVacia(tbody, colspan, mensaje = 'No hay registros') {
  tbody.innerHTML = `<tr class="loading-row"><td colspan="${colspan}">${mensaje}</td></tr>`;
}

/**
 * Serializa un formulario HTML a objeto JS.
 * @param {HTMLFormElement} form
 */
export function serializarForm(form) {
  const data = {};
  new FormData(form).forEach((val, key) => {
    data[key] = val === '' ? null : val;
  });
  return data;
}
