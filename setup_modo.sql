-- ==============================================================
-- setup_modo.sql
-- Agrega la columna `modo` a todas las tablas que la necesitan.
-- Ejecuta este script UNA SOLA VEZ en tu base de datos Railway.
--
-- Valores posibles del campo modo:
--   'real'      → dato ingresado por un usuario o sensor real
--   'simulado'  → dato generado automáticamente para pruebas
-- ==============================================================

-- Si la columna ya existe, MySQL lanzará un error; puedes ignorarlo.

ALTER TABLE Colmenas
  ADD COLUMN modo ENUM('real','simulado') NOT NULL DEFAULT 'real'
  COMMENT 'Indica si el dato es real o simulado para pruebas';

ALTER TABLE Cosechas
  ADD COLUMN modo ENUM('real','simulado') NOT NULL DEFAULT 'real';

ALTER TABLE Inventario_Frutas
  ADD COLUMN modo ENUM('real','simulado') NOT NULL DEFAULT 'real';

ALTER TABLE Reservas
  ADD COLUMN modo ENUM('real','simulado') NOT NULL DEFAULT 'real';

ALTER TABLE Monitoreo_Colmena
  ADD COLUMN modo ENUM('real','simulado') NOT NULL DEFAULT 'real';

-- Verificación: muestra las columnas de cada tabla
DESCRIBE Colmenas;
DESCRIBE Cosechas;
DESCRIBE Inventario_Frutas;
DESCRIBE Reservas;
DESCRIBE Monitoreo_Colmena;
