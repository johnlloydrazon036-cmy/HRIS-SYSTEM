import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { FileText, X } from "lucide-react";
import { toast } from "sonner";
import type { EmployeeStatus } from "../../lib/employees";
import { EMPLOYEE_TABS, type EmployeeTabKey } from "./employeeTabs";
import { useEmployeeDocuments } from "../../pages/personal-records/hooks/useEmployeeDocuments";
import { EmployeeDocumentsPanel } from "./EmployeeDocumentsPanel";
import type { EmployeeDocumentDto } from "../../lib/employees";
import { formatEmploymentTypeLabel } from "./employeeList.utils";

type EmploymentType =
  | "Regular"
  | "Probationary"
  | "Project-based";
  
export type EmployeeView = {
  id?: string;
  employeeId: string;
  name: string;
  position: string;
  department: string;
  status: EmployeeStatus;
  employmentType: EmploymentType;
  contact: string;
  email: string;
  hireDate: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  province: string;
  zipCode: string;
  sssNumber?: string;
  philHealthNumber?: string;
  pagIbigNumber?: string;
  tinNumber?: string;
};

type PreviewState = {
  url: string;
  contentType?: string | null;
  fileName?: string | null;
} | null;

const statusBadge: Record<EmployeeStatus, string> = {
  Active: "badge-success",
  Inactive: "badge-danger",
};

const GOVERNMENT_AUTO_HIDE_MS = 10000;

function extractDigits(value?: string): string {
  return (value ?? "").replace(/\D/g, "");
}

function formatSSS(value?: string): string {
  const digits = extractDigits(value).slice(0, 10);
  if (!digits) return "—";

  const parts = [
    digits.slice(0, 2),
    digits.slice(2, 9),
    digits.slice(9, 10),
  ];

  return parts.filter(Boolean).join("-");
}

function formatPhilHealth(value?: string): string {
  const digits = extractDigits(value).slice(0, 12);
  if (!digits) return "—";

  const parts = [
    digits.slice(0, 2),
    digits.slice(2, 11),
    digits.slice(11, 12),
  ];

  return parts.filter(Boolean).join("-");
}

function formatPagIbig(value?: string): string {
  const digits = extractDigits(value).slice(0, 12);
  if (!digits) return "—";

  const parts = [
    digits.slice(0, 4),
    digits.slice(4, 8),
    digits.slice(8, 12),
  ];

  return parts.filter(Boolean).join("-");
}

function formatTIN(value?: string): string {
  const digits = extractDigits(value).slice(0, 12);
  if (!digits) return "—";

  const parts = [
    digits.slice(0, 3),
    digits.slice(3, 6),
    digits.slice(6, 9),
    digits.slice(9, 12),
  ];

  return parts.filter(Boolean).join("-");
}

function maskGovernmentValue(value?: string) {
  const raw = extractDigits(value);
  if (!raw) return "—";

  const visibleChars = 4;
  if (raw.length <= visibleChars) {
    return "•".repeat(raw.length);
  }

  return `${"•".repeat(raw.length - visibleChars)}${raw.slice(-visibleChars)}`;
}

function formatDisplayDate(value?: string): string {
  if (!value?.trim()) return "—";

  const raw = value.trim();

  let date: Date | null = null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [year, month, day] = raw.split("-").map(Number);
    date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  } else {
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
      date = parsed;
    }
  }

  if (!date) return raw;

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "Asia/Manila",
  }).format(date);
}

function normalizePreviewValue(value?: string | null): string {
  return typeof value === "string" ? value.trim() : "";
}

function isPdf(contentType?: string | null, fileName?: string | null): boolean {
  const lowerContentType = normalizePreviewValue(contentType).toLowerCase();
  const lowerFileName = normalizePreviewValue(fileName).toLowerCase();

  return lowerContentType.includes("pdf") || lowerFileName.endsWith(".pdf");
}

function isImage(
  contentType?: string | null,
  fileName?: string | null
): boolean {
  const lowerContentType = normalizePreviewValue(contentType).toLowerCase();
  const lowerFileName = normalizePreviewValue(fileName).toLowerCase();

  return (
    lowerContentType.startsWith("image/") ||
    lowerFileName.endsWith(".png") ||
    lowerFileName.endsWith(".jpg") ||
    lowerFileName.endsWith(".jpeg") ||
    lowerFileName.endsWith(".webp")
  );
}

function EmptyPreviewState({
  message,
  helper,
}: {
  message: string;
  helper?: string;
}) {
  return (
    <div className="flex h-full w-full items-center justify-center rounded-2xl border border-white/30 bg-white/60 p-8 shadow-2xl backdrop-blur-sm">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-gray-400 shadow">
          <FileText className="h-8 w-8" />
        </div>
        <p className="text-base font-semibold text-gray-700">{message}</p>
        {helper && <p className="mt-1 text-sm text-gray-500">{helper}</p>}
      </div>
    </div>
  );
}

