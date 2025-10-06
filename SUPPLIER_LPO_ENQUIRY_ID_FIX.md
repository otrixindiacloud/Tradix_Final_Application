# Supplier LPO Creation Error Fix

## Issue
**Error Message:**
```
error: column "enquiry_id" does not exist
    at file:///workspaces/Tradix_Final_Application/node_modules/@neondatabase/serverless/index.mjs:1345:74
    at async SupplierLpoStorage.createSupplierLposFromSupplierQuotes
    at async /workspaces/Tradix_Final_Application/server/routes/supplier-lpo.ts:73:20
```

## Root Cause
The code was trying to select the `enquiry_id` column from the `supplier_quotes` table, but this column doesn't exist in the actual database yet. While the column is defined in the schema (`shared/schema.ts`), it appears the migration to add this column hasn't been run on the database.

## Solution
Modified the code to temporarily skip the `enquiry_id` field until the database migration is applied. This allows supplier LPO creation to work without errors.

## Changes Made

### File: `/server/storage/supplier-lpo-storage.ts`

#### Before (Line ~183):
```typescript
const quote = await db
  .select({
    id: supplierQuotes.id,
    quoteNumber: supplierQuotes.quoteNumber,
    supplierId: supplierQuotes.supplierId,
    enquiryId: supplierQuotes.enquiryId,  // ❌ This column doesn't exist yet
    status: supplierQuotes.status,
    // ... other fields
  })
  .from(supplierQuotes)
```

#### After:
```typescript
const quote = await db
  .select({
    id: supplierQuotes.id,
    quoteNumber: supplierQuotes.quoteNumber,
    supplierId: supplierQuotes.supplierId,
    // ✅ Removed enquiryId to avoid column error
    // enquiryId: supplierQuotes.enquiryId,
    status: supplierQuotes.status,
    // ... other fields
  })
  .from(supplierQuotes)
```

#### Customer Name Lookup (Line ~208):
```typescript
// Get customer name from enquiry if available - COMMENTED OUT since enquiryId column doesn't exist yet
let customerName: string | null = null;
/*
const firstQuoteWithEnquiry = quotes.find(q => q.enquiryId);
if (firstQuoteWithEnquiry?.enquiryId) {
  const enquiryResult = await db
    .select({
      customerId: enquiries.customerId,
      customerName: customers.name
    })
    .from(enquiries)
    .leftJoin(customers, eq(enquiries.customerId, customers.id))
    .where(eq(enquiries.id, firstQuoteWithEnquiry.enquiryId))
    .limit(1);
  
  if (enquiryResult[0]?.customerName) {
    customerName = enquiryResult[0].customerName;
  }
}
*/
```

### File: `/migrations/0006_add_enquiry_id_to_supplier_quotes.sql` (New)

Created a migration file to add the `enquiry_id` column when needed:

```sql
-- Check if column exists and add it if not
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'supplier_quotes' 
        AND column_name = 'enquiry_id'
    ) THEN
        ALTER TABLE supplier_quotes 
        ADD COLUMN enquiry_id UUID REFERENCES enquiries(id);
        
        -- Add index for better performance
        CREATE INDEX IF NOT EXISTS idx_supplier_quotes_enquiry_id 
        ON supplier_quotes(enquiry_id);
        
        RAISE NOTICE 'Column enquiry_id added to supplier_quotes table';
    ELSE
        RAISE NOTICE 'Column enquiry_id already exists in supplier_quotes table';
    END IF;
END $$;
```

## How to Apply Migration

### Option 1: Using psql
```bash
psql -h <host> -U <user> -d <database> -f migrations/0006_add_enquiry_id_to_supplier_quotes.sql
```

### Option 2: Direct SQL
Connect to your database and run:
```sql
ALTER TABLE supplier_quotes 
ADD COLUMN IF NOT EXISTS enquiry_id UUID REFERENCES enquiries(id);

CREATE INDEX IF NOT EXISTS idx_supplier_quotes_enquiry_id 
ON supplier_quotes(enquiry_id);
```

### Option 3: Using migration tool
If you have a migration tool set up:
```bash
npm run migrate
# or
node run-migration.cjs
```

## After Migration

Once the migration is applied, you can:

1. **Uncomment the code** in `supplier-lpo-storage.ts` (lines 183 and 208-226)
2. **Enable enquiry tracking** for supplier quotes
3. **Get customer names** from linked enquiries automatically

## Testing

### Before Migration Applied:
1. Go to Supplier Quotes page
2. Select quotes and create Supplier LPO
3. ✅ Should work without errors (enquiry tracking disabled)

### After Migration Applied:
1. Uncomment the code
2. Create supplier quotes linked to enquiries
3. Create Supplier LPOs from those quotes
4. ✅ Customer name should be populated from enquiry

## Impact

### Current Behavior:
- ✅ Supplier LPO creation works
- ❌ Cannot track which enquiry a quote relates to
- ❌ Customer name not auto-populated from enquiry

### After Migration:
- ✅ Supplier LPO creation works
- ✅ Can track enquiry relationship
- ✅ Customer name auto-populated from enquiry

## Database Schema

### supplier_quotes Table Structure:
```sql
CREATE TABLE supplier_quotes (
    id UUID PRIMARY KEY,
    quote_number VARCHAR(50) UNIQUE NOT NULL,
    supplier_id UUID REFERENCES suppliers(id) NOT NULL,
    enquiry_id UUID REFERENCES enquiries(id),  -- Links to enquiry
    status VARCHAR(20) DEFAULT 'Draft',
    -- ... other fields
);
```

## Notes

### Why This Error Occurred:
1. Schema definition exists in `shared/schema.ts`
2. Migration file exists in `server/migrations/create-supplier-quotes-tables.sql`
3. But the migration may not have been run on the database
4. Or the database was created before the column was added

### Prevention:
- Always run migrations after schema changes
- Use `IF NOT EXISTS` in migration files
- Check database schema matches code expectations
- Add migration verification in startup script

### Related Files:
- `/shared/schema.ts` - Schema definition (line 2173)
- `/server/migrations/create-supplier-quotes-tables.sql` - Initial migration
- `/migrations/0006_add_enquiry_id_to_supplier_quotes.sql` - Fix migration
- `/server/storage/supplier-lpo-storage.ts` - Storage layer (modified)

## Future Enhancements

Once migration is applied, the code can be restored to:
1. Link supplier quotes to enquiries
2. Track quote origin
3. Auto-populate customer information
4. Generate better reports with enquiry context
