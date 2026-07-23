-- Stop before applying this migration if this query returns a row.  The release
-- runbook must decide how each fractional quantity is handled; data is never
-- silently rounded in production.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "Product" WHERE "reorderPoint" <> trunc("reorderPoint")
    UNION ALL SELECT 1 FROM "StockBalance" WHERE "quantity" <> trunc("quantity")
    UNION ALL SELECT 1 FROM "StockDocumentLine" WHERE "quantity" <> trunc("quantity")
    UNION ALL SELECT 1 FROM "StockLedger" WHERE "quantityDelta" <> trunc("quantityDelta") OR "balanceAfter" <> trunc("balanceAfter")
    UNION ALL SELECT 1 FROM "StocktakeLine" WHERE "expectedQty" <> trunc("expectedQty") OR ("countedQty" IS NOT NULL AND "countedQty" <> trunc("countedQty"))
    UNION ALL SELECT 1 FROM "SaleLine" WHERE "quantity" <> trunc("quantity")
  ) THEN
    RAISE EXCEPTION 'Cannot migrate quantities to integer: fractional inventory data exists';
  END IF;
END $$;

CREATE TYPE "ReceiptPaperSize" AS ENUM ('THERMAL_80', 'A4');

ALTER TABLE "Company"
  ADD COLUMN "logoKey" VARCHAR(500),
  ADD COLUMN "address" VARCHAR(500),
  ADD COLUMN "phone" VARCHAR(32),
  ADD COLUMN "email" VARCHAR(255),
  ADD COLUMN "taxCode" VARCHAR(64),
  ADD COLUMN "currencyCode" VARCHAR(3) NOT NULL DEFAULT 'VND',
  ADD COLUMN "defaultTaxRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN "receiptPaperSize" "ReceiptPaperSize" NOT NULL DEFAULT 'THERMAL_80',
  ADD COLUMN "receiptFooter" VARCHAR(500);

ALTER TABLE "Product" ALTER COLUMN "reorderPoint" TYPE INTEGER USING "reorderPoint"::integer;
ALTER TABLE "StockBalance" ALTER COLUMN "quantity" TYPE INTEGER USING "quantity"::integer;
ALTER TABLE "StockDocumentLine" ALTER COLUMN "quantity" TYPE INTEGER USING "quantity"::integer;
ALTER TABLE "StockLedger" ALTER COLUMN "quantityDelta" TYPE INTEGER USING "quantityDelta"::integer;
ALTER TABLE "StockLedger" ALTER COLUMN "balanceAfter" TYPE INTEGER USING "balanceAfter"::integer;
ALTER TABLE "StocktakeLine" ALTER COLUMN "expectedQty" TYPE INTEGER USING "expectedQty"::integer;
ALTER TABLE "StocktakeLine" ALTER COLUMN "countedQty" TYPE INTEGER USING "countedQty"::integer;
ALTER TABLE "SaleLine" ALTER COLUMN "quantity" TYPE INTEGER USING "quantity"::integer;