export function EmployeeViewPanel({
  open,
  employee,
  onClose,
}: {
  open: boolean;
  employee: EmployeeView | null;
  onClose: () => void;
}) {
  const [activeTab, setActiveTab] = useState<EmployeeTabKey>("personal");
  const [showGovernment, setShowGovernment] = useState(false);
  const [preview, setPreview] = useState<PreviewState>(null);
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const employeeId = employee?.id ?? null;

  const {
    documents,
    documentsLoading,
    documentsError,
    uploading,
    downloadingDocumentId,
    deletingDocumentId,
    selectedDocumentType,
    setSelectedDocumentType,
    upload,
    download,
    remove,
    getPreviewPayload,
  } = useEmployeeDocuments(employeeId, open && activeTab === "documents", {
    onUploadSuccess: (message) => toast.success(message),
    onUploadError: (message) => toast.error(message),
    onDownloadSuccess: (message) => toast.success(message),
    onDownloadError: (message) => toast.error(message),
    onDeleteSuccess: (message) => toast.success(message),
    onDeleteError: (message) => toast.error(message),
  });

  const clearPreview = () => {
    setPreview((prev) => {
      if (prev?.url) {
        URL.revokeObjectURL(prev.url);
      }
      return null;
    });

    setActiveDocumentId(null);
    setPreviewLoading(false);
  };

  useEffect(() => {
    if (!open || activeTab !== "government" || !showGovernment) return;

    const timeoutId = window.setTimeout(() => {
      setShowGovernment(false);
    }, GOVERNMENT_AUTO_HIDE_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [open, activeTab, showGovernment]);

  useEffect(() => {
    if (!open) {
      clearPreview();
      setActiveTab("personal");
      setShowGovernment(false);
    }
  }, [open]);

  useEffect(() => {
    return () => {
      setPreview((prev) => {
        if (prev?.url) {
          URL.revokeObjectURL(prev.url);
        }
        return null;
      });
    };
  }, []);

  if (!open || !employee) return null;

  const handleClose = () => {
    setActiveTab("personal");
    setShowGovernment(false);
    clearPreview();
    onClose();
  };

  const handleTabChange = (tab: EmployeeTabKey) => {
    if (tab !== "government") {
      setShowGovernment(false);
    }

    if (tab !== "documents") {
      clearPreview();
    }

    setActiveTab(tab);
  };

  const handlePreviewSelect = async (doc: EmployeeDocumentDto) => {
    if (activeDocumentId === doc.id) {
      clearPreview();
      return;
    }

    setPreviewLoading(true);
    setActiveDocumentId(doc.id);

    try {
      const payload = await getPreviewPayload(doc);

      if (!payload?.url) {
        clearPreview();
        toast.error("Preview could not be loaded.");
        return;
      }

      setPreview((prev) => {
        if (prev?.url) {
          URL.revokeObjectURL(prev.url);
        }

        return {
          url: payload.url,
          contentType: payload.contentType ?? doc.contentType ?? "",
          fileName: payload.fileName ?? doc.fileName ?? "",
        };
      });
    } catch {
      clearPreview();
      toast.error("Preview could not be loaded.");
    } finally {
      setPreviewLoading(false);
    }
  };

  const fullAddress = [
    employee.addressLine1,
    employee.addressLine2,
    employee.city,
    employee.province,
    employee.zipCode,
  ]
    .filter(Boolean)
    .join(", ");

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex justify-end overflow-hidden bg-slate-900/55 backdrop-blur-[4px]">
      <div className="absolute inset-0 z-0" onClick={handleClose} />

      {activeTab === "documents" && (
        <div className="relative z-10 hidden h-full flex-1 items-center justify-center px-8 py-8 lg:flex">
          <div className="h-full w-full max-w-4xl">
            {documentsLoading || previewLoading ? (
              <div className="flex h-full w-full items-center justify-center rounded-2xl border border-white/30 bg-white/60 p-8 shadow-2xl backdrop-blur-sm">
                <div className="text-center text-gray-500">
                  <p className="text-base font-semibold">Loading preview...</p>
                  <p className="mt-1 text-sm">Please wait a moment.</p>
                </div>
              </div>
            ) : preview ? (
              isPdf(preview.contentType, preview.fileName) ? (
                <div className="h-full w-full overflow-hidden rounded-2xl border border-white/30 bg-white shadow-2xl">
                  <iframe
                    src={preview.url}
                    title={preview.fileName || "Document preview"
                    }
                    className="h-full w-full"
                  />
                </div>
              ) : isImage(preview.contentType, preview.fileName) ? (
                <div className="h-full w-full overflow-auto rounded-2xl border border-white/30 bg-white shadow-2xl">
                  <div className="flex min-h-full w-full items-start justify-center p-4">
                    <img
                      src={preview.url}
                      alt={preview.fileName || "Image preview"}
                      className="h-auto max-w-none object-contain"
                    />
                  </div>
                </div>
              ) : (
                <EmptyPreviewState
                  message="Preview not available"
                  helper="This file type can still be downloaded from the panel."
                />
              )
            ) : documents.length > 0 ? (
              <EmptyPreviewState
                message="Click the eye icon to preview"
                helper="Use the eye button on the right panel to show or hide preview."
              />
            ) : (
              <EmptyPreviewState
                message="No documents to preview"
                helper="This employee does not have uploaded documents yet."
              />
            )}
          </div>
        </div>
      )}

      <div className="relative z-10 ml-auto h-full w-full max-w-md overflow-y-auto bg-white shadow-2xl animate-slide-in-right">
        <div className="p-6">
          <div className="mb-6 flex items-center justify-between">
            <h3 className="text-lg font-bold text-gray-900">
              Employee Details
            </h3>
            <button
              onClick={handleClose}
              className="btn-ghost btn-icon"
              type="button"
            >
              <X className="h-5 w-5 text-gray-400" />
            </button>
          </div>

          <div className="mb-6 flex flex-col items-center">
            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-3xl font-bold text-white shadow-lg">
              {employee.name?.charAt(0) || "—"}
            </div>

            <h4 className="text-lg font-bold text-gray-900">
              {employee.name}
            </h4>
            <p className="text-sm text-gray-500">{employee.position}</p>

            <span className={`badge mt-2 ${statusBadge[employee.status]}`}>
              <span className="badge-dot" />
              {employee.status}
            </span>
          </div>

          <div className="mb-4 border-b">
            <div className="flex gap-4 text-sm font-medium">
              {EMPLOYEE_TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => handleTabChange(tab.key)}
                  className={`pb-2 ${
                    activeTab === tab.key
                      ? "border-b-2 border-green-600 text-green-600"
                      : "text-gray-500"
                  }`}
                  type="button"
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {activeTab === "personal" && (
            <div className="space-y-4">
              {[
                ["Employee ID", employee.employeeId],
                ["Contact", employee.contact || "—"],
                ["Email", employee.email || "—"],
                ["Address", fullAddress || "—"],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="flex justify-between rounded-xl bg-gray-50 p-3"
                >
                  <span className="text-xs uppercase text-gray-400">
                    {label}
                  </span>
                  <span className="text-right text-sm font-semibold text-gray-800">
                    {value}
                  </span>
                </div>
              ))}
            </div>
          )}

          {activeTab === "employment" && (
            <div className="space-y-4">
              {[
                ["Position", employee.position],
                ["Department", employee.department],
                [
                  "Employment Type",
                  formatEmploymentTypeLabel(employee.employmentType),
                ],
                ["Hire Date", formatDisplayDate(employee.hireDate)],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="flex justify-between rounded-xl bg-gray-50 p-3"
                >
                  <span className="text-xs uppercase text-gray-400">
                    {label}
                  </span>
                  <span className="text-right text-sm font-semibold text-gray-800">
                    {value}
                  </span>
                </div>
              ))}
            </div>
          )}

          {activeTab === "government" && (
            <div className="space-y-4">
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowGovernment((prev) => !prev)}
                  className="text-xs font-medium text-green-600 hover:underline"
                >
                  {showGovernment ? "Hide" : "Show"} government numbers
                </button>
              </div>

              {[
                [
                  "SSS",
                  showGovernment
                    ? formatSSS(employee.sssNumber)
                    : maskGovernmentValue(employee.sssNumber),
                ],
                [
                  "PhilHealth",
                  showGovernment
                    ? formatPhilHealth(employee.philHealthNumber)
                    : maskGovernmentValue(employee.philHealthNumber),
                ],
                [
                  "Pag-IBIG",
                  showGovernment
                    ? formatPagIbig(employee.pagIbigNumber)
                    : maskGovernmentValue(employee.pagIbigNumber),
                ],
                [
                  "TIN",
                  showGovernment
                    ? formatTIN(employee.tinNumber)
                    : maskGovernmentValue(employee.tinNumber),
                ],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="flex justify-between rounded-xl bg-gray-50 p-3"
                >
                  <span className="text-xs uppercase text-gray-400">
                    {label}
                  </span>
                  <span className="text-right text-sm font-semibold text-gray-800">
                    {value}
                  </span>
                </div>
              ))}

              {showGovernment && (
                <p className="text-right text-[11px] text-gray-400">
                  Auto-hides in 10 seconds.
                </p>
              )}
            </div>
          )}

          {activeTab === "documents" && (
            <EmployeeDocumentsPanel
              employeeId={employeeId}
              documents={documents}
              documentsLoading={documentsLoading}
              documentsError={documentsError}
              uploading={uploading}
              downloadingDocumentId={downloadingDocumentId}
              deletingDocumentId={deletingDocumentId}
              selectedDocumentType={selectedDocumentType}
              onSelectedDocumentTypeChange={setSelectedDocumentType}
              onUpload={upload}
              onDownload={download}
              onDelete={remove}
              readOnly
              onPreviewSelect={handlePreviewSelect}
              activeDocumentId={activeDocumentId}
            />
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}