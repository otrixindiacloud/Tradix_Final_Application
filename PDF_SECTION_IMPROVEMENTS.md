# PDF Address & Contact Section Improvements

## Summary
Updated all three PDF generators (Invoice, Quotation, Purchase Invoice) to have professional formatting for the Customer/Supplier Name & Address and Contact Person sections.

## Changes Made

### 1. **Two-Row Table Format**
- **Before**: Single row with combined header and content
- **After**: Separate header row and content row for better visual hierarchy

### 2. **Bold Headers**
- Headers are now **bold** and in a larger font size (8pt vs 7pt)
- Clear separation between label and content

### 3. **Professional Spacing**
- Custom cell padding for better readability:
  - Header: `{ top: 3, left: 5, right: 5, bottom: 1 }`
  - Content: `{ top: 1, left: 5, right: 5, bottom: 3 }`

### 4. **Clean Data Handling**
- Filters out 'N/A' values when building blocks
- Shows only available information
- Fallback messages: "No information available" / "No contact information"

### 5. **Better Visual Appearance**
- Light gray borders: `lineColor: [200, 200, 200]`
- Thinner lines: `lineWidth: 0.1`
- Left-aligned text for natural reading

### 6. **Consistent Across All PDFs**

#### Invoice PDF
- Customer Name & Address
- Customer Contact Person

#### Quotation PDF
- Customer Name & Address
- Customer Contact Person

#### Purchase Invoice PDF
- Supplier Name & Address
- Supplier Contact Person

## Result

**Before:**
```
Customer Name & Address:
roshan
deewan
roshan@gmail.com
789654485644
```

**After:**
```
╔════════════════════════════════════╦════════════════════════════════════╗
║ Customer Name & Address:           ║ Customer Contact Person:           ║
╠════════════════════════════════════╬════════════════════════════════════╣
║ roshan                             ║ roshan                             ║
║ deewan                             ║ roshan@gmail.com                   ║
║ roshan@gmail.com                   ║ 789654485644                       ║
║ 789654485644                       ║                                    ║
╚════════════════════════════════════╩════════════════════════════════════╝
```

## Technical Details

### Structure
```typescript
autoTable(doc, {
  startY: afterMeta,
  body: [
    [ 
      { content: 'Customer Name & Address:', styles: { fontStyle: 'bold', fontSize: 8, ... } }, 
      { content: 'Customer Contact Person:', styles: { fontStyle: 'bold', fontSize: 8, ... } }
    ],
    [ 
      { content: addressBlock, styles: { fontSize: 7, ... } }, 
      { content: contactBlock, styles: { fontSize: 7, ... } }
    ]
  ],
  styles: { cellPadding: 0, lineColor: [200, 200, 200], lineWidth: 0.1 },
  columnStyles: { 0: { cellWidth: (pageWidth-30)/2 }, 1: { cellWidth: (pageWidth-30)/2 } },
  theme: 'grid',
  margin: { left: 15, right: 15 }
});
```

## Files Modified
- `/server/pdf/pdf-utils.ts`
  - `buildEnhancedInvoicePdf()` - Lines ~130-180
  - `generateQuotationPdf()` - Lines ~408-458
  - `buildEnhancedPurchaseInvoicePdf()` - Lines ~713-763

## Testing
Test the PDFs by:
1. **Invoice**: Go to Invoicing page → Click download PDF icon
2. **Quotation**: Go to Quotations page → Click download PDF icon
3. **Purchase Invoice**: Go to Purchase Invoices page → Click download PDF icon

All three should now show professional, well-formatted address and contact sections.
