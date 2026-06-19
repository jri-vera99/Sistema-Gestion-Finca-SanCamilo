-- =================================================================
-- migrations/001_sistema_completo.sql
-- Migración incremental — Finca Agroecológica San Camilo
-- =================================================================
-- INSTRUCCIONES:
--   Ejecutar UNA SOLA VEZ en Railway (panel SQL, DBeaver o TablePlus).
--   Usa IF NOT EXISTS y IGNORE para ser idempotente.
--   NO borra ninguna tabla existente.
-- =================================================================

-- -----------------------------------------------------------------
-- 1. AMPLIAR TABLAS EXISTENTES
--    Solo se agregan columnas con DEFAULT para no romper datos.
-- -----------------------------------------------------------------

-- Usuarios: seguridad, control de sesión, MFA preparado
ALTER TABLE Usuarios
  ADD COLUMN IF NOT EXISTS activo          TINYINT(1)   NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS es_superadmin   TINYINT(1)   NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ultima_sesion   DATETIME     NULL,
  ADD COLUMN IF NOT EXISTS creado_en       DATETIME     NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS actualizado_en  DATETIME     ON UPDATE NOW(),
  ADD COLUMN IF NOT EXISTS mfa_habilitado  TINYINT(1)   NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mfa_secreto     VARCHAR(64)  NULL COMMENT 'TOTP secret para Google Authenticator';

-- Roles: control de estado
ALTER TABLE Roles
  ADD COLUMN IF NOT EXISTS activo     TINYINT(1) NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS creado_en  DATETIME   NOT NULL DEFAULT NOW();

-- Colmenas: observaciones y alertas
ALTER TABLE Colmenas
  ADD COLUMN IF NOT EXISTS observaciones  TEXT NULL,
  ADD COLUMN IF NOT EXISTS activa         TINYINT(1) NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS creado_en      DATETIME NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS creado_por     INT NULL,
  ADD COLUMN IF NOT EXISTS actualizado_en DATETIME ON UPDATE NOW();

-- Reservas: campos adicionales de gestión
ALTER TABLE Reservas
  ADD COLUMN IF NOT EXISTS notas          TEXT NULL,
  ADD COLUMN IF NOT EXISTS creado_en      DATETIME NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS actualizado_en DATETIME ON UPDATE NOW();

-- Habitaciones: descripción e imagen
ALTER TABLE Habitaciones
  ADD COLUMN IF NOT EXISTS descripcion    TEXT NULL,
  ADD COLUMN IF NOT EXISTS imagen_url     VARCHAR(500) NULL,
  ADD COLUMN IF NOT EXISTS activa         TINYINT(1) NOT NULL DEFAULT 1;

-- Clientes: campos adicionales
ALTER TABLE Clientes
  ADD COLUMN IF NOT EXISTS creado_en      DATETIME NOT NULL DEFAULT NOW();

