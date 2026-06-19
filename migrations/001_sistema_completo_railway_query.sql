-- =================================================================
-- migrations/001_sistema_completo_railway_query.sql
-- Migración incremental compatible con Railway Data Query
-- =================================================================

-- NOTA IMPORTANTE PARA EL BLOQUE 1:
-- Railway Data Query no permite ignorar errores de forma global fácilmente.
-- Ejecuta el BLOQUE 1 línea por línea o en grupos pequeños.
-- Si un ALTER TABLE falla con el mensaje "Duplicate column name", 
-- significa que la columna ya existe. SIMPLEMENTE OMITE ESA LÍNEA Y CONTINÚA.

-- =================================================================
-- BLOQUE 1: ALTER TABLE (AMPLIAR TABLAS EXISTENTES)
-- =================================================================

ALTER TABLE Usuarios ADD COLUMN activo TINYINT(1) NOT NULL DEFAULT 1;
ALTER TABLE Usuarios ADD COLUMN es_superadmin TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE Usuarios ADD COLUMN ultima_sesion DATETIME NULL;
ALTER TABLE Usuarios ADD COLUMN creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE Usuarios ADD COLUMN actualizado_en DATETIME NULL ON UPDATE CURRENT_TIMESTAMP;
ALTER TABLE Usuarios ADD COLUMN mfa_habilitado TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE Usuarios ADD COLUMN mfa_secreto VARCHAR(64) NULL COMMENT 'TOTP secret';

ALTER TABLE Roles ADD COLUMN activo TINYINT(1) NOT NULL DEFAULT 1;
ALTER TABLE Roles ADD COLUMN creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE Colmenas ADD COLUMN observaciones TEXT NULL;
ALTER TABLE Colmenas ADD COLUMN activa TINYINT(1) NOT NULL DEFAULT 1;
ALTER TABLE Colmenas ADD COLUMN creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE Colmenas ADD COLUMN creado_por INT NULL;
ALTER TABLE Colmenas ADD COLUMN actualizado_en DATETIME NULL ON UPDATE CURRENT_TIMESTAMP;

ALTER TABLE Reservas ADD COLUMN notas TEXT NULL;
ALTER TABLE Reservas ADD COLUMN creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE Reservas ADD COLUMN actualizado_en DATETIME NULL ON UPDATE CURRENT_TIMESTAMP;

ALTER TABLE Habitaciones ADD COLUMN descripcion TEXT NULL;
ALTER TABLE Habitaciones ADD COLUMN imagen_url VARCHAR(500) NULL;
ALTER TABLE Habitaciones ADD COLUMN activa TINYINT(1) NOT NULL DEFAULT 1;

ALTER TABLE Clientes ADD COLUMN creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- OPCIONAL: Si no tienes correos duplicados, puedes crear el índice único:
-- ALTER TABLE Usuarios ADD UNIQUE INDEX uk_usuarios_correo (correo);

-- =================================================================
-- BLOQUE 2: CREATE TABLE (NUEVAS TABLAS)
-- Puedes copiar y ejecutar este bloque completo.
-- =================================================================

