import type { Express } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import Tesseract from "tesseract.js";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
// pdf-parse is a CJS module, so require interop keeps typing simple
const pdfParse: (dataBuffer: Buffer) => Promise<{ text: string }> = require("pdf-parse");

const uploadsDir = path.join(process.cwd(), "uploads");

// Ensure uploads directory exists
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for temporary file storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueId = uuidv4();
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueId}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

/**
 * Extract invoice number from text using various patterns
 */
function extractInvoiceNumber(text: string): string | null {
  console.log('[extractInvoiceNumber] Analyzing text for invoice patterns...');
  
  // Common invoice number patterns
  const patterns = [
    // Pattern 1: "Invoice No : PI-20251006-JM577" or "Invoice No: PI-20251006-JM577"
    /Invoice\s*No\s*:?\s*([A-Z0-9\-]+)/i,
    // Pattern 2: "Invoice Number: PI-20251006-JM577"
    /Invoice\s*Number\s*:?\s*([A-Z0-9\-]+)/i,
    // Pattern 3: "Invoice #: PI-20251006-JM577"
    /Invoice\s*#\s*:?\s*([A-Z0-9\-]+)/i,
    // Pattern 4: "INV-123456" or "PI-123456" standalone
    /\b(INV|INVOICE|PI|GR|PO)-?[\s]?([A-Z0-9\-]+)\b/i,
    // Pattern 5: "Bill No: 123456"
    /Bill\s*No\s*:?\s*([A-Z0-9\-]+)/i,
    // Pattern 6: Generic pattern for formats like "PI-20251006-JM577"
    /\b([A-Z]{2,4}[-_]\d{8}[-_][A-Z0-9]+)\b/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      // For pattern 4, combine the prefix and number
      if (pattern.source.includes('(INV|INVOICE|PI|GR|PO)')) {
        const invoiceNumber = match[1] && match[2] ? `${match[1]}-${match[2]}` : match[0];
        console.log('[extractInvoiceNumber] Found invoice number:', invoiceNumber);
        return invoiceNumber.trim();
      }
      const invoiceNumber = match[1] || match[0];
      console.log('[extractInvoiceNumber] Found invoice number:', invoiceNumber);
      return invoiceNumber.trim();
    }
  }

  console.log('[extractInvoiceNumber] No invoice number found');
  return null;
}

/**
 * Extract text from PDF document
 */
async function extractTextFromPDF(filePath: string): Promise<string> {
  console.log('[extractTextFromPDF] Processing PDF:', filePath);
  try {
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdfParse(dataBuffer);
    console.log('[extractTextFromPDF] Extracted text length:', data.text.length);
    return data.text;
  } catch (error) {
    console.error('[extractTextFromPDF] Error:', error);
    throw new Error('Failed to extract text from PDF');
  }
}

/**
 * Extract text from image using OCR
 */
async function extractTextFromImage(filePath: string): Promise<string> {
  console.log('[extractTextFromImage] Processing image with OCR:', filePath);
  try {
    const result = await Tesseract.recognize(filePath, 'eng', {
      logger: (m) => {
        if (m.status === 'recognizing text') {
          console.log(`[OCR Progress] ${Math.round(m.progress * 100)}%`);
        }
      },
    });
    console.log('[extractTextFromImage] OCR completed. Text length:', result.data.text.length);
    return result.data.text;
  } catch (error) {
    console.error('[extractTextFromImage] Error:', error);
    throw new Error('Failed to extract text from image');
  }
}

export function registerDocumentExtractionRoutes(app: Express) {
  /**
   * Extract invoice details from uploaded document
   * POST /api/documents/extract-invoice
   */
  app.post("/api/documents/extract-invoice", upload.single('file'), async (req, res) => {
    let tempFilePath: string | null = null;
    
    try {
      console.log('[EXTRACT-INVOICE] Request received');
      
      if (!req.file) {
        return res.status(400).json({ 
          success: false,
          message: "No file uploaded" 
        });
      }

      tempFilePath = req.file.path;
      const fileType = req.file.mimetype;
      console.log('[EXTRACT-INVOICE] File type:', fileType);
      console.log('[EXTRACT-INVOICE] File path:', tempFilePath);

      let extractedText = '';

      // Extract text based on file type
      if (fileType === 'application/pdf') {
        extractedText = await extractTextFromPDF(tempFilePath);
      } else if (fileType.startsWith('image/')) {
        extractedText = await extractTextFromImage(tempFilePath);
      } else {
        return res.status(400).json({ 
          success: false,
          message: "Unsupported file type. Please upload PDF or image files." 
        });
      }

      console.log('[EXTRACT-INVOICE] Extracted text preview:', extractedText.substring(0, 200));

      // Extract invoice number from the text
      const invoiceNumber = extractInvoiceNumber(extractedText);

      if (!invoiceNumber) {
        return res.json({
          success: false,
          message: "Could not find invoice number in document",
          extractedText: extractedText.substring(0, 500), // Return preview for debugging
        });
      }

      console.log('[EXTRACT-INVOICE] Successfully extracted invoice number:', invoiceNumber);

      res.json({
        success: true,
        invoiceNumber: invoiceNumber,
        extractedText: extractedText.substring(0, 500), // Return preview
        message: `Successfully extracted invoice number: ${invoiceNumber}`,
      });

    } catch (error) {
      console.error('[EXTRACT-INVOICE] Error:', error);
      res.status(500).json({ 
        success: false,
        message: "Failed to extract invoice details", 
        error: (error as Error).message 
      });
    } finally {
      // Clean up temporary file
      if (tempFilePath && fs.existsSync(tempFilePath)) {
        try {
          fs.unlinkSync(tempFilePath);
          console.log('[EXTRACT-INVOICE] Cleaned up temporary file');
        } catch (cleanupError) {
          console.error('[EXTRACT-INVOICE] Failed to clean up temp file:', cleanupError);
        }
      }
    }
  });
}

export default registerDocumentExtractionRoutes;