-- -----------------------------------------------------------------
-- 2. TABLAS NUEVAS DE PERMISOS Y MÓDULOS
-- -----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS Modulos (
  id_modulo    INT          NOT NULL AUTO_INCREMENT,
  nombre       VARCHAR(100) NOT NULL,
  slug         VARCHAR(50)  NOT NULL UNIQUE COMMENT 'Identificador URL: colmenas, cosechas, hospedaje...',
  descripcion  TEXT         NULL,
  icono        VARCHAR(100) NULL COMMENT 'Clase FontAwesome: fa-solid fa-layer-group',
  orden        INT          NOT NULL DEFAULT 0,
  activo       TINYINT(1)   NOT NULL DEFAULT 1,
  PRIMARY KEY (id_modulo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS Permisos (
  id_permiso   INT          NOT NULL AUTO_INCREMENT,
  nombre       VARCHAR(100) NOT NULL,
  codigo       VARCHAR(50)  NOT NULL UNIQUE COMMENT 'ver, crear, editar, eliminar, exportar, simular',
  PRIMARY KEY (id_permiso)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS Rol_Modulo_Permiso (
  id           INT NOT NULL AUTO_INCREMENT,
  id_rol       INT NOT NULL,
  id_modulo    INT NOT NULL,
  id_permiso   INT NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_rol_modulo_permiso (id_rol, id_modulo, id_permiso),
  FOREIGN KEY (id_rol)    REFERENCES Roles(id_rol)       ON DELETE CASCADE,
  FOREIGN KEY (id_modulo) REFERENCES Modulos(id_modulo)  ON DELETE CASCADE,
  FOREIGN KEY (id_permiso)REFERENCES Permisos(id_permiso)ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Permisos individuales que sobrescriben al rol
CREATE TABLE IF NOT EXISTS Usuario_Permiso_Extra (
  id           INT        NOT NULL AUTO_INCREMENT,
  id_usuario   INT        NOT NULL,
  id_modulo    INT        NOT NULL,
  id_permiso   INT        NOT NULL,
  permitido    TINYINT(1) NOT NULL DEFAULT 1 COMMENT '1=conceder, 0=denegar',
  PRIMARY KEY (id),
  UNIQUE KEY uk_usr_mod_perm (id_usuario, id_modulo, id_permiso),
  FOREIGN KEY (id_usuario)REFERENCES Usuarios(id_usuario) ON DELETE CASCADE,
  FOREIGN KEY (id_modulo) REFERENCES Modulos(id_modulo)   ON DELETE CASCADE,
  FOREIGN KEY (id_permiso)REFERENCES Permisos(id_permiso) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -----------------------------------------------------------------
-- 3. CONFIGURACIÓN DE MODOS POR MÓDULO
-- -----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS Configuracion_Modo (
  id_config       INT          NOT NULL AUTO_INCREMENT,
  id_modulo       INT          NOT NULL,
  modo            ENUM('real','simulado') NOT NULL DEFAULT 'real',
  subsimulacion   VARCHAR(100) NULL COMMENT 'Ej: colmena_critica, alta_produccion, bajo_stock',
  actualizado_por INT          NULL,
  actualizado_en  DATETIME     NOT NULL DEFAULT NOW() ON UPDATE NOW(),
  PRIMARY KEY (id_config),
  UNIQUE KEY uk_modulo (id_modulo),
  FOREIGN KEY (id_modulo) REFERENCES Modulos(id_modulo) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -----------------------------------------------------------------
-- 4. IoT — DISPOSITIVOS Y LECTURAS
-- -----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS Dispositivos_IoT (
  id_dispositivo  INT          NOT NULL AUTO_INCREMENT,
  nombre          VARCHAR(100) NOT NULL,
  tipo            VARCHAR(50)  NOT NULL COMMENT 'ESP32, DHT22, sensor_peso, etc.',
  mac_address     VARCHAR(17)  NULL,
  token_api       VARCHAR(64)  NULL COMMENT 'Token único para autenticación del dispositivo',
  estado          ENUM('conectado','desconectado','mantenimiento') NOT NULL DEFAULT 'desconectado',
  id_colmena      INT          NULL,
  ultima_lectura  DATETIME     NULL,
  activo          TINYINT(1)   NOT NULL DEFAULT 1,
  creado_en       DATETIME     NOT NULL DEFAULT NOW(),
  FOREIGN KEY (id_colmena) REFERENCES Colmenas(id_colmena) ON DELETE SET NULL,
  PRIMARY KEY (id_dispositivo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -----------------------------------------------------------------
-- 5. ALERTAS DEL SISTEMA
-- -----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS Alertas (
  id_alerta     INT          NOT NULL AUTO_INCREMENT,
  tipo          VARCHAR(50)  NOT NULL COMMENT 'colmena_critica, bajo_stock, reserva_pendiente...',
  severidad     ENUM('info','advertencia','critica') NOT NULL DEFAULT 'info',
  mensaje       TEXT         NOT NULL,
  id_colmena    INT          NULL,
  id_reserva    INT          NULL,
  id_usuario    INT          NULL COMMENT 'Alerta dirigida a un usuario específico',
  leida         TINYINT(1)   NOT NULL DEFAULT 0,
  leida_en      DATETIME     NULL,
  creado_en     DATETIME     NOT NULL DEFAULT NOW(),
  FOREIGN KEY (id_colmena) REFERENCES Colmenas(id_colmena)  ON DELETE SET NULL,
  FOREIGN KEY (id_reserva) REFERENCES Reservas(id_reserva)  ON DELETE SET NULL,
  PRIMARY KEY (id_alerta)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -----------------------------------------------------------------
-- 6. AUDITORÍA
-- -----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS Auditoria (
  id_auditoria  INT          NOT NULL AUTO_INCREMENT,
  id_usuario    INT          NULL,
  accion        VARCHAR(100) NOT NULL COMMENT 'login, crear_colmena, cambiar_modo, generar_reporte...',
  modulo        VARCHAR(50)  NULL,
  detalle_json  JSON         NULL COMMENT 'Datos adicionales de la acción',
  ip            VARCHAR(45)  NULL,
  user_agent    VARCHAR(255) NULL,
  creado_en     DATETIME     NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id_auditoria),
  INDEX idx_usuario  (id_usuario),
  INDEX idx_creado   (creado_en),
  INDEX idx_modulo   (modulo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -----------------------------------------------------------------
-- 7. CATÁLOGO DE PRODUCTOS (portal público + inventario)
-- -----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS Productos (
  id_producto   INT           NOT NULL AUTO_INCREMENT,
  nombre        VARCHAR(150)  NOT NULL,
  categoria     VARCHAR(50)   NOT NULL COMMENT 'miel, cera, citrico, fruta, otro',
  descripcion   TEXT          NULL,
  precio        DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  unidad        VARCHAR(20)   NOT NULL DEFAULT 'kg' COMMENT 'kg, litro, unidad, tarro',
  stock         DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  estado        ENUM('disponible','bajo_stock','agotado') NOT NULL DEFAULT 'disponible',
  imagen_url    VARCHAR(500)  NULL,
  visible_publico TINYINT(1)  NOT NULL DEFAULT 1,
  modo          ENUM('real','simulado') NOT NULL DEFAULT 'real',
  activo        TINYINT(1)    NOT NULL DEFAULT 1,
  creado_en     DATETIME      NOT NULL DEFAULT NOW(),
  actualizado_en DATETIME     ON UPDATE NOW(),
  PRIMARY KEY (id_producto)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -----------------------------------------------------------------
-- 8. SOLICITUDES DEL PORTAL PÚBLICO
-- -----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS Solicitudes_Publicas (
  id_solicitud      INT           NOT NULL AUTO_INCREMENT,
  tipo              ENUM('compra','reserva','contacto') NOT NULL,
  nombre_solicitante VARCHAR(150) NOT NULL,
  correo            VARCHAR(150)  NOT NULL,
  telefono          VARCHAR(20)   NULL,
  mensaje           TEXT          NULL,
  estado            ENUM('pendiente','revisada','confirmada','rechazada','finalizada')
                                  NOT NULL DEFAULT 'pendiente',
  modo_pago         ENUM('comprobante','en_sitio') NULL,
  comprobante_url   VARCHAR(500)  NULL,
  asignado_a        INT           NULL COMMENT 'id_usuario intranet responsable',
  id_reserva        INT           NULL COMMENT 'Si se convirtió en reserva real',
  notas_internas    TEXT          NULL,
  modo              ENUM('real','simulado') NOT NULL DEFAULT 'real',
  creado_en         DATETIME      NOT NULL DEFAULT NOW(),
  actualizado_en    DATETIME      ON UPDATE NOW(),
  FOREIGN KEY (id_reserva) REFERENCES Reservas(id_reserva) ON DELETE SET NULL,
  PRIMARY KEY (id_solicitud),
  INDEX idx_estado  (estado),
  INDEX idx_creado  (creado_en)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Detalle de productos solicitados
CREATE TABLE IF NOT EXISTS Solicitud_Detalle (
  id_detalle     INT           NOT NULL AUTO_INCREMENT,
  id_solicitud   INT           NOT NULL,
  id_producto    INT           NULL,
  nombre_producto VARCHAR(150) NULL COMMENT 'Por si el producto ya no existe',
  cantidad       DECIMAL(10,2) NOT NULL DEFAULT 1,
  precio_unitario DECIMAL(10,2) NULL,
  PRIMARY KEY (id_detalle),
  FOREIGN KEY (id_solicitud) REFERENCES Solicitudes_Publicas(id_solicitud) ON DELETE CASCADE,
  FOREIGN KEY (id_producto)  REFERENCES Productos(id_producto) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -----------------------------------------------------------------
-- 9. PAGOS Y COMPROBANTES
-- -----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS Pagos (
  id_pago         INT           NOT NULL AUTO_INCREMENT,
  id_reserva      INT           NULL,
  id_solicitud    INT           NULL,
  monto           DECIMAL(10,2) NOT NULL,
  metodo          ENUM('transferencia','efectivo','tarjeta','otro') NOT NULL DEFAULT 'efectivo',
  comprobante_url VARCHAR(500)  NULL,
  estado          ENUM('pendiente','verificado','rechazado') NOT NULL DEFAULT 'pendiente',
  verificado_por  INT           NULL,
  notas           TEXT          NULL,
  creado_en       DATETIME      NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id_pago),
  FOREIGN KEY (id_reserva)   REFERENCES Reservas(id_reserva) ON DELETE SET NULL,
  FOREIGN KEY (id_solicitud) REFERENCES Solicitudes_Publicas(id_solicitud) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -----------------------------------------------------------------
-- 10. TICKETS DE MANTENIMIENTO (hospedaje)
-- -----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS Tickets_Mantenimiento (
  id_ticket      INT          NOT NULL AUTO_INCREMENT,
  id_habitacion  INT          NOT NULL,
  titulo         VARCHAR(200) NOT NULL,
  descripcion    TEXT         NULL,
  tipo           ENUM('limpieza','mantenimiento','reparacion','otro') NOT NULL DEFAULT 'mantenimiento',
  estado         ENUM('abierto','en_proceso','resuelto','cancelado') NOT NULL DEFAULT 'abierto',
  prioridad      ENUM('baja','media','alta','urgente') NOT NULL DEFAULT 'media',
  asignado_a     INT          NULL,
  creado_por     INT          NULL,
  creado_en      DATETIME     NOT NULL DEFAULT NOW(),
  resuelto_en    DATETIME     NULL,
  FOREIGN KEY (id_habitacion) REFERENCES Habitaciones(id_habitacion) ON DELETE CASCADE,
  PRIMARY KEY (id_ticket)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -----------------------------------------------------------------
-- 11. GALERÍA PÚBLICA
-- -----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS Galeria (
  id_imagen   INT          NOT NULL AUTO_INCREMENT,
  url         VARCHAR(500) NOT NULL,
  titulo      VARCHAR(150) NULL,
  alt_text    VARCHAR(150) NULL COMMENT 'Texto alternativo para accesibilidad',
  categoria   VARCHAR(50)  NULL COMMENT 'apiario, hospedaje, frutas, naturaleza',
  orden       INT          NOT NULL DEFAULT 0,
  activo      TINYINT(1)   NOT NULL DEFAULT 1,
  creado_en   DATETIME     NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id_imagen)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =================================================================
-- DATOS INICIALES
-- =================================================================

-- Módulos del sistema
INSERT IGNORE INTO Modulos (nombre, slug, icono, orden) VALUES
  ('Dashboard',            'dashboard',    'fa-solid fa-gauge-high',      1),
  ('Apiario / Colmenas',   'colmenas',     'fa-solid fa-layer-group',     2),
  ('Cosechas',             'cosechas',     'fa-solid fa-jar',             3),
  ('Inventario',           'inventario',   'fa-solid fa-boxes-stacked',   4),
  ('Hospedaje',            'hospedaje',    'fa-solid fa-house',           5),
  ('Solicitudes Públicas', 'solicitudes',  'fa-solid fa-inbox',           6),
  ('Clientes',             'clientes',     'fa-solid fa-users',           7),
  ('Usuarios y Roles',     'usuarios',     'fa-solid fa-user-shield',     8),
  ('Configuración Modos',  'configuracion','fa-solid fa-sliders',         9),
  ('Dispositivos IoT',     'dispositivos', 'fa-solid fa-microchip',      10),
  ('Reportes',             'reportes',     'fa-solid fa-chart-bar',      11),
  ('Auditoría',            'auditoria',    'fa-solid fa-scroll',         12);

-- Permisos base
INSERT IGNORE INTO Permisos (nombre, codigo) VALUES
  ('Ver',                  'ver'),
  ('Crear',                'crear'),
  ('Editar',               'editar'),
  ('Eliminar',             'eliminar'),
  ('Exportar',             'exportar'),
  ('Configurar Simulación','simular');

-- Rol: Superadministrador (si no existe)
INSERT IGNORE INTO Roles (id_rol, nombre_rol, descripcion, activo)
  VALUES (1, 'Superadministrador', 'Control total del sistema. No puede ser eliminado.', 1);

-- Rol: Apicultor
INSERT IGNORE INTO Roles (nombre_rol, descripcion, activo)
  VALUES ('Apicultor', 'Gestiona colmenas, monitoreo y cosechas.', 1);

-- Rol: Administrador Hospedaje
INSERT IGNORE INTO Roles (nombre_rol, descripcion, activo)
  VALUES ('Administrador Hospedaje', 'Gestiona reservas, habitaciones y clientes.', 1);

-- Rol: Vendedor
INSERT IGNORE INTO Roles (nombre_rol, descripcion, activo)
  VALUES ('Vendedor', 'Gestiona inventario y solicitudes del portal.', 1);

-- Usuario Superadmin principal
-- Contraseña: (hasheada con bcrypt — se actualiza al primer login)
-- HASH generado con bcrypt cost factor 12 para ''
INSERT IGNORE INTO Usuarios
  (id_rol, nombres, correo, contrasena, estado, activo, es_superadmin, creado_en)
VALUES
  (1,
   'Administrador Principal',
   'gestion.jobs.jr@gmail.com',
   '$2b$12$9rKQ8MqNbMbF1RGRJY.Uxe2VqWJeC2LvNK9EJ2yEZ1qpBZJbmEfO',
   'activo',
   1,
   1,
   NOW()
  );

-- Dar al rol Superadministrador todos los permisos en todos los módulos
INSERT IGNORE INTO Rol_Modulo_Permiso (id_rol, id_modulo, id_permiso)
SELECT 1, m.id_modulo, p.id_permiso
FROM Modulos m CROSS JOIN Permisos p;

-- Configuración inicial: todos los módulos en modo 'real'
INSERT IGNORE INTO Configuracion_Modo (id_modulo, modo)
SELECT id_modulo, 'real' FROM Modulos;

-- Productos del catálogo inicial
INSERT IGNORE INTO Productos (nombre, categoria, descripcion, precio, unidad, stock, estado) VALUES
  ('Miel Pura de Abeja', 'miel', 'Miel artesanal del apiario, sin procesar. Rica en enzimas y antioxidantes.', 12.00, 'tarro 500g', 50, 'disponible'),
  ('Cera de Abeja Natural', 'cera', 'Cera pura extraída de las colmenas. Ideal para cosmética y velas artesanales.', 8.00, 'bloque 200g', 30, 'disponible'),
  ('Mandarinas Frescas', 'citrico', 'Mandarinas dulces y jugosas de la finca. Cosecha fresca de temporada.', 1.50, 'kg', 200, 'disponible'),
  ('Aguacates Hass', 'fruta', 'Aguacates cremosos y nutritivos. Cultivados sin pesticidas.', 3.00, 'unidad grande', 80, 'disponible'),
  ('Naranjas de Mesa', 'citrico', 'Naranjas jugosas, perfectas para jugo natural o consumo directo.', 1.20, 'kg', 300, 'disponible'),
  ('Mango Tommy Atkins', 'fruta', 'Mangos grandes y carnosos, con sabor tropical intenso.', 2.50, 'kg', 120, 'disponible'),
  ('Plátanos Maduros', 'fruta', 'Plátanos de maduración natural, ideales para frituras y postres.', 0.80, 'kg', 150, 'disponible');

-- Galería inicial (imágenes Unsplash — TODO: reemplazar por fotografías reales del negocio)
INSERT IGNORE INTO Galeria (url, titulo, alt_text, categoria, orden) VALUES
  ('https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800', 'Apiario en Ambuquí', 'Colmenas de la finca agroecológica San Camilo en Ambuquí', 'apiario', 1),
  ('https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=800', 'Miel artesanal', 'Tarro de miel pura de abeja producida en la finca', 'apiario', 2),
  ('https://images.unsplash.com/photo-1564648351416-3eec9f3e85de?w=800', 'Cítricos frescos', 'Mandarinas y naranjas frescas de la finca San Camilo', 'frutas', 3),
  ('https://images.unsplash.com/photo-1615484477778-ca3b77940c25?w=800', 'Hospedaje rural', 'Cabaña rodeada de naturaleza para turismo agroecológico', 'hospedaje', 4),
  ('https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800', 'Valle del Chota', 'Paisaje del Valle del Chota cerca de Ambuquí', 'naturaleza', 5),
  ('https://images.unsplash.com/photo-1601004890684-d8cbf643f5f2?w=800', 'Aguacates Hass', 'Aguacates cultivados sin pesticidas en la finca', 'frutas', 6);
