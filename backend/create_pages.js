const fs = require('fs');
const pages = ['cosechas', 'inventario', 'hospedaje', 'solicitudes', 'clientes', 'dispositivos', 'reportes'];

const tpl = name => `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>${name.charAt(0).toUpperCase() + name.slice(1)} — San Camilo</title>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
  <link rel="stylesheet" href="assets/css/intranet.css">
</head>
<body>
  <div class="app-layout">
    <aside class="sidebar" id="sidebar"></aside>
    <div class="main-area">
      <header class="main-header">
        <div class="page-title"><i class="fa-solid fa-file"></i> ${name.toUpperCase()}</div>
      </header>
      <main class="main-content">
        <div class="card">
          <div class="card-header">
            <div class="card-titulo">Módulo en construcción</div>
          </div>
          <div style="padding:2rem;text-align:center;color:var(--texto-suave);">
            Esta es la pantalla básica para el módulo ${name}. Pronto se habilitarán más funciones.
          </div>
        </div>
      </main>
    </div>
  </div>
  <script type="module">
    import { verificarAcceso, renderSidebar, cerrarSesion } from './assets/js/auth.js';
    window.logout = cerrarSesion;
    document.addEventListener('DOMContentLoaded', async () => {
      let slug = '${name}';
      if (slug === 'inventario') slug = 'inventario_frutas';
      if (slug === 'dispositivos') slug = 'dispositivos_iot';
      if (slug === 'hospedaje') slug = 'reservas';
      const u = await verificarAcceso(slug);
      if (!u) return;
      renderSidebar(slug);
    });
  </script>
</body>
</html>`;

pages.forEach(p => fs.writeFileSync('../frontend/intranet/' + p + '.html', tpl(p)));
console.log('Pages created.');
