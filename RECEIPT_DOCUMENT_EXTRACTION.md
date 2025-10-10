# Receipt Document Extraction Feature with OCR

## Overview
The receipt creation wizard now includes **intelligent document processing with OCR (Optical Character Recognition)** that automatically extracts and populates invoice details from uploaded documents by reading the actual document content.

## How It Works

### Step 1: Document Upload
Users upload a receipt or invoice document (PDF, JPG, PNG, etc.)

### Step 2: Automatic OCR Processing
When moving from Step 1 to Step 2, the system performs a **two-tier extraction**:

#### Tier 1: OCR/PDF Text Extraction (Primary Method)
1. **Document Analysis**: Sends the uploaded file to the server for text extraction
   - **For PDFs**: Uses `pdf-parse` library to extract text directly
   - **For Images**: Uses Tesseract.js OCR engine to recognize text in the image

2. **Invoice Number Detection**: Scans the extracted text for invoice patterns:
   - `Invoice No : PI-20251006-JM577`
   - `Invoice Number: INV-123456`
   - `Invoice #: GR-789012`
   - `Bill No: 345678`
   - Standalone patterns like `PI-20251006-JM577`

3. **Database Lookup**: If an invoice number is found:
   - Searches the purchase invoices database for a matching invoice
   - Retrieves complete invoice details
   - Fetches associated invoice line items

4. **Auto-Fill**: Populates the receipt form with:
   - Invoice number and supplier invoice number
   - Invoice dates (invoice date, due date, received date)
   - Payment terms and notes
   - Payment status and amounts
   - Supplier information (name, ID)
   - LPO reference (if available)
   - All invoice line items (name, quantity, unit price, description)

#### Tier 2: Filename Pattern Matching (Fallback)
If OCR doesn't find an invoice number, the system falls back to:
- Extracting potential invoice numbers from the filename
- Supported patterns: `INV-123.pdf`, `INVOICE-456.jpg`, `PI-789.png`
- Same database lookup and auto-fill process

## Features

### ✅ Implemented
- **OCR text extraction** from images (JPG, PNG, GIF, WEBP)
- **PDF text parsing** for PDF documents
- **Intelligent invoice number detection** with multiple pattern matching
- Automatic invoice data retrieval from database
- Auto-population of all form fields
- Automatic loading of invoice items
- Two-tier extraction (OCR → filename fallback)
- Comprehensive error handling
- User-friendly notifications
- Real-time OCR progress tracking

### Supported Document Types
- **Images**: JPG, JPEG, PNG, GIF, WEBP
- **Documents**: PDF
- **File size limit**: 10MB

### Invoice Number Patterns Recognized
The system can detect invoice numbers in various formats:
- `Invoice No : PI-20251006-JM577`
- `Invoice Number: INV-123456`
- `Invoice #: GR-789012`
- `Bill No: 345678`
- `INV-123456` (standalone)
- `PI-20251006-JM577` (standalone)
- Case-insensitive matching
- Handles various separators and spacing

### User Experience
- **Invoice Found via OCR**: Shows success message with invoice number and item count
- **Invoice Found via Filename**: Shows success with source indicated
- **Invoice Not Found**: Friendly message suggesting manual entry with extracted number pre-filled
- **No Pattern Detected**: Prompts user to enter invoice number manually
- **OCR Progress**: Real-time progress indicator during text recognition
- Clear visual feedback throughout the process

## Testing the Feature

### Prerequisites
1. Ensure you have purchase invoices in your database
2. Upload actual invoice documents (PDFs or images with text)
3. For testing, use documents with clear "Invoice No:" or similar labels

### Test Cases

#### Test Case 1: Valid Invoice in PDF Document
```
Document: invoice_document.pdf containing "Invoice No : PI-20251006-JM577"
Expected: System extracts PI-20251006-JM577 via PDF parsing and auto-fills all details
```

#### Test Case 2: Valid Invoice in Image Document
```
Document: receipt.jpg containing "Invoice Number: INV-001"
Expected: System uses OCR to extract INV-001 and auto-fills all details
```

#### Test Case 3: Invoice Number Not Found in Database
```
Document: Contains "Invoice No: INV-999999"
Expected: OCR extracts number, but shows message that invoice not found in system
```

#### Test Case 4: No Invoice Pattern in Document
```
Document: Contains no clear invoice number pattern
Expected: Falls back to filename matching, or prompts manual entry
```

#### Test Case 5: Fallback to Filename
```
Document: receipt.pdf (no clear invoice in content)
Filename: INV-001.pdf
Expected: System tries OCR first, then falls back to filename extraction
```

#### Test Case 6: Manual Invoice Lookup
```
Action: User enters invoice number in the lookup field and clicks "Fetch"
Expected: Invoice details loaded and form populated
```

## Code Changes

### New Components

#### 1. Server-Side OCR/PDF Parsing (`/server/routes/document-extraction.ts`)
- **New API endpoint**: `POST /api/documents/extract-invoice`
- PDF text extraction using `pdf-parse` library
- Image OCR using Tesseract.js
- Multiple invoice number pattern matching
- Temporary file handling and cleanup

### Modified Functions

#### 1. `extractReceiptData()` (Client)
- Enhanced to use OCR/PDF parsing as primary method
- Sends document to server for text extraction
- Two-tier approach: OCR first, then filename fallback
- Calls `fetchInvoiceDetails()` when invoice number found
- Improved error handling and user feedback

#### 2. `fetchInvoiceDetails()` (Client)
- Improved error handling and logging
- Fetches invoice items automatically
- Maps invoice items to receipt items format
- Auto-fills all form fields with invoice data
- Shows contextual toast notifications

### API Endpoints Used
- `POST /api/documents/extract-invoice` - **NEW**: Extract text and find invoice number
- `GET /api/purchase-invoices/by-number/:invoiceNumber` - Fetch invoice by number
- `GET /api/purchase-invoices/:id/items` - Fetch invoice line items

### Dependencies Added
- `tesseract.js` - OCR engine for image text extraction
- `pdf-parse` - Already installed, used for PDF text parsing

## Error Handling

### Server Errors
- 404: Invoice not found (handled gracefully, user can enter manually)
- 500: Server error (logged, user notified to try manual entry)

### Client Errors
- File upload failure (logged as warning, non-blocking)
- Invalid filename pattern (handled, prompts manual entry)
- Network errors (caught and displayed to user)

## Usage Tips

### For Best Results
1. **Use clear documents**: Ensure text is readable and not blurry
2. **High resolution images**: Better image quality = better OCR accuracy
3. **Proper orientation**: Ensure document is right-side up
4. **Good lighting**: For photos, ensure adequate lighting and contrast
5. **Invoice in database**: The invoice must exist in the system first
6. **Standard formats**: Documents with "Invoice No:", "Invoice Number:", etc. work best
7. **Verify details**: Always review auto-filled data before submitting

### Supported Invoice Label Formats
The OCR can recognize these label variations:
- ✅ `Invoice No : PI-20251006-JM577`
- ✅ `Invoice Number: INV-123456`
- ✅ `Invoice # : GR-789012`
- ✅ `Bill No: 345678`
- ✅ `INVOICE NO: PI-456789`
- ✅ Standalone: `PI-20251006-JM577` (without label)

### Common Filename Patterns (Fallback)
- ✅ `INV-123.pdf`
- ✅ `INVOICE-456.jpg`
- ✅ `PI-789.png`
- ✅ `GR-012.pdf`

## Future Enhancements

### Potential Improvements
- Advanced AI/ML models for better accuracy
- Support for multi-page documents
- Extraction of additional fields (amounts, dates, supplier info)
- Language support beyond English
- Barcode/QR code scanning
- Support for more invoice number patterns
- Batch document processing
- Document thumbnail preview with extracted data highlights
- Confidence scores for extracted data
- Manual correction and learning from user edits

## Troubleshooting

### Issue: Invoice not found
**Solution**: 
- Verify the invoice exists in the purchase invoices database
- Check the document contains the exact invoice number
- Try manual invoice lookup using the invoice number field
- Ensure invoice number format matches database records

### Issue: OCR not extracting text
**Solution**:
- Ensure image is clear and readable
- Check image orientation (should be right-side up)
- Try higher resolution image
- Ensure adequate lighting/contrast for photos
- PDFs with text work better than scanned images
- Check console logs for OCR progress/errors

### Issue: Wrong invoice number extracted
**Solution**:
- Manually correct the invoice number in the lookup field
- Check if document has multiple numbers (system picks first match)
- Ensure invoice number has clear label ("Invoice No:", etc.)
- Review console logs to see what was extracted

### Issue: OCR is slow
**Solution**:
- OCR processing can take 10-30 seconds for images
- Progress indicator shows real-time status
- PDFs are generally faster than image OCR
- Consider using smaller/optimized images
- System continues to process in background

### Issue: Items not loading
**Solution**:
- Verify the invoice has associated items in the database
- Check browser console for API errors
- Items can be added manually if auto-load fails

## Support

For issues or questions:
1. Check browser console for detailed error logs
2. Review server logs for API errors
3. Verify database connectivity and data integrity
4. Test with a known good invoice number

---

**Last Updated**: October 10, 2025
**Feature Status**: ✅ Active and Working
