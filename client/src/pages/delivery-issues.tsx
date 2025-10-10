import { useMemo } from "react";
import type { ChangeEvent, ElementType } from "react";
import {
  Upload,
  FileSearch,
  PackageSearch,
  CheckCircle2,
  FileText,
  AlertTriangle,
} from "lucide-react";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import React, { useState } from "react";
import { FaUpload, FaFileAlt, FaList, FaCheckCircle } from "react-icons/fa";
import { Dialog, DialogContent } from "@radix-ui/react-dialog";

// Step 1: Upload Document
type StepUploadProps = {
  onNext: () => void;
  setDocument: (file: File | null) => void;
};
const StepUpload: React.FC<StepUploadProps> = ({ onNext, setDocument }) => {
  const [file, setFile] = useState<File | null>(null);
  return (
    <div className="wizard-step">
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><FaUpload /> Upload Issue Document</h2>
      <input type="file" accept=".pdf,.doc,.docx,.jpg,.png" onChange={e => {
        const selectedFile = e.target.files && e.target.files[0] ? e.target.files[0] : null;
        setFile(selectedFile);
        setDocument(selectedFile);
      }} />
      <button
        className="mt-4 px-4 py-2 bg-blue-600 text-white rounded"
        disabled={!file}
        onClick={onNext}
      >Next</button>
    </div>
  );
};

// Step 2: Fetch Header Details
type HeaderType = {
  issueNo: string;
  date: string;
  customer: string;
};
type StepHeaderProps = {
  document: File | null;
  header: HeaderType | null;
  setHeader: (header: HeaderType | null) => void;
  onNext: () => void;
  onPrev: () => void;
};
const StepHeader: React.FC<StepHeaderProps> = ({ document, header, setHeader, onNext, onPrev }) => {
  React.useEffect(() => {
    if (document) {
      setHeader({ issueNo: "ISSUE-12345", date: "2025-10-10", customer: "ABC Corp" });
    }
  }, [document, setHeader]);
  return (
    <div className="wizard-step">
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><FaFileAlt /> Issue Header Details</h2>
      {header ? (
        <div className="mb-4">
          <div><strong>Issue No:</strong> {header.issueNo}</div>
          <div><strong>Date:</strong> {header.date}</div>
          <div><strong>Customer:</strong> {header.customer}</div>
        </div>
      ) : <div>Loading header details...</div>}
      <div className="flex gap-2">
        <button className="px-4 py-2 bg-gray-300 rounded" onClick={onPrev}>Back</button>
        <button className="px-4 py-2 bg-blue-600 text-white rounded" onClick={onNext}>Next</button>
      </div>
    </div>
  );
};

// Step 3: Fetch Item Details
type ItemType = {
  id: number;
  name: string;
  qty: number;
};
type StepItemsProps = {
  header: HeaderType | null;
  items: ItemType[];
  setItems: (items: ItemType[]) => void;
  onNext: () => void;
  onPrev: () => void;
};
const StepItems: React.FC<StepItemsProps> = ({ header, items, setItems, onNext, onPrev }) => {
  React.useEffect(() => {
    if (header) {
      setItems([
        { id: 1, name: "Item A", qty: 10 },
        { id: 2, name: "Item B", qty: 5 }
      ]);
    }
  }, [header, setItems]);
  return (
    <div className="wizard-step">
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><FaList /> Issue Items</h2>
      {items && items.length ? (
        <ul className="mb-4">
          {items.map(item => (
            <li key={item.id} className="border-b py-2 flex justify-between">
              <span>{item.name}</span>
              <span>Qty: {item.qty}</span>
            </li>
          ))}
        </ul>
      ) : <div>Loading items...</div>}
      <div className="flex gap-2">
        <button className="px-4 py-2 bg-gray-300 rounded" onClick={onPrev}>Back</button>
        <button className="px-4 py-2 bg-blue-600 text-white rounded" onClick={onNext}>Next</button>
      </div>
    </div>
  );
};

// Step 4: Review & Submit
type StepReviewProps = {
  document: File | null;
  header: HeaderType | null;
  items: ItemType[];
  onPrev: () => void;
  onSubmit: () => void;
  submitted: boolean;
};
const StepReview: React.FC<StepReviewProps> = ({ document, header, items, onPrev, onSubmit, submitted }) => {
  return (
    <div className="wizard-step">
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><FaCheckCircle /> Review & Submit</h2>
      <div className="mb-4">
        <div><strong>Document:</strong> {document?.name}</div>
        <div><strong>Issue No:</strong> {header?.issueNo}</div>
        <div><strong>Date:</strong> {header?.date}</div>
        <div><strong>Customer:</strong> {header?.customer}</div>
        <div><strong>Items:</strong></div>
        <ul>
          {items?.map(item => (
            <li key={item.id}>{item.name} (Qty: {item.qty})</li>
          ))}
        </ul>
      </div>
      {submitted ? (
        <div className="text-green-600 font-bold">Issue Return Submitted Successfully!</div>
      ) : (
        <div className="flex gap-2">
          <button className="px-4 py-2 bg-gray-300 rounded" onClick={onPrev}>Back</button>
          <button className="px-4 py-2 bg-green-600 text-white rounded" onClick={onSubmit}>Submit</button>
        </div>
      )}
    </div>
  );
};


type IssueReturnHeader = {
  issueNumber: string;
  deliveryNumber: string;
  issueDate: string;
  customerName: string;
  customerReference: string;
  warehouse: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  reasonCategory: string;
  remarks: string;
  documentName?: string;
};

// Define IssueReturnItem type
type IssueReturnItem = {
  id: string;
  sku: string;
  description: string;
  deliveredQty: number;
  returnableQty: number;
  returnQty: number;
  unitPrice: number;
  reason: string;
  selected: boolean;
};

const wizardSteps = [
  {
    label: "Upload Document",
    description: "Attach the signed delivery note or issue report.",
    icon: Upload,
  },
  {
    label: "Header Details",
    description: "Fetch or enter shipment and customer info.",
    icon: FileSearch,
  },
  {
    label: "Select Items",
    description: "Choose items and quantities for return.",
    icon: PackageSearch,
  },
  {
    label: "Review & Submit",
    description: "Validate and submit the issue return.",
    icon: CheckCircle2,
  },
];

export default function DeliveryIssueReturnPage() {
  const [currentStep, setCurrentStep] = useState(1);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [issueNumberInput, setIssueNumberInput] = useState("");
  const [deliveryNumberInput, setDeliveryNumberInput] = useState("");

  const [headerDetails, setHeaderDetails] = useState<IssueReturnHeader | null>(null);
  
    const [items, setItems] = useState<IssueReturnItem[]>([]);
  const [isFetchingHeader, setIsFetchingHeader] = useState(false);
  const [isFetchingItems, setIsFetchingItems] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const selectedItems = useMemo(
    () => items.filter((item) => item.selected && item.returnQty > 0),
    [items]
  );

  const totals = useMemo(
    () => ({
      quantity: selectedItems.reduce((sum, item) => sum + item.returnQty, 0),
      value: selectedItems.reduce((sum, item) => sum + item.returnQty * item.unitPrice, 0),
    }),
    [selectedItems]
  );

  const canProceed = useMemo(() => {
    if (currentStep === 1) {
      return Boolean(uploadedFile);
    }
    if (currentStep === 2) {
      return Boolean(headerDetails);
    }
    if (currentStep === 3) {
      return selectedItems.length > 0;
    }
    if (currentStep === 4) {
      return selectedItems.length > 0 && totals.quantity > 0;
    }
    return true;
  }, [currentStep, headerDetails, uploadedFile, selectedItems, totals.quantity]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setUploadedFile(file);
    if (file) {
      toast({ title: "Document attached", description: `${file.name} is ready for processing.` });
    }
  };

  const removeFile = () => {
    setUploadedFile(null);
  };

  const prefillHeaderManually = () => {
    const fallback = buildFallbackHeader(issueNumberInput, deliveryNumberInput, uploadedFile?.name);
    setHeaderDetails(fallback);
    setIssueNumberInput(fallback.issueNumber);
    setDeliveryNumberInput(fallback.deliveryNumber);
    toast({ title: "Manual template ready", description: "Edit the header fields as needed before continuing." });
  };

  const fetchHeaderDetails = async () => {
    const issueNumber = issueNumberInput.trim();
    const deliveryNumber = deliveryNumberInput.trim();

    if (!issueNumber && !deliveryNumber) {
      toast({
        title: "Provide a reference",
        description: "Enter at least an issue number or delivery number to locate header details.",
        variant: "destructive",
      });
      return;
    }

    setIsFetchingHeader(true);
    try {
      const response = await apiRequest("POST", "/api/delivery-issues/lookup", {
        issueNumber: issueNumber || undefined,
        deliveryNumber: deliveryNumber || undefined,
        documentName: uploadedFile?.name,
      });
      const payload = await response.json();
      const normalized = normalizeHeaderResponse(payload, {
        issueNumber: issueNumber || deliveryNumber || `IR-${Date.now().toString().slice(-6)}`,
        deliveryNumber: deliveryNumber || undefined,
        documentName: uploadedFile?.name,
      });
      setHeaderDetails(normalized);
      setIssueNumberInput(normalized.issueNumber);
      setDeliveryNumberInput(normalized.deliveryNumber);
      toast({
        title: "Header details loaded",
        description: `Delivery ${normalized.deliveryNumber} linked successfully.`,
      });
    } catch (error) {
      const fallback = buildFallbackHeader(issueNumber || deliveryNumber, deliveryNumber, uploadedFile?.name);
      setHeaderDetails(fallback);
      setIssueNumberInput(fallback.issueNumber);
      setDeliveryNumberInput(fallback.deliveryNumber);
      const message = error instanceof Error ? error.message : "Unable to reach the lookup service.";
      toast({
        title: "Using fallback header",
        description: `${message} You can adjust the pre-filled details manually.`,
      });
    } finally {
      setIsFetchingHeader(false);
    }
  };

  const fetchItems = async (): Promise<IssueReturnItem[]> => {
    if (!headerDetails) {
      toast({
        title: "Header required",
        description: "Fetch or enter header details before loading items.",
        variant: "destructive",
      });
      return [];
    }

    setIsFetchingItems(true);
    try {
      const response = await apiRequest(
        "GET",
        `/api/delivery-issues/${encodeURIComponent(headerDetails.issueNumber)}/items` +
        (headerDetails.deliveryNumber ? `?delivery=${encodeURIComponent(headerDetails.deliveryNumber)}` : "")
      );
      const payload = await response.json();
      const normalized = normalizeItemsResponse(payload, headerDetails.issueNumber);
      setItems(normalized);
      if (normalized.length === 0) {
        toast({ title: "No items found", description: "The lookup did not return any lines for this issue." });
      } else {
        toast({ title: "Items loaded", description: `Fetched ${normalized.length} item(s) for review.` });
      }
      return normalized;
    } catch (error) {
      const fallback = buildFallbackItems(headerDetails.issueNumber);
      setItems(fallback);
      const message = error instanceof Error ? error.message : "Unable to fetch line items.";
      toast({
        title: "Using fallback items",
        description: `${message} Sample lines have been provided for review.`,
      });
      return fallback;
    } finally {
      setIsFetchingItems(false);
    }
  };

  const handleHeaderInputChange = (field: keyof IssueReturnHeader) => (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setHeaderDetails((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  const handleHeaderRemarksChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const value = event.target.value;
    setHeaderDetails((prev) => (prev ? { ...prev, remarks: value } : prev));
  };

  const toggleItemSelection = (id: string, nextValue: boolean) => {
    setItems((prev) => prev.map((item) => {
      if (item.id !== id) {
        return item;
      }
      if (!nextValue) {
        return { ...item, selected: false, returnQty: 0 };
      }
      const recommended = item.returnableQty > 0
        ? Math.min(item.returnQty > 0 ? item.returnQty : 1, item.returnableQty)
        : 0;
      return { ...item, selected: recommended > 0, returnQty: recommended };
    })
    );
  };

  const handleReturnQtyChange = (id: string) => (event: ChangeEvent<HTMLInputElement>) => {
    const parsed = Number(event.target.value);
    setItems((prev) => prev.map((item) => {
      if (item.id !== id) {
        return item;
      }
      const clamped = Math.max(0, Math.min(Number.isNaN(parsed) ? 0 : parsed, item.returnableQty));
      return {
        ...item,
        returnQty: clamped,
        selected: clamped > 0,
      };
    })
    );
  };

  const handleReasonChange = (id: string) => (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, reason: value } : item)));
  };

  const selectAllItems = (shouldSelect: boolean) => {
    setItems((prev) => prev.map((item) => {
      if (!shouldSelect) {
        return { ...item, selected: false, returnQty: 0 };
      }
      const recommended = item.returnableQty > 0 ? Math.min(item.returnQty > 0 ? item.returnQty : 1, item.returnableQty) : 0;
      return { ...item, selected: recommended > 0, returnQty: recommended };
    })
    );
  };

  const handleNext = async () => {
    if (currentStep === 1) {
      setCurrentStep(2);
      return;
    }
    if (currentStep === 2) {
      if (!headerDetails) {
        toast({
          title: "Complete header",
          description: "Populate the header details before continuing.",
          variant: "destructive",
        });
        return;
      }
      await fetchItems();
      setCurrentStep(3);
      return;
    }
    if (currentStep === 3) {
      if (selectedItems.length === 0) {
        toast({
          title: "Select at least one item",
          description: "Choose the lines that should be included in the issue return.",
          variant: "destructive",
        });
        return;
      }
      setCurrentStep(4);
    }
  };

  const handleBack = () => {
    setCurrentStep((step) => Math.max(1, step - 1));
  };

  const handleReset = () => {
    setCurrentStep(1);
    setUploadedFile(null);
    setIssueNumberInput("");
    setDeliveryNumberInput("");
    setHeaderDetails(null);
    setItems([]);
    setIsFetchingHeader(false);
    setIsFetchingItems(false);
  };

  const handleSubmit = async () => {
    if (!headerDetails || selectedItems.length === 0) {
      toast({
        title: "Nothing to submit",
        description: "Select at least one item with a return quantity before submitting.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await apiRequest("POST", "/api/delivery-issues/returns", {
        documentName: uploadedFile?.name,
        header: headerDetails,
        items: selectedItems,
        totals,
      });
      let reference = headerDetails.issueNumber;
      const contentType = response.headers.get("content-type") ?? "";
      if (contentType.includes("application/json")) {
        const payload = await response.json();
        reference = String(
          payload.reference ?? payload.issueNumber ?? payload.issue_return_number ?? reference
        );
      }
      toast({
        title: "Issue return submitted",
        description: `Return ${reference} has been sent for processing.`,
      });
      handleReset();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected error while submitting.";
      toast({
        title: "Submission failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Issues Return</h1>
        <p className="text-sm text-gray-600">
          Create a delivery issue return by following the guided four-step wizard.
        </p>
      </div>

      <Card>
        <CardContent className="grid gap-4 p-6 md:grid-cols-4">
          {wizardSteps.map((step, index) => {
            const stepNumber = index + 1;
            const Icon = step.icon;
            const isCompleted = currentStep > stepNumber;
            const isActive = currentStep === stepNumber;
            return (
              <div
                key={step.label}
                className={cn(
                  "rounded-lg border p-4 transition",
                  isActive
                    ? "border-blue-500 bg-blue-50"
                    : isCompleted
                      ? "border-emerald-500 bg-emerald-50"
                      : "border-gray-200 bg-white"
                )}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-full border text-sm font-semibold",
                      isActive
                        ? "border-blue-500 bg-blue-600 text-white"
                        : isCompleted
                          ? "border-emerald-500 bg-emerald-500 text-white"
                          : "border-gray-300 bg-gray-100 text-gray-600"
                    )}
                  >
                    {stepNumber}
                  </span>
                  <Icon
                    className={cn(
                      "h-5 w-5",
                      isActive ? "text-blue-600" : isCompleted ? "text-emerald-600" : "text-gray-400"
                    )} />
                </div>
                <div className="mt-3">
                  <p className="text-sm font-medium text-gray-900">{step.label}</p>
                  <p className="text-xs text-gray-500">{step.description}</p>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {currentStep === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Step 1 · Upload supporting document</CardTitle>
            <CardDescription>
              Add the signed delivery note, discrepancy report, or customer communication describing the issue.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 p-10 text-center transition hover:border-blue-400 hover:bg-blue-50/50">
              <Upload className="mb-3 h-12 w-12 text-blue-500" />
              <p className="text-sm text-gray-600">
                Drag and drop the issue document here, or <span className="font-semibold text-blue-600">browse</span> to upload.
              </p>
              <p className="mt-2 text-xs text-gray-400">Accepted formats: PDF, Excel, CSV, JSON (max 20 MB)</p>
              <input
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.json,.txt,.xml"
                onChange={handleFileChange}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
            </div>

            {uploadedFile && (
              <div className="rounded-lg border border-blue-100 bg-blue-50/60 p-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <FileText className="mt-0.5 h-5 w-5 text-blue-600" />
                    <div className="text-sm">
                      <p className="font-medium text-gray-900">{uploadedFile.name}</p>
                      <p className="text-xs text-gray-500">
                        {(uploadedFile.size / 1024).toFixed(1)} KB · uploaded {formatDate(new Date())}
                      </p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={removeFile}>
                    Remove
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {currentStep === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Step 2 · Fetch header details</CardTitle>
            <CardDescription>Use the issue or delivery number to pull shipment metadata and customer context.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-5">
              <div className="md:col-span-2 space-y-2">
                <Label htmlFor="issue-number">Issue number</Label>
                <Input
                  id="issue-number"
                  placeholder="e.g. IR-240901"
                  value={issueNumberInput}
                  onChange={(event) => setIssueNumberInput(event.target.value.toUpperCase())} />
              </div>
              <div className="md:col-span-2 space-y-2">
                <Label htmlFor="delivery-number">Delivery note</Label>
                <Input
                  id="delivery-number"
                  placeholder="Optional"
                  value={deliveryNumberInput}
                  onChange={(event) => setDeliveryNumberInput(event.target.value.toUpperCase())} />
              </div>
              <div className="md:col-span-1 flex flex-col gap-2 pt-6 md:pt-0">
                <Button
                  onClick={fetchHeaderDetails}
                  disabled={isFetchingHeader || (!issueNumberInput.trim() && !deliveryNumberInput.trim())}
                  className="w-full"
                >
                  {isFetchingHeader ? "Fetching…" : "Fetch details"}
                </Button>
                <Button variant="outline" onClick={prefillHeaderManually} className="w-full">
                  Manual template
                </Button>
              </div>
            </div>

            {headerDetails ? (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="header-issue-number">Issue number</Label>
                  <Input
                    id="header-issue-number"
                    value={headerDetails.issueNumber}
                    onChange={handleHeaderInputChange("issueNumber")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="header-delivery-number">Delivery note</Label>
                  <Input
                    id="header-delivery-number"
                    value={headerDetails.deliveryNumber}
                    onChange={handleHeaderInputChange("deliveryNumber")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="header-issue-date">Issue date</Label>
                  <Input
                    id="header-issue-date"
                    type="date"
                    value={headerDetails.issueDate}
                    onChange={handleHeaderInputChange("issueDate")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="header-customer">Customer</Label>
                  <Input
                    id="header-customer"
                    value={headerDetails.customerName}
                    onChange={handleHeaderInputChange("customerName")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="header-reference">Customer reference</Label>
                  <Input
                    id="header-reference"
                    value={headerDetails.customerReference}
                    onChange={handleHeaderInputChange("customerReference")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="header-warehouse">Warehouse</Label>
                  <Input
                    id="header-warehouse"
                    value={headerDetails.warehouse}
                    onChange={handleHeaderInputChange("warehouse")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="header-contact-name">Contact name</Label>
                  <Input
                    id="header-contact-name"
                    value={headerDetails.contactName}
                    onChange={handleHeaderInputChange("contactName")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="header-contact-email">Contact email</Label>
                  <Input
                    id="header-contact-email"
                    type="email"
                    value={headerDetails.contactEmail}
                    onChange={handleHeaderInputChange("contactEmail")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="header-contact-phone">Contact phone</Label>
                  <Input
                    id="header-contact-phone"
                    value={headerDetails.contactPhone}
                    onChange={handleHeaderInputChange("contactPhone")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="header-reason">Return category</Label>
                  <Input
                    id="header-reason"
                    value={headerDetails.reasonCategory}
                    onChange={handleHeaderInputChange("reasonCategory")} />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="header-remarks">Internal remarks</Label>
                  <Textarea
                    id="header-remarks"
                    rows={3}
                    placeholder="Add context for the warehouse or finance team."
                    value={headerDetails.remarks}
                    onChange={handleHeaderRemarksChange} />
                </div>
                {headerDetails.documentName && (
                  <div className="md:col-span-2">
                    <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                      Document: {headerDetails.documentName}
                    </Badge>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-gray-300 bg-white p-6 text-sm text-gray-600">
                Provide a reference and fetch details, or start with the manual template to enter the shipment metadata.
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {currentStep === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Step 3 · Item selection</CardTitle>
            <CardDescription>Choose the items and quantities that should be included in the issue return.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="text-sm text-gray-600">
                {headerDetails ? (
                  <span>
                    Delivery <span className="font-medium text-gray-900">{headerDetails.deliveryNumber}</span> · Customer {" "}
                    <span className="font-medium text-gray-900">{headerDetails.customerName}</span>
                  </span>
                ) : (
                  "Fetch header details to load items."
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => selectAllItems(true)} disabled={items.length === 0}>
                  Select all
                </Button>
                <Button variant="outline" size="sm" onClick={() => selectAllItems(false)} disabled={items.length === 0}>
                  Clear
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={fetchItems}
                  disabled={isFetchingItems || !headerDetails}
                >
                  {isFetchingItems ? "Fetching…" : "Refresh items"}
                </Button>
              </div>
            </div>

            {items.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center text-sm text-gray-500">
                No items loaded yet. Use “Refresh items” after confirming the header details.
              </div>
            ) : (
              <ScrollArea className="h-[360px] rounded-lg border">
                <Table>
                  <TableHeader className="bg-gray-50">
                    <TableRow>
                      <TableHead className="w-[28%]">Item</TableHead>
                      <TableHead>Delivered</TableHead>
                      <TableHead>Returnable</TableHead>
                      <TableHead>Return qty</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead className="text-right">Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => (
                      <TableRow key={item.id} className={!item.selected ? "bg-white" : "bg-blue-50/40"}>
                        <TableCell>
                          <div className="flex items-start gap-3">
                            <Checkbox
                              checked={item.selected}
                              onCheckedChange={(checked) => toggleItemSelection(item.id, checked === true)} />
                            <div>
                              <p className="font-medium text-gray-900">{item.sku}</p>
                              <p className="text-xs text-gray-500">{item.description}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="align-middle text-sm text-gray-700">{item.deliveredQty}</TableCell>
                        <TableCell className="align-middle text-sm text-gray-700">{item.returnableQty}</TableCell>
                        <TableCell className="align-middle">
                          <Input
                            type="number"
                            min={0}
                            max={item.returnableQty}
                            value={Number.isNaN(item.returnQty) ? 0 : item.returnQty}
                            onChange={handleReturnQtyChange(item.id)}
                            disabled={item.returnableQty === 0} />
                        </TableCell>
                        <TableCell className="align-middle">
                          <Input
                            placeholder="Optional"
                            value={item.reason}
                            onChange={handleReasonChange(item.id)} />
                        </TableCell>
                        <TableCell className="align-middle text-right text-sm font-medium text-gray-900">
                          {formatCurrency(item.returnQty * item.unitPrice)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            )}

            <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-700">
              <div>
                Selected items: <span className="font-semibold text-gray-900">{selectedItems.length}</span>
              </div>
              <div className="space-x-4">
                <span>
                  Quantity: <span className="font-semibold text-gray-900">{totals.quantity}</span>
                </span>
                <span>
                  Value: <span className="font-semibold text-gray-900">{formatCurrency(totals.value)}</span>
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {currentStep === 4 && (
        <Card>
          <CardHeader>
            <CardTitle>Step 4 · Review and submit</CardTitle>
            <CardDescription>Validate header information and selected items before final submission.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {headerDetails ? (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-lg border border-gray-200 bg-white p-4">
                  <p className="text-xs uppercase text-gray-500">Issue Number</p>
                  <p className="text-sm font-medium text-gray-900">{headerDetails.issueNumber}</p>
                </div>
                <div className="rounded-lg border border-gray-200 bg-white p-4">
                  <p className="text-xs uppercase text-gray-500">Delivery Note</p>
                  <p className="text-sm font-medium text-gray-900">{headerDetails.deliveryNumber}</p>
                </div>
                <div className="rounded-lg border border-gray-200 bg-white p-4">
                  <p className="text-xs uppercase text-gray-500">Issue Date</p>
                  <p className="text-sm font-medium text-gray-900">{formatDate(headerDetails.issueDate)}</p>
                </div>
                <div className="rounded-lg border border-gray-200 bg-white p-4">
                  <p className="text-xs uppercase text-gray-500">Customer</p>
                  <p className="text-sm font-medium text-gray-900">{headerDetails.customerName}</p>
                  <p className="text-xs text-gray-500">Reference {headerDetails.customerReference}</p>
                </div>
                <div className="rounded-lg border border-gray-200 bg-white p-4">
                  <p className="text-xs uppercase text-gray-500">Warehouse</p>
                  <p className="text-sm font-medium text-gray-900">{headerDetails.warehouse}</p>
                </div>
                <div className="rounded-lg border border-gray-200 bg-white p-4">
                  <p className="text-xs uppercase text-gray-500">Contact</p>
                  <p className="text-sm font-medium text-gray-900">{headerDetails.contactName}</p>
                  <p className="text-xs text-gray-500">{headerDetails.contactEmail} · {headerDetails.contactPhone}</p>
                </div>
                <div className="md:col-span-2 rounded-lg border border-gray-200 bg-white p-4">
                  <p className="text-xs uppercase text-gray-500">Remarks</p>
                  <p className="text-sm text-gray-700">{headerDetails.remarks || "—"}</p>
                </div>
                {uploadedFile && (
                  <div className="md:col-span-2">
                    <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                      Attached file: {uploadedFile.name}
                    </Badge>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
                <AlertTriangle className="h-5 w-5" />
                <span>Header details are missing. Go back to step 2 to populate them.</span>
              </div>
            )}

            <div className="rounded-lg border border-gray-200">
              <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-4 py-3">
                <p className="text-sm font-medium text-gray-900">Selected items ({selectedItems.length})</p>
                <Badge variant="outline" className="border-blue-200 text-blue-700">
                  {formatCurrency(totals.value)}
                </Badge>
              </div>
              {selectedItems.length === 0 ? (
                <div className="p-6 text-sm text-gray-500">No items selected. Return to step 3 to choose at least one line.</div>
              ) : (
                <ScrollArea className="max-h-72">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead>Return qty</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead className="text-right">Value</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedItems.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium text-gray-900">{item.sku}</p>
                              <p className="text-xs text-gray-500">{item.description}</p>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-gray-700">{item.returnQty}</TableCell>
                          <TableCell className="text-sm text-gray-600">{item.reason || "—"}</TableCell>
                          <TableCell className="text-right text-sm font-medium text-gray-900">
                            {formatCurrency(item.returnQty * item.unitPrice)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-gray-200 bg-white p-4 text-sm">
              <div className="text-gray-600">
                Total return quantity: <span className="font-semibold text-gray-900">{totals.quantity}</span>
              </div>
              <div className="text-gray-600">
                Total return value: <span className="font-semibold text-gray-900">{formatCurrency(totals.value)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 pt-4">
        <Button variant="ghost" onClick={handleReset} disabled={isSubmitting}>
          Reset
        </Button>
        <div className="flex gap-2">
          {currentStep > 1 && (
            <Button variant="outline" onClick={handleBack} disabled={isSubmitting}>
              Back
            </Button>
          )}
          {currentStep < 4 && (
            <Button onClick={handleNext} disabled={!canProceed || isFetchingHeader || isFetchingItems || isSubmitting}>
              {currentStep === 3 ? "Review" : "Next"}
            </Button>
          )}
          {currentStep === 4 && (
            <Button
              onClick={handleSubmit}
              disabled={!canProceed || isSubmitting}
            >
              {isSubmitting ? "Submitting…" : "Submit return"}
            </Button>
          )}
        </div>
      </div>
    </div>);

  // Add this type definition above the normalizeIssue function
  type DeliveryIssue = {
    id: string;
    reference: string;
    title: string;
    issueType: string;
    severity: string;
    status: string;
    customer: string;
    facility: string;
    reportedBy: string;
    reportedAt: string;
    lastUpdated: string;
    description: string;
    resolution: string;
    attachments: number;
  };

  // Fallback issues array for normalizeIssue
  const fallbackIssues: DeliveryIssue[] = [
    {
      id: "ISS-0",
      reference: "SO-1000",
      title: "Sample delivery issue",
      issueType: "General",
      severity: "Medium",
      status: "Open",
      customer: "Fallback Customer",
      facility: "Fallback Facility",
      reportedBy: "Fallback Reporter",
      reportedAt: "2024-01-01",
      lastUpdated: "2024-01-02",
      description: "This is a fallback delivery issue description.",
      resolution: "",
      attachments: 0,
    }
  ];

    function normalizeIssue(issue: any, index: number): DeliveryIssue {
      const fallback = fallbackIssues[index] ?? fallbackIssues[0];
      return {
        id: String(issue?.id ?? fallback.id ?? `ISS-${index}`),
        reference: String(
          issue?.reference ??
          issue?.orderNumber ??
          issue?.order_id ??
          fallback.reference ??
          `SO-${1000 + index}`
        ),
        title: String(issue?.title ?? issue?.summary ?? fallback.title ?? "Delivery issue"),
        issueType: String(issue?.issueType ?? issue?.category ?? fallback.issueType ?? "General"),
        severity: String(issue?.severity ?? fallback.severity ?? "Medium"),
        status: String(issue?.status ?? fallback.status ?? "Open"),
        customer: issue?.customer ?? issue?.customerName ?? fallback.customer,
        facility: issue?.facility ?? issue?.location ?? fallback.facility,
        reportedBy: issue?.reportedBy ?? issue?.reported_by ?? fallback.reportedBy,
        reportedAt: issue?.reportedAt ?? issue?.reported_at ?? fallback.reportedAt,
        lastUpdated: issue?.lastUpdated ?? issue?.updated_at ?? fallback.lastUpdated,
        description: issue?.description ?? fallback.description,
        resolution: issue?.resolution ?? fallback.resolution,
        attachments: Number(
          issue?.attachments ??
          issue?.attachmentCount ??
          (typeof fallback.attachments === "number" ? fallback.attachments : 0)
        ),
      };
    }


function normalizeHeaderResponse(
  payload: any,
  { issueNumber, deliveryNumber, documentName }: { issueNumber: string; deliveryNumber?: string; documentName?: string }
): IssueReturnHeader {
  return {
    issueNumber: payload.issueNumber ?? issueNumber,
    deliveryNumber: payload.deliveryNumber ?? deliveryNumber ?? "",
    issueDate: payload.issueDate ?? "",
    customerName: payload.customerName ?? "",
    customerReference: payload.customerReference ?? "",
    warehouse: payload.warehouse ?? "",
    contactName: payload.contactName ?? "",
    contactEmail: payload.contactEmail ?? "",
    contactPhone: payload.contactPhone ?? "",
    reasonCategory: payload.reasonCategory ?? "",
    remarks: payload.remarks ?? "",
    documentName: documentName,
  };
}
function buildFallbackHeader(issueNumberInput: string, deliveryNumberInput: string, name: string | undefined): IssueReturnHeader {
  const today = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  const issueDate = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  return {
    issueNumber: issueNumberInput || `IR-${today.getFullYear()}${pad(today.getMonth() + 1)}${pad(today.getDate())}`,
    deliveryNumber: deliveryNumberInput || "",
    issueDate,
    customerName: "",
    customerReference: "",
    warehouse: "",
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    reasonCategory: "",
    remarks: "",
    documentName: name,
  };
}
function normalizeItemsResponse(payload: any, issueNumber: string): IssueReturnItem[] {
  if (!payload || !Array.isArray(payload.items ?? payload)) {
    // Fallback: return empty array
    return [];
  }
  const itemsArray = Array.isArray(payload.items) ? payload.items : payload;
  return itemsArray.map((item: any, idx: number) => ({
    id: String(item.id ?? item.lineId ?? item.sku ?? `ITEM-${idx}`),
    sku: String(item.sku ?? item.productCode ?? item.code ?? `SKU-${idx}`),
    description: String(item.description ?? item.name ?? item.productName ?? ""),
    deliveredQty: Number(item.deliveredQty ?? item.delivered_quantity ?? item.qty_delivered ?? 0),
    returnableQty: Number(item.returnableQty ?? item.returnable_quantity ?? item.qty_returnable ?? item.deliveredQty ?? 0),
    returnQty: 0,
    unitPrice: Number(item.unitPrice ?? item.price ?? item.unit_price ?? 0),
    reason: "",
    selected: false,
  }));
}

function buildFallbackItems(issueNumber: string): IssueReturnItem[] {
  // Provide a sample fallback array with one or more items
  return [
    {
      id: `FALLBACK-1`,
      sku: `SKU-FALLBACK-1`,
      description: `Sample fallback item for issue ${issueNumber}`,
      deliveredQty: 10,
      returnableQty: 10,
      returnQty: 0,
      unitPrice: 100,
      reason: "",
      selected: false,
    },
    {
      id: `FALLBACK-2`,
      sku: `SKU-FALLBACK-2`,
      description: `Another fallback item for issue ${issueNumber}`,
      deliveredQty: 5,
      returnableQty: 5,
      returnQty: 0,
      unitPrice: 50,
      reason: "",
      selected: false,
    }
  ];
}

function useQuery(arg0: { queryKey: string[]; queryFn: () => Promise<any>; staleTime: number; }): { data: any; } {
  throw new Error("Function not implemented.");
}
}
