import { Express, Request, Response } from 'express';
import { storage } from '../storage';
import { generateInvoicePdf, generateQuotationPdf } from '../pdf/pdf-utils';
import { sendPdf } from '../utils/pdf-response';

export function registerEmailRoutes(app: Express) {
  console.log("[EMAIL ROUTES] Registering email routes...");

  // Send invoice via email
  app.post("/api/email/invoice/:id", async (req, res) => {
    try {
      const invoiceId = req.params.id;
      const { email, customMessage } = req.body;
      // const userId = getAttributingUserId(req); // Temporarily disabled

      // Get invoice data
      const invoice = await storage.getInvoice(invoiceId);
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }

      // Get customer information
      const customer = await storage.getCustomer(invoice.customerId);
      if (!customer) {
        return res.status(404).json({ message: "Customer not found" });
      }

      // Generate PDF
      const invoiceItems = await storage.getInvoiceItems(invoiceId);
      const enhancedItems = await Promise.all(
        invoiceItems.map(async (invoiceItem) => {
          let itemDetails = null;
          if (invoiceItem.itemId) {
            try {
              itemDetails = await storage.getItem(invoiceItem.itemId);
            } catch (error) {
              console.warn(`Could not fetch item details for ${invoiceItem.itemId}:`, error);
            }
          }
          return {
            ...invoiceItem,
            item: itemDetails
          };
        })
      );

      const pdfResult = generateInvoicePdf({
        invoice: invoice as any,
        items: enhancedItems as any,
        customer: customer as any,
        mode: 'enhanced'
      });

      // Generate a temporary download URL for the PDF
      const pdfBase64 = pdfResult.buffer.toString('base64');
      const pdfDataUrl = `data:application/pdf;base64,${pdfBase64}`;

      // Update invoice status to sent
      await storage.updateInvoice(invoiceId, { status: 'Sent' } as any);

      res.json({
        success: true,
        message: 'Invoice prepared for email sending',
        data: {
          invoiceId,
          customerEmail: customer.email || email,
          customerName: customer.name,
          documentNumber: invoice.invoiceNumber,
          pdfDataUrl,
          customMessage: customMessage || null
        }
      });
    } catch (error) {
      console.error("Error preparing invoice for email:", error);
      res.status(500).json({ 
        message: "Failed to prepare invoice for email",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Send quotation via email
  app.post("/api/email/quotation/:id", async (req, res) => {
    try {
      const quotationId = req.params.id;
      const { email, customMessage } = req.body;
      // const userId = getAttributingUserId(req); // Temporarily disabled

      // Get quotation data
      const quotation = await storage.getQuotation(quotationId);
      if (!quotation) {
        return res.status(404).json({ message: "Quotation not found" });
      }

      // Get customer information
      const customer = await storage.getCustomer(quotation.customerId);
      if (!customer) {
        return res.status(404).json({ message: "Customer not found" });
      }

      // Generate PDF
      const items = await storage.getQuotationItems(quotationId);
      const pdfResult = generateQuotationPdf({ 
        quotation: quotation as any, 
        items: items as any, 
        customer: customer as any 
      });

      // Generate a temporary download URL for the PDF
      const pdfBase64 = pdfResult.buffer.toString('base64');
      const pdfDataUrl = `data:application/pdf;base64,${pdfBase64}`;

      res.json({
        success: true,
        message: 'Quotation prepared for email sending',
        data: {
          quotationId,
          customerEmail: customer.email || email,
          customerName: customer.name,
          documentNumber: quotation.quoteNumber,
          pdfDataUrl,
          customMessage: customMessage || null
        }
      });
    } catch (error) {
      console.error("Error preparing quotation for email:", error);
      res.status(500).json({ 
        message: "Failed to prepare quotation for email",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Send proforma invoice via email
  app.post("/api/email/proforma-invoice/:id", async (req, res) => {
    try {
      const proformaId = req.params.id;
      const { email, customMessage } = req.body;
      // const userId = getAttributingUserId(req); // Temporarily disabled

      // Get proforma invoice data (assuming it's stored as invoice with type 'proforma')
      const invoice = await storage.getInvoice(proformaId);
      if (!invoice) {
        return res.status(404).json({ message: "Proforma invoice not found" });
      }

      // Get customer information
      const customer = await storage.getCustomer(invoice.customerId);
      if (!customer) {
        return res.status(404).json({ message: "Customer not found" });
      }

      // Generate PDF
      const invoiceItems = await storage.getInvoiceItems(proformaId);
      const enhancedItems = await Promise.all(
        invoiceItems.map(async (invoiceItem) => {
          let itemDetails = null;
          if (invoiceItem.itemId) {
            try {
              itemDetails = await storage.getItem(invoiceItem.itemId);
            } catch (error) {
              console.warn(`Could not fetch item details for ${invoiceItem.itemId}:`, error);
            }
          }
          return {
            ...invoiceItem,
            item: itemDetails
          };
        })
      );

      const pdfResult = generateInvoicePdf({
        invoice: invoice as any,
        items: enhancedItems as any,
        customer: customer as any,
        mode: 'enhanced'
      });

      // Generate a temporary download URL for the PDF
      const pdfBase64 = pdfResult.buffer.toString('base64');
      const pdfDataUrl = `data:application/pdf;base64,${pdfBase64}`;

      res.json({
        success: true,
        message: 'Proforma invoice prepared for email sending',
        data: {
          proformaId,
          customerEmail: customer.email || email,
          customerName: customer.name,
          documentNumber: invoice.invoiceNumber,
          pdfDataUrl,
          customMessage: customMessage || null
        }
      });
    } catch (error) {
      console.error("Error preparing proforma invoice for email:", error);
      res.status(500).json({ 
        message: "Failed to prepare proforma invoice for email",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Send goods receipt via email
  app.post("/api/email/goods-receipt/:id", async (req, res) => {
    try {
      const goodsReceiptId = req.params.id;
      const { email, customMessage } = req.body;
      // const userId = getAttributingUserId(req); // Temporarily disabled

      // Get goods receipt data
      // const goodsReceipt = await storage.getGoodsReceipt(goodsReceiptId); // Method not available
      const goodsReceipt = null; // Temporarily disabled
      if (!goodsReceipt) {
        return res.status(404).json({ message: "Goods receipt not found" });
      }

      // Get supplier information
      const supplier = await storage.getSupplier(goodsReceipt.supplierId);
      if (!supplier) {
        return res.status(404).json({ message: "Supplier not found" });
      }

      // For now, we'll create a simple PDF representation
      // In a real implementation, you'd have a generateGoodsReceiptPdf function
      const pdfContent = `Goods Receipt #${goodsReceipt.goodsReceiptNumber}\n\n` +
        `Supplier: ${supplier.supplierName}\n` +
        `Date: ${goodsReceipt.receiptDate}\n` +
        `Status: ${goodsReceipt.status}\n\n` +
        `This is a goods receipt document.`;

      const pdfBuffer = Buffer.from(pdfContent, 'utf-8');
      const pdfBase64 = pdfBuffer.toString('base64');
      const pdfDataUrl = `data:application/pdf;base64,${pdfBase64}`;

      res.json({
        success: true,
        message: 'Goods receipt prepared for email sending',
        data: {
          goodsReceiptId,
          supplierEmail: supplier.email || email,
          supplierName: supplier.supplierName,
          documentNumber: goodsReceipt.goodsReceiptNumber,
          pdfDataUrl,
          customMessage: customMessage || null
        }
      });
    } catch (error) {
      console.error("Error preparing goods receipt for email:", error);
      res.status(500).json({ 
        message: "Failed to prepare goods receipt for email",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Send sales order via email
  app.post("/api/email/sales-order/:id", async (req, res) => {
    try {
      const salesOrderId = req.params.id;
      const { email, customMessage } = req.body;
      // const userId = getAttributingUserId(req); // Temporarily disabled

      // Get sales order data
      const salesOrder = await storage.getSalesOrder(salesOrderId);
      if (!salesOrder) {
        return res.status(404).json({ message: "Sales order not found" });
      }

      // Get customer information
      const customer = await storage.getCustomer(salesOrder.customerId);
      if (!customer) {
        return res.status(404).json({ message: "Customer not found" });
      }

      // For now, we'll create a simple PDF representation
      // In a real implementation, you'd have a generateSalesOrderPdf function
      const pdfContent = `Sales Order #${salesOrder.salesOrderNumber}\n\n` +
        `Customer: ${customer.customerName || customer.name}\n` +
        `Date: ${salesOrder.orderDate}\n` +
        `Status: ${salesOrder.status}\n\n` +
        `This is a sales order document.`;

      const pdfBuffer = Buffer.from(pdfContent, 'utf-8');
      const pdfBase64 = pdfBuffer.toString('base64');
      const pdfDataUrl = `data:application/pdf;base64,${pdfBase64}`;

      res.json({
        success: true,
        message: 'Sales order prepared for email sending',
        data: {
          salesOrderId,
          customerEmail: customer.email || email,
          customerName: customer.name,
          documentNumber: salesOrder.salesOrderNumber,
          pdfDataUrl,
          customMessage: customMessage || null
        }
      });
    } catch (error) {
      console.error("Error preparing sales order for email:", error);
      res.status(500).json({ 
        message: "Failed to prepare sales order for email",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
}

