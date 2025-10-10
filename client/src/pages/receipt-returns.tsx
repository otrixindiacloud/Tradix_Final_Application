import { useMemo, useState, type ChangeEvent } from "react";
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
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  RotateCcw,
  Plus, 
  Search, 
  Filter,
  Edit, 
  Eye,
  CheckCircle,
  Clock,
  XCircle,
  AlertTriangle,
  User,
  Calendar,
  DollarSign,
  FileText,
  TrendingUp,
  Building2,
  Package,
  Undo2,
  RefreshCw,
  AlertCircle,
  Scan,
  ClipboardCheck
} from "lucide-react";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import DataTable from "@/components/tables/data-table";
import { formatDate, formatCurrency } from "@/lib/utils";

// Form schemas
const receiptReturnSchema = z.object({
  returnNumber: z.string().min(1, "Return number is required"),
  goodsReceiptId: z.string().min(1, "Goods receipt is required"),
  supplierId: z.string().min(1, "Supplier is required"),
  returnReason: z.string().min(1, "Return reason is required"),
  returnDate: z.string().min(1, "Return date is required"),
  status: z.enum(["Draft", "Pending Approval", "Approved", "Returned", "Credited"]),
  notes: z.string().optional(),
});

type ReceiptReturnForm = z.infer<typeof receiptReturnSchema>;
type ReceiptReturnItemForm = {
  itemId: string;
  quantityReturned: number;
  unitCost?: number;
  totalCost?: number;
  returnReason: string;
  conditionNotes?: string;
};

// Status badge component (light background, border + icon, no saturated fills)
const StatusBadge = ({ status }: { status: string }) => {
  const cfg: Record<string, { icon: React.ElementType; variant: string; label: string }> = {
    Draft: { icon: FileText, variant: "outline", label: "Draft" },
    "Pending Approval": { icon: Clock, variant: "secondary", label: "Pending" },
    Approved: { icon: CheckCircle, variant: "default", label: "Approved" },
    Returned: { icon: RotateCcw, variant: "warning", label: "Returned" },
    Credited: { icon: DollarSign, variant: "success", label: "Credited" },
  };
  const data = cfg[status] || cfg["Draft"];
  const Icon = data.icon;
  return (
    <Badge
      variant={data.variant as any}
      className="flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium"
    >
      <Icon className="h-3.5 w-3.5" />
      <span>{data.label}</span>
    </Badge>
  );
};

