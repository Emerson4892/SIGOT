ALTER TABLE repuestos
  ADD CONSTRAINT repuestos_stock_no_negativo CHECK (stock >= 0 AND "stockMinimo" >= 0);

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

CREATE TRIGGER auditoria_inmutable
BEFORE UPDATE OR DELETE ON auditoria
FOR EACH ROW
EXECUTE FUNCTION sigot_auditoria_inmutable();
