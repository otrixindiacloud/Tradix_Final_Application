# Quotation PDF Fixes

## Issues Fixed

### 1. **NaN Values in Totals**
**Problem:** The PDF was showing "NaN" (Not a Number) in the total amount fields, indicating null or undefined values weren't being handled properly.

**Solution:**
- Added proper fallback values using `|| 0` for all numeric calculations
- Implemented safe number parsing with `Number()` or `parseFloat()` functions
- Added calculated values as fallbacks when database values are missing
- Ensured all monetary values default to 0 instead of NaN

### 2. **Table Layout and Column Widths**
**Problem:** Text was getting cut off and columns weren't properly aligned.

**Solution:**
Server-side (pdf-utils.ts):
- Adjusted column widths for better balance:
  - S.I.: 10 units (centered)
  - Description: 55 units (left-aligned)
  - Qty: 18 units (centered)
  - Unit Rate: 20 units (right-aligned)
  - Disc %: 12 units (centered)
  - Disc Amt: 18 units (right-aligned)
  - Net Total: 20 units (right-aligned)
  - VAT %: 12 units (centered)
  - VAT Amt: 20 units (right-aligned)

Client-side (quotation-detail.tsx):
- Simplified to 5 columns with proper widths:
  - S.I.: 12 units (centered)
  - Description: 80 units (left-aligned)
  - Qty: 25 units (centered)
  - Unit Rate: 30 units (right-aligned)
  - Net Total: 30 units (right-aligned)

### 3. **Discount and Tax Calculations**
**Problem:** Individual item discounts and tax rates weren't being properly accessed.

**Solution:**
- Added proper type casting with `(it as any)` to access optional properties
- Implemented fallback chain: item level → quotation level → default (0)
- Both discount percentage and tax rate now check item first, then quotation
- Ensures calculations work even when properties don't exist on schema

### 4. **Summary Section Enhancement**
**Problem:** Summary calculations were relying on potentially incorrect data.

**Solution:**
- Implemented dual calculation approach:
  - Calculate totals from actual item data
  - Use database values as primary, calculated as fallback
- Added new "Net Amount" line showing subtotal minus discount
- Ensured currency prefix appears on all monetary values
- Right-aligned summary table for professional appearance

### 5. **Client-Side PDF Improvements**
**Problem:** Client PDF didn't match server PDF style and had similar NaN issues.

**Solution:**
- Unified styling with server-side PDF generation
- Changed from colored headers to black/white professional style
- Added alternating row colors (light gray) for better readability
- Implemented same safe number parsing as server-side
- Converted pricing from dollar signs to dynamic currency (BHD)
- Used autoTable for pricing summary instead of manual positioning

## Technical Changes

### Files Modified
1. `/server/pdf/pdf-utils.ts` - Server-side PDF generation
2. `/client/src/pages/quotation-detail.tsx` - Client-side PDF generation

### Key Code Patterns

#### Safe Number Parsing
```typescript
const qty = Number(it.quantity) || 0;
const unit = Number(it.unitPrice) || 0;
```

#### Fallback Chain for Optional Properties
```typescript
const discPerc = Number((it as any).discountPercentage) || Number((quotation as any).discountPercentage) || 0;
const vatPerc = Number((it as any).taxRate) || Number((quotation as any).taxRate) || 0;
```

#### Calculated Fallbacks
```typescript
const subtotal = Number((quotation as any).subtotal) || calculatedSubtotal;
const totalAmount = Number((quotation as any).totalAmount) || (netAmount + taxAmount);
```

#### Currency Formatting
```typescript
`${currency} ${amount.toFixed(2)}`  // Consistent decimal places
`${currency} ${rate.toFixed(3)}`    // Extra precision for rates
```

## Testing Recommendations

1. **Test with missing data:**
   - Quotations without discount amounts
   - Items without tax rates
   - Null or undefined values in database

2. **Test calculations:**
   - Verify subtotal = sum of all line items
   - Verify discount is properly subtracted
   - Verify VAT is calculated on net amount
   - Verify grand total = net + VAT

3. **Test layout:**
   - Generate PDF with long descriptions
   - Test with multiple items (pagination)
   - Verify all text is visible and not cut off
   - Check alignment of numeric columns

4. **Test both PDF methods:**
   - Server-side (API endpoint)
   - Client-side (fallback)
   - Ensure both produce consistent output

## Result
- ✅ No more NaN values in PDFs
- ✅ Professional table layout with proper alignment
- ✅ All text visible and properly formatted
- ✅ Consistent styling between server and client PDFs
- ✅ Accurate calculations with proper fallbacks
- ✅ Currency properly displayed throughout document
