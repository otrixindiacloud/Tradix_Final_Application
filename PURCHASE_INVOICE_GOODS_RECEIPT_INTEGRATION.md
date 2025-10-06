# Purchase Invoice - Goods Receipt Integration

## Overview
Enhanced the purchase invoice detail page to fetch and display complete goods receipt information alongside invoice data, providing full visibility into the receiving process.

## Implementation Details

### 1. Data Fetching
**Added two data sources:**

**a) Invoice Items Query:**
```typescript
const { data: invoiceItems = [] } = useQuery<PurchaseInvoiceItem[]>({
  queryKey: ["/api/purchase-invoices", id, "items"],
  enabled: !!id,
  queryFn: async () => {
    const resp = await fetch(`/api/purchase-invoices/${id}/items`);
    return resp.json();
  }
});
```

**b) Goods Receipt Items Query:**
```typescript
const { data: goodsReceiptItems = [] } = useQuery<any[]>({
  queryKey: ["/api/goods-receipt-headers", invoice?.goodsReceiptId, "items"],
  enabled: !!invoice?.goodsReceiptId,
  queryFn: async () => {
    const resp = await fetch(`/api/goods-receipt-headers/${invoice?.goodsReceiptId}/items`);
    return resp.json();
  }
});
```

### 2. Data Enrichment
Merged both data sources to create enriched items with complete information:

```typescript
const enrichedItems = invoiceItems.map(invItem => {
  const grItem = goodsReceiptItems.find((gr: any) => gr.id === invItem.goodsReceiptItemId);
  return {
    ...invItem,
    quantityExpected: grItem?.quantityExpected,
    quantityReceived: grItem?.quantityReceived,
    quantityDamaged: grItem?.quantityDamaged,
    quantityShort: grItem?.quantityShort,
    discrepancyReason: grItem?.discrepancyReason,
    scannedAt: grItem?.scannedAt,
    receivedAt: grItem?.receivedAt,
  };
});
```

### 3. Enhanced Display

#### New Goods Receipt Details Section
Added a dedicated indigo-colored section showing receiving information:

**Features:**
- 📦 **Expected Quantity** - What was ordered
- ✅ **Received Quantity** - What was actually received
- 🔴 **Damaged Quantity** - Items received in damaged condition
- 🟠 **Short Quantity** - Missing items
- 📝 **Discrepancy Reason** - Explanation for differences
- 🕒 **Timestamps** - Scanned and received dates/times

#### Complete Item Information Display

**1. Item Header:**
- Item icon badge
- Item description
- Color-coded badges:
  - �� Supplier Code
  - 🟣 Barcode
  - 🟢 Storage Location
  - Condition (color-coded: green for Good, red for Damaged)

**2. Goods Receipt Details Section (Indigo):**
- Expected vs Received quantities comparison
- Damaged and short quantities (if any)
- Discrepancy reasons
- Scan and receipt timestamps

**3. Invoice Details:**
- Invoiced quantity with unit of measure
- Unit price
- Discount (if applicable)
- Tax amount and rate

**4. Additional Information:**
- Batch number (monospace font)
- Expiry date
- Item notes

**5. Total Price:**
- Large, prominent display on the right

### 4. Visual Design

**Color Scheme:**
- **Indigo Section** - Goods receipt details
- **Blue Badges** - Supplier codes
- **Purple Badges** - Barcodes
- **Green Badges** - Storage locations
- **Condition Badges** - Color-coded based on status
- **Gray** - Standard invoice details

**Layout:**
- Card-based design with hover effects
- Responsive grid layouts
- Clear visual hierarchy
- Separated sections with borders

## Benefits

### 1. Complete Traceability
- View both invoice and goods receipt data in one place
- Track quantity discrepancies
- See receiving timeline

### 2. Quality Control
- Identify damaged items
- Track shortage reasons
- Monitor receiving accuracy

### 3. Audit Trail
- Timestamps for scanning and receiving
- Complete discrepancy documentation
- Linking invoice to actual receipts

### 4. Professional Presentation
- Clean, organized layout
- Color-coded information
- Easy to scan and understand

## Data Fields Displayed

### From Purchase Invoice Items:
- Item description, barcode, supplier code
- Invoiced quantity, unit price, total price
- Tax rate, tax amount
- Discount rate, discount amount
- Storage location
- Batch number, expiry date
- Condition, notes

### From Goods Receipt Items:
- Quantity expected
- Quantity received
- Quantity damaged
- Quantity short
- Discrepancy reason
- Scanned at timestamp
- Received at timestamp

## Usage

When viewing a purchase invoice:
1. System automatically fetches associated goods receipt items
2. Data is merged and enriched
3. Complete receiving history is displayed alongside invoice details
4. Users can see exact quantities expected vs received
5. Any discrepancies are clearly highlighted

## Technical Notes

- Uses React Query for efficient data fetching
- Conditional rendering based on data availability
- Proper TypeScript typing for all data structures
- Responsive design works on all screen sizes
- Performance optimized with proper query keys
