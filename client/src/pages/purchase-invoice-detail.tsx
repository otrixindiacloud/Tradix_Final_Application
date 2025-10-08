import { useState, useEffect, useCallback } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Link, useParams, useLocation } from "wouter";
import { formatDate } from "date-fns";
import { 
  ArrowLeft, 
  Download, 
  FileText,
  Clock,
  DollarSign,
  Building2,
  Calendar,
  Receipt,
  Package,
  AlertTriangle,
  Trash2,
  Edit,
  Save,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import AttachmentManager from "@/components/enquiry/attachment-manager";

interface PurchaseInvoice {
  id: string;
  invoiceNumber: string;
  supplierInvoiceNumber?: string;
  supplierId: string;
  supplierName: string;
  supplierEmail?: string;
  supplierPhone?: string;
  purchaseOrderId?: string;
  purchaseOrderNumber?: string;
  goodsReceiptId?: string;
  goodsReceiptNumber?: string;
  status: "Draft" | "Pending Approval" | "Approved" | "Paid" | "Partially Paid" | "Overdue" | "Disputed" | "Cancelled";
  paymentStatus: "Unpaid" | "Partially Paid" | "Paid" | "Overdue";
  invoiceDate: string;
  dueDate: string;
  receivedDate?: string;
  paymentDate?: string;
  subtotal: string;
  taxAmount: string;
  discountAmount: string;
  totalAmount: string;
  paidAmount: string;
  remainingAmount: string;
  currency: "BHD" | "AED" | "EUR" | "GBP";
  paymentTerms: string;
  paymentMethod?: "Bank Transfer" | "Cheque" | "Cash" | "Credit Card" | "Letter of Credit";
  bankReference?: string;
  approvedBy?: string;
  approvalDate?: string;
  notes?: string;
  attachments: Array<string | { url: string; name?: string }>;
  itemCount: number;
  isRecurring: boolean;
  nextInvoiceDate?: string;
  createdAt: string;
  updatedAt: string;
}

interface PurchaseInvoiceItem {
  id: string;
  purchaseInvoiceId: string;
  goodsReceiptItemId?: string;
  lpoItemId?: string;
  itemId?: string;
  variantId?: string;
  barcode?: string;
  supplierCode?: string;
  itemDescription: string;
  quantity: number;
  unitPrice: string;
  totalPrice: string;
  taxRate?: string;
  taxAmount?: string;
  discountRate?: string;
  discountAmount?: string;
  unitOfMeasure?: string;
  storageLocation?: string;
  batchNumber?: string;
  expiryDate?: string;
  condition?: string;
  notes?: string;
}

// Payments not yet implemented on backend for derived purchase invoices
type PaymentEntry = never;

type SupplierInvoiceAttachment = {
  id: string;
  name: string;
  filename?: string;
  size?: number;
  type?: string;
  url: string;
  uploadedAt?: string;
};

const normalizeSupplierInvoiceAttachments = (
  raw: any[] | null | undefined,
  fallbackDate?: string
): SupplierInvoiceAttachment[] => {
  if (!Array.isArray(raw)) {
    return [];
  }

  const normalized: SupplierInvoiceAttachment[] = [];

  raw.forEach((attachment: any, index: number) => {
    if (!attachment) {
      return;
    }

    if (typeof attachment === "string") {
      const fileName = attachment.split("/").pop() || `attachment-${index + 1}`;
      const url = attachment.startsWith("/api")
        ? attachment
        : `/api/files/download/${attachment}`;

      normalized.push({
        id: `${index}-${fileName}`,
        name: fileName,
        filename: fileName,
        size: 0,
        type: "application/octet-stream",
        url,
        uploadedAt: fallbackDate,
      });
      return;
    }

    const fileName =
      attachment.filename ||
      attachment.name ||
      attachment.originalname ||
      (typeof attachment.url === "string" ? attachment.url.split("/").pop() : undefined) ||
      `attachment-${index + 1}`;

    const url =
      attachment.url ||
      attachment.path ||
      (typeof fileName === "string" ? `/api/files/download/${fileName}` : undefined);

    if (!url) {
      return;
    }

    normalized.push({
      id: attachment.id || `${index}-${fileName}`,
      name: attachment.name || attachment.originalname || fileName,
      filename: fileName,
      size: attachment.size ?? 0,
      type: attachment.type || attachment.mimetype || "application/octet-stream",
      url,
      uploadedAt: attachment.uploadedAt || fallbackDate,
    });
  });

  return normalized;
};

export default function PurchaseInvoiceDetailPage() {
  const { id } = useParams();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // UI state
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<PurchaseInvoice | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"Bank Transfer" | "Cheque" | "Cash" | "Credit Card" | "Letter of Credit">("Bank Transfer");
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [supplierInvoiceAttachments, setSupplierInvoiceAttachments] = useState<SupplierInvoiceAttachment[]>([]);

  // Download PDF handler
  const handleDownloadPDF = async () => {
    if (!invoice) {
      toast({
        title: "Error",
        description: "No invoice data available for PDF generation.",
        variant: "destructive",
      });
      return;
    }

    try {
      toast({
        title: "Generating PDF",
        description: "Please wait while the PDF is being generated...",
      });

      const response = await fetch(`/api/purchase-invoices/${invoice.id}/pdf?mode=enhanced`);
      
      if (!response.ok) {
        throw new Error('Failed to generate PDF');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `purchase-invoice-${invoice.invoiceNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Download Started",
        description: `Purchase invoice PDF (${invoice.invoiceNumber}) download started.`,
      });
    } catch (error) {
      console.error('Error downloading PDF:', error);
      toast({
        title: "Download Failed",
        description: "Failed to generate or download the PDF. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Fetch single purchase invoice
  const { data: invoice, isLoading } = useQuery<PurchaseInvoice>({
    queryKey: ["/api/purchase-invoices", id],
    queryFn: async () => {
      const resp = await fetch(`/api/purchase-invoices/${id}`);
      if (!resp.ok) throw new Error("Failed to fetch purchase invoice");
      return resp.json();
    }
  });

  // Update purchase invoice mutation
  const updateInvoiceMutation = useMutation({
    mutationFn: async (data: Partial<PurchaseInvoice>) => {
      const response = await apiRequest("PATCH", `/api/purchase-invoices/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-invoices", id] });
      setShowEditDialog(false);
      setEditingInvoice(null);
      toast({ title: "Success", description: "Purchase invoice updated successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update purchase invoice", variant: "destructive" });
    },
  });

  // Delete purchase invoice mutation
  const deleteInvoiceMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("DELETE", `/api/purchase-invoices/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-invoices"] });
      toast({ title: "Success", description: "Purchase invoice deleted successfully" });
      navigate("/purchase-invoices");
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete purchase invoice", variant: "destructive" });
    },
  });

  const updateSupplierInvoiceAttachments = useMutation({
    mutationFn: async (attachments: SupplierInvoiceAttachment[]) => {
      const response = await apiRequest("PATCH", `/api/purchase-invoices/${id}`, { attachments });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-invoices", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-invoices"] });
      toast({ title: "Supplier Invoice Updated", description: "Supplier invoice document saved successfully." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update supplier invoice document", variant: "destructive" });
    },
  });

  // Fetch items from purchase invoice items endpoint
  const { data: invoiceItems = [] } = useQuery<PurchaseInvoiceItem[]>({
    queryKey: ["/api/purchase-invoices", id, "items"],
    enabled: !!id,
    queryFn: async () => {
      const resp = await fetch(`/api/purchase-invoices/${id}/items`);
      if (!resp.ok) throw new Error("Failed to fetch purchase invoice items");
      return resp.json();
    }
  });

  // Fetch goods receipt items for additional details
  const { data: goodsReceiptItems = [] } = useQuery<any[]>({
    queryKey: ["/api/goods-receipt-headers", invoice?.goodsReceiptId, "items"],
    enabled: !!invoice?.goodsReceiptId,
    queryFn: async () => {
      const resp = await fetch(`/api/goods-receipt-headers/${invoice?.goodsReceiptId}/items`);
      if (!resp.ok) throw new Error("Failed to fetch goods receipt items");
      return resp.json();
    }
  });

  useEffect(() => {
    const normalized = normalizeSupplierInvoiceAttachments(
      invoice?.attachments,
      invoice?.updatedAt || invoice?.createdAt
    );

    setSupplierInvoiceAttachments((prev) => {
      const prevSerialized = JSON.stringify(prev);
      const nextSerialized = JSON.stringify(normalized);
      return prevSerialized === nextSerialized ? prev : normalized;
    });
  }, [invoice?.attachments, invoice?.updatedAt, invoice?.createdAt]);

  // Merge invoice items with goods receipt items for complete details
  const enrichedItems = invoiceItems.map(invItem => {
    const grItem = goodsReceiptItems.find((gr: any) => gr.id === invItem.goodsReceiptItemId);
    return {
      ...invItem,
      // Add goods receipt specific details
      quantityExpected: grItem?.quantityExpected,
      quantityReceived: grItem?.quantityReceived,
      quantityDamaged: grItem?.quantityDamaged,
      quantityShort: grItem?.quantityShort,
      discrepancyReason: grItem?.discrepancyReason,
      scannedAt: grItem?.scannedAt,
      receivedAt: grItem?.receivedAt,
    };
  });

  const paymentHistory: PaymentEntry[] = [];

  const handleSupplierAttachmentsChange = useCallback(
    (attachments: SupplierInvoiceAttachment[]) => {
      const previous = supplierInvoiceAttachments;
      setSupplierInvoiceAttachments(attachments);
      updateSupplierInvoiceAttachments.mutate(attachments, {
        onError: () => {
          setSupplierInvoiceAttachments(previous);
        },
      });
    },
    [supplierInvoiceAttachments, updateSupplierInvoiceAttachments]
  );

  // Handler functions
  const handleEdit = () => {
    if (invoice) {
      setEditingInvoice(invoice);
      setShowEditDialog(true);
    }
  };

  const handleSaveEdit = () => {
    if (editingInvoice) {
      // Filter out fields that shouldn't be updated and ensure proper data types
      const { id, createdAt, updatedAt, supplierId, goodsReceiptId, purchaseOrderId, ...updateData } = editingInvoice;
      
      // Ensure numeric fields are properly formatted
      const cleanedData = {
        ...updateData,
        subtotal: updateData.subtotal || "0.00",
        taxAmount: updateData.taxAmount || "0.00",
        discountAmount: updateData.discountAmount || "0.00",
        totalAmount: updateData.totalAmount || "0.00",
        paidAmount: updateData.paidAmount || "0.00",
        remainingAmount: updateData.remainingAmount || "0.00",
      };
      
      updateInvoiceMutation.mutate(cleanedData);
    }
  };

  const handleRecordPayment = () => {
    setShowPaymentDialog(true);
  };

  const handleSavePayment = () => {
    if (!paymentAmount || parseFloat(paymentAmount) <= 0) {
      toast({ title: "Error", description: "Please enter a valid payment amount", variant: "destructive" });
      return;
    }
    
    const currentPaidAmount = parseFloat(invoice?.paidAmount || '0');
    const newPaidAmount = currentPaidAmount + parseFloat(paymentAmount);
    const totalAmount = parseFloat(invoice?.totalAmount || '0');
    
    let newStatus = invoice?.status;
    let newPaymentStatus = invoice?.paymentStatus;
    
    if (newPaidAmount >= totalAmount) {
      newStatus = "Paid";
      newPaymentStatus = "Paid";
    } else if (newPaidAmount > 0) {
      newStatus = "Partially Paid";
      newPaymentStatus = "Partially Paid";
    }
    
    updateInvoiceMutation.mutate({
      paidAmount: newPaidAmount.toString(),
      remainingAmount: (totalAmount - newPaidAmount).toString(),
      status: newStatus,
      paymentStatus: newPaymentStatus,
      paymentDate: new Date().toISOString().split('T')[0],
      notes: `${invoice?.notes || ''}\n\nPayment recorded: ${paymentAmount} ${invoice?.currency} via ${paymentMethod} on ${new Date().toLocaleDateString()}. Reference: ${paymentReference}. ${paymentNotes ? `Notes: ${paymentNotes}` : ''}`
    });
    
    setShowPaymentDialog(false);
    setPaymentAmount("");
    setPaymentReference("");
    setPaymentNotes("");
  };

  const handleDelete = () => {
    setShowDeleteDialog(true);
  };

  const handleConfirmDelete = () => {
    deleteInvoiceMutation.mutate();
  };

  const getStatusBadgeProps = (status: string) => {
    switch (status) {
      case "Draft": 
        return {
          variant: "outline" as const,
          className: "border-gray-500 text-gray-600 hover:bg-gray-50"
        };
      case "Pending Approval": 
        return {
          variant: "outline" as const,
          className: "border-yellow-500 text-yellow-600 hover:bg-yellow-50"
        };
      case "Approved": 
        return {
          variant: "outline" as const,
          className: "border-green-500 text-green-600 hover:bg-green-50"
        };
      case "Paid": 
        return {
          variant: "outline" as const,
          className: ""
        };
      case "Partially Paid": 
        return {
          variant: "outline" as const,
          className: "border-orange-500 text-orange-600 hover:bg-orange-50"
        };
      case "Overdue": 
        return {
          variant: "outline" as const,
          className: "border-red-500 text-red-600 hover:bg-red-50"
        };
      case "Disputed": 
        return {
          variant: "outline" as const,
          className: "border-purple-500 text-purple-600 hover:bg-purple-50"
        };
      case "Cancelled": 
        return {
          variant: "outline" as const,
          className: "border-gray-500 text-gray-600 hover:bg-gray-50"
        };
      default: 
        return {
          variant: "outline" as const,
          className: "border-gray-500 text-gray-600 hover:bg-gray-50"
        };
    }
  };

  const getPaymentStatusBadgeProps = (status: string) => {
    switch (status) {
      case "Paid": 
        return {
          variant: "outline" as const,
          className: "border-green-500 text-green-600 hover:bg-green-50"
        };
      case "Partially Paid": 
        return {
          variant: "outline" as const,
          className: ""
        };
      case "Unpaid": 
        return {
          variant: "outline" as const,
          className: "border-orange-500 text-orange-600 hover:bg-orange-50"
        };
      case "Overdue": 
        return {
          variant: "outline" as const,
          className: "border-red-500 text-red-600 hover:bg-red-50"
        };
      default: 
        return {
          variant: "outline" as const,
          className: "border-gray-500 text-gray-600 hover:bg-gray-50"
        };
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading invoice details...</p>
        </div>
      </div>
    );
  }

  if (!invoice && !isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Invoice Not Found</h1>
          <p className="text-gray-600 mb-4">The requested purchase invoice could not be found.</p>
          <Link href="/purchase-invoices">
            <Button>Back to Purchase Invoices</Button>
          </Link>
        </div>
      </div>
    );
  }

  // If still loading invoices, show spinner (previous loading branch covers but guard here)
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading invoice details...</p>
        </div>
      </div>
    );
  }

  // Defensive: if invoice somehow undefined after loading
  if (!invoice) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Invoice Not Found</h1>
          <p className="text-gray-600 mb-4">The requested purchase invoice could not be found.</p>
          <Link href="/purchase-invoices">
            <Button>Back to Purchase Invoices</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/purchase-invoices">
            <Button variant="outline" size="sm" onClick={() => navigate('/purchase-invoices')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Purchase Invoices
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{invoice?.invoiceNumber}</h1>
            <p className="text-gray-600">{invoice?.supplierName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleEdit}>
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
          <Button variant="outline" onClick={handleDownloadPDF}>
            <Download className="h-4 w-4 mr-2" />
            Download
          </Button>
          <Button onClick={handleRecordPayment}>Record Payment</Button>
        </div>
      </div>

      {/* Status and Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
  <Card className="shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div>
                <FileText className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-black">Status</p>
                <Badge 
                  variant={getStatusBadgeProps(invoice?.status || 'Draft').variant}
                  className={getStatusBadgeProps(invoice?.status || 'Draft').className}
                >
                  <span className="font-medium">{invoice?.status}</span>
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

  <Card className="shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div>
                <DollarSign className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-black">Total Amount</p>
                <p className="text-xl font-bold">{invoice?.currency} {parseFloat(invoice?.totalAmount || '0').toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

  <Card className="shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="h-6 w-6" />
              <div>
                <p className="text-sm font-bold text-black">Payment Status</p>
                <Badge 
                  variant={getPaymentStatusBadgeProps(invoice?.paymentStatus || 'Unpaid').variant}
                  className={getPaymentStatusBadgeProps(invoice?.paymentStatus || 'Unpaid').className}
                >
                  <span className="font-medium">{invoice?.paymentStatus}</span>
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

  <Card className="shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div>
                <Calendar className="h-6 w-6 text-orange-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-black">Due Date</p>
                  <p className="text-lg font-semibold">{invoice?.dueDate ? formatDate(new Date(invoice.dueDate), 'MMM dd, yyyy') : '-'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Invoice Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Invoice Information */}
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5" />
                Invoice Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-600">Invoice Number</Label>
                  <p className="text-lg font-semibold">{invoice?.invoiceNumber}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-600">Supplier Invoice Number</Label>
                  <p className="text-lg">{invoice?.supplierInvoiceNumber || "Nb/A"}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-600">Invoice Date</Label>
                  <p className="text-lg">{invoice?.invoiceDate ? formatDate(new Date(invoice.invoiceDate), 'MMM dd, yyyy') : '-'}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-600">Due Date</Label>
                  <p className="text-lg">{invoice?.dueDate ? formatDate(new Date(invoice.dueDate), 'MMM dd, yyyy') : '-'}</p>
                </div>
                {invoice?.receivedDate && (
                  <div>
                    <Label className="text-sm font-medium text-gray-600">Received Date</Label>
                    <p className="text-lg">{formatDate(new Date(invoice.receivedDate), 'MMM dd, yyyy')}</p>
                  </div>
                )}
                <div>
                  <Label className="text-sm font-medium text-gray-600">Payment Terms</Label>
                  <p className="text-lg">{invoice?.paymentTerms || '-'}</p>
                </div>
                {invoice?.purchaseOrderNumber && (
                  <div>
                    <Label className="text-sm font-medium text-gray-600">Purchase Order</Label>
                    <p className="text-lg">{invoice.purchaseOrderNumber}</p>
                  </div>
                )}
                {invoice?.goodsReceiptNumber && (
                  <div>
                    <Label className="text-sm font-medium text-gray-600">Goods Receipt</Label>
                    <p className="text-lg">{invoice.goodsReceiptNumber}</p>
                  </div>
                )}
              </div>
              {invoice?.notes && (
                <div>
                  <Label className="text-sm font-medium text-gray-600">Notes</Label>
                  <p className="text-gray-800">{invoice.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Invoice Items */}
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Invoice Items ({enrichedItems.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {enrichedItems.map((item: any, index: number) => (
                  <div key={item.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                            <Package className="h-5 w-5 text-blue-600" />
                          </div>
                          <div className="flex-1">
                            <h4 className="font-semibold text-gray-900 text-base mb-1">
                              {item.itemDescription || item.description || `Item ${index + 1}`}
                            </h4>
                            <div className="flex flex-wrap gap-2 mb-2">
                              {item.supplierCode && (
                                <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                                  <span className="font-medium">Code:</span> {item.supplierCode}
                                </Badge>
                              )}
                              {item.barcode && (
                                <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">
                                  <span className="font-medium">Barcode:</span> {item.barcode}
                                </Badge>
                              )}
                              {item.storageLocation && (
                                <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                                  <span className="font-medium">Location:</span> {item.storageLocation}
                                </Badge>
                              )}
                              {item.condition && (
                                <Badge 
                                  variant="outline" 
                                  className={`text-xs ${
                                    item.condition === 'Good' ? 'bg-green-50 text-green-700 border-green-200' :
                                    item.condition === 'Damaged' ? 'bg-red-50 text-red-700 border-red-200' :
                                    'bg-gray-50 text-gray-700 border-gray-200'
                                  }`}
                                >
                                  <span className="font-medium">Condition:</span> {item.condition}
                                </Badge>
                              )}
                            </div>
                            
                            {/* Goods Receipt Details */}
                            {(item.quantityExpected || item.quantityReceived) && (
                              <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 mb-3">
                                <p className="text-xs font-semibold text-indigo-900 mb-2">📦 Goods Receipt Details</p>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                                  {item.quantityExpected && (
                                    <div>
                                      <p className="text-indigo-600 text-xs font-medium">Expected</p>
                                      <p className="font-semibold text-indigo-900">{item.quantityExpected}</p>
                                    </div>
                                  )}
                                  {item.quantityReceived !== undefined && (
                                    <div>
                                      <p className="text-green-600 text-xs font-medium">Received</p>
                                      <p className="font-semibold text-green-700">{item.quantityReceived}</p>
                                    </div>
                                  )}
                                  {item.quantityDamaged > 0 && (
                                    <div>
                                      <p className="text-red-600 text-xs font-medium">Damaged</p>
                                      <p className="font-semibold text-red-700">{item.quantityDamaged}</p>
                                    </div>
                                  )}
                                  {item.quantityShort > 0 && (
                                    <div>
                                      <p className="text-orange-600 text-xs font-medium">Short</p>
                                      <p className="font-semibold text-orange-700">{item.quantityShort}</p>
                                    </div>
                                  )}
                                </div>
                                {item.discrepancyReason && (
                                  <div className="mt-2 pt-2 border-t border-indigo-200">
                                    <p className="text-xs text-indigo-600 font-medium">Discrepancy:</p>
                                    <p className="text-sm text-indigo-900 italic">{item.discrepancyReason}</p>
                                  </div>
                                )}
                                {(item.scannedAt || item.receivedAt) && (
                                  <div className="mt-2 pt-2 border-t border-indigo-200 flex flex-wrap gap-3 text-xs">
                                    {item.scannedAt && (
                                      <div>
                                        <span className="text-indigo-600 font-medium">Scanned:</span>{' '}
                                        <span className="text-indigo-900">{formatDate(new Date(item.scannedAt), 'MMM dd, yyyy HH:mm')}</span>
                                      </div>
                                    )}
                                    {item.receivedAt && (
                                      <div>
                                        <span className="text-indigo-600 font-medium">Received:</span>{' '}
                                        <span className="text-indigo-900">{formatDate(new Date(item.receivedAt), 'MMM dd, yyyy HH:mm')}</span>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Invoice Details Grid */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 text-sm">
                              <div>
                                <p className="text-gray-500 text-xs font-medium">Invoiced Qty</p>
                                <p className="font-semibold text-gray-900">
                                  {item.quantity} {item.unitOfMeasure || 'units'}
                                </p>
                              </div>
                              <div>
                                <p className="text-gray-500 text-xs font-medium">Unit Price</p>
                                <p className="font-semibold text-gray-900">
                                  {invoice?.currency} {parseFloat(item.unitPrice || '0').toLocaleString()}
                                </p>
                              </div>
                              {item.discountAmount && parseFloat(item.discountAmount) > 0 && (
                                <div>
                                  <p className="text-gray-500 text-xs font-medium">Discount</p>
                                  <p className="font-semibold text-green-600">
                                    -{invoice?.currency} {parseFloat(item.discountAmount).toLocaleString()}
                                    {item.discountRate && ` (${item.discountRate}%)`}
                                  </p>
                                </div>
                              )}
                              <div>
                                <p className="text-gray-500 text-xs font-medium">Tax</p>
                                <p className="font-semibold text-gray-900">
                                  {invoice?.currency} {parseFloat(item.taxAmount || '0').toLocaleString()}
                                  {item.taxRate && ` (${item.taxRate}%)`}
                                </p>
                              </div>
                            </div>

                            {/* Batch and Expiry Info */}
                            {(item.batchNumber || item.expiryDate) && (
                              <div className="mt-3 pt-3 border-t border-gray-200">
                                <div className="flex flex-wrap gap-4 text-sm">
                                  {item.batchNumber && (
                                    <div className="flex items-center gap-2">
                                      <span className="text-gray-500 font-medium">Batch:</span>
                                      <span className="text-gray-900 font-mono">{item.batchNumber}</span>
                                    </div>
                                  )}
                                  {item.expiryDate && (
                                    <div className="flex items-center gap-2">
                                      <span className="text-gray-500 font-medium">Expiry:</span>
                                      <span className="text-gray-900">{formatDate(new Date(item.expiryDate), 'MMM dd, yyyy')}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Item Notes */}
                            {item.notes && (
                              <div className="mt-3 pt-3 border-t border-gray-200">
                                <p className="text-xs text-gray-500 font-medium mb-1">Notes:</p>
                                <p className="text-sm text-gray-700 italic">{item.notes}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {/* Item Total */}
                      <div className="text-right ml-4">
                        <p className="text-xs text-gray-500 font-medium mb-1">Total</p>
                        <p className="text-xl font-bold text-gray-900">
                          {invoice?.currency} {parseFloat(item.totalPrice || '0').toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <Separator className="my-6" />

              {/* Invoice Totals */}
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Subtotal:</span>
                  <span className="font-medium">{invoice?.currency} {parseFloat(invoice?.subtotal || '0').toLocaleString()}</span>
                </div>
                {invoice?.discountAmount && parseFloat(invoice.discountAmount) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Discount:</span>
                    <span className="text-green-600">-{invoice?.currency} {parseFloat(invoice.discountAmount).toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-600">Tax:</span>
                  <span className="font-medium">{invoice?.currency} {parseFloat(invoice.taxAmount || '0').toLocaleString()}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-lg font-bold">
                  <span>Total:</span>
                  <span>{invoice?.currency} {parseFloat(invoice?.totalAmount || '0').toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-green-600">
                  <span>Paid:</span>
                  <span>{invoice?.currency} {parseFloat(invoice?.paidAmount || '0').toLocaleString()}</span>
                </div>
                {invoice?.remainingAmount && parseFloat(invoice.remainingAmount) > 0 && (
                  <div className="flex justify-between text-red-600 font-medium">
                    <span>Remaining:</span>
                    <span>{invoice?.currency} {parseFloat(invoice.remainingAmount).toLocaleString()}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Supplier Information */}
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Supplier Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-sm font-medium text-gray-600">Name</Label>
                <p className="font-medium">{invoice?.supplierName}</p>
              </div>
              {invoice?.supplierEmail && (
                <div>
                  <Label className="text-sm font-medium text-gray-600">Email</Label>
                  <p className="text-blue-600">{invoice.supplierEmail}</p>
                </div>
              )}
              {invoice?.supplierPhone && (
                <div>
                  <Label className="text-sm font-medium text-gray-600">Phone</Label>
                  <p>{invoice.supplierPhone}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Payment History (not available yet) */}
          

          <AttachmentManager
            title="Supplier Invoice Documents"
            attachments={supplierInvoiceAttachments}
            onAttachmentsChange={handleSupplierAttachmentsChange}
            maxFiles={5}
            allowedTypes={["application/pdf", "image/*"]}
            readOnly={updateSupplierInvoiceAttachments.isPending}
          />


          {/* Quick Actions (limited - derived data) */}
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" onClick={handleDownloadPDF} className="w-full justify-start">
                <Download className="h-4 w-4 mr-2" />
                Download PDF
              </Button>
              <Button onClick={handleRecordPayment} className="w-full justify-start">Record Payment</Button>
              <Button variant="destructive" onClick={handleDelete} className="w-full justify-start">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Invoice
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5" />
              Edit Purchase Invoice
            </DialogTitle>
          </DialogHeader>
          {editingInvoice && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="invoiceNumber">Invoice Number</Label>
                  <Input
                    id="invoiceNumber"
                    value={editingInvoice.invoiceNumber}
                    onChange={(e) => setEditingInvoice({...editingInvoice, invoiceNumber: e.target.value})}
                  />
                </div>
                <div>
                  <Label htmlFor="supplierInvoiceNumber">Supplier Invoice Number</Label>
                  <Input
                    id="supplierInvoiceNumber"
                    value={editingInvoice.supplierInvoiceNumber || ''}
                    onChange={(e) => setEditingInvoice({...editingInvoice, supplierInvoiceNumber: e.target.value})}
                  />
                </div>
                <div>
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={editingInvoice.status}
                    onValueChange={(value) => setEditingInvoice({...editingInvoice, status: value as any})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Draft">Draft</SelectItem>
                      <SelectItem value="Pending Approval">Pending Approval</SelectItem>
                      <SelectItem value="Approved">Approved</SelectItem>
                      <SelectItem value="Paid">Paid</SelectItem>
                      <SelectItem value="Partially Paid">Partially Paid</SelectItem>
                      <SelectItem value="Overdue">Overdue</SelectItem>
                      <SelectItem value="Disputed">Disputed</SelectItem>
                      <SelectItem value="Cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="paymentStatus">Payment Status</Label>
                  <Select
                    value={editingInvoice.paymentStatus}
                    onValueChange={(value) => setEditingInvoice({...editingInvoice, paymentStatus: value as any})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Unpaid">Unpaid</SelectItem>
                      <SelectItem value="Partially Paid">Partially Paid</SelectItem>
                      <SelectItem value="Paid">Paid</SelectItem>
                      <SelectItem value="Overdue">Overdue</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="invoiceDate">Invoice Date</Label>
                  <Input
                    id="invoiceDate"
                    type="date"
                    value={editingInvoice.invoiceDate}
                    onChange={(e) => setEditingInvoice({...editingInvoice, invoiceDate: e.target.value})}
                  />
                </div>
                <div>
                  <Label htmlFor="dueDate">Due Date</Label>
                  <Input
                    id="dueDate"
                    type="date"
                    value={editingInvoice.dueDate}
                    onChange={(e) => setEditingInvoice({...editingInvoice, dueDate: e.target.value})}
                  />
                </div>
                <div>
                  <Label htmlFor="subtotal">Subtotal</Label>
                  <Input
                    id="subtotal"
                    type="number"
                    step="0.01"
                    value={editingInvoice.subtotal}
                    onChange={(e) => setEditingInvoice({...editingInvoice, subtotal: e.target.value})}
                  />
                </div>
                <div>
                  <Label htmlFor="taxAmount">Tax Amount</Label>
                  <Input
                    id="taxAmount"
                    type="number"
                    step="0.01"
                    value={editingInvoice.taxAmount}
                    onChange={(e) => setEditingInvoice({...editingInvoice, taxAmount: e.target.value})}
                  />
                </div>
                <div>
                  <Label htmlFor="totalAmount">Total Amount</Label>
                  <Input
                    id="totalAmount"
                    type="number"
                    step="0.01"
                    value={editingInvoice.totalAmount}
                    onChange={(e) => setEditingInvoice({...editingInvoice, totalAmount: e.target.value})}
                  />
                </div>
                <div>
                  <Label htmlFor="currency">Currency</Label>
                  <Select
                    value={editingInvoice.currency}
                    onValueChange={(value) => setEditingInvoice({...editingInvoice, currency: value as any})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BHD">BHD</SelectItem>
                      <SelectItem value="AED">AED</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                      <SelectItem value="GBP">GBP</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label htmlFor="paymentTerms">Payment Terms</Label>
                <Textarea
                  id="paymentTerms"
                  value={editingInvoice.paymentTerms || ''}
                  onChange={(e) => setEditingInvoice({...editingInvoice, paymentTerms: e.target.value})}
                />
              </div>
              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={editingInvoice.notes || ''}
                  onChange={(e) => setEditingInvoice({...editingInvoice, notes: e.target.value})}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSaveEdit} disabled={updateInvoiceMutation.isPending}>
                  {updateInvoiceMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Record Payment
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="paymentAmount">Payment Amount</Label>
              <Input
                id="paymentAmount"
                type="number"
                step="0.01"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder="Enter payment amount"
              />
            </div>
            <div>
              <Label htmlFor="paymentMethod">Payment Method</Label>
              <Select value={paymentMethod} onValueChange={(value: any) => setPaymentMethod(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                  <SelectItem value="Cheque">Cheque</SelectItem>
                  <SelectItem value="Cash">Cash</SelectItem>
                  <SelectItem value="Credit Card">Credit Card</SelectItem>
                  <SelectItem value="Letter of Credit">Letter of Credit</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="paymentReference">Reference Number</Label>
              <Input
                id="paymentReference"
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
                placeholder="Enter reference number"
              />
            </div>
            <div>
              <Label htmlFor="paymentNotes">Notes</Label>
              <Textarea
                id="paymentNotes"
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
                placeholder="Enter payment notes"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowPaymentDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleSavePayment} disabled={updateInvoiceMutation.isPending}>
                {updateInvoiceMutation.isPending ? "Recording..." : "Record Payment"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Delete Purchase Invoice
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this purchase invoice? This action cannot be undone.
              <br />
              <br />
              <strong>Invoice:</strong> {invoice?.invoiceNumber}
              <br />
              <strong>Supplier:</strong> {invoice?.supplierName}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteInvoiceMutation.isPending}
            >
              {deleteInvoiceMutation.isPending ? "Deleting..." : "Delete Invoice"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}