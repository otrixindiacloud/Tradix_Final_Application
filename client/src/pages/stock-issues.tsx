import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  ArrowRightLeft,
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
  TrendingDown,
  Building2,
  Package,
  Minus,
  Activity,
  BarChart3,
  Trash,
  Loader2,
  FileUp,
  Info
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import DataTable from "@/components/tables/data-table";
import { formatDate, formatCurrency } from "@/lib/utils";

// Helper: format a date (string from input or Date) to backend-required 'YYYY-MM-DD HH:mm:ss+00'
function toBackendTimestamp(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  let d: Date | null = null;
  if (value instanceof Date) {
    d = value;
  } else if (typeof value === 'string' && value.trim()) {
    // Accept ISO already
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(value)) return value;
    // Date-only -> midnight UTC
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [y, m, day] = value.split('-').map(Number);
      d = new Date(Date.UTC(y, (m as number) - 1, day, 0, 0, 0));
    } else {
      const parsed = new Date(value);
      if (!isNaN(parsed.getTime())) d = parsed;
    }
  }
  if (!d || isNaN(d.getTime())) return null;
  return d.toISOString().replace(/\.\d{3}Z$/, 'Z'); // Trim ms for cleanliness
}

// Form schemas
const stockIssueSchema = z.object({
  issueNumber: z.string().min(1, "Issue number is required"),
  itemId: z.string().min(1, "Item is required"),
  quantityIssued: z.number().min(1, "Quantity must be greater than 0"),
  issuedTo: z.string().min(1, "Issued to is required"),
  issueDate: z.string().min(1, "Issue date is required").or(z.null()),
  purpose: z.string().min(1, "Purpose is required"),
  departmentId: z.string().optional(),
  notes: z.string().optional(),
  status: z.string().optional(), // Add status field
});

type StockIssueForm = z.infer<typeof stockIssueSchema>;

const stockIssueWizardSchema = z.object({
  issueNumberPrefix: z.string().min(1, "Issue number prefix is required"),
  issuedTo: z.string().min(1, "Issued to is required"),
  purpose: z.string().min(1, "Purpose is required"),
  issueDate: z.string().optional(),
  notes: z.string().optional(),
  status: z.enum(["Draft", "Issued", "Applied", "Cancelled"]).default("Issued"),
});

type StockIssueWizardForm = z.infer<typeof stockIssueWizardSchema>;

// Status icon helper (no background colors, only icon + label)
const getStatusIcon = (status: string | undefined) => {
  switch (status) {
    case "Issued":
      return <ArrowRightLeft className="h-4 w-4 text-blue-600" />;
    case "Applied":
      return <CheckCircle className="h-4 w-4 text-green-600" />;
    case "Cancelled":
      return <XCircle className="h-4 w-4 text-red-600" />;
    case "Draft":
    default:
      return <FileText className="h-4 w-4 text-gray-500" />;
  }
};

// Status classes for bordered pill (no background fill)
const getStatusClasses = (status: string | undefined) => {
  switch (status) {
    case "Issued":
      return "border-blue-300 text-blue-700 bg-blue-50";
    case "Applied":
      return "border-green-300 text-green-700 bg-green-50";
    case "Cancelled":
      return "border-red-300 text-red-700 bg-red-50";
    case "Draft":
    default:
      return "border-gray-300 text-gray-700 bg-gray-50";
  }
};

export default function StockIssuesPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState<any | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [deliveryNumberInput, setDeliveryNumberInput] = useState("");
  const [deliveryFetchError, setDeliveryFetchError] = useState<string | null>(null);
  const [deliveryDetails, setDeliveryDetails] = useState<any | null>(null);
  const [deliveryItems, setDeliveryItems] = useState<any[]>([]);
  const [deliveryFetching, setDeliveryFetching] = useState(false);
  const [deliveryItemsLoading, setDeliveryItemsLoading] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Record<string, { include: boolean; quantity: number }>>({});
  const [uploadedDeliveryFile, setUploadedDeliveryFile] = useState<File | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const wizardForm = useForm<StockIssueWizardForm>({
    resolver: zodResolver(stockIssueWizardSchema),
    defaultValues: {
      issueNumberPrefix: "",
      issuedTo: "",
      purpose: "Delivery Issue",
      issueDate: new Date().toISOString().split("T")[0],
      notes: "",
      status: "Issued",
    },
  });

  // Fetch stock issues from new API
  const { data: stockIssues = [], isLoading } = useQuery({
    queryKey: ["stock-issues"],
    queryFn: async () => {
      try {
        const response = await apiRequest("GET", "/api/stock-issues");
        const data = await response.json();
        return Array.isArray(data) ? data : [];
      } catch (error) {
        console.error("Failed to fetch stock issues:", error);
        return [];
      }
    },
  });

  // Fetch items for dropdown
   const { data: items = [] } = useQuery({
      queryKey: ["inventory-items"],
      queryFn: async () => {
        try {
          const response = await apiRequest("GET", "/api/inventory-items");
          const data = await response.json();
          return Array.isArray(data) ? data : [];
        } catch (error) {
          console.error("Failed to fetch inventory items:", error);
          return [];
        }
      },
    });

  // Fetch statistics
  const { data: stats } = useQuery({
    queryKey: ["stock-issues-stats"],
    queryFn: async () => {
      const issuesArray = Array.isArray(stockIssues) ? stockIssues : [];
      const total = issuesArray.length;
      const draft = issuesArray.filter(i => i.status === "Draft").length;
      const issued = issuesArray.filter(i => i.status === "Issued").length;
      const applied = issuesArray.filter(i => i.status === "Applied").length;
      const cancelled = issuesArray.filter(i => i.status === "Cancelled").length;
      
      // Calculate total value issued
      const totalValue = issuesArray.reduce((sum, issue) => {
        return sum + (parseFloat(issue.quantity || "0") * parseFloat(issue.unitPrice || "0"));
      }, 0);
      
      return { total, draft, issued, applied, cancelled, totalValue };
    },
    enabled: Array.isArray(stockIssues) && stockIssues.length > 0,
  });

  // Update stock issue mutation
  const updateIssueMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string, data: Partial<StockIssueForm> }) => {
      return await apiRequest("PUT", `/api/stock-issues/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stock-issues"] });
      toast({ title: "Success", description: "Stock issue updated successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update stock issue", variant: "destructive" });
    },
  });

  // Delete stock issue mutation
  const deleteIssueMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/stock-issues/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stock-issues"] });
      toast({ title: "Success", description: "Stock issue deleted" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to delete stock issue", variant: "destructive" });
    },
  });

  const safeNumber = (value: unknown) => {
    if (typeof value === "number" && !isNaN(value)) return value;
    if (typeof value === "string") {
      const parsed = parseFloat(value);
      return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  };

  const getItemBaseQuantity = (item: any) => {
    const delivered = safeNumber(item?.deliveredQuantity);
    if (delivered > 0) return delivered;
    const picked = safeNumber(item?.pickedQuantity);
    if (picked > 0) return picked;
    const ordered = safeNumber(item?.orderedQuantity);
    if (ordered > 0) return ordered;
    return 0;
  };

  const submitWizardMutation = useMutation({
    mutationFn: async (payload: {
      delivery: any;
      items: Array<{ item: any; quantity: number }>;
      values: StockIssueWizardForm;
    }) => {
      const created: any[] = [];
      const { values, items } = payload;
      const isoDate = toBackendTimestamp(values.issueDate ?? null);
      for (let index = 0; index < items.length; index += 1) {
        const { item, quantity } = items[index];
        if (!item?.itemId) {
          throw new Error(`Delivery item “${item?.description || "Unnamed"}” is missing a linked inventory item.`);
        }
        if (quantity <= 0) {
          continue;
        }
        const issueNumberSuffix = String(index + 1).padStart(2, "0");
        const issueNumber = `${values.issueNumberPrefix}-${issueNumberSuffix}`;
        const requestBody: Record<string, unknown> = {
          issueNumber,
          itemId: item.itemId,
          issuedTo: values.issuedTo,
          quantity,
          reason: values.purpose,
          notes: values.notes,
          status: values.status,
        };
        if (isoDate) requestBody.issueDate = isoDate;
        const response = await apiRequest("POST", "/api/stock-issues", requestBody);
        const createdIssue = await response.json().catch(() => null);
        created.push(createdIssue);
      }
      if (!created.length) {
        throw new Error("No stock issues were created. Please ensure at least one item has a quantity greater than zero.");
      }
      return created;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stock-issues"] });
      queryClient.invalidateQueries({ queryKey: ["stock-issues-stats"] });
      toast({ title: "Stock issues created", description: "Delivery items have been issued successfully." });
      setShowCreateDialog(false);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to create stock issues",
        description: error?.message || "Unknown error",
        variant: "destructive",
      });
    },
  });

  const resetWizard = useCallback(() => {
    setWizardStep(1);
    setDeliveryNumberInput("");
    setDeliveryFetchError(null);
    setDeliveryDetails(null);
    setDeliveryItems([]);
    setSelectedItems({});
    setUploadedDeliveryFile(null);
    setDeliveryFetching(false);
    setDeliveryItemsLoading(false);
    wizardForm.reset({
      issueNumberPrefix: "",
      issuedTo: "",
      purpose: "Delivery Issue",
      issueDate: new Date().toISOString().split("T")[0],
      notes: "",
      status: "Issued",
    });
  }, [wizardForm]);

  const { reset: resetWizardMutation } = submitWizardMutation;

  useEffect(() => {
    if (!showCreateDialog) {
      resetWizard();
      resetWizardMutation();
    }
  }, [resetWizard, resetWizardMutation, showCreateDialog]);

  const deliveryCustomerName = deliveryDetails?.salesOrder?.customer?.name
    || deliveryDetails?.customer?.name
    || deliveryDetails?.customerName
    || "";

  const deliverySupplierName = deliveryDetails?.salesOrder?.supplier?.name
    || deliveryDetails?.supplier?.name
    || deliveryDetails?.supplierName
    || "";

  const wizardStepsMeta = [
    { label: "Upload", description: "Delivery note reference" },
    { label: "Details", description: "Verify delivery info" },
    { label: "Items", description: "Choose lines to issue" },
    { label: "Review", description: "Confirm & submit" },
  ];

  const computedSelections = useMemo(() => {
    return deliveryItems.map((item: any) => {
      const selection = selectedItems[item.id];
      if (selection) return { item, include: selection.include, quantity: selection.quantity };
      const baseQuantity = getItemBaseQuantity(item);
      return {
        item,
        include: baseQuantity > 0,
        quantity: baseQuantity,
      };
    });
  }, [deliveryItems, selectedItems]);

  const selectedItemEntries = useMemo(
    () => computedSelections.filter(entry => entry.include && entry.quantity > 0),
    [computedSelections]
  );

  const totalSelectedQuantity = useMemo(
    () => selectedItemEntries.reduce((sum, entry) => sum + safeNumber(entry.quantity), 0),
    [selectedItemEntries]
  );

  const totalSelectedValue = useMemo(
    () => selectedItemEntries.reduce((sum, entry) => {
      const unitPrice = safeNumber(entry.item?.unitPrice);
      return sum + unitPrice * safeNumber(entry.quantity);
    }, 0),
    [selectedItemEntries]
  );

  const handleItemToggle = (itemId: string, include: boolean) => {
    setSelectedItems(prev => {
      const current = prev[itemId] ?? computedSelections.find(entry => entry.item.id === itemId);
      const baseQuantity = current ? current.quantity : getItemBaseQuantity(deliveryItems.find(item => item.id === itemId));
      return {
        ...prev,
        [itemId]: {
          include,
          quantity: include ? safeNumber(baseQuantity) || 0 : safeNumber(baseQuantity) || 0,
        },
      };
    });
  };

  const handleQuantityChange = (itemId: string, quantity: number) => {
    setSelectedItems(prev => {
      const target = deliveryItems.find(item => item.id === itemId);
      if (target && !target.itemId) {
        return prev;
      }
      const existing = prev[itemId];
      return {
        ...prev,
        [itemId]: {
          include: quantity > 0,
          quantity: quantity < 0 ? 0 : quantity,
        },
      };
    });
  };

  const fetchDeliveryDetails = async () => {
    const trimmed = deliveryNumberInput.trim();
    if (!trimmed) {
      setDeliveryFetchError("Please enter a delivery number before continuing.");
      return;
    }
    setDeliveryFetching(true);
    setDeliveryFetchError(null);
    try {
      const response = await apiRequest("GET", `/api/delivery-notes?search=${encodeURIComponent(trimmed)}`);
      const data = await response.json();
      const toArray = (payload: any): any[] => {
        if (Array.isArray(payload)) return payload;
        if (Array.isArray(payload?.data)) return payload.data;
        if (Array.isArray(payload?.results)) return payload.results;
        return [];
      };
      const candidates = toArray(data);
      const deliveryNumberLower = trimmed.toLowerCase();
      const matched = candidates.find((candidate: any) => {
        const number = candidate?.deliveryNumber ?? candidate?.delivery_number;
        return typeof number === "string" && number.toLowerCase() === deliveryNumberLower;
      }) || candidates[0];

      if (!matched) {
        throw new Error(`Delivery note ${trimmed} was not found.`);
      }

      const normalizedDelivery = {
        ...matched,
        deliveryNumber: matched.deliveryNumber ?? matched.delivery_number ?? trimmed,
      };

      if (!normalizedDelivery.id) {
        throw new Error("Delivery record is missing an identifier. Unable to fetch items.");
      }

      setDeliveryDetails(normalizedDelivery);

      const friendlyIssuedTo = normalizedDelivery?.salesOrder?.customer?.name
        || normalizedDelivery?.customer?.name
        || normalizedDelivery?.customerName
        || "Delivery Recipient";
      wizardForm.setValue("issueNumberPrefix", `SI-${normalizedDelivery.deliveryNumber}`);
      wizardForm.setValue("issuedTo", friendlyIssuedTo || "Delivery Recipient");
      wizardForm.setValue("purpose", "Delivery Note Issue");
      wizardForm.setValue("issueDate", new Date().toISOString().split("T")[0]);

      setDeliveryItemsLoading(true);
      try {
        const itemsResponse = await apiRequest("GET", `/api/deliveries/${normalizedDelivery.id}/items`);
        const itemsData = await itemsResponse.json();
        setDeliveryItems(Array.isArray(itemsData) ? itemsData : []);
        const defaults: Record<string, { include: boolean; quantity: number }> = {};
        (Array.isArray(itemsData) ? itemsData : []).forEach((item: any) => {
          const baseQuantity = getItemBaseQuantity(item);
          defaults[item.id] = {
            include: baseQuantity > 0 && !!item.itemId,
            quantity: baseQuantity,
          };
        });
        setSelectedItems(defaults);
      } finally {
        setDeliveryItemsLoading(false);
      }

      setWizardStep(2);
    } catch (error: any) {
      console.error("Failed to fetch delivery details", error);
      setDeliveryFetchError(error?.message || "Failed to retrieve delivery details. Please verify the number and try again.");
      setDeliveryDetails(null);
      setDeliveryItems([]);
      setSelectedItems({});
    } finally {
      setDeliveryFetching(false);
    }
  };

  useEffect(() => {
    if (wizardStep === 3 && deliveryItems.length === 0 && !deliveryItemsLoading) {
      // Ensure we don't land on step 3 without data
      setWizardStep(2);
    }
  }, [wizardStep, deliveryItems, deliveryItemsLoading]);

  const handleWizardSubmit = wizardForm.handleSubmit((values) => {
    if (!deliveryDetails) {
      toast({
        title: "Delivery details missing",
        description: "Please fetch a delivery note before submitting.",
        variant: "destructive",
      });
      return;
    }
    if (!selectedItemEntries.length) {
      toast({
        title: "No items selected",
        description: "Select at least one item with a quantity greater than zero to create stock issues.",
        variant: "destructive",
      });
      return;
    }
    submitWizardMutation.mutate({
      delivery: deliveryDetails,
      items: selectedItemEntries.map(entry => ({ item: entry.item, quantity: safeNumber(entry.quantity) })),
      values,
    });
  });

  // Filter stock issues
  const filteredIssues = (Array.isArray(stockIssues) ? stockIssues : []).filter((issue: any) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = [
      issue.issueNumber,
      issue.issuedTo,
      issue.reason, // backend uses reason
      issue.notes,
      issue.itemName,
      issue.itemCode,
    ].some((v: any) => typeof v === "string" && v.toLowerCase().includes(q));

    const matchesStatus = statusFilter === "all" || issue.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Table columns
  const columns = [
    {
      key: "issueNumber",
      header: "Issue Number",
      render: (_: any, issue: any) => (
  <span className="font-mono text-sm font-medium">{issue.issueNumber || "N/A"}</span>
      ),
    },
    {
      key: "itemName",
      header: "Item",
      render: (_: any, issue: any) => (
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-gray-500" />
          <span>{issue.itemName || "N/A"}</span>
        </div>
      ),
    },
    {
      key: "quantity",
      header: "Quantity",
      render: (value: string) => (
        <div className="flex items-center gap-2">
          <Minus className="h-4 w-4 text-red-500" />
          <span className="font-medium text-red-600">{value || "0"}</span>
        </div>
      ),
    },
    {
      key: "issuedTo",
      header: "Issued To",
      render: (value: string) => (
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-gray-500" />
          <span>{value || "N/A"}</span>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (_: any, issue: any) => (
        <div className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${getStatusClasses(issue.status)}`}>
          {getStatusIcon(issue.status)}
          <span>{issue.status || "Draft"}</span>
        </div>
      ),
    },
    {
      key: "issueDate",
      header: "Issue Date",
      render: (_: any, issue: any) => (
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-gray-500" />
          <span>{issue.issueDate ? formatDate(issue.issueDate) : "N/A"}</span>
        </div>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      render: (_: any, issue: any) => (
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSelectedIssue(issue);
              setShowDetailsDialog(true);
            }}
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSelectedIssue(issue);
              setShowEditDialog(true);
            }}
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              deleteIssueMutation.mutate(issue.id);
            }}
          >
            <Trash className="h-4 w-4 text-red-500" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-50 to-red-50 rounded-xl p-6 border border-slate-200/50 shadow-sm">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white rounded-xl shadow-sm border border-slate-200/50">
              <ArrowRightLeft className="h-10 w-10 text-red-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-800 mb-1">Stock Issues</h1>
              <p className="text-slate-600 text-base">Manage stock issues for production, sales, and internal use</p>
              <div className="flex items-center gap-4 mt-2">
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                  <span>Inventory Tracking</span>
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
                Issue Stock
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl">
              <DialogHeader>
                <DialogTitle>Issue Stock via Delivery Note</DialogTitle>
                <DialogDescription>
                  Follow the guided steps to convert a delivery note into stock issue entries.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-6">
                <div className="grid gap-3 md:grid-cols-4">
                  {wizardStepsMeta.map((meta, index) => {
                    const isActive = wizardStep === index + 1;
                    const isCompleted = wizardStep > index + 1;
                    return (
                      <div
                        key={meta.label}
                        className={`flex items-center gap-3 rounded-lg border px-3 py-2 transition-colors ${isActive ? "border-red-500 bg-red-50" : isCompleted ? "border-green-500 bg-green-50" : "border-slate-200 bg-white"}`}
                      >
                        <div className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold ${isActive ? "bg-red-600 text-white" : isCompleted ? "bg-green-600 text-white" : "bg-slate-200 text-slate-600"}`}>
                          {isCompleted ? <CheckCircle className="h-5 w-5" /> : index + 1}
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-slate-900">{meta.label}</p>
                          <p className="text-xs text-slate-500">{meta.description}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {wizardStep === 1 && (
                  <div className="space-y-6">
                    <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center">
                      <label htmlFor="delivery-note-upload" className="flex cursor-pointer flex-col items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
                          <FileUp className="h-6 w-6" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-800">Upload delivery note (optional)</p>
                          <p className="text-xs text-slate-500">Attach the signed note for reference. PDF or image files up to 10MB.</p>
                        </div>
                      </label>
                      <Input
                        id="delivery-note-upload"
                        type="file"
                        accept=".pdf,.png,.jpg,.jpeg"
                        className="hidden"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          setUploadedDeliveryFile(file ?? null);
                        }}
                      />
                      {uploadedDeliveryFile && (
                        <p className="mt-3 text-sm text-slate-600">
                          Selected file: <span className="font-medium">{uploadedDeliveryFile.name}</span>
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="delivery-number-input">Delivery Number</Label>
                      <Input
                        id="delivery-number-input"
                        placeholder="Enter delivery note number"
                        value={deliveryNumberInput}
                        onChange={(event) => {
                          const value = event.target.value.toUpperCase();
                          setDeliveryNumberInput(value);
                          if (deliveryFetchError) {
                            setDeliveryFetchError(null);
                          }
                        }}
                      />
                      <p className="text-xs text-slate-500">We will use this number to fetch delivery details and their items.</p>
                    </div>
                    {deliveryFetchError && (
                      <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-600">
                        <AlertTriangle className="mt-0.5 h-4 w-4" />
                        <span>{deliveryFetchError}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <Button type="button" variant="outline" onClick={() => setShowCreateDialog(false)}>
                        Cancel
                      </Button>
                      <Button type="button" onClick={fetchDeliveryDetails} disabled={deliveryFetching}>
                        {deliveryFetching ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Fetching...
                          </>
                        ) : (
                          "Fetch Delivery Details"
                        )}
                      </Button>
                    </div>
                  </div>
                )}

                {wizardStep === 2 && (
                  <div className="space-y-6">
                    {deliveryDetails ? (
                      <>
                        <div className="grid gap-4 md:grid-cols-3">
                          <Card>
                            <CardHeader className="pb-3">
                              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                                <FileText className="h-4 w-4 text-red-600" />
                                Delivery Overview
                              </CardTitle>
                              <CardDescription>Confirm the reference and schedule.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3 text-sm">
                              <div className="flex items-center justify-between">
                                <span className="text-slate-500">Delivery Number</span>
                                <span className="font-semibold text-slate-900">{deliveryDetails.deliveryNumber}</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-slate-500">Status</span>
                                <Badge variant="outline" className="bg-white text-slate-700">
                                  {deliveryDetails.status || "Pending"}
                                </Badge>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-slate-500">Delivery Date</span>
                                <span className="font-medium text-slate-800">{deliveryDetails.deliveryDate ? formatDate(deliveryDetails.deliveryDate) : "Not available"}</span>
                              </div>
                            </CardContent>
                          </Card>
                          <Card>
                            <CardHeader className="pb-3">
                              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                                <User className="h-4 w-4 text-red-600" />
                                Customer
                              </CardTitle>
                              <CardDescription>Recipient of this delivery.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-2 text-sm">
                              <p className="font-semibold text-slate-900">{deliveryCustomerName || "Not specified"}</p>
                              {deliveryDetails?.salesOrder?.customer?.address && (
                                <p className="text-slate-600">{deliveryDetails.salesOrder.customer.address}</p>
                              )}
                              {deliveryDetails?.deliveryAddress && (
                                <p className="text-xs text-slate-500">Ship to: {deliveryDetails.deliveryAddress}</p>
                              )}
                              {deliveryDetails?.salesOrder?.orderNumber && (
                                <p className="text-xs text-slate-500">
                                  Sales Order: <span className="font-medium text-slate-700">{deliveryDetails.salesOrder.orderNumber}</span>
                                </p>
                              )}
                            </CardContent>
                          </Card>
                          <Card>
                            <CardHeader className="pb-3">
                              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                                <Building2 className="h-4 w-4 text-red-600" />
                                Supplier
                              </CardTitle>
                              <CardDescription>Source of the goods (if applicable).</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-2 text-sm">
                              {deliverySupplierName ? (
                                <p className="font-semibold text-slate-900">{deliverySupplierName}</p>
                              ) : (
                                <p className="text-slate-500">No supplier linked to this delivery.</p>
                              )}
                              {deliveryDetails?.supplierReference && (
                                <p className="text-xs text-slate-500">Reference: {deliveryDetails.supplierReference}</p>
                              )}
                            </CardContent>
                          </Card>
                        </div>
                        <div className="flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
                          <Info className="mt-0.5 h-4 w-4" />
                          <span>
                            {deliveryItemsLoading
                              ? "Fetching delivery items..."
                              : `Found ${deliveryItems.length} item${deliveryItems.length === 1 ? "" : "s"} in this delivery note.`}
                          </span>
                        </div>
                        {uploadedDeliveryFile && (
                          <div className="rounded-md border border-slate-200 bg-white p-3 text-xs text-slate-600">
                            Attached document: <span className="font-medium">{uploadedDeliveryFile.name}</span>
                          </div>
                        )}
                        <div className="flex items-center justify-between">
                          <Button type="button" variant="outline" onClick={() => setWizardStep(1)}>
                            Back
                          </Button>
                          <Button
                            type="button"
                            onClick={() => setWizardStep(3)}
                            disabled={deliveryItemsLoading || deliveryItems.length === 0}
                          >
                            Continue to Items
                          </Button>
                        </div>
                      </>
                    ) : (
                      <div className="rounded-md border border-dashed p-6 text-center text-sm text-slate-500">
                        Delivery details are not available. Please go back and fetch a delivery note.
                      </div>
                    )}
                  </div>
                )}

                {wizardStep === 3 && (
                  <div className="space-y-6">
                    <div className="rounded-lg border bg-white p-4">
                      <h3 className="text-base font-semibold text-slate-900">Select delivery items</h3>
                      <p className="text-sm text-slate-500">Choose which lines to convert into stock issue entries and adjust the issued quantity if needed.</p>
                    </div>
                    {deliveryItemsLoading ? (
                      <div className="flex items-center justify-center rounded-lg border border-dashed p-6 text-sm text-slate-500">
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading delivery items...
                      </div>
                    ) : computedSelections.length ? (
                      <div className="overflow-hidden rounded-lg border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-12">Select</TableHead>
                              <TableHead>Item</TableHead>
                              <TableHead className="w-32 text-right">Delivered</TableHead>
                              <TableHead className="w-32 text-right">Unit Price</TableHead>
                              <TableHead className="w-36 text-right">Issue Qty</TableHead>
                              <TableHead className="w-32 text-right">Value</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {computedSelections.map(({ item, include, quantity }) => {
                              const issuedQuantity = quantity ?? 0;
                              const deliveredQty = getItemBaseQuantity(item);
                              const unitPrice = safeNumber(item?.unitPrice);
                              const lineValue = unitPrice * safeNumber(issuedQuantity);
                              const isSelectable = Boolean(item?.itemId);
                              return (
                                <TableRow key={item.id} className={!include ? "opacity-60" : undefined}>
                                  <TableCell>
                                    <Checkbox
                                      checked={include}
                                      disabled={!isSelectable}
                                      onCheckedChange={(checked) => handleItemToggle(item.id, Boolean(checked) && isSelectable)}
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <div className="space-y-1">
                                      <p className="font-medium text-slate-900">{item.description || item.itemDescription || "Unnamed item"}</p>
                                      <p className="text-xs text-slate-500">Barcode: {item.barcode || "N/A"}</p>
                                      {!item.itemId && (
                                        <Badge variant="outline" className="border-yellow-300 bg-yellow-50 text-yellow-700">Missing inventory link</Badge>
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-right font-mono text-sm">{deliveredQty}</TableCell>
                                  <TableCell className="text-right font-mono text-sm">{formatCurrency(unitPrice)}</TableCell>
                                  <TableCell className="text-right">
                                    <Input
                                      type="number"
                                      min={0}
                                      value={issuedQuantity}
                                      disabled={!include || !isSelectable}
                                      onChange={(event) => {
                                        const raw = parseFloat(event.target.value);
                                        const nextValue = Number.isFinite(raw) ? raw : 0;
                                        handleQuantityChange(item.id, nextValue);
                                      }}
                                    />
                                  </TableCell>
                                  <TableCell className="text-right font-mono text-sm">{formatCurrency(lineValue)}</TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    ) : (
                      <div className="rounded-lg border border-dashed p-6 text-center text-sm text-slate-500">
                        No delivery items were found for this note.
                      </div>
                    )}
                    <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 md:flex-row md:items-center md:justify-between">
                      <div>
                        <span className="font-semibold">{selectedItemEntries.length}</span> item{selectedItemEntries.length === 1 ? "" : "s"} selected ·
                        <span className="ml-1 font-semibold">{totalSelectedQuantity}</span> unit{totalSelectedQuantity === 1 ? "" : "s"}
                        {totalSelectedValue > 0 && (
                          <span className="ml-2">({formatCurrency(totalSelectedValue)})</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <Button type="button" variant="outline" onClick={() => setWizardStep(2)}>
                          Back
                        </Button>
                        <Button
                          type="button"
                          onClick={() => setWizardStep(4)}
                          disabled={selectedItemEntries.length === 0}
                        >
                          Review & Continue
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {wizardStep === 4 && (
                  <Form {...wizardForm}>
                    <form onSubmit={handleWizardSubmit} className="space-y-6">
                      <div className="rounded-lg border bg-white p-4">
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                          <div>
                            <h3 className="text-base font-semibold text-slate-900">Review delivery summary</h3>
                            <p className="text-sm text-slate-500">Confirm these details before creating stock issue entries.</p>
                          </div>
                          <Badge variant="outline" className="bg-emerald-50 text-emerald-700">
                            {selectedItemEntries.length} item{selectedItemEntries.length === 1 ? "" : "s"}
                          </Badge>
                        </div>
                        <div className="mt-4 grid gap-4 md:grid-cols-2">
                          <div className="space-y-1 text-sm">
                            <p className="text-slate-500">Delivery Number</p>
                            <p className="font-semibold text-slate-900">{deliveryDetails?.deliveryNumber}</p>
                          </div>
                          <div className="space-y-1 text-sm">
                            <p className="text-slate-500">Customer</p>
                            <p className="font-semibold text-slate-900">{deliveryCustomerName || "Not specified"}</p>
                          </div>
                          <div className="space-y-1 text-sm">
                            <p className="text-slate-500">Supplier</p>
                            <p className="font-semibold text-slate-900">{deliverySupplierName || "Not linked"}</p>
                          </div>
                          <div className="space-y-1 text-sm">
                            <p className="text-slate-500">Total quantity</p>
                            <p className="font-semibold text-slate-900">{totalSelectedQuantity}</p>
                          </div>
                          <div className="space-y-1 text-sm">
                            <p className="text-slate-500">Total value</p>
                            <p className="font-semibold text-slate-900">{formatCurrency(totalSelectedValue)}</p>
                          </div>
                          {uploadedDeliveryFile && (
                            <div className="space-y-1 text-sm">
                              <p className="text-slate-500">Attached document</p>
                              <p className="font-semibold text-slate-900">{uploadedDeliveryFile.name}</p>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="overflow-hidden rounded-lg border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Item</TableHead>
                              <TableHead className="w-28 text-right">Issue Qty</TableHead>
                              <TableHead className="w-32 text-right">Unit Price</TableHead>
                              <TableHead className="w-32 text-right">Line Value</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {selectedItemEntries.map(({ item, quantity }) => {
                              const unitPrice = safeNumber(item?.unitPrice);
                              const lineValue = unitPrice * safeNumber(quantity);
                              return (
                                <TableRow key={item.id}>
                                  <TableCell>
                                    <p className="font-medium text-slate-900">{item.description || item.itemDescription || "Unnamed item"}</p>
                                    <p className="text-xs text-slate-500">Barcode: {item.barcode || "N/A"}</p>
                                  </TableCell>
                                  <TableCell className="text-right font-mono text-sm">{quantity}</TableCell>
                                  <TableCell className="text-right font-mono text-sm">{formatCurrency(unitPrice)}</TableCell>
                                  <TableCell className="text-right font-mono text-sm">{formatCurrency(lineValue)}</TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <FormField
                          control={wizardForm.control}
                          name="issueNumberPrefix"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Issue Number Prefix</FormLabel>
                              <FormControl>
                                <Input placeholder="e.g. SI-DLV-1234" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={wizardForm.control}
                          name="issueDate"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Issue Date</FormLabel>
                              <FormControl>
                                <Input type="date" value={field.value ?? ""} onChange={field.onChange} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={wizardForm.control}
                          name="issuedTo"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Issued To</FormLabel>
                              <FormControl>
                                <Input placeholder="Department or person receiving" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={wizardForm.control}
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
                                  <SelectItem value="Issued">Issued</SelectItem>
                                  <SelectItem value="Applied">Applied</SelectItem>
                                  <SelectItem value="Cancelled">Cancelled</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={wizardForm.control}
                          name="purpose"
                          render={({ field }) => (
                            <FormItem className="md:col-span-2">
                              <FormLabel>Purpose</FormLabel>
                              <FormControl>
                                <Input placeholder="Describe why the stock is being issued" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={wizardForm.control}
                          name="notes"
                          render={({ field }) => (
                            <FormItem className="md:col-span-2">
                              <FormLabel>Notes</FormLabel>
                              <FormControl>
                                <Textarea rows={3} placeholder="Optional notes for the receiving team" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <Button type="button" variant="outline" onClick={() => setWizardStep(3)}>
                          Back
                        </Button>
                        <Button type="submit" disabled={submitWizardMutation.isPending}>
                          {submitWizardMutation.isPending ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Creating Issues...
                            </>
                          ) : (
                            "Create Stock Issues"
                          )}
                        </Button>
                      </div>
                    </form>
                  </Form>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Issues</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground">All stock issues</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Draft</CardTitle>
              <FileText className="h-4 w-4 text-gray-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-600">{stats.draft}</div>
              <p className="text-xs text-muted-foreground">Pending approval</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Issued</CardTitle>
              <ArrowRightLeft className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{stats.issued}</div>
              <p className="text-xs text-muted-foreground">Stock issued</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Applied</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.applied}</div>
              <p className="text-xs text-muted-foreground">Successfully applied</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Cancelled</CardTitle>
              <XCircle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.cancelled}</div>
              <p className="text-xs text-muted-foreground">Cancelled issues</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Value</CardTitle>
              <DollarSign className="h-4 w-4 text-emerald-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600">
                ${stats.totalValue.toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground">Issued value</p>
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
                placeholder="Search stock issues..."
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
                <SelectItem value="Issued">Issued</SelectItem>
                <SelectItem value="Applied">Applied</SelectItem>
                <SelectItem value="Cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Stock Issues Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Stock Issues</CardTitle>
          <CardDescription>
            {filteredIssues.length} of {Array.isArray(stockIssues) ? stockIssues.length : 0} stock issues
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            data={filteredIssues}
            columns={columns}
            isLoading={isLoading}
            emptyMessage="No stock issues found. Create your first stock issue to get started."
          />
      </CardContent>
    </Card>
      {/* Issue Details Dialog */}
      {/* Edit Issue Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Stock Issue</DialogTitle>
            <DialogDescription>
              Edit details for Issue #{selectedIssue?.issueNumber || "N/A"}
            </DialogDescription>
          </DialogHeader>
          {selectedIssue && (
            <EditStockIssueForm
              issue={selectedIssue}
              items={items}
              onClose={() => setShowEditDialog(false)}
              onSuccess={() => {
                setShowEditDialog(false);
                queryClient.invalidateQueries({ queryKey: ["stock-issues"] });
                toast({ title: "Success", description: "Stock issue updated successfully" });
              }}
            />
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Stock Issue Details</DialogTitle>
            <DialogDescription>
              Issue #{selectedIssue?.issueNumber || "N/A"}
            </DialogDescription>
          </DialogHeader>
          {selectedIssue && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Issue Number</Label>
                    <p className="text-sm font-medium">{selectedIssue.issueNumber || "N/A"}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Item</Label>
                    <p className="text-sm font-medium">{selectedIssue.itemName || selectedIssue.itemCode || "N/A"}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Quantity Issued</Label>
                    <p className="text-sm font-medium text-red-600">{selectedIssue.quantity || "0"}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Status</Label>
                    <div className={`mt-1 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${getStatusClasses(selectedIssue.status)}`}>
                      {getStatusIcon(selectedIssue.status)}
                      <span>{selectedIssue.status || "Draft"}</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Issue Date</Label>
                    <p className="text-sm font-medium">
                      {selectedIssue.issueDate ? formatDate(selectedIssue.issueDate) : "N/A"}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Issued To</Label>
                    <p className="text-sm font-medium">{selectedIssue.issuedTo || "N/A"}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Purpose</Label>
                    <p className="text-sm font-medium">{selectedIssue.reason || "N/A"}</p>
                  </div>
                </div>
              </div>
              {selectedIssue.notes && (
                <div>
                  <Label className="text-sm font-medium text-gray-500">Notes</Label>
                  <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-md">
                    {selectedIssue.notes}
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

// Edit form component
function EditStockIssueForm({ issue, items, onClose, onSuccess }: { issue: any, items: any[], onClose: () => void, onSuccess: () => void }) {
  const { toast } = useToast();
  const form = useForm<StockIssueForm>({
    resolver: zodResolver(stockIssueSchema),
    defaultValues: {
      issueNumber: issue.issueNumber || "",
      itemId: issue.itemId || "",
      quantityIssued: issue.quantity || 0,
      issuedTo: issue.issuedTo || "",
      issueDate: issue.issueDate ? issue.issueDate.split("T")[0] : "",
      purpose: issue.reason || "",
      departmentId: issue.departmentId || "",
      notes: issue.notes || "",
      status: issue.status || "Draft",
    },
  });

  const queryClient = useQueryClient();
  // Use the main updateIssueMutation from props
  const { mutate, isPending } = useMutation({
    mutationFn: async (data: StockIssueForm) => {
      // Always send ISO string or null for backend
      const validDate = toBackendTimestamp(data.issueDate);
      const updateData = {
        issueNumber: data.issueNumber,
        itemId: data.itemId,
        issuedTo: data.issuedTo,
        quantity: Number(data.quantityIssued),
        issueDate: validDate,
        reason: data.purpose,
        notes: data.notes,
        status: data.status,
      };
      return await apiRequest("PUT", `/api/stock-issues/${issue.id}`, updateData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stock-issues"] });
      onSuccess();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update stock issue", variant: "destructive" });
    },
  });

  const onSubmit = (data: StockIssueForm) => {
  mutate(data);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="issueNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Issue Number</FormLabel>
                <FormControl>
                  <Input placeholder="Enter issue number" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="itemId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Item</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select item" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {items.map((item: any) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.description || item.name || item.itemCode}
                      </SelectItem>
                    ))}
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
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="Draft">Draft</SelectItem>
                    <SelectItem value="Issued">Issued</SelectItem>
                    <SelectItem value="Applied">Applied</SelectItem>
                    <SelectItem value="Cancelled">Cancelled</SelectItem>
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
            name="quantityIssued"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Quantity to Issue</FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    placeholder="Enter quantity"
                    {...field}
                    onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="issueDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Issue Date</FormLabel>
                <FormControl>
                  <Input type="date" {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="issuedTo"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Issued To</FormLabel>
                <FormControl>
                  <Input placeholder="Enter person/department" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="purpose"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Purpose</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select purpose" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="Production">Production</SelectItem>
                    <SelectItem value="Sales">Sales</SelectItem>
                    <SelectItem value="Internal Use">Internal Use</SelectItem>
                    <SelectItem value="Maintenance">Maintenance</SelectItem>
                    <SelectItem value="Testing">Testing</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
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
              <FormLabel>Notes</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Enter any additional notes..."
                  rows={3}
                  {...field} 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex justify-end gap-3 pt-4">
          <Button 
            type="button" 
            variant="outline" 
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? "Updating..." : "Update Issue"}
          </Button>
        </div>
      </form>
    </Form>
  );
}