// Test script to create a sample purchase invoice for testing OCR extraction
import { storage } from './server/storage/index.js';

async function createTestInvoice() {
  try {
    console.log('Creating test purchase invoice...');
    
    // First, get a supplier (or create one if needed)
    const suppliers = await storage.getSuppliers();
    let supplier = suppliers[0];
    
    if (!supplier) {
      console.log('No suppliers found, creating test supplier...');
      supplier = await storage.createSupplier({
        name: 'Test Supplier Ltd',
        email: 'supplier@test.com',
        phone: '+1-555-0100',
        address: '123 Test Street',
        contactPerson: 'John Doe',
        paymentTerms: 'Net 30',
        status: 'Active',
        category: 'General',
      });
      console.log('Created test supplier:', supplier.id);
    } else {
      console.log('Using existing supplier:', supplier.id, supplier.name);
    }
    
    // Create test invoice
    const testInvoice = {
      invoiceNumber: 'PI-20251006-JM577',
      supplierInvoiceNumber: 'SUP-INV-2025-001',
      supplierId: supplier.id,
      status: 'Draft',
      paymentStatus: 'Unpaid',
      invoiceDate: new Date().toISOString(),
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
      receivedDate: new Date().toISOString(),
      subtotal: '1000.00',
      taxAmount: '100.00',
      discountAmount: '0.00',
      totalAmount: '1100.00',
      paidAmount: '0.00',
      remainingAmount: '1100.00',
      currency: 'USD',
      paymentTerms: 'Net 30 days',
      notes: 'Test invoice for OCR extraction testing',
    };
    
    // Create invoice with items
    const testItems = [
      {
        itemName: 'Widget A',
        description: 'High-quality widget',
        quantity: 10,
        unitPrice: '50.00',
        totalPrice: '500.00',
        taxAmount: '50.00',
      },
      {
        itemName: 'Widget B',
        description: 'Premium widget',
        quantity: 5,
        unitPrice: '100.00',
        totalPrice: '500.00',
        taxAmount: '50.00',
      },
    ];
    
    const createdInvoice = await storage.createPurchaseInvoice(testInvoice, testItems);
    
    console.log('✅ Test invoice created successfully!');
    console.log('Invoice Number:', createdInvoice.invoiceNumber);
    console.log('Invoice ID:', createdInvoice.id);
    console.log('Supplier:', supplier.name);
    console.log('Total Amount:', createdInvoice.totalAmount, createdInvoice.currency);
    console.log('\nYou can now test OCR with a document containing: "Invoice No : PI-20251006-JM577"');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating test invoice:', error);
    process.exit(1);
  }
}

createTestInvoice();
