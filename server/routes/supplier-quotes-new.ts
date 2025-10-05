import { Request, Response, type Express } from "express";
import { z } from "zod";
import { SupplierQuoteStorage } from "../storage/supplier-quote-storage-new";
import { db, pool } from "../db";
import { suppliers, enquiries, enquiryItems, customers, quotations, quotationItems, supplierQuotes, supplierQuoteItems } from "@shared/schema";
import { eq } from "drizzle-orm";
import { BaseStorage } from "../storage/base";
import { SYSTEM_USER_ID } from "@shared/utils/uuid";
import { randomUUID } from "crypto";

// Validation schemas
const supplierQuoteSearchSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  search: z.string().optional(),
  status: z.string().optional(),
  priority: z.string().optional(),
  supplier: z.string().optional(),
  currency: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

const supplierQuoteCreateSchema = z.object({
  supplierId: z.string().uuid(),
  customerId: z.string().uuid().optional(),
  enquiryId: z.string().uuid().optional(),
  priority: z.enum(["Low", "Medium", "High", "Urgent"]).default("Medium"),
  validUntil: z.string(),
  paymentTerms: z.string(),
  deliveryTerms: z.string(),
  notes: z.string().optional(),
  rfqNumber: z.string().optional(),
  currency: z.enum(["BHD", "AED", "USD", "EUR", "GBP"]).default("BHD"),
  items: z.array(z.object({
    itemDescription: z.string(),
    quantity: z.number().positive(),
    unitOfMeasure: z.string(),
    unitPrice: z.number().positive(),
    specification: z.string().optional(),
    brand: z.string().optional(),
    model: z.string().optional(),
    warranty: z.string().optional(),
    leadTime: z.string().optional(),
  })).optional()
});

const supplierQuoteUpdateSchema = z.object({
  supplierId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional().or(z.literal("")),
  status: z.enum(["Draft", "Sent", "Accepted", "Rejected", "Expired"]).optional(),
  priority: z.enum(["Low", "Medium", "High", "Urgent"]).optional(),
  validUntil: z.string().optional(),
  responseDate: z.string().optional(),
  totalAmount: z.string().optional(),
  currency: z.enum(["BHD", "AED", "USD", "EUR", "GBP"]).optional(),
  paymentTerms: z.string().optional(),
  deliveryTerms: z.string().optional(),
  notes: z.string().optional(),
  rfqNumber: z.string().optional(),
  evaluationScore: z.number().min(0).max(10).optional(),
  competitiveRank: z.number().positive().optional(),
});

export function registerSupplierQuoteRoutes(app: Express) {
  
  // Get all supplier quotes with filtering
  app.get("/api/supplier-quotes", async (req: Request, res: Response) => {
    try {
      const params = supplierQuoteSearchSchema.parse(req.query);
      const quotes = await SupplierQuoteStorage.list(params);
      const totalCount = await SupplierQuoteStorage.getCount(params);
      
      res.json({
        data: quotes,
        total: totalCount,
        page: params.page,
        limit: params.limit,
        totalPages: Math.ceil(totalCount / params.limit)
      });
    } catch (error) {
      console.error("Error fetching supplier quotes:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to fetch supplier quotes" });
    }
  });

  // Get supplier quote by ID
  app.get("/api/supplier-quotes/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const quote = await SupplierQuoteStorage.getById(id);
      if (!quote) {
        return res.status(404).json({ message: "Supplier quote not found" });
      }
      res.json(quote);
    } catch (error) {
      console.error("Error fetching supplier quote:", error);
      res.status(500).json({ message: "Failed to fetch supplier quote" });
    }
  });

  // Test database connection and table structure
  app.get("/api/test-db", async (req: Request, res: Response) => {
    try {
      console.log("Pool object:", pool);
      console.log("Pool type:", typeof pool);
      if (!pool) {
        return res.status(500).json({ error: "Pool is undefined" });
      }
      const result = await pool.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name LIKE '%supplier%'
        ORDER BY table_name
      `);
      res.json({ tables: result.rows });
    } catch (error) {
      console.error("Database test error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get supplier quote items
  app.get("/api/supplier-quotes/:id/items", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      console.log('Fetching items for quote ID:', id);
      const items = await SupplierQuoteStorage.getItems(id);
      console.log('Items fetched:', items);
      res.json(items);
    } catch (error) {
      console.error("Error fetching supplier quote items:", error);
      res.status(500).json({ message: "Failed to fetch supplier quote items", error: error.message });
    }
  });

  // Create new supplier quote
  app.post("/api/supplier-quotes", async (req: Request, res: Response) => {
    try {
      const data = supplierQuoteCreateSchema.parse(req.body);
      
      // Validate supplier exists
      const supplier = await db.select().from(suppliers).where(eq(suppliers.id, data.supplierId)).limit(1);
      if (supplier.length === 0) {
        return res.status(400).json({ message: "Supplier not found" });
      }
      
      // Calculate totals
      let subtotal = 0;
      let totalAmount = 0;
      
      if (data.items && data.items.length > 0) {
        for (const item of data.items) {
          const itemTotal = item.quantity * item.unitPrice;
          subtotal += itemTotal;
        }
        totalAmount = subtotal; // Add tax calculation if needed
      }
      
      const quoteData = {
        ...data,
        subtotal: subtotal.toString(),
        totalAmount: totalAmount.toString(),
        quoteDate: new Date().toISOString(),
      };
      
      const newQuote = await SupplierQuoteStorage.create(quoteData);
      res.status(201).json(newQuote);
    } catch (error) {
      console.error("Error creating supplier quote:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create supplier quote" });
    }
  });

  // Update supplier quote
  app.patch("/api/supplier-quotes/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      console.log('Updating supplier quote:', id, 'with data:', req.body);
      
      const data = supplierQuoteUpdateSchema.parse(req.body);
      console.log('Parsed data:', data);
      
      // Check if the quote exists first
      const existingQuote = await SupplierQuoteStorage.getById(id);
      if (!existingQuote) {
        console.log('Quote not found:', id);
        return res.status(404).json({ message: "Supplier quote not found" });
      }
      console.log('Existing quote found:', existingQuote.id);
      
      // Validate supplier if provided
      if (data.supplierId) {
        console.log('Validating supplier ID:', data.supplierId);
        const supplier = await db.select().from(suppliers).where(eq(suppliers.id, data.supplierId)).limit(1);
        console.log('Supplier query result:', supplier);
        if (supplier.length === 0) {
          console.log('Supplier not found:', data.supplierId);
          return res.status(400).json({ message: "Supplier not found" });
        }
        console.log('Supplier validated:', data.supplierId);
      }
      
      // Process the update data
      const processedData: any = {};
      
       // Map fields
       if (data.supplierId) processedData.supplierId = data.supplierId;
       if (data.customerId && data.customerId !== "") processedData.customerId = data.customerId;
       if (data.status) processedData.status = data.status;
       if (data.priority) processedData.priority = data.priority;
       if (data.currency) processedData.currency = data.currency;
       if (data.notes) processedData.notes = data.notes;
       if (data.rfqNumber) processedData.rfqNumber = data.rfqNumber;
       if (data.evaluationScore) processedData.evaluationScore = data.evaluationScore.toString();
       if (data.competitiveRank) processedData.competitiveRank = data.competitiveRank;
      
      if (data.validUntil) {
        try {
          processedData.validUntil = new Date(data.validUntil);
        } catch (error) {
          console.error("Invalid date format for validUntil:", data.validUntil);
          return res.status(400).json({ message: "Invalid date format for validUntil" });
        }
      }
      
      if (data.responseDate) {
        try {
          processedData.responseDate = new Date(data.responseDate);
        } catch (error) {
          console.error("Invalid date format for responseDate:", data.responseDate);
          return res.status(400).json({ message: "Invalid date format for responseDate" });
        }
      }
      
      if (data.totalAmount) {
        try {
          processedData.totalAmount = parseFloat(data.totalAmount).toString();
        } catch (error) {
          console.error("Invalid totalAmount format:", data.totalAmount);
          return res.status(400).json({ message: "Invalid totalAmount format" });
        }
      }
      
      // Handle payment and delivery terms
      if (data.paymentTerms || data.deliveryTerms) {
        const terms = [];
        if (data.paymentTerms) terms.push(`Payment Terms: ${data.paymentTerms}`);
        if (data.deliveryTerms) terms.push(`Delivery Terms: ${data.deliveryTerms}`);
        processedData.terms = terms.join('\n');
      }
      
      // Validate that we have at least one field to update
      if (Object.keys(processedData).length === 0) {
        console.log('No valid fields to update');
        return res.status(400).json({ message: "No valid fields to update" });
      }
      
      console.log('Processed data for update:', processedData);
      
      const updatedQuote = await SupplierQuoteStorage.update(id, processedData);
      if (!updatedQuote) {
        return res.status(404).json({ message: "Supplier quote not found after update" });
      }
      console.log('Update successful:', updatedQuote.id);
      res.json(updatedQuote);
    } catch (error) {
      console.error("Error updating supplier quote:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      // Provide more specific error information
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      res.status(500).json({ 
        message: "Failed to update supplier quote", 
        error: errorMessage 
      });
    }
  });

  // Delete supplier quote
  app.delete("/api/supplier-quotes/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      // Check if quote exists
      const existingQuote = await SupplierQuoteStorage.getById(id);
      if (!existingQuote) {
        return res.status(404).json({ message: "Supplier quote not found" });
      }
      
      // Check for references
      const hasRefs = await SupplierQuoteStorage.hasReferences(id);
      if (hasRefs) {
        return res.status(400).json({ message: "Cannot delete supplier quote with existing references" });
      }
      
      await SupplierQuoteStorage.delete(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting supplier quote:", error);
      res.status(500).json({ message: "Failed to delete supplier quote" });
    }
  });

  // Generate RFQ number
  app.get("/api/supplier-quotes/generate-rfq", async (req: Request, res: Response) => {
    try {
      const rfqNumber = `RFQ-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
      res.json({ rfqNumber });
    } catch (error) {
      console.error("Error generating RFQ number:", error);
      res.status(500).json({ message: "Failed to generate RFQ number" });
    }
  });

  // Create supplier quote request from enquiry (customer-quotes endpoint)
  app.post("/api/customer-quotes", async (req: Request, res: Response) => {
    try {
      const { enquiryId, customerId, suppliers, items, paymentTerms, deliveryTerms, priority, currency } = req.body;

      if (!enquiryId || !customerId || !suppliers || !Array.isArray(suppliers) || suppliers.length === 0) {
        return res.status(400).json({ 
          message: "Missing required fields: enquiryId, customerId, and suppliers array are required" 
        });
      }

      // Get enquiry with customer details
      const enquiry = await db
        .select({
          id: enquiries.id,
          enquiryNumber: enquiries.enquiryNumber,
          customerId: enquiries.customerId,
          enquiryDate: enquiries.enquiryDate,
          status: enquiries.status,
          notes: enquiries.notes,
          targetDeliveryDate: enquiries.targetDeliveryDate,
          customer: {
            id: customers.id,
            name: customers.name,
            email: customers.email,
            phone: customers.phone,
            address: customers.address,
            customerType: customers.customerType,
          }
        })
        .from(enquiries)
        .leftJoin(customers, eq(enquiries.customerId, customers.id))
        .where(eq(enquiries.id, enquiryId))
        .limit(1);

      if (!enquiry.length) {
        return res.status(404).json({ message: "Enquiry not found" });
      }

      const enquiryData = enquiry[0];

      // Get enquiry items from database using raw SQL
      const enquiryItemsResult = await pool.query(
        'SELECT * FROM enquiry_items WHERE enquiry_id = $1',
        [enquiryId]
      );
      const enquiryItemsList = enquiryItemsResult.rows;

      // Use items from request if provided, otherwise use enquiry items from database
      let itemsToUse = items;
      if (!itemsToUse || itemsToUse.length === 0) {
        // Convert enquiry items to the format expected by supplier quote
        itemsToUse = enquiryItemsList.map(item => ({
          itemDescription: item.description || '',
          quantity: item.quantity || 1,
          unitOfMeasure: 'pcs', // Default since enquiry_items doesn't have unitOfMeasure
          unitPrice: parseFloat(item.unit_price) || 0,
          specification: item.notes || '',
          brand: '',
          model: '',
          warranty: '',
          leadTime: ''
        }));
      }

      // Validate all suppliers exist (simplified validation for now)
      const supplierIds = suppliers.map(s => s.supplierId);
      console.log('Validating suppliers:', supplierIds);
      
      // For now, just validate that we have supplier IDs
      if (supplierIds.length === 0) {
        return res.status(400).json({ message: "No suppliers provided" });
      }

      // Build supplier names string for notes
      const supplierNames = suppliers.map(s => s.supplierName).join(', ');

      // Generate unique quote number
      const baseStorage = new (BaseStorage as any)();
      let quoteNumber: string;
      let attempts = 0;
      const maxAttempts = 10;
      
      do {
        quoteNumber = baseStorage.generateNumber("QT");
        
        // Check if this number already exists
        const existing = await db.select({ id: quotations.id }).from(quotations).where(eq(quotations.quoteNumber, quoteNumber)).limit(1);
        if (existing.length === 0) break;
        
        attempts++;
      } while (attempts < maxAttempts);
      
      if (attempts >= maxAttempts) {
        throw new Error("Failed to generate unique quotation number");
      }

      // Create supplier quote requests for each selected supplier using raw SQL
      const createdSupplierQuotes = [];
      
      for (const supplier of suppliers) {
        const supplierQuoteId = randomUUID();
        const supplierQuoteNumber = `${quoteNumber}-${supplier.supplierId.slice(-4)}`;
        
        // Calculate totals from items
        let subtotal = 0;
        let totalAmount = 0;
        
        if (itemsToUse && itemsToUse.length > 0) {
          subtotal = itemsToUse.reduce((sum: number, item: any) => {
            const itemTotal = (item.quantity || 0) * (item.unitPrice || 0);
            return sum + itemTotal;
          }, 0);
          totalAmount = subtotal; // For now, no tax or discount
        }

        // Insert supplier quote using raw SQL to avoid schema issues
        await pool.query(`
          INSERT INTO supplier_quotes (
            id, quote_number, supplier_id, status, priority, 
            valid_until, subtotal, discount_percentage, discount_amount, 
            tax_amount, total_amount, currency, terms, notes, 
            payment_terms, delivery_terms, created_by, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW(), NOW())
        `, [
          supplierQuoteId,
          supplierQuoteNumber,
          supplier.supplierId,
          'Draft',
          priority || 'Medium',
          new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
          subtotal.toString(),
          '0',
          '0',
          '0',
          totalAmount.toString(),
          currency || 'USD',
          `Quote request for enquiry ${enquiryData.enquiryNumber}`,
          `Quote request for enquiry ${enquiryData.enquiryNumber} from customer ${enquiryData.customer?.name || 'Unknown'}`,
          paymentTerms || 'Net 30',
          deliveryTerms || 'FOB Destination',
          SYSTEM_USER_ID
        ]);

        // Create supplier quote items if provided
        if (itemsToUse && itemsToUse.length > 0) {
          for (let i = 0; i < itemsToUse.length; i++) {
            const item = itemsToUse[i];
            const itemTotal = (item.quantity || 0) * (item.unitPrice || 0);
            
            await pool.query(`
              INSERT INTO supplier_quote_items (
                id, supplier_quote_id, item_description, quantity, 
                unit_of_measure, unit_price, line_total, specification, 
                brand, model, warranty, lead_time, created_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
            `, [
              randomUUID(),
              supplierQuoteId,
              item.itemDescription || '',
              item.quantity || 0,
              item.unitOfMeasure || 'pcs',
              (item.unitPrice || 0).toString(),
              itemTotal.toString(),
              item.specification || '',
              item.brand || '',
              item.model || '',
              item.warranty || '',
              item.leadTime || ''
            ]);
          }
        }

        createdSupplierQuotes.push({
          id: supplierQuoteId,
          quoteNumber: supplierQuoteNumber,
          supplierId: supplier.supplierId
        });
      }

      // Return success response with created quote details
      res.status(201).json({
        message: "Quote request sent successfully",
        supplierQuotes: createdSupplierQuotes.map(sq => ({
          id: sq.id,
          quoteNumber: sq.quoteNumber,
          supplierId: sq.supplierId
        })),
        enquiryId: enquiryId,
        suppliers: suppliers.map(s => ({ id: s.supplierId, name: s.supplierName })),
        customerName: enquiryData.customer?.name || 'Unknown',
        enquiryNumber: enquiryData.enquiryNumber,
        itemsCount: itemsToUse ? itemsToUse.length : enquiryItemsList.length,
      });

    } catch (error) {
      console.error("Error creating customer quote request:", error);
      res.status(500).json({ 
        message: "Failed to create quote request", 
        error: error instanceof Error ? error.message : "Unknown error" 
      });
    }
  });
}