CREATE TABLE IF NOT EXISTS Modulos (
  id_modulo    INT          NOT NULL AUTO_INCREMENT,
  nombre       VARCHAR(100) NOT NULL,
  slug         VARCHAR(50)  NOT NULL UNIQUE COMMENT 'Identificador URL',
  descripcion  TEXT         NULL,
  icono        VARCHAR(100) NULL,
  orden        INT          NOT NULL DEFAULT 0,
  activo       TINYINT(1)   NOT NULL DEFAULT 1,
  PRIMARY KEY (id_modulo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS Permisos (
  id_permiso   INT          NOT NULL AUTO_INCREMENT,
  nombre       VARCHAR(100) NOT NULL,
  codigo       VARCHAR(50)  NOT NULL UNIQUE,
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

CREATE TABLE IF NOT EXISTS Usuario_Permiso_Extra (
  id           INT        NOT NULL AUTO_INCREMENT,
  id_usuario   INT        NOT NULL,
  id_modulo    INT        NOT NULL,
  id_permiso   INT        NOT NULL,
  permitido    TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  UNIQUE KEY uk_usr_mod_perm (id_usuario, id_modulo, id_permiso),
  FOREIGN KEY (id_usuario)REFERENCES Usuarios(id_usuario) ON DELETE CASCADE,
  FOREIGN KEY (id_modulo) REFERENCES Modulos(id_modulo)   ON DELETE CASCADE,
  FOREIGN KEY (id_permiso)REFERENCES Permisos(id_permiso) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS Configuracion_Modo (
  id_config       INT          NOT NULL AUTO_INCREMENT,
  id_modulo       INT          NOT NULL,
  modo            ENUM('real','simulado') NOT NULL DEFAULT 'real',
  subsimulacion   VARCHAR(100) NULL,
  actualizado_por INT          NULL,
  actualizado_en  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id_config),
  UNIQUE KEY uk_modulo (id_modulo),
  FOREIGN KEY (id_modulo) REFERENCES Modulos(id_modulo) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS Dispositivos_IoT (
  id_dispositivo  INT          NOT NULL AUTO_INCREMENT,
  nombre          VARCHAR(100) NOT NULL,
  tipo            VARCHAR(50)  NOT NULL,
  mac_address     VARCHAR(17)  NULL,
  token_api       VARCHAR(64)  NULL,
  estado          ENUM('conectado','desconectado','mantenimiento') NOT NULL DEFAULT 'desconectado',
  id_colmena      INT          NULL,
  ultima_lectura  DATETIME     NULL,
  activo          TINYINT(1)   NOT NULL DEFAULT 1,
  creado_en       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (id_colmena) REFERENCES Colmenas(id_colmena) ON DELETE SET NULL,
  PRIMARY KEY (id_dispositivo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS Alertas (
  id_alerta     INT          NOT NULL AUTO_INCREMENT,
  tipo          VARCHAR(50)  NOT NULL,
  severidad     ENUM('info','advertencia','critica') NOT NULL DEFAULT 'info',
  mensaje       TEXT         NOT NULL,
  id_colmena    INT          NULL,
  id_reserva    INT          NULL,
  id_usuario    INT          NULL,
  leida         TINYINT(1)   NOT NULL DEFAULT 0,
  leida_en      DATETIME     NULL,
  creado_en     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (id_colmena) REFERENCES Colmenas(id_colmena)  ON DELETE SET NULL,
  FOREIGN KEY (id_reserva) REFERENCES Reservas(id_reserva)  ON DELETE SET NULL,
  PRIMARY KEY (id_alerta)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS Auditoria (
  id_auditoria  INT          NOT NULL AUTO_INCREMENT,
  id_usuario    INT          NULL,
  accion        VARCHAR(100) NOT NULL,
  modulo        VARCHAR(50)  NULL,
  detalle_json  JSON         NULL,
  ip            VARCHAR(45)  NULL,
  user_agent    VARCHAR(255) NULL,
  creado_en     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_auditoria),
  INDEX idx_usuario  (id_usuario),
  INDEX idx_creado   (creado_en),
  INDEX idx_modulo   (modulo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS Productos (
  id_producto   INT           NOT NULL AUTO_INCREMENT,
  nombre        VARCHAR(150)  NOT NULL,
  categoria     VARCHAR(50)   NOT NULL,
  descripcion   TEXT          NULL,
  precio        DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  unidad        VARCHAR(20)   NOT NULL DEFAULT 'kg',
  stock         DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  estado        ENUM('disponible','bajo_stock','agotado') NOT NULL DEFAULT 'disponible',
  imagen_url    VARCHAR(500)  NULL,
  visible_publico TINYINT(1)  NOT NULL DEFAULT 1,
  modo          ENUM('real','simulado') NOT NULL DEFAULT 'real',
  activo        TINYINT(1)    NOT NULL DEFAULT 1,
  creado_en     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en DATETIME     NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id_producto),
  UNIQUE KEY uk_nombre_producto (nombre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS Solicitudes_Publicas (
  id_solicitud      INT           NOT NULL AUTO_INCREMENT,
  tipo              ENUM('compra','reserva','contacto') NOT NULL,
  nombre_solicitante VARCHAR(150) NOT NULL,
  correo            VARCHAR(150)  NOT NULL,
  telefono          VARCHAR(20)   NULL,
  mensaje           TEXT          NULL,
  estado            ENUM('pendiente','revisada','confirmada','rechazada','finalizada') NOT NULL DEFAULT 'pendiente',
  modo_pago         ENUM('comprobante','en_sitio') NULL,
  comprobante_url   VARCHAR(500)  NULL,
  asignado_a        INT           NULL,
  id_reserva        INT           NULL,
  notas_internas    TEXT          NULL,
  modo              ENUM('real','simulado') NOT NULL DEFAULT 'real',
  creado_en         DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en    DATETIME      NULL ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (id_reserva) REFERENCES Reservas(id_reserva) ON DELETE SET NULL,
  PRIMARY KEY (id_solicitud),
  INDEX idx_estado  (estado),
  INDEX idx_creado  (creado_en)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS Solicitud_Detalle (
  id_detalle     INT           NOT NULL AUTO_INCREMENT,
  id_solicitud   INT           NOT NULL,
  id_producto    INT           NULL,
  nombre_producto VARCHAR(150) NULL,
  cantidad       DECIMAL(10,2) NOT NULL DEFAULT 1,
  precio_unitario DECIMAL(10,2) NULL,
  PRIMARY KEY (id_detalle),
  FOREIGN KEY (id_solicitud) REFERENCES Solicitudes_Publicas(id_solicitud) ON DELETE CASCADE,
  FOREIGN KEY (id_producto)  REFERENCES Productos(id_producto) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

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
  creado_en       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_pago),
  FOREIGN KEY (id_reserva)   REFERENCES Reservas(id_reserva) ON DELETE SET NULL,
  FOREIGN KEY (id_solicitud) REFERENCES Solicitudes_Publicas(id_solicitud) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

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
  creado_en      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resuelto_en    DATETIME     NULL,
  FOREIGN KEY (id_habitacion) REFERENCES Habitaciones(id_habitacion) ON DELETE CASCADE,
  PRIMARY KEY (id_ticket)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS Galeria (
  id_imagen   INT          NOT NULL AUTO_INCREMENT,
  url         VARCHAR(500) NOT NULL,
  titulo      VARCHAR(150) NULL,
  alt_text    VARCHAR(150) NULL,
  categoria   VARCHAR(50)  NULL,
  orden       INT          NOT NULL DEFAULT 0,
  activo      TINYINT(1)   NOT NULL DEFAULT 1,
  creado_en   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_imagen),
  UNIQUE KEY uk_url_imagen (url)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =================================================================
-- BLOQUE 3: INSERT IGNORE / WHERE NOT EXISTS (DATOS INICIALES)
-- Puedes copiar y ejecutar este bloque completo.
-- =================================================================

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

INSERT IGNORE INTO Permisos (nombre, codigo) VALUES
  ('Ver',                  'ver'),
  ('Crear',                'crear'),
  ('Editar',               'editar'),
  ('Eliminar',             'eliminar'),
  ('Exportar',             'exportar'),
  ('Configurar Simulación','simular');

INSERT IGNORE INTO Roles (id_rol, nombre_rol, descripcion, activo)
  VALUES (1, 'Superadministrador', 'Control total del sistema.', 1);

INSERT IGNORE INTO Roles (nombre_rol, descripcion, activo)
SELECT 'Apicultor', 'Gestiona colmenas, monitoreo y cosechas.', 1
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM Roles WHERE nombre_rol = 'Apicultor');

INSERT IGNORE INTO Roles (nombre_rol, descripcion, activo)
SELECT 'Administrador Hospedaje', 'Gestiona reservas, habitaciones y clientes.', 1
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM Roles WHERE nombre_rol = 'Administrador Hospedaje');

INSERT IGNORE INTO Roles (nombre_rol, descripcion, activo)
SELECT 'Vendedor', 'Gestiona inventario y solicitudes del portal.', 1
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM Roles WHERE nombre_rol = 'Vendedor');

INSERT INTO Usuarios (id_rol, nombres, correo, contrasena, estado, activo, es_superadmin, creado_en)
SELECT 1, 'Administrador Principal', 'gestion.jobs.jr@gmail.com', '$2b$12$9rKQ8MqNbMbF1RGRJY.Uxe2VqWJeC2LvNK9EJ2yEZ1qpBZJbmEfO', 'activo', 1, 1, CURRENT_TIMESTAMP
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1 FROM Usuarios WHERE correo = 'gestion.jobs.jr@gmail.com'
);

INSERT IGNORE INTO Rol_Modulo_Permiso (id_rol, id_modulo, id_permiso)
SELECT 1, m.id_modulo, p.id_permiso
FROM Modulos m CROSS JOIN Permisos p;

INSERT IGNORE INTO Configuracion_Modo (id_modulo, modo)
SELECT id_modulo, 'real' FROM Modulos;

INSERT IGNORE INTO Productos (nombre, categoria, descripcion, precio, unidad, stock, estado) VALUES
  ('Miel Pura de Abeja', 'miel', 'Miel artesanal del apiario, sin procesar.', 12.00, 'tarro 500g', 50, 'disponible'),
  ('Cera de Abeja Natural', 'cera', 'Cera pura extraída de las colmenas.', 8.00, 'bloque 200g', 30, 'disponible'),
  ('Mandarinas Frescas', 'citrico', 'Mandarinas dulces y jugosas de la finca.', 1.50, 'kg', 200, 'disponible'),
  ('Aguacates Hass', 'fruta', 'Aguacates cremosos y nutritivos.', 3.00, 'unidad grande', 80, 'disponible'),
  ('Naranjas de Mesa', 'citrico', 'Naranjas jugosas, perfectas para jugo natural.', 1.20, 'kg', 300, 'disponible'),
  ('Mango Tommy Atkins', 'fruta', 'Mangos grandes y carnosos.', 2.50, 'kg', 120, 'disponible'),
  ('Plátanos Maduros', 'fruta', 'Plátanos de maduración natural.', 0.80, 'kg', 150, 'disponible');

INSERT IGNORE INTO Galeria (url, titulo, alt_text, categoria, orden) VALUES
  ('https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800', 'Apiario en Ambuquí', 'Colmenas de la finca', 'apiario', 1),
  ('https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=800', 'Miel artesanal', 'Tarro de miel pura', 'apiario', 2),
  ('https://images.unsplash.com/photo-1564648351416-3eec9f3e85de?w=800', 'Cítricos frescos', 'Mandarinas y naranjas', 'frutas', 3),
  ('https://images.unsplash.com/photo-1615484477778-ca3b77940c25?w=800', 'Hospedaje rural', 'Cabaña rodeada de naturaleza', 'hospedaje', 4),
  ('https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800', 'Valle del Chota', 'Paisaje del Valle del Chota', 'naturaleza', 5),
  ('https://images.unsplash.com/photo-1601004890684-d8cbf643f5f2?w=800', 'Aguacates Hass', 'Aguacates cultivados sin pesticidas', 'frutas', 6);