export default function ReceiptReturnsPage() {
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editForm, setEditForm] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedReturn, setSelectedReturn] = useState<any | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  // Local search state for goods receipt selection (previously incorrectly inside render callback)
  const [receiptSearchTerm, setReceiptSearchTerm] = useState("");
  const [wizardStep, setWizardStep] = useState(1);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  // Local state for item and quantity selection in dialogs
  // (Removed local selectedItemId/quantity state; using form values directly)

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch receipt returns
  const { data: receiptReturns = [], isLoading } = useQuery({
  // receiptReturns is defined above
    queryKey: ["receipt-returns"],
    queryFn: async () => {
      try {
        const data = await apiRequest("GET", "/api/receipt-returns");
        return Array.isArray(data) ? data : [];
      } catch (error) {
        console.error("Failed to fetch receipt returns:", error);
        return [];
      }
    },
  });

  // Fetch goods receipts for dropdown (from /api/receipts)
  const { data: goodsReceipts = [] } = useQuery({
    queryKey: ["receipts"],
    queryFn: async () => {
      try {
        const data = await apiRequest("GET", "/api/receipts");
        // Ensure each receipt has a receiptNumber property
        return Array.isArray(data)
          ? data.map((receipt: any) => ({
              ...receipt,
              receiptNumber: receipt.receiptNumber || receipt.number || receipt.id,
            }))
          : [];
      } catch (error) {
        console.error("Failed to fetch receipts:", error);
        return [];
      }
    },
  });

  const filteredReceiptOptions = useMemo(() => {
    return goodsReceipts.filter((receipt: any) => {
      const searchStr = `${receipt.receiptNumber || ""} ${receipt.supplierName || receipt.supplier?.name || ""}`.toLowerCase();
      return searchStr.includes(receiptSearchTerm.toLowerCase());
    });
  }, [goodsReceipts, receiptSearchTerm]);

  // Fetch items for dropdown
  const { data: items = [] } = useQuery({
    queryKey: ["inventory-items"],
    queryFn: async () => {
      try {
        const data = await apiRequest("GET", "/api/inventory-items");
        return Array.isArray(data) ? data : [];
      } catch (error) {
        console.error("Failed to fetch inventory items:", error);
        return [];
      }
    },
  });

  // Fetch suppliers for name resolution
  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => {
      try {
        const data = await apiRequest("GET", "/api/suppliers");
        return Array.isArray(data) ? data : [];
      } catch (e) {
        console.error("Failed to fetch suppliers", e);
        return [];
      }
    }
  });

  // Fetch statistics
  const { data: stats } = useQuery({
    queryKey: ["receipt-returns-stats"],
    queryFn: async () => {
      const returnsArray = Array.isArray(receiptReturns) ? receiptReturns : [];
      const total = returnsArray.length;
      const draft = returnsArray.filter(r => r.status === "Draft").length;
      const pending = returnsArray.filter(r => r.status === "Pending Approval").length;
      const approved = returnsArray.filter(r => r.status === "Approved").length;
      const returned = returnsArray.filter(r => r.status === "Returned").length;
      const credited = returnsArray.filter(r => r.status === "Credited").length;
      
      // Calculate total return value
      const totalValue = returnsArray.reduce((sum, ret) => {
        return sum + (parseFloat(ret.returnQuantity || "0") * parseFloat(ret.unitPrice || "0"));
      }, 0);
      
      return { total, draft, pending, approved, returned, credited, totalValue };
    },
    enabled: Array.isArray(receiptReturns) && receiptReturns.length > 0,
  });

  // Create receipt return mutation
  const createReturnMutation = useMutation({
    mutationFn: async (data: ReceiptReturnForm) => {
      return await apiRequest("POST", "/api/receipt-returns", data);
    },
    onSuccess: async (createdReturn: any) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["receipt-returns"] }),
        queryClient.invalidateQueries({ queryKey: ["receipt-returns-stats"] })
      ]);
      // If form had item and quantity include creating item record
      const formValues = form.getValues();
      if (createdReturn?.id && formValues.itemId && formValues.returnQuantity) {
        try {
          await apiRequest("POST", `/api/receipt-returns/${createdReturn.id}/items`, {
            itemId: formValues.itemId,
            quantityReturned: formValues.returnQuantity,
            unitCost: 0,
            totalCost: 0,
            returnReason: formValues.returnReason,
            conditionNotes: formValues.notes,
          });
        } catch (e) {
          console.error("Failed to create return item", e);
        }
      }
      setTimeout(() => {
        setShowCreateDialog(false);
        resetCreateState();
        toast({
          title: "Success",
          description: "Receipt return created successfully",
        });
      }, 300);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create receipt return",
        variant: "destructive",
      });
    },
  });

  // Update receipt return mutation
  const updateReturnMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ReceiptReturnForm> }) => {
      const json = await apiRequest("PUT", `/api/receipt-returns/${id}`, data);
      return json;
    },
    onSuccess: (updated: any) => {
      // Merge into cache optimistically
      queryClient.setQueryData(["receipt-returns"], (old: any) => {
        if (!Array.isArray(old)) return old;
        return old.map(r => (r.id === updated.id ? { ...r, ...updated } : r));
      });
      queryClient.invalidateQueries({ queryKey: ["receipt-returns-stats"] });
      setShowEditDialog(false);
      setEditForm(null);
      form.reset();
      toast({
        title: "Updated",
        description: "Receipt return saved",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update receipt return",
        variant: "destructive",
      });
    },
  });

  // Delete receipt return mutation
  const deleteReturnMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/receipt-returns/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["receipt-returns"] });
      toast({
        title: "Success",
        description: "Receipt return deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete receipt return",
        variant: "destructive",
      });
    },
  });

  // Extend form schema to include itemId and returnQuantity
  // For a unified form used in both create & edit dialogs, make item fields optional here;
  // we'll enforce them manually only during creation.
  const extendedReceiptReturnSchema = receiptReturnSchema.extend({
    itemId: z.string().optional(),
    returnQuantity: z.coerce.number().optional(),
  });

  type ExtendedReceiptReturnForm = z.infer<typeof extendedReceiptReturnSchema>;

  const form = useForm<ExtendedReceiptReturnForm>({
    resolver: zodResolver(extendedReceiptReturnSchema),
    defaultValues: {
      returnNumber: "",
      goodsReceiptId: "",
      // supplierId is required by schema; we'll derive it automatically from selected goods receipt
      // and keep it in form state so validation passes
      supplierId: "",
      returnReason: "",
      returnDate: "",
      status: "Draft",
      notes: "",
      itemId: "",
      returnQuantity: 1,
    },
  });

  const watchedValues = form.watch();

  function resetCreateState() {
    setWizardStep(1);
    setUploadedFile(null);
    setUploadPreview(null);
    setReceiptSearchTerm("");
    form.reset();
  }

  const handleFileUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadedFile(file);

    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = e => {
        setUploadPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setUploadPreview(null);
    }
  };

  const handleNextStep = async () => {
    if (wizardStep === 1) {
      setWizardStep(prev => Math.min(prev + 1, 4));
      return;
    }

    if (wizardStep === 2) {
      const isValid = await form.trigger([
        "returnNumber",
        "goodsReceiptId",
        "returnDate",
        "returnReason",
        "status",
      ]);
      if (!isValid) return;
    }

    if (wizardStep === 3) {
      const isValid = await form.trigger(["itemId", "returnQuantity"]);
      if (!isValid) return;
      const quantity = form.getValues("returnQuantity");
      if (!quantity || quantity < 1) {
        toast({
          title: "Invalid quantity",
          description: "Please enter a return quantity of at least 1.",
          variant: "destructive",
        });
        return;
      }
    }

    setWizardStep(prev => Math.min(prev + 1, 4));
  };

  const handlePreviousStep = () => {
    setWizardStep(prev => Math.max(prev - 1, 1));
  };

  const onSubmit = (data: ExtendedReceiptReturnForm) => {
    // Manual enforcement for create scenario (itemId & returnQuantity required)
    if (!data.itemId || !data.returnQuantity || data.returnQuantity < 1) {
      toast({
        title: "Missing item details",
        description: "Please select an item and enter a valid return quantity.",
        variant: "destructive",
      });
      return;
    }
    const selectedReceipt = goodsReceipts.find((r: any) => r.id === data.goodsReceiptId);
    const supplierId = selectedReceipt?.supplierId || "";
    form.setValue("supplierId", supplierId, { shouldValidate: true });
    const payload: ReceiptReturnForm = {
      returnNumber: data.returnNumber,
      goodsReceiptId: data.goodsReceiptId,
      supplierId,
      returnReason: data.returnReason,
      returnDate: data.returnDate,
      status: data.status,
      notes: data.notes,
    };
    createReturnMutation.mutate(payload);
  };

  // Filter receipt returns
  const filteredReturns = (Array.isArray(receiptReturns) ? receiptReturns : []).filter((returnItem: any) => {
    const matchesSearch = 
      returnItem.returnNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      returnItem.returnedBy?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      returnItem.returnReason?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      returnItem.notes?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === "all" || returnItem.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Table columns
  const columns = [
    {
      key: "returnNumber",
      header: "Return Number",
      render: (value: string) => (
        <span className="font-mono text-sm font-medium">{value || "N/A"}</span>
      ),
    },
    {
      key: "goodsReceiptId",
      header: "Goods Receipt",
      render: (value: string) => {
        const receipt = goodsReceipts.find((r: any) => r.id === value);
        const display = receipt?.receiptNumber || receipt?.number || value;
        return (
          <span className="font-mono text-xs text-blue-700 font-medium">{display || "N/A"}</span>
        );
      },
    },
    {
      key: "supplierId",
      header: "Supplier",
      render: (value: string, row: any) => {
        // Prefer supplier list lookup; fallback to goods receipt supplier name if not found
        const supplier = suppliers.find((s: any) => s.id === value);
        let name = supplier?.name;
        if (!name) {
          const receipt = goodsReceipts.find((r: any) => r.id === row.goodsReceiptId);
            name = receipt?.supplierName || receipt?.supplier?.name;
        }
        return (
          <span className="text-sm font-medium text-gray-800">{name || value || "N/A"}</span>
        );
      },
    },
    {
      key: "returnReason",
      header: "Return Reason",
      render: (value: string) => (
        <div className="flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-gray-500" />
          <span className="truncate max-w-[150px]" title={value}>{value || "N/A"}</span>
        </div>
      ),
    },
    {
      key: "returnDate",
      header: "Return Date",
      render: (value: string) => (
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-gray-500" />
          <span>{value ? formatDate(value) : "N/A"}</span>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (value: string) => <StatusBadge status={value || "Draft"} />,
    },
    {
      key: "notes",
      header: "Notes",
      render: (value: string) => (
        <span className="truncate max-w-[200px]">{value || ""}</span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      render: (_: any, returnItem: any) => (
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSelectedReturn(returnItem);
              setShowDetailsDialog(true);
            }}
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setEditForm(returnItem);
              setShowEditDialog(true);
              // Prefill form values
              form.setValue("returnNumber", returnItem.returnNumber || returnItem.return_number || "");
              form.setValue("goodsReceiptId", returnItem.goodsReceiptId || returnItem.goods_receipt_id || "");
              form.setValue("returnReason", returnItem.returnReason || returnItem.return_reason || "");
              form.setValue("returnDate", returnItem.returnDate || returnItem.return_date || "");
              form.setValue("status", returnItem.status || "Draft");
              form.setValue("notes", returnItem.notes || "");
            }}
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (confirm(`Are you sure you want to delete return ${returnItem.return_number}?`)) {
                deleteReturnMutation.mutate(returnItem.id);
              }
            }}
          >
            <XCircle className="h-4 w-4 text-red-500" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-50 to-orange-50 rounded-xl p-6 border border-slate-200/50 shadow-sm">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white rounded-xl shadow-sm border border-slate-200/50">
              <RotateCcw className="h-10 w-10 text-orange-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-800 mb-1">Returns Receipt</h1>
              <p className="text-slate-600 text-base">Manage returns of received goods and track return processing</p>
              <div className="flex items-center gap-4 mt-2">
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <div className="w-2 h-2 bg-orange-400 rounded-full"></div>
                  <span>Return Processing</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Clock className="h-3 w-3" />
                  <span>Last updated: {new Date().toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          </div>
          <Dialog
            open={showCreateDialog}
            onOpenChange={(open) => {
              setShowCreateDialog(open);
              if (!open) {
                resetCreateState();
              } else {
                setWizardStep(1);
                setReceiptSearchTerm("");
                form.reset();
              }
            }}
          >
            <DialogTrigger asChild>
              <Button className="px-6 py-2.5 font-medium">
                <Plus className="h-4 w-4 mr-2" />
                Process Return
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-5xl overflow-hidden flex flex-col">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1">
                  <DialogHeader className="flex-shrink-0 pb-3 border-b">
                    <DialogTitle className="text-xl font-bold text-gray-900">Process Receipt Return</DialogTitle>
                    <DialogDescription className="text-sm mt-1">
                      Step {wizardStep} of 4: {wizardStep === 1 ? "Upload Return Evidence" : wizardStep === 2 ? "Return Details" : wizardStep === 3 ? "Return Items" : "Review & Submit"}
                    </DialogDescription>
                  </DialogHeader>

                  <div className="flex items-center justify-between my-4 px-4 flex-shrink-0">
                    <div className="flex items-center gap-2">
                      <div className={`flex items-center justify-center w-9 h-9 rounded-full font-semibold transition-all text-sm ${wizardStep >= 1 ? "bg-orange-600 text-white shadow-lg" : "bg-gray-200 text-gray-600"}`}>
                        {wizardStep > 1 ? <CheckCircle className="h-5 w-5" /> : "1"}
                      </div>
                      <div className="text-left">
                        <span className={`text-xs font-semibold block ${wizardStep >= 1 ? "text-gray-900" : "text-gray-500"}`}>Upload</span>
                        <span className="text-[10px] text-gray-400">Attachment</span>
                      </div>
                    </div>
                    <div className={`flex-1 h-1 mx-3 rounded ${wizardStep >= 2 ? "bg-orange-600" : "bg-gray-200"}`}></div>
                    <div className="flex items-center gap-2">
                      <div className={`flex items-center justify-center w-9 h-9 rounded-full font-semibold transition-all text-sm ${wizardStep >= 2 ? "bg-orange-600 text-white shadow-lg" : "bg-gray-200 text-gray-600"}`}>
                        {wizardStep > 2 ? <CheckCircle className="h-5 w-5" /> : "2"}
                      </div>
                      <div className="text-left">
                        <span className={`text-xs font-semibold block ${wizardStep >= 2 ? "text-gray-900" : "text-gray-500"}`}>Details</span>
                        <span className="text-[10px] text-gray-400">Return Info</span>
                      </div>
                    </div>
                    <div className={`flex-1 h-1 mx-3 rounded ${wizardStep >= 3 ? "bg-orange-600" : "bg-gray-200"}`}></div>
                    <div className="flex items-center gap-2">
                      <div className={`flex items-center justify-center w-9 h-9 rounded-full font-semibold transition-all text-sm ${wizardStep >= 3 ? "bg-orange-600 text-white shadow-lg" : "bg-gray-200 text-gray-600"}`}>
                        {wizardStep > 3 ? <CheckCircle className="h-5 w-5" /> : "3"}
                      </div>
                      <div className="text-left">
                        <span className={`text-xs font-semibold block ${wizardStep >= 3 ? "text-gray-900" : "text-gray-500"}`}>Items</span>
                        <span className="text-[10px] text-gray-400">Line Items</span>
                      </div>
                    </div>
                    <div className={`flex-1 h-1 mx-3 rounded ${wizardStep >= 4 ? "bg-orange-600" : "bg-gray-200"}`}></div>
                    <div className="flex items-center gap-2">
                      <div className={`flex items-center justify-center w-9 h-9 rounded-full font-semibold transition-all text-sm ${wizardStep >= 4 ? "bg-orange-600 text-white shadow-lg" : "bg-gray-200 text-gray-600"}`}>
                        4
                      </div>
                      <div className="text-left">
                        <span className={`text-xs font-semibold block ${wizardStep >= 4 ? "text-gray-900" : "text-gray-500"}`}>Review</span>
                        <span className="text-[10px] text-gray-400">Confirm</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto px-6 min-h-[380px] max-h-[380px]">
                    {wizardStep === 1 && (
                      <div className="space-y-4 h-full flex flex-col justify-center">
                        <div className="border-2 border-dashed border-gray-300 rounded-xl p-10 text-center hover:border-orange-500 hover:bg-orange-50/30 transition-all duration-200 bg-gray-50/50">
                          <input
                            type="file"
                            id="return-upload"
                            className="hidden"
                            accept="image/*,.pdf"
                            onChange={handleFileUpload}
                          />
                          <label htmlFor="return-upload" className="cursor-pointer">
                            <div className="flex flex-col items-center gap-5">
                              {uploadPreview ? (
                                <div className="relative group">
                                  <img src={uploadPreview} alt="Return preview" className="max-h-56 rounded-xl shadow-lg border-2 border-gray-200" />
                                  <Button
                                    type="button"
                                    variant="destructive"
                                    size="sm"
                                    className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                                    onClick={(event) => {
                                      event.preventDefault();
                                      setUploadedFile(null);
                                      setUploadPreview(null);
                                    }}
                                  >
                                    <XCircle className="h-4 w-4 mr-1" />
                                    Remove
                                  </Button>
                                </div>
                              ) : uploadedFile ? (
                                <div className="flex items-center gap-4 bg-orange-50 p-5 rounded-xl border-2 border-orange-200 shadow-sm min-w-[400px]">
                                  <div className="p-3 bg-orange-100 rounded-lg">
                                    <FileText className="h-8 w-8 text-orange-600" />
                                  </div>
                                  <div className="text-left flex-1">
                                    <p className="font-semibold text-gray-900 text-base">{uploadedFile.name}</p>
                                    <p className="text-sm text-gray-600 mt-1">
                                      {(uploadedFile.size / 1024).toFixed(2)} KB • {uploadedFile.type.split("/")[1]?.toUpperCase()}
                                    </p>
                                  </div>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="hover:bg-red-50"
                                    onClick={(event) => {
                                      event.preventDefault();
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
                                    <p className="text-xl font-bold text-gray-900">Upload supporting document</p>
                                    <p className="text-sm text-gray-600">Click to browse or drag and drop your file here (optional)</p>
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
                          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2.5">
                            <ClipboardCheck className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                            <div className="text-xs text-amber-800">
                              <p className="font-medium">Attachment ready</p>
                              <p className="text-amber-600 mt-0.5">
                                The uploaded file will be stored with this return for audit reference.
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {wizardStep === 2 && (
                      <div className="space-y-5 py-2">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="returnNumber"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs font-semibold text-gray-700">Return Number *</FormLabel>
                                <FormControl>
                                  <Input
                                    required
                                    placeholder="e.g., RR-20251010-01"
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
                            name="returnDate"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs font-semibold text-gray-700">Return Date *</FormLabel>
                                <FormControl>
                                  <Input required type="date" className="h-9 text-sm" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        <FormField
                          control={form.control}
                          name="goodsReceiptId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs font-semibold text-gray-700">Associated Goods Receipt *</FormLabel>
                              <Select
                                required
                                onValueChange={(val) => {
                                  field.onChange(val);
                                  const selected = goodsReceipts.find((r: any) => r.id === val);
                                  if (selected?.supplierId) {
                                    form.setValue("supplierId", selected.supplierId, { shouldValidate: true });
                                  }
                                }}
                                value={field.value}
                              >
                                <FormControl>
                                  <SelectTrigger className="h-9 text-sm">
                                    <SelectValue placeholder="Select receipt" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <div className="px-2 py-2 sticky top-0 bg-white z-10">
                                    <Input
                                      placeholder="Search receipt number or supplier..."
                                      value={receiptSearchTerm}
                                      onChange={e => setReceiptSearchTerm(e.target.value)}
                                      className="mb-2"
                                    />
                                  </div>
                                  {filteredReceiptOptions.length === 0 ? (
                                    <div className="px-4 py-2 text-gray-500 text-sm">No receipts found</div>
                                  ) : (
                                    filteredReceiptOptions.map((receipt: any) => (
                                      <SelectItem key={receipt.id} value={receipt.id}>
                                        {receipt.receiptNumber && typeof receipt.receiptNumber === "string" ? receipt.receiptNumber : `GR-${receipt.id}`}
                                        {receipt.supplierName
                                          ? ` — ${receipt.supplierName}`
                                          : receipt.supplier?.name
                                            ? ` — ${receipt.supplier.name}`
                                            : ""}
                                      </SelectItem>
                                    ))
                                  )}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="returnReason"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs font-semibold text-gray-700">Return Reason *</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                  <FormControl>
                                    <SelectTrigger className="h-9 text-sm">
                                      <SelectValue placeholder="Select return reason" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="Damaged">Damaged</SelectItem>
                                    <SelectItem value="Wrong Item">Wrong Item</SelectItem>
                                    <SelectItem value="Quality Issue">Quality Issue</SelectItem>
                                    <SelectItem value="Excess Quantity">Excess Quantity</SelectItem>
                                    <SelectItem value="Expired">Expired</SelectItem>
                                    <SelectItem value="Customer Request">Customer Request</SelectItem>
                                    <SelectItem value="Other">Other</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
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
                                    <SelectItem value="Draft">Draft</SelectItem>
                                    <SelectItem value="Pending Approval">Pending Approval</SelectItem>
                                    <SelectItem value="Approved">Approved</SelectItem>
                                    <SelectItem value="Returned">Returned</SelectItem>
                                    <SelectItem value="Credited">Credited</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        <FormField
                          control={form.control}
                          name="notes"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs font-semibold text-gray-700">Notes</FormLabel>
                              <FormControl>
                                <Textarea rows={3} className="text-sm" placeholder="Add any additional notes about this return" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    )}

                    {wizardStep === 3 && (
                      <div className="space-y-5 py-2">
                        <div className="rounded-lg border border-dashed border-gray-200 bg-white p-4">
                          <div className="flex flex-col gap-1 text-sm text-gray-600">
                            <span className="font-medium text-gray-900">Selected Receipt Summary</span>
                            {(() => {
                              const selectedReceipt = goodsReceipts.find((receipt: any) => receipt.id === watchedValues.goodsReceiptId);
                              if (!selectedReceipt) {
                                return <span className="text-xs text-gray-500">Select a goods receipt in the previous step to link items.</span>;
                              }
                              return (
                                <div className="text-xs text-gray-600 space-y-1">
                                  <p><span className="font-semibold text-gray-800">Receipt:</span> {selectedReceipt.receiptNumber || `GR-${selectedReceipt.id}`}</p>
                                  <p><span className="font-semibold text-gray-800">Supplier:</span> {selectedReceipt.supplierName || selectedReceipt.supplier?.name || "N/A"}</p>
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="itemId"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs font-semibold text-gray-700">Item *</FormLabel>
                                <Select required onValueChange={field.onChange} value={field.value}>
                                  <FormControl>
                                    <SelectTrigger className="h-9 text-sm">
                                      <SelectValue placeholder="Select item" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {items.length === 0 ? (
                                      <div className="px-4 py-2 text-gray-500 text-sm">No items available</div>
                                    ) : (
                                      items.map((item: any) => (
                                        <SelectItem key={item.id} value={item.id}>
                                          {item.name || item.description || item.itemCode || `Item-${item.id}`}
                                        </SelectItem>
                                      ))
                                    )}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="returnQuantity"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs font-semibold text-gray-700">Return Quantity *</FormLabel>
                                <FormControl>
                                  <Input
                                    required
                                    type="number"
                                    min={1}
                                    className="h-9 text-sm"
                                    placeholder="Enter quantity"
                                    {...field}
                                    value={field.value}
                                    onChange={event => field.onChange(Number(event.target.value))}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        <div className="rounded-lg border border-orange-200 bg-orange-50/60 p-4 text-xs text-orange-800">
                          <p className="font-medium">Tip</p>
                          <p className="mt-1">Ensure the quantity returned does not exceed the originally received quantity. You can update item costs after the return is processed.</p>
                        </div>
                      </div>
                    )}

                    {wizardStep === 4 && (
                      <div className="space-y-5 py-2">
                        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm space-y-4">
                          <h3 className="text-base font-semibold text-gray-900">Return Summary</h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            <div>
                              <Label className="text-xs font-semibold text-gray-500">Return Number</Label>
                              <p className="font-medium text-gray-900">{watchedValues.returnNumber || "—"}</p>
                            </div>
                            <div>
                              <Label className="text-xs font-semibold text-gray-500">Return Date</Label>
                              <p className="font-medium text-gray-900">{watchedValues.returnDate ? formatDate(watchedValues.returnDate) : "—"}</p>
                            </div>
                            <div>
                              <Label className="text-xs font-semibold text-gray-500">Goods Receipt</Label>
                              <p className="font-medium text-gray-900">
                                {(() => {
                                  const receipt = goodsReceipts.find((entry: any) => entry.id === watchedValues.goodsReceiptId);
                                  if (!receipt) return "—";
                                  const label = receipt.receiptNumber && typeof receipt.receiptNumber === "string" ? receipt.receiptNumber : `GR-${receipt.id}`;
                                  const supplierLabel = receipt.supplierName || receipt.supplier?.name;
                                  return supplierLabel ? `${label} — ${supplierLabel}` : label;
                                })()}
                              </p>
                            </div>
                            <div>
                              <Label className="text-xs font-semibold text-gray-500">Status</Label>
                              <p className="font-medium text-gray-900">{watchedValues.status}</p>
                            </div>
                            <div>
                              <Label className="text-xs font-semibold text-gray-500">Return Reason</Label>
                              <p className="font-medium text-gray-900">{watchedValues.returnReason}</p>
                            </div>
                            <div>
                              <Label className="text-xs font-semibold text-gray-500">Item</Label>
                              <p className="font-medium text-gray-900">
                                {(() => {
                                  const item = items.find((entry: any) => entry.id === watchedValues.itemId);
                                  return item?.name || item?.description || item?.itemCode || "—";
                                })()}
                              </p>
                            </div>
                            <div>
                              <Label className="text-xs font-semibold text-gray-500">Quantity Returned</Label>
                              <p className="font-medium text-orange-600">{watchedValues.returnQuantity || 0}</p>
                            </div>
                          </div>
                          {watchedValues.notes && (
                            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm text-gray-700">
                              <Label className="text-xs font-semibold text-gray-500">Notes</Label>
                              <p className="mt-1 whitespace-pre-wrap">{watchedValues.notes}</p>
                            </div>
                          )}
                          {uploadedFile && (
                            <div className="flex items-center gap-3 text-sm text-gray-700 border border-dashed border-gray-300 rounded-lg p-3">
                              <FileText className="h-5 w-5 text-orange-600" />
                              <div>
                                <p className="font-medium">Attachment: {uploadedFile.name}</p>
                                <p className="text-xs text-gray-500">{(uploadedFile.size / 1024).toFixed(2)} KB</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between border-t px-6 py-4 bg-white flex-shrink-0 gap-3">
                    <Button type="button" variant="ghost" onClick={wizardStep === 1 ? () => setShowCreateDialog(false) : handlePreviousStep} disabled={createReturnMutation.isPending}>
                      {wizardStep === 1 ? "Cancel" : "Back"}
                    </Button>
                    <div className="flex items-center gap-2">
                      <Button type="button" variant="outline" onClick={resetCreateState} disabled={createReturnMutation.isPending}>
                        Reset
                      </Button>
                      {wizardStep < 4 ? (
                        <Button type="button" onClick={handleNextStep} className="min-w-[110px]">
                          Next
                        </Button>
                      ) : (
                        <Button
                          type="submit"
                          disabled={createReturnMutation.isPending}
                          className="min-w-[140px] flex items-center justify-center gap-2"
                        >
                          {createReturnMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                          {createReturnMutation.isPending ? "Processing..." : "Process Return"}
                        </Button>
                      )}
                    </div>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Returns</CardTitle>
              <RefreshCw className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground">All returns</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Draft</CardTitle>
              <FileText className="h-4 w-4 text-gray-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-600">{stats.draft}</div>
              <p className="text-xs text-muted-foreground">Being prepared</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
              <Clock className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
              <p className="text-xs text-muted-foreground">Awaiting approval</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Approved</CardTitle>
              <CheckCircle className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{stats.approved}</div>
              <p className="text-xs text-muted-foreground">Ready to return</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Returned</CardTitle>
              <RotateCcw className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{stats.returned}</div>
              <p className="text-xs text-muted-foreground">Items returned</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Credited</CardTitle>
              <DollarSign className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.credited}</div>
              <p className="text-xs text-muted-foreground">Credit processed</p>
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
                placeholder="Search returns..."
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
                <SelectItem value="Draft">Draft</SelectItem>
                <SelectItem value="Pending Approval">Pending Approval</SelectItem>
                <SelectItem value="Approved">Approved</SelectItem>
                <SelectItem value="Returned">Returned</SelectItem>
                <SelectItem value="Credited">Credited</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Receipt Returns Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Returns Receipt </CardTitle>
          <CardDescription>
            {filteredReturns.length} of {Array.isArray(receiptReturns) ? receiptReturns.length : 0} returns
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            data={filteredReturns}
            columns={columns}
            isLoading={isLoading}
            emptyMessage="No receipt returns found. Process your first return to get started."
          />
        </CardContent>
      </Card>

      {/* Edit Return Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Receipt Return</DialogTitle>
            <DialogDescription>
              Update details for return #{form.getValues("returnNumber")}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit((data) => {
                if (!editForm?.id) return;
                // Derive supplierId from selected goods receipt (mirroring create logic)
                const selectedReceipt = goodsReceipts.find((r: any) => r.id === data.goodsReceiptId);
                const supplierId = selectedReceipt?.supplierId || editForm.supplierId || "";
                const payload: Partial<ReceiptReturnForm> = {
                  returnNumber: data.returnNumber,
                  goodsReceiptId: data.goodsReceiptId,
                  supplierId,
                  returnReason: data.returnReason,
                  returnDate: data.returnDate,
                  status: data.status,
                  notes: data.notes,
                };
                // Optimistic cache update before mutation
                queryClient.setQueryData(["receipt-returns"], (old: any) => {
                  if (!Array.isArray(old)) return old;
                  return old.map(r => (r.id === editForm.id ? { ...r, ...payload } : r));
                });
                updateReturnMutation.mutate({ id: editForm.id, data: payload });
              })}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="returnNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Return Number</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="goodsReceiptId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Goods Receipt</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select goods receipt" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {goodsReceipts.map((receipt: any) => (
                            <SelectItem key={receipt.id} value={receipt.id}>
                              {receipt.receiptNumber && typeof receipt.receiptNumber === "string"
                                ? receipt.receiptNumber
                                : `GR-${receipt.id}`}
                              {receipt.supplierName
                                ? ` — ${receipt.supplierName}`
                                : receipt.supplier?.name
                                  ? ` — ${receipt.supplier.name}`
                                  : ""}
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
                {/* Removed itemId and returnQuantity fields from edit dialog, not in schema */}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="returnDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Return Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {/* Removed returnedBy field from edit dialog, not in schema */}
              </div>
              <FormField
                control={form.control}
                name="returnReason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Return Reason</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select return reason" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Damaged">Damaged</SelectItem>
                        <SelectItem value="Wrong Item">Wrong Item</SelectItem>
                        <SelectItem value="Quality Issue">Quality Issue</SelectItem>
                        <SelectItem value="Excess Quantity">Excess Quantity</SelectItem>
                        <SelectItem value="Expired">Expired</SelectItem>
                        <SelectItem value="Customer Request">Customer Request</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Draft">Draft</SelectItem>
                        <SelectItem value="Pending Approval">Pending Approval</SelectItem>
                        <SelectItem value="Approved">Approved</SelectItem>
                        <SelectItem value="Returned">Returned</SelectItem>
                        <SelectItem value="Credited">Credited</SelectItem>
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
                <Button type="submit" disabled={updateReturnMutation.isPending} className="min-w-[120px] flex items-center justify-center gap-2">
                  {updateReturnMutation.isPending && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                  {updateReturnMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Returns Receipt Details</DialogTitle>
            <DialogDescription>
              Return #{selectedReturn?.returnNumber || "N/A"}
            </DialogDescription>
          </DialogHeader>
          {selectedReturn && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Return Number</Label>
                    <p className="text-sm font-medium">{selectedReturn.returnNumber || "N/A"}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Item</Label>
                    <p className="text-sm font-medium">{selectedReturn.itemName || selectedReturn.itemCode || "N/A"}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Return Quantity</Label>
                    <p className="text-sm font-medium text-orange-600">{selectedReturn.returnQuantity || "0"}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Status</Label>
                    <StatusBadge status={selectedReturn.status || "Draft"} />
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Return Date</Label>
                    <p className="text-sm font-medium">
                      {selectedReturn.returnDate ? formatDate(selectedReturn.returnDate) : "N/A"}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Returned By</Label>
                    <p className="text-sm font-medium">{selectedReturn.returnedBy || "N/A"}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Return Reason</Label>
                    <p className="text-sm font-medium">{selectedReturn.returnReason || "N/A"}</p>
                  </div>
                </div>
              </div>
              {selectedReturn.notes && (
                <div>
                  <Label className="text-sm font-medium text-gray-500">Notes</Label>
                  <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-md">
                    {selectedReturn.notes}
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