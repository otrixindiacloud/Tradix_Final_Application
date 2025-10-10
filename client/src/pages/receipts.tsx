import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import DataTable from "@/components/tables/data-table";
import {
  Package,
  Plus,
  Search,
  Filter,
  Edit,
  Eye,
  CheckCircle,
  Clock,
  Trash,
  XCircle,
  AlertTriangle,
  User,
  Calendar,
  DollarSign,
  FileText,
  TrendingUp,
  Building2,
  Truck,
  Scan,
  ClipboardCheck,
  Loader2
} from "lucide-react";

// Utility function to format date strings as "YYYY-MM-DD"
function formatDate(dateStr?: string) {
  if (!dateStr) return "N/A";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

// Form schemas
const goodsReceiptSchema = z.object({
  receiptNumber: z.string().min(1, "Receipt number is required"),
  supplierLpoId: z.string().min(1, "Supplier LPO is required"),
  supplierId: z.string().min(1, "Supplier is required"),
  receiptDate: z.string().min(1, "Receipt date is required"),
  receivedBy: z.string().min(1, "Received by is required"),
  status: z.enum(["Pending", "Partial", "Completed", "Discrepancy"]),
  notes: z.string().optional(),
});

type GoodsReceiptForm = z.infer<typeof goodsReceiptSchema>;

type InvoiceHeaderDetails = {
  invoiceNumber: string;
  supplierInvoiceNumber?: string;
  invoiceDate?: string;
  dueDate?: string;
  receivedDate?: string;
  paymentTerms?: string;
  notes?: string;
  paymentStatus?: string;
  totalAmount?: string;
  currency?: string;
  supplierName?: string;
  supplierId?: string;
  lpoId?: string;
};

// Status badge colors


const getStatusIcon = (status: string) => {
  switch (status) {
    case "Pending":
      return <Clock className="h-4 w-4 text-yellow-600" />;
    case "Partial":
      return <Truck className="h-4 w-4 text-blue-600" />;
    case "Complete":
      return <CheckCircle className="h-4 w-4 text-green-600" />;
    case "Discrepancy":
      return <AlertTriangle className="h-4 w-4 text-red-600" />;
    case "Draft":
      return <Clock className="h-4 w-4 text-gray-600" />;
    case "Pending Approval":
      return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
    case "Approved":
      return <CheckCircle className="h-4 w-4 text-green-600" />;
    case "Paid":
      return <CheckCircle className="h-4 w-4 text-green-600" />;
    case "Partially Paid":
      return <Clock className="h-4 w-4 text-blue-600" />;
    case "Overdue":
      return <XCircle className="h-4 w-4 text-red-600" />;
    case "Disputed":
      return <AlertTriangle className="h-4 w-4 text-red-600" />;
    case "Cancelled":
      return <XCircle className="h-4 w-4 text-gray-600" />;
    default:
      return <Clock className="h-4 w-4 text-gray-600" />;
  }
};

const getStatusBadge = (status: string) => {
  let colorClass = "text-gray-600 border-gray-300 bg-gray-50";
  let icon = getStatusIcon(status);
  switch (status) {
    case "Pending":
      colorClass = "text-yellow-600 border-yellow-300 bg-yellow-50";
      icon = <Clock className="h-4 w-4 text-yellow-600" />;
      break;
    case "Partial":
      colorClass = "text-blue-600 border-blue-300 bg-blue-50";
      icon = <Truck className="h-4 w-4 text-blue-600" />;
      break;
    case "Completed":
      colorClass = "text-green-600 border-green-300 bg-green-50";
      icon = <CheckCircle className="h-4 w-4 text-green-600" />;
      break;
    case "Discrepancy":
      colorClass = "text-red-600 border-red-300 bg-red-50";
      icon = <AlertTriangle className="h-4 w-4 text-red-600" />;
      break;
    case "Draft":
      colorClass = "text-yellow-600 border-yellow-300 bg-yellow-50";
      icon = <Clock className="h-4 w-4 text-yellow-600" />;
      break;
    default:
      colorClass = "text-gray-600 border-gray-300 bg-gray-50";
      icon = <Clock className="h-4 w-4 text-gray-600" />;
  }
  return (
    <Badge variant="outline" className={`${colorClass} flex items-center  gap-1 px-3 py-1 font-semibold`}>
      {icon}
      <span className="ml-0 ">{status}</span>
    </Badge>
  );
};

export default function ReceiptsPage() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [isExtractingData, setIsExtractingData] = useState(false);
  const [receiptItems, setReceiptItems] = useState<any[]>([]);
  const [currentItem, setCurrentItem] = useState({
    itemName: "",
    quantity: "",
    unitPrice: "",
    description: ""
  });
  const [invoiceLookupValue, setInvoiceLookupValue] = useState("");
  const [invoiceDetails, setInvoiceDetails] = useState<InvoiceHeaderDetails | null>(null);
  const [isFetchingInvoice, setIsFetchingInvoice] = useState(false);
  const [invoiceFetchError, setInvoiceFetchError] = useState<string | null>(null);
  
  // Fetch supplier LPOs for dropdown
  const { data: supplierLpos = [], isLoading: lpoLoading } = useQuery({
    queryKey: ["supplier-lpos"],
    queryFn: async () => {
      const data = await apiRequest("GET", "/api/supplier-lpos");
      return Array.isArray(data) ? data : [];
    },
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedReceipt, setSelectedReceipt] = useState<any | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editForm, setEditForm] = useState<any | null>(null);

  // Sync form values with editForm when opening the edit dialog
  React.useEffect(() => {
    if (showEditDialog && editForm) {
      form.setValue("receiptNumber", editForm.receiptNumber || "");
      form.setValue("supplierLpoId", editForm.supplierLpoId || "");
      form.setValue("receiptDate", editForm.receiptDate || "");
      form.setValue("receivedBy", editForm.receivedBy || "");
      form.setValue("status", editForm.status || "Pending");
      form.setValue("notes", editForm.notes || "");
    }
    // Reset form when dialog closes
    if (!showEditDialog) {
      form.reset();
    }
  }, [showEditDialog, editForm]);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Delete goods receipt mutation
  const deleteReceiptMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/receipts/${id}`);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["receipts"] }),
        queryClient.invalidateQueries({ queryKey: ["receipts-stats"] })
      ]);
      setShowDeleteDialog(false);
      setSelectedReceipt(null);
      toast({
        title: "Deleted",
        description: "Receipt deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete receipt",
        variant: "destructive",
      });
    },
  });

  // Fetch goods receipts
  const { data: receipts = [], isLoading } = useQuery({
    queryKey: ["receipts"],
    queryFn: async () => {
      const data = await apiRequest("GET", "/api/receipts");
      return Array.isArray(data) ? data : [];
    },
  });

  // Fetch customers data
  const { data: customersData = { customers: [] } } = useQuery({
    queryKey: ["/api/customers"],
    queryFn: async () => {
      const response = await fetch("/api/customers");
      if (!response.ok) {
        throw new Error('Failed to fetch customers');
      }
      return response.json();
    },
  });

  const customers = customersData.customers || [];

  // Enrich receipts with customer data
  const enrichedReceipts = receipts.map((receipt: any) => {
    const customer = customers.find((c: any) => c.id === receipt.customerId);
    return {
      ...receipt,
      customer: customer ? {
        ...customer,
        name: customer.name || 'No Customer'
      } : receipt.customer || { name: 'No Customer', customerType: '-' }
    };
  });

  // Fetch statistics
  const { data: stats } = useQuery({
    queryKey: ["receipts-stats"],
    queryFn: async () => {
      const receiptsArray = Array.isArray(enrichedReceipts) ? enrichedReceipts : [];
      const total = receiptsArray.length;
      const pending = receiptsArray.filter(r => r.status === "Pending").length;
      const partial = receiptsArray.filter(r => r.status === "Partial").length;
      const complete = receiptsArray.filter(r => r.status === "Completed").length;
      const discrepancy = receiptsArray.filter(r => r.status === "Discrepancy").length;
      
      return { total, pending, partial, complete, discrepancy };
    },
    enabled: Array.isArray(receipts) && receipts.length > 0,
  });

  // Create goods receipt mutation
  const createReceiptMutation = useMutation({
    mutationFn: async (data: GoodsReceiptForm) => {
      return await apiRequest("POST", "/api/receipts", data);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["receipts"] }),
        queryClient.invalidateQueries({ queryKey: ["receipts-stats"] })
      ]);
      // Wait for receipts to refetch before closing dialog
      setTimeout(() => {
        setShowCreateDialog(false);
        form.reset();
        toast({
          title: "Success",
          description: "Receipt created successfully",
        });
      }, 300); // 300ms delay to allow table to update
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create goods receipt",
        variant: "destructive",
      });
    },
  });

  // Update goods receipt mutation
  const updateReceiptMutation = useMutation({
    mutationFn: async (data: GoodsReceiptForm & { id: string }) => {
      return await apiRequest("PUT", `/api/receipts/${data.id}`, data);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["receipts"] }),
        queryClient.invalidateQueries({ queryKey: ["receipts-stats"] })
      ]);
      setShowEditDialog(false);
      toast({
        title: "Success",
        description: "Goods receipt updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update goods receipt",
        variant: "destructive",
      });
    },
  });

  const form = useForm<GoodsReceiptForm>({
    resolver: zodResolver(goodsReceiptSchema),
    defaultValues: {
      receiptNumber: "",
      supplierLpoId: "",
      supplierId: "",
      receiptDate: "",
      receivedBy: "",
      status: "Pending",
      notes: "",
    },
  });

  const normalizeDateInput = (value?: string | null) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return date.toISOString().split("T")[0];
  };

  const handleInvoiceFieldChange = (field: keyof InvoiceHeaderDetails, value: string) => {
    setInvoiceDetails(prev => (prev ? { ...prev, [field]: value } : prev));
  };

  const fetchInvoiceDetails = React.useCallback(
    async (invoiceNumberOverride?: string) => {
      const lookup = (invoiceNumberOverride ?? invoiceLookupValue).trim();
      if (!lookup) {
        setInvoiceFetchError("Enter an invoice number to fetch details.");
        setInvoiceDetails(null);
        return false;
      }

      setIsFetchingInvoice(true);
      setInvoiceFetchError(null);

      try {
        console.log('[fetchInvoiceDetails] Fetching invoice:', lookup);
        
        const response = await apiRequest(
          "GET",
          `/api/purchase-invoices/by-number/${encodeURIComponent(lookup)}`
        );
        
        const data = await response.json();
        console.log('[fetchInvoiceDetails] Fetched invoice data:', data);

        const normalized: InvoiceHeaderDetails = {
          invoiceNumber: data.invoiceNumber || lookup,
          supplierInvoiceNumber: data.supplierInvoiceNumber || "",
          invoiceDate: normalizeDateInput(data.invoiceDate),
          dueDate: normalizeDateInput(data.dueDate),
          receivedDate: normalizeDateInput(data.receivedDate),
          paymentTerms: data.paymentTerms || "",
          notes: data.notes || "",
          paymentStatus: data.paymentStatus || "",
          totalAmount: data.totalAmount,
          currency: data.currency,
          supplierName: data.supplierName,
          supplierId: data.supplierId,
          lpoId: data.lpoId,
        };

        console.log('[fetchInvoiceDetails] Normalized invoice details:', normalized);
        setInvoiceDetails(normalized);
        
        if (!invoiceNumberOverride) {
          setInvoiceLookupValue(lookup);
        }

        // Auto-fill form fields with invoice data
        if (data.lpoId) {
          console.log('[fetchInvoiceDetails] Setting supplierLpoId:', data.lpoId);
          form.setValue("supplierLpoId", data.lpoId);
          const selectedLpo = supplierLpos.find((lpo: any) => lpo.id === data.lpoId);
          if (selectedLpo?.supplierId) {
            console.log('[fetchInvoiceDetails] Setting supplierId from LPO:', selectedLpo.supplierId);
            form.setValue("supplierId", selectedLpo.supplierId);
          } else if (data.supplierId) {
            console.log('[fetchInvoiceDetails] Setting supplierId from invoice:', data.supplierId);
            form.setValue("supplierId", data.supplierId);
          }
        } else if (data.supplierId) {
          console.log('[fetchInvoiceDetails] Setting supplierId:', data.supplierId);
          form.setValue("supplierId", data.supplierId);
        }

        if (data.receivedDate) {
          console.log('[fetchInvoiceDetails] Setting receiptDate:', normalizeDateInput(data.receivedDate));
          form.setValue("receiptDate", normalizeDateInput(data.receivedDate));
        }

        if (data.notes) {
          console.log('[fetchInvoiceDetails] Setting notes:', data.notes);
          form.setValue("notes", data.notes);
        }

        // Fetch invoice items if the invoice has a goodsReceiptId or id
        try {
          let items: any[] = [];
          
          // Try to fetch items from the purchase invoice
          if (data.id) {
            console.log('[fetchInvoiceDetails] Fetching invoice items for invoice ID:', data.id);
            const itemsResponse = await apiRequest(
              "GET",
              `/api/purchase-invoices/${data.id}/items`
            );
            items = await itemsResponse.json();
            console.log('[fetchInvoiceDetails] Fetched invoice items:', items);
          }
          
          // If we have items, populate the receipt items
          if (items && items.length > 0) {
            const mappedItems = items.map((item: any, index: number) => ({
              id: Date.now() + index,
              itemName: item.itemName || item.description || item.name || 'Item',
              quantity: parseFloat(item.quantity) || 0,
              unitPrice: parseFloat(item.unitPrice) || 0,
              description: item.description || item.itemName || '',
              total: (parseFloat(item.quantity) || 0) * (parseFloat(item.unitPrice) || 0)
            }));
            
            console.log('[fetchInvoiceDetails] Setting receipt items:', mappedItems);
            setReceiptItems(mappedItems);
            
            toast({
              title: "Invoice Found",
              description: `Successfully loaded invoice ${data.invoiceNumber} with ${items.length} items`,
            });
          } else {
            toast({
              title: "Invoice Found",
              description: `Successfully loaded details for invoice ${data.invoiceNumber}. Please add items manually.`,
            });
          }
        } catch (itemsError) {
          console.warn('[fetchInvoiceDetails] Could not fetch invoice items:', itemsError);
          toast({
            title: "Invoice Found",
            description: `Successfully loaded details for invoice ${data.invoiceNumber}. Could not load items, please add them manually.`,
          });
        }
      } catch (error) {
        console.error('[fetchInvoiceDetails] Error fetching invoice details:', error);
        const message = error instanceof Error ? error.message : "Failed to fetch invoice details";
        setInvoiceFetchError(message);
        setInvoiceDetails(null);
        
        // Only show error toast if called manually (not from extractReceiptData)
        if (!invoiceNumberOverride) {
          toast({
            title: "Invoice Not Found",
            description: `Could not find invoice "${lookup}" in the system.`,
            variant: "destructive",
          });
        }
        
        // Return false to indicate failure (don't throw to avoid breaking UI)
        return false;
      } finally {
        setIsFetchingInvoice(false);
      }
      
      return true;
    },
    [invoiceLookupValue, supplierLpos, form, toast]
  );

  const clearInvoiceDetails = React.useCallback(() => {
    setInvoiceDetails(null);
    setInvoiceFetchError(null);
    setInvoiceLookupValue("");
  }, []);

  const onSubmit = (data: GoodsReceiptForm) => {
    // Find supplierId from selected supplierLpoId
    const selectedLpo = supplierLpos.find((lpo: any) => lpo.id === data.supplierLpoId);
    const supplierId = selectedLpo?.supplierId || "";
    createReceiptMutation.mutate({ ...data, supplierId });
  };

  // Reset wizard when dialog closes
  React.useEffect(() => {
    if (!showCreateDialog) {
      setWizardStep(1);
      setUploadedFile(null);
      setUploadPreview(null);
      setReceiptItems([]);
      setCurrentItem({ itemName: "", quantity: "", unitPrice: "", description: "" });
      form.reset();
      setInvoiceDetails(null);
      setInvoiceLookupValue("");
      setInvoiceFetchError(null);
      setIsFetchingInvoice(false);
    }
  }, [showCreateDialog]);

  // Handle file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFile(file);
      
      // Create preview for images
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setUploadPreview(reader.result as string);
        };
        reader.readAsDataURL(file);
      } else {
        setUploadPreview(null);
      }
    }
  };

  // Extract data from uploaded receipt using OCR/PDF parsing
  const extractReceiptData = async () => {
    if (!uploadedFile) return;
    
    setIsExtractingData(true);
    
    try {
      // Generate receipt number based on timestamp
      const timestamp = new Date().getTime();
      const receiptNumber = `GR-${timestamp.toString().slice(-6)}`;
      
      // Auto-fill form with basic data
      form.setValue("receiptNumber", receiptNumber);
      form.setValue("receiptDate", new Date().toISOString().split('T')[0]);
      form.setValue("receivedBy", "Warehouse Staff"); // Default value
      form.setValue("status", "Pending");
      
      console.log('[extractReceiptData] Processing uploaded file:', uploadedFile.name);
      
      // First try: Extract invoice number from document content using OCR/PDF parsing
      try {
        const formData = new FormData();
        formData.append('file', uploadedFile);
        
        console.log('[extractReceiptData] Sending document for text extraction...');
        
        const extractResponse = await fetch('/api/documents/extract-invoice', {
          method: 'POST',
          body: formData,
        });
        
        if (extractResponse.ok) {
          const extractResult = await extractResponse.json();
          console.log('[extractReceiptData] Extraction result:', extractResult);
          
          if (extractResult.success && extractResult.invoiceNumber) {
            const extractedInvoiceNumber = extractResult.invoiceNumber;
            console.log('[extractReceiptData] Found invoice number in document:', extractedInvoiceNumber);
            setInvoiceLookupValue(extractedInvoiceNumber);
            
            // Try to fetch invoice details from database
            const fetchSuccess = await fetchInvoiceDetails(extractedInvoiceNumber);
            
            if (fetchSuccess) {
              // Success toast is handled in fetchInvoiceDetails
              return; // Exit early on success
            } else {
              // Invoice not found in database
              console.warn('[extractReceiptData] Invoice not found in database:', extractedInvoiceNumber);
              toast({
                title: "Invoice Number Extracted",
                description: `Found invoice "${extractedInvoiceNumber}" in document, but no matching record in system. Please verify or enter details manually.`,
              });
              return;
            }
          } else {
            console.log('[extractReceiptData] No invoice number found in document content');
          }
        } else {
          console.warn('[extractReceiptData] Document extraction failed:', await extractResponse.text());
        }
      } catch (extractError) {
        console.warn('[extractReceiptData] Document extraction error:', extractError);
      }
      
      // Second try: Extract invoice number from filename as fallback
      const filename = uploadedFile.name;
      console.log('[extractReceiptData] Trying filename extraction for:', filename);
      
      // Match various invoice number patterns in filename
      const invoiceNumberMatch = filename.match(/(?:INV|INVOICE|PI|GR)[-_\s]?(\d+)/i);
      
      if (invoiceNumberMatch) {
        const potentialInvoiceNumber = invoiceNumberMatch[0];
        console.log('[extractReceiptData] Found potential invoice number in filename:', potentialInvoiceNumber);
        setInvoiceLookupValue(potentialInvoiceNumber);
        
        // Try to fetch invoice details
        const fetchSuccess = await fetchInvoiceDetails(potentialInvoiceNumber);
        
        if (fetchSuccess) {
          // Success toast is handled in fetchInvoiceDetails
          return;
        } else {
          console.warn('[extractReceiptData] Invoice not found for extracted number:', potentialInvoiceNumber);
          toast({
            title: "Document Processed",
            description: `Found invoice reference "${potentialInvoiceNumber}" in filename, but no matching invoice in system. Please verify and enter details manually.`,
          });
          return;
        }
      }
      
      // No invoice number found in document or filename
      console.log('[extractReceiptData] No invoice number pattern found');
      toast({
        title: "Document Ready",
        description: "Could not extract invoice number from document. Please enter invoice number manually to fetch details.",
      });
      
    } catch (error) {
      console.error('[extractReceiptData] Error processing document:', error);
      toast({
        title: "Processing Error",
        description: error instanceof Error ? error.message : "Failed to process document",
        variant: "destructive",
      });
    } finally {
      setIsExtractingData(false);
    }
  };

  const handleNextStep = () => {
    if (wizardStep === 1 && !uploadedFile) {
      toast({
        title: "Upload Required",
        description: "Please upload a receipt document before proceeding",
        variant: "destructive",
      });
      return;
    }
    
    // Extract data when moving from step 1 to step 2
    if (wizardStep === 1 && uploadedFile) {
      extractReceiptData();
    }
    
    setWizardStep(prev => Math.min(prev + 1, 4));
  };

  const handlePreviousStep = () => {
    setWizardStep(prev => Math.max(prev - 1, 1));
  };

  // Add item to receipt
  const handleAddItem = () => {
    if (!currentItem.itemName || !currentItem.quantity || !currentItem.unitPrice) {
      toast({
        title: "Missing Information",
        description: "Please fill in item name, quantity, and unit price",
        variant: "destructive",
      });
      return;
    }

    const newItem = {
      id: Date.now(),
      itemName: currentItem.itemName,
      quantity: parseFloat(currentItem.quantity),
      unitPrice: parseFloat(currentItem.unitPrice),
      description: currentItem.description,
      total: parseFloat(currentItem.quantity) * parseFloat(currentItem.unitPrice)
    };

    setReceiptItems([...receiptItems, newItem]);
    setCurrentItem({ itemName: "", quantity: "", unitPrice: "", description: "" });
    
    toast({
      title: "Item Added",
      description: "Item has been added to the receipt",
    });
  };

  // Remove item from receipt
  const handleRemoveItem = (id: number) => {
    setReceiptItems(receiptItems.filter(item => item.id !== id));
  };

  // Calculate total
  const calculateTotal = () => {
    return receiptItems.reduce((sum, item) => sum + item.total, 0);
  };

  // Sort receipts by createdAt descending (latest first)
  const sortedReceipts = (Array.isArray(enrichedReceipts) ? enrichedReceipts : []).slice().sort((a: any, b: any) => {
    const aDate = new Date(a.createdAt || a.receiptDate || 0).getTime();
    const bDate = new Date(b.createdAt || b.receiptDate || 0).getTime();
    return bDate - aDate;
  });

  // Filter receipts
  const filteredReceipts = sortedReceipts.filter((receipt: any) => {
    const matchesSearch = 
      receipt.receiptNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      receipt.receivedBy?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      receipt.notes?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      receipt.customer?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      receipt.customer?.customerType?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === "all" || receipt.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Table columns
  const columns = [
    {
      key: "receiptNumber",
      header: "Receipt Number",
      render: (value: string) => (
        <span className="font-mono text-sm font-medium">{value}</span>
      ),
    },
    {
      key: "supplierName",
      header: "Supplier LPO",
      render: (_: string, receipt: any) => {
        // Find LPO number from supplierLpos using supplierLpoId
        const lpo = supplierLpos.find((l: any) => l.id === receipt.supplierLpoId);
        const lpoNumber = lpo?.lpoNumber || receipt.supplierLpoId || "N/A";
        return (
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-gray-500" />
            <span>{lpoNumber}</span>
          </div>
        );
      },
    },
    {
      key: "customerName",
      header: "Customer",
      render: (_: string, receipt: any) => {
        const customer = receipt.customer;
        if (!customer || !customer.name) {
          return (
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-gray-400" />
              <span className="text-gray-400">No Customer</span>
            </div>
          );
        }
        return (
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-blue-500" />
            <div className="flex flex-col">
              <span className="font-medium text-gray-900">{customer.name}</span>
              {customer.customerType && (
                <span className="text-xs text-gray-500">{customer.customerType}</span>
              )}
            </div>
          </div>
        );
      },
    },
    {
      key: "receivedBy",
      header: "Received By",
      render: (value: string) => (
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-gray-500" />
          <span>{value}</span>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (value: string) => getStatusBadge(value),
    },
    {
      key: "receiptDate",
      header: "Receipt Date",
      render: (value: string) => (
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-gray-500" />
          <span>{formatDate(value)}</span>
        </div>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      render: (_: any, receipt: any) => (
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSelectedReceipt(receipt);
              setShowDetailsDialog(true);
            }}
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setEditForm(receipt);
              setShowEditDialog(true);
              // Set form values for editing
              form.setValue("receiptNumber", receipt.receiptNumber || "");
              form.setValue("supplierLpoId", receipt.supplierLpoId || "");
              form.setValue("receiptDate", receipt.receiptDate || "");
              form.setValue("receivedBy", receipt.receivedBy || "");
              form.setValue("status", receipt.status || "Pending");
              form.setValue("notes", receipt.notes || "");
            }}
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => {
              setSelectedReceipt(receipt);
              setShowDeleteDialog(true);
            }}
          >
            <Trash className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Delete Receipt Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Receipt</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete receipt #{selectedReceipt?.receiptNumber}?
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteReceiptMutation.isPending}
              onClick={() => {
                if (selectedReceipt?.id) {
                  deleteReceiptMutation.mutate(selectedReceipt.id);
                }
              }}
            >
              {deleteReceiptMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-50 to-green-50 rounded-xl p-6 border border-slate-200/50 shadow-sm">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white rounded-xl shadow-sm border border-slate-200/50">
              <Package className="h-10 w-10 text-green-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-800 mb-1">Inventory Receipts</h1>
              <p className="text-slate-600 text-base">Record and manage incoming inventory receipts for inventory tracking</p>
              <div className="flex items-center gap-4 mt-2">
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                  <span>System Active</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Clock className="h-3 w-3" />
                  <span>Last updated: {new Date().toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          </div>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button className="px-6 py-2.5 font-medium">
                <Plus className="h-4 w-4 mr-2" />
                New Receipt
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-5xl overflow-hidden flex flex-col">
              <DialogHeader className="flex-shrink-0 pb-3 border-b">
                <DialogTitle className="text-xl font-bold text-gray-900">Create New Inventory Receipt</DialogTitle>
                <DialogDescription className="text-sm mt-1">
                  Step {wizardStep} of 4: {wizardStep === 1 ? 'Upload Receipt Document' : wizardStep === 2 ? 'Enter Receipt Details' : wizardStep === 3 ? 'Add Receipt Items' : 'Review & Submit'}
                </DialogDescription>
              </DialogHeader>

              {/* Progress Indicator */}
              <div className="flex items-center justify-between my-4 px-4 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <div className={`flex items-center justify-center w-9 h-9 rounded-full font-semibold transition-all text-sm ${wizardStep >= 1 ? 'bg-green-600 text-white shadow-lg' : 'bg-gray-200 text-gray-600'}`}>
                    {wizardStep > 1 ? <CheckCircle className="h-5 w-5" /> : '1'}
                  </div>
                  <div className="text-left">
                    <span className={`text-xs font-semibold block ${wizardStep >= 1 ? 'text-gray-900' : 'text-gray-500'}`}>Upload</span>
                    <span className="text-[10px] text-gray-400">Document</span>
                  </div>
                </div>
                <div className={`flex-1 h-1 mx-3 rounded ${wizardStep >= 2 ? 'bg-green-600' : 'bg-gray-200'}`}></div>
                <div className="flex items-center gap-2">
                  <div className={`flex items-center justify-center w-9 h-9 rounded-full font-semibold transition-all text-sm ${wizardStep >= 2 ? 'bg-green-600 text-white shadow-lg' : 'bg-gray-200 text-gray-600'}`}>
                    {wizardStep > 2 ? <CheckCircle className="h-5 w-5" /> : '2'}
                  </div>
                  <div className="text-left">
                    <span className={`text-xs font-semibold block ${wizardStep >= 2 ? 'text-gray-900' : 'text-gray-500'}`}>Details</span>
                    <span className="text-[10px] text-gray-400">Information</span>
                  </div>
                </div>
                <div className={`flex-1 h-1 mx-3 rounded ${wizardStep >= 3 ? 'bg-green-600' : 'bg-gray-200'}`}></div>
                <div className="flex items-center gap-2">
                  <div className={`flex items-center justify-center w-9 h-9 rounded-full font-semibold transition-all text-sm ${wizardStep >= 3 ? 'bg-green-600 text-white shadow-lg' : 'bg-gray-200 text-gray-600'}`}>
                    {wizardStep > 3 ? <CheckCircle className="h-5 w-5" /> : '3'}
                  </div>
                  <div className="text-left">
                    <span className={`text-xs font-semibold block ${wizardStep >= 3 ? 'text-gray-900' : 'text-gray-500'}`}>Items</span>
                    <span className="text-[10px] text-gray-400">Line Items</span>
                  </div>
                </div>
                <div className={`flex-1 h-1 mx-3 rounded ${wizardStep >= 4 ? 'bg-green-600' : 'bg-gray-200'}`}></div>
                <div className="flex items-center gap-2">
                  <div className={`flex items-center justify-center w-9 h-9 rounded-full font-semibold transition-all text-sm ${wizardStep >= 4 ? 'bg-green-600 text-white shadow-lg' : 'bg-gray-200 text-gray-600'}`}>
                    4
                  </div>
                  <div className="text-left">
                    <span className={`text-xs font-semibold block ${wizardStep >= 4 ? 'text-gray-900' : 'text-gray-500'}`}>Review</span>
                    <span className="text-[10px] text-gray-400">Confirm</span>
                  </div>
                </div>
              </div>

              {/* Scrollable Content Area with Fixed Height */}
              <div className="flex-1 overflow-y-auto px-6 min-h-[380px] max-h-[380px]">
                {/* Step 1: Upload Receipt */}
                {wizardStep === 1 && (
                  <div className="space-y-4 h-full flex flex-col justify-center">
                    <div className="border-2 border-dashed border-gray-300 rounded-xl p-10 text-center hover:border-green-500 hover:bg-green-50/30 transition-all duration-200 bg-gray-50/50">
                      <input
                        type="file"
                        id="receipt-upload"
                        className="hidden"
                        accept="image/*,.pdf"
                        onChange={handleFileUpload}
                      />
                      <label htmlFor="receipt-upload" className="cursor-pointer">
                        <div className="flex flex-col items-center gap-5">
                          {uploadPreview ? (
                            <div className="relative group">
                              <img src={uploadPreview} alt="Receipt preview" className="max-h-56 rounded-xl shadow-lg border-2 border-gray-200" />
                              <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                                onClick={(e) => {
                                  e.preventDefault();
                                  setUploadedFile(null);
                                  setUploadPreview(null);
                                }}
                              >
                                <XCircle className="h-4 w-4 mr-1" />
                                Remove
                              </Button>
                            </div>
                          ) : uploadedFile ? (
                            <div className="flex items-center gap-4 bg-green-50 p-5 rounded-xl border-2 border-green-200 shadow-sm min-w-[400px]">
                              <div className="p-3 bg-green-100 rounded-lg">
                                <FileText className="h-8 w-8 text-green-600" />
                              </div>
                              <div className="text-left flex-1">
                                <p className="font-semibold text-gray-900 text-base">{uploadedFile.name}</p>
                                <p className="text-sm text-gray-600 mt-1">
                                  {(uploadedFile.size / 1024).toFixed(2)} KB • {uploadedFile.type.split('/')[1].toUpperCase()}
                                </p>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="hover:bg-red-50"
                                onClick={(e) => {
                                  e.preventDefault();
                                  setUploadedFile(null);
                                  setUploadPreview(null);
                                }}
                              >
                                <XCircle className="h-5 w-5 text-red-500" />
                              </Button>
                            </div>
                          ) : (
                            <>
                              <div className="p-5 bg-gray-100 rounded-full">
                                <Scan className="h-16 w-16 text-gray-400" />
                              </div>
                              <div className="space-y-2">
                                <p className="text-xl font-bold text-gray-900">Upload Receipt Document</p>
                                <p className="text-sm text-gray-600">Click to browse or drag and drop your file here</p>
                                <div className="flex items-center justify-center gap-3 text-xs text-gray-500 pt-1">
                                  <div className="flex items-center gap-1.5">
                                    <FileText className="h-3.5 w-3.5" />
                                    <span>Images (JPG, PNG)</span>
                                  </div>
                                  <span>•</span>
                                  <div className="flex items-center gap-1.5">
                                    <FileText className="h-3.5 w-3.5" />
                                    <span>PDF Documents</span>
                                  </div>
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      </label>
                    </div>
                    {uploadedFile && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2.5">
                        <ClipboardCheck className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                        <div className="text-xs text-blue-800">
                          <p className="font-medium">Intelligent Document Processing</p>
                          <p className="text-blue-600 mt-0.5">
                            Using OCR and AI, the system will extract invoice numbers directly from your document content (e.g., "Invoice No: PI-20251006-JM577"). 
                            If found, all invoice details will be auto-filled from the database.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Step 2: Receipt Details */}
                {wizardStep === 2 && (
                  <div className="space-y-5 py-2">
                    {isExtractingData && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2.5">
                        <div className="animate-spin h-4 w-4 border-2 border-green-600 border-t-transparent rounded-full"></div>
                        <div className="text-xs text-green-800">
                          <p className="font-medium">Extracting receipt data...</p>
                          <p className="text-green-600">Please wait while we analyze your document.</p>
                        </div>
                      </div>
                    )}

                    <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                        <div>
                          <h3 className="text-base font-semibold text-gray-900">Invoice Header Details</h3>
                          <p className="text-sm text-gray-600">Fetch the purchase invoice to use its header details while creating this receipt.</p>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto">
                          <Input
                            placeholder="Invoice number e.g. PI-20251009-LD6ZH"
                            className="h-9 text-sm"
                            value={invoiceLookupValue}
                            onChange={(e) => setInvoiceLookupValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                fetchInvoiceDetails();
                              }
                            }}
                          />
                          <Button
                            type="button"
                            onClick={() => fetchInvoiceDetails()}
                            disabled={isFetchingInvoice}
                            className="whitespace-nowrap"
                          >
                            {isFetchingInvoice ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Fetching
                              </>
                            ) : (
                              <>
                                <Search className="h-4 w-4 mr-2" />
                                Fetch Details
                              </>
                            )}
                          </Button>
                          {invoiceDetails && (
                            <Button
                              type="button"
                              variant="ghost"
                              className="whitespace-nowrap"
                              onClick={clearInvoiceDetails}
                              disabled={isFetchingInvoice}
                            >
                              Clear
                            </Button>
                          )}
                        </div>
                      </div>

                      {invoiceFetchError && (
                        <Alert variant="destructive" className="mt-3">
                          <AlertDescription>{invoiceFetchError}</AlertDescription>
                        </Alert>
                      )}

                      {invoiceDetails ? (
                        <>
                          <div className="mt-4 flex flex-wrap items-center gap-3">
                            {invoiceDetails.paymentStatus && (
                              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                Status: {invoiceDetails.paymentStatus}
                              </Badge>
                            )}
                            {invoiceDetails.totalAmount && (
                              <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200">
                                {invoiceDetails.currency ? `${invoiceDetails.currency} ` : ""}
                                {invoiceDetails.totalAmount}
                              </Badge>
                            )}
                            {invoiceDetails.supplierName && (
                              <span className="text-sm text-gray-600">
                                Supplier: <span className="font-medium text-gray-900">{invoiceDetails.supplierName}</span>
                              </span>
                            )}
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
                            <div className="space-y-1">
                              <Label className="text-xs font-semibold text-gray-700">Invoice Number</Label>
                              <Input
                                className="h-9 text-sm"
                                value={invoiceDetails.invoiceNumber}
                                onChange={(e) => handleInvoiceFieldChange("invoiceNumber", e.target.value)}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs font-semibold text-gray-700">Supplier Invoice Number</Label>
                              <Input
                                className="h-9 text-sm"
                                value={invoiceDetails.supplierInvoiceNumber || ""}
                                onChange={(e) => handleInvoiceFieldChange("supplierInvoiceNumber", e.target.value)}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs font-semibold text-gray-700">Invoice Date</Label>
                              <Input
                                type="date"
                                className="h-9 text-sm"
                                value={invoiceDetails.invoiceDate || ""}
                                onChange={(e) => handleInvoiceFieldChange("invoiceDate", e.target.value)}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs font-semibold text-gray-700">Due Date</Label>
                              <Input
                                type="date"
                                className="h-9 text-sm"
                                value={invoiceDetails.dueDate || ""}
                                onChange={(e) => handleInvoiceFieldChange("dueDate", e.target.value)}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs font-semibold text-gray-700">Received Date</Label>
                              <Input
                                type="date"
                                className="h-9 text-sm"
                                value={invoiceDetails.receivedDate || ""}
                                onChange={(e) => handleInvoiceFieldChange("receivedDate", e.target.value)}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs font-semibold text-gray-700">Payment Terms</Label>
                              <Textarea
                                rows={2}
                                className="text-sm"
                                value={invoiceDetails.paymentTerms || ""}
                                onChange={(e) => handleInvoiceFieldChange("paymentTerms", e.target.value)}
                              />
                            </div>
                            <div className="space-y-1 md:col-span-2 lg:col-span-3">
                              <Label className="text-xs font-semibold text-gray-700">Invoice Notes</Label>
                              <Textarea
                                rows={3}
                                className="text-sm"
                                value={invoiceDetails.notes || ""}
                                onChange={(e) => handleInvoiceFieldChange("notes", e.target.value)}
                              />
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="mt-4 border border-dashed border-gray-200 rounded-lg p-4 text-sm text-gray-600 bg-gray-50/60">
                          Enter an invoice number above to pull its header details. You can adjust the fetched values before submitting this receipt.
                        </div>
                      )}
                    </div>

                    <Form {...form}>
                      <form className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="receiptNumber"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs font-semibold text-gray-700">Receipt Number *</FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder="e.g., GR-123456"
                                    className="h-9 text-sm"
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="supplierLpoId"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs font-semibold text-gray-700">Supplier LPO *</FormLabel>
                                <Select
                                  onValueChange={value => {
                                    field.onChange(value);
                                    const selectedLpo = supplierLpos.find((lpo: any) => lpo.id === value);
                                    form.setValue("supplierId", selectedLpo?.supplierId || "");
                                  }}
                                  value={field.value}
                                >
                                  <FormControl>
                                    <SelectTrigger className="h-9 text-sm">
                                      <SelectValue placeholder="Select Supplier LPO" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {lpoLoading ? (
                                      <div className="px-4 py-2 text-gray-500 text-sm">Loading LPOs...</div>
                                    ) : supplierLpos.length === 0 ? (
                                      <div className="px-4 py-2 text-gray-500 text-sm">No supplier LPOs available</div>
                                    ) : (
                                      supplierLpos.map((lpo: any) => (
                                        <SelectItem key={lpo.id} value={lpo.id}>
                                          {lpo.lpoNumber}
                                        </SelectItem>
                                      ))
                                    )}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <input type="hidden" {...form.register("supplierId")} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="receiptDate"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs font-semibold text-gray-700">Receipt Date *</FormLabel>
                                <FormControl>
                                  <Input type="date" className="h-9 text-sm" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="receivedBy"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs font-semibold text-gray-700">Received By *</FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder="Enter receiver name"
                                    className="h-9 text-sm"
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        <FormField
                          control={form.control}
                          name="status"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs font-semibold text-gray-700">Status *</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger className="h-9 text-sm">
                                    <SelectValue placeholder="Select status" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="Pending">
                                    <div className="flex items-center gap-2">
                                      <Clock className="h-3.5 w-3.5 text-yellow-600" />
                                      <span>Pending</span>
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="Partial">
                                    <div className="flex items-center gap-2">
                                      <Truck className="h-3.5 w-3.5 text-blue-600" />
                                      <span>Partial</span>
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="Completed">
                                    <div className="flex items-center gap-2">
                                      <CheckCircle className="h-3.5 w-3.5 text-green-600" />
                                      <span>Completed</span>
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="Discrepancy">
                                    <div className="flex items-center gap-2">
                                      <AlertTriangle className="h-3.5 w-3.5 text-red-600" />
                                      <span>Discrepancy</span>
                                    </div>
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="notes"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs font-semibold text-gray-700">Additional Notes</FormLabel>
                              <FormControl>
                                <Textarea
                                  placeholder="Enter any additional notes or observations..."
                                  rows={3}
                                  className="resize-none text-sm"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </form>
                    </Form>
                  </div>
                )}

                {/* Step 3: Add Receipt Items */}
                {wizardStep === 3 && (
                  <div className="space-y-4 py-2 h-full flex flex-col">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2.5">
                      <Package className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                      <div className="text-xs text-blue-800">
                        <p className="font-medium">Add Items to Receipt</p>
                        <p className="text-blue-600 mt-0.5">Add all items received in this shipment. You can add multiple items.</p>
                      </div>
                    </div>

                    {/* Add Item Form */}
                    <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
                      <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                        <Plus className="h-4 w-4 text-green-600" />
                        Add New Item
                      </h4>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs font-semibold text-gray-700">Item Name *</Label>
                          <Input
                            placeholder="Enter item name"
                            className="h-9 text-sm mt-1"
                            value={currentItem.itemName}
                            onChange={(e) => setCurrentItem({ ...currentItem, itemName: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label className="text-xs font-semibold text-gray-700">Description</Label>
                          <Input
                            placeholder="Item description"
                            className="h-9 text-sm mt-1"
                            value={currentItem.description}
                            onChange={(e) => setCurrentItem({ ...currentItem, description: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label className="text-xs font-semibold text-gray-700">Quantity *</Label>
                          <Input
                            type="number"
                            placeholder="0"
                            className="h-9 text-sm mt-1"
                            value={currentItem.quantity}
                            onChange={(e) => setCurrentItem({ ...currentItem, quantity: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label className="text-xs font-semibold text-gray-700">Unit Price *</Label>
                          <Input
                            type="number"
                            placeholder="0.00"
                            className="h-9 text-sm mt-1"
                            value={currentItem.unitPrice}
                            onChange={(e) => setCurrentItem({ ...currentItem, unitPrice: e.target.value })}
                          />
                        </div>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleAddItem}
                        className="w-full bg-green-600 hover:bg-green-700"
                      >
                        <Plus className="h-3.5 w-3.5 mr-1.5" />
                        Add Item
                      </Button>
                    </div>

                    {/* Items List */}
                    <div className="flex-1 overflow-y-auto border border-gray-200 rounded-lg">
                      {receiptItems.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                          <Package className="h-12 w-12 mb-2" />
                          <p className="text-sm">No items added yet</p>
                          <p className="text-xs">Add items using the form above</p>
                        </div>
                      ) : (
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                              <th className="text-left p-2 text-xs font-semibold text-gray-700">Item Name</th>
                              <th className="text-left p-2 text-xs font-semibold text-gray-700">Description</th>
                              <th className="text-right p-2 text-xs font-semibold text-gray-700">Quantity</th>
                              <th className="text-right p-2 text-xs font-semibold text-gray-700">Unit Price</th>
                              <th className="text-right p-2 text-xs font-semibold text-gray-700">Total</th>
                              <th className="text-center p-2 text-xs font-semibold text-gray-700">Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {receiptItems.map((item) => (
                              <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                                <td className="p-2 text-xs font-medium text-gray-900">{item.itemName}</td>
                                <td className="p-2 text-xs text-gray-600">{item.description || '-'}</td>
                                <td className="p-2 text-xs text-right text-gray-900">{item.quantity}</td>
                                <td className="p-2 text-xs text-right text-gray-900">${item.unitPrice.toFixed(2)}</td>
                                <td className="p-2 text-xs text-right font-semibold text-gray-900">${item.total.toFixed(2)}</td>
                                <td className="p-2 text-center">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleRemoveItem(item.id)}
                                    className="h-7 w-7 p-0 hover:bg-red-50"
                                  >
                                    <Trash className="h-3.5 w-3.5 text-red-500" />
                                  </Button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot className="bg-gray-50 border-t-2 border-gray-300">
                            <tr>
                              <td colSpan={4} className="p-2 text-xs font-bold text-gray-900 text-right">Total:</td>
                              <td className="p-2 text-xs font-bold text-green-600 text-right">${calculateTotal().toFixed(2)}</td>
                              <td></td>
                            </tr>
                          </tfoot>
                        </table>
                      )}
                    </div>
                  </div>
                )}

                {/* Step 4: Review & Submit */}
                {wizardStep === 4 && (
                  <div className="space-y-4 py-2 h-full flex flex-col justify-center">
                    <div className="bg-gradient-to-br from-gray-50 to-green-50/30 rounded-xl p-4 border-2 border-gray-200 space-y-4">
                      <div className="flex items-center gap-2.5 pb-3 border-b border-gray-300">
                        <ClipboardCheck className="h-5 w-5 text-green-600" />
                        <h3 className="font-bold text-base text-gray-900">Review Your Receipt</h3>
                      </div>
                      
                      {/* Uploaded File */}
                      <div className="bg-white rounded-lg p-3.5 border border-gray-200 shadow-sm">
                        <Label className="text-xs font-semibold text-gray-700 mb-2 block flex items-center gap-1.5">
                          <FileText className="h-3.5 w-3.5" />
                          Uploaded Document
                        </Label>
                        {uploadPreview ? (
                          <img src={uploadPreview} alt="Receipt" className="max-h-44 rounded-lg shadow-md border border-gray-200 mx-auto" />
                        ) : uploadedFile ? (
                          <div className="flex items-center gap-3 bg-gray-50 p-3 rounded-lg border border-gray-200">
                            <FileText className="h-6 w-6 text-green-600" />
                            <div>
                              <p className="font-semibold text-gray-900 text-sm">{uploadedFile.name}</p>
                              <p className="text-xs text-gray-500">{(uploadedFile.size / 1024).toFixed(2)} KB</p>
                            </div>
                          </div>
                        ) : null}
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <div className="bg-white rounded-lg p-3 border border-gray-200 shadow-sm">
                          <Label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Receipt Number</Label>
                          <p className="text-sm font-semibold text-gray-900 mt-1.5">{form.getValues("receiptNumber") || "N/A"}</p>
                        </div>
                        <div className="bg-white rounded-lg p-3 border border-gray-200 shadow-sm">
                          <Label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Supplier LPO</Label>
                          <p className="text-sm font-semibold text-gray-900 mt-1.5">
                            {supplierLpos.find((lpo: any) => lpo.id === form.getValues("supplierLpoId"))?.lpoNumber || "N/A"}
                          </p>
                        </div>
                        <div className="bg-white rounded-lg p-3 border border-gray-200 shadow-sm">
                          <Label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Receipt Date</Label>
                          <p className="text-sm font-semibold text-gray-900 mt-1.5">{formatDate(form.getValues("receiptDate")) || "N/A"}</p>
                        </div>
                        <div className="bg-white rounded-lg p-3 border border-gray-200 shadow-sm">
                          <Label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Received By</Label>
                          <p className="text-sm font-semibold text-gray-900 mt-1.5">{form.getValues("receivedBy") || "N/A"}</p>
                        </div>
                        <div className="bg-white rounded-lg p-3 border border-gray-200 shadow-sm col-span-2">
                          <Label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Status</Label>
                          <div className="mt-1">{getStatusBadge(form.getValues("status") || "Pending")}</div>
                        </div>
                      </div>

                      {form.getValues("notes") && (
                        <div className="bg-white rounded-lg p-3.5 border border-gray-200 shadow-sm">
                          <Label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Additional Notes</Label>
                          <p className="text-xs text-gray-700 mt-1.5 leading-relaxed">{form.getValues("notes")}</p>
                        </div>
                      )}

                      {/* Items Summary */}
                      {receiptItems.length > 0 && (
                        <div className="bg-white rounded-lg p-3.5 border border-gray-200 shadow-sm">
                          <Label className="text-xs font-semibold text-gray-700 mb-2 block flex items-center gap-1.5">
                            <Package className="h-3.5 w-3.5" />
                            Receipt Items ({receiptItems.length})
                          </Label>
                          <div className="space-y-1.5">
                            {receiptItems.map((item) => (
                              <div key={item.id} className="flex justify-between items-center text-xs border-b border-gray-100 pb-1.5">
                                <div className="flex-1">
                                  <p className="font-medium text-gray-900">{item.itemName}</p>
                                  {item.description && (
                                    <p className="text-gray-500 text-[10px]">{item.description}</p>
                                  )}
                                </div>
                                <div className="text-right">
                                  <p className="text-gray-600">{item.quantity} × ${item.unitPrice.toFixed(2)}</p>
                                  <p className="font-semibold text-gray-900">${item.total.toFixed(2)}</p>
                                </div>
                              </div>
                            ))}
                            <div className="flex justify-between items-center pt-2 border-t-2 border-gray-300">
                              <p className="font-bold text-sm text-gray-900">Total Amount:</p>
                              <p className="font-bold text-base text-green-600">${calculateTotal().toFixed(2)}</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Fixed Footer with Actions */}
              <div className="flex-shrink-0 border-t pt-3 pb-2 px-6 bg-gray-50/50">
                {wizardStep === 1 && (
                  <div className="flex justify-end gap-2.5">
                    <Button type="button" variant="outline" size="default" onClick={() => setShowCreateDialog(false)}>
                      Cancel
                    </Button>
                    <Button type="button" size="default" onClick={handleNextStep} className="min-w-[110px]">
                      Next Step
                      <CheckCircle className="h-3.5 w-3.5 ml-1.5" />
                    </Button>
                  </div>
                )}
                
                {wizardStep === 2 && (
                  <div className="flex justify-between gap-2.5">
                    <Button type="button" variant="outline" size="default" onClick={handlePreviousStep}>
                      <XCircle className="h-3.5 w-3.5 mr-1.5" />
                      Previous
                    </Button>
                    <div className="flex gap-2.5">
                      <Button type="button" variant="outline" size="default" onClick={() => setShowCreateDialog(false)}>
                        Cancel
                      </Button>
                      <Button type="button" size="default" onClick={handleNextStep} className="min-w-[110px]">
                        Next Step
                        <CheckCircle className="h-3.5 w-3.5 ml-1.5" />
                      </Button>
                    </div>
                  </div>
                )}

                {wizardStep === 3 && (
                  <div className="flex justify-between gap-2.5">
                    <Button type="button" variant="outline" size="default" onClick={handlePreviousStep}>
                      <XCircle className="h-3.5 w-3.5 mr-1.5" />
                      Previous
                    </Button>
                    <div className="flex gap-2.5">
                      <Button type="button" variant="outline" size="default" onClick={() => setShowCreateDialog(false)}>
                        Cancel
                      </Button>
                      <Button type="button" size="default" onClick={handleNextStep} className="min-w-[110px]">
                        Next Step
                        <CheckCircle className="h-3.5 w-3.5 ml-1.5" />
                      </Button>
                    </div>
                  </div>
                )}

                {wizardStep === 4 && (
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)}>
                      <div className="flex justify-between gap-2.5">
                        <Button type="button" variant="outline" size="default" onClick={handlePreviousStep}>
                          <XCircle className="h-3.5 w-3.5 mr-1.5" />
                          Previous
                        </Button>
                        <div className="flex gap-2.5">
                          <Button type="button" variant="outline" size="default" onClick={() => setShowCreateDialog(false)}>
                            Cancel
                          </Button>
                          <Button 
                            type="submit" 
                            size="default" 
                            disabled={createReceiptMutation.isPending}
                            className="min-w-[140px] bg-green-600 hover:bg-green-700"
                          >
                            {createReceiptMutation.isPending ? (
                              <>
                                <div className="animate-spin h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full mr-1.5"></div>
                                Creating...
                              </>
                            ) : (
                              <>
                                <CheckCircle className="h-3.5 w-3.5 mr-1.5" />
                                Create Receipt
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    </form>
                  </Form>
                )}
              </div>
            </DialogContent>
      </Dialog>

      {/* Edit Receipt Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Inventory Receipt</DialogTitle>
            <DialogDescription>
              Update details for receipt #{form.getValues("receiptNumber")}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit((data) => {
                if (editForm && editForm.id) {
                  // Ensure supplierId is set from selected LPO
                  const selectedLpo = supplierLpos.find((lpo: any) => lpo.id === data.supplierLpoId);
                  const supplierId = selectedLpo?.supplierId || data.supplierId || "";
                  updateReceiptMutation.mutate({ ...data, supplierId, id: editForm.id }, {
                    onSuccess: async () => {
                      setShowEditDialog(false);
                      setEditForm(null);
                      form.reset();
                      // Invalidate queries but do not block dialog closing
                      queryClient.invalidateQueries({ queryKey: ["receipts"] });
                      queryClient.invalidateQueries({ queryKey: ["receipts-stats"] });
                    }
                  });
                }
              })}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="receiptNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Receipt Number</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="supplierLpoId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Supplier LPO</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select Supplier LPO" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {supplierLpos.map((lpo: any) => (
                            <SelectItem key={lpo.id} value={lpo.id}>
                              {lpo.lpoNumber}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="receiptDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Receipt Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="receivedBy"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Received By</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Pending">Pending</SelectItem>
                        <SelectItem value="Partial">Partial</SelectItem>
                        <SelectItem value="Completed">Completed</SelectItem>
                        <SelectItem value="Discrepancy">Discrepancy</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea rows={3} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => setShowEditDialog(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={updateReceiptMutation.isPending ? true : false}>
                  {updateReceiptMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
        </div>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Receipts</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground">All receipts</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
              <Clock className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
              <p className="text-xs text-muted-foreground">Awaiting receipt</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Partial</CardTitle>
              <Truck className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{stats.partial}</div>
              <p className="text-xs text-muted-foreground">Partially received</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Complete</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.complete}</div>
              <p className="text-xs text-muted-foreground">Fully received</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Discrepancy</CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.discrepancy}</div>
              <p className="text-xs text-muted-foreground">Need attention</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Search & Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search receipts, customers, received by..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="Pending">Pending</SelectItem>
                <SelectItem value="Partial">Partial</SelectItem>
                <SelectItem value="Complete">Complete</SelectItem>
                <SelectItem value="Discrepancy">Discrepancy</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Receipts Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Inventory Receipts</CardTitle>
          <CardDescription>
            {filteredReceipts.length} of {Array.isArray(enrichedReceipts) ? enrichedReceipts.length : 0} receipts
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            data={filteredReceipts}
            columns={columns}
            isLoading={isLoading}
            emptyMessage="No goods receipts found. Create your first receipt to get started."
          />
        </CardContent>
      </Card>

      {/* Receipt Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Goods Receipt Details</DialogTitle>
            <DialogDescription>
              Receipt #{selectedReceipt?.receiptNumber}
            </DialogDescription>
          </DialogHeader>
          {selectedReceipt && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Receipt Number</Label>
                    <p className="text-sm font-medium">{selectedReceipt.receiptNumber}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Received By</Label>
                    <p className="text-sm font-medium">{selectedReceipt.receivedBy}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Status</Label>
                    {getStatusBadge(selectedReceipt.status || "Pending")}
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Receipt Date</Label>
                    <p className="text-sm font-medium">
                      {selectedReceipt.receiptDate ? formatDate(selectedReceipt.receiptDate) : "N/A"}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Supplier LPO</Label>
                    <p className="text-sm font-medium">{selectedReceipt.supplierLpoId || "N/A"}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Customer</Label>
                    <p className="text-sm font-medium">
                      {selectedReceipt.customer?.name || "N/A"}
                      {selectedReceipt.customer?.customerType && (
                        <span className="text-xs text-gray-500 ml-2">({selectedReceipt.customer.customerType})</span>
                      )}
                    </p>
                  </div>
                </div>
              </div>
              {selectedReceipt.notes && (
                <div>
                  <Label className="text-sm font-medium text-gray-500">Notes</Label>
                  <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-md">
                    {selectedReceipt.notes}
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}