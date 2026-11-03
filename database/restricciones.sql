-- Referencia de restricciones que Prisma no expresa en el esquema.
-- La fuente de aplicación es la migración:
-- backend/prisma/migrations/20261101063000_restricciones/migration.sql
-- No las ejecuta prisma/seed.js. migrate deploy las aplica una sola vez.

ALTER TABLE repuestos
  DROP CONSTRAINT IF EXISTS repuestos_stock_no_negativo;
ALTER TABLE repuestos
  ADD CONSTRAINT repuestos_stock_no_negativo CHECK (stock >= 0 AND "stockMinimo" >= 0);

ALTER TABLE movimientos_repuesto
  DROP CONSTRAINT IF EXISTS movimientos_cantidad_positiva;
ALTER TABLE movimientos_repuesto
  ADD CONSTRAINT movimientos_cantidad_positiva CHECK (cantidad > 0);

CREATE OR REPLACE FUNCTION sigot_auditoria_inmutable()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Los registros de auditoria son inmutables';
END;
$$;

DROP TRIGGER IF EXISTS auditoria_inmutable ON auditoria;
CREATE TRIGGER auditoria_inmutable
BEFORE UPDATE OR DELETE ON auditoria
FOR EACH ROW
EXECUTE FUNCTION sigot_auditoria_inmutable();
