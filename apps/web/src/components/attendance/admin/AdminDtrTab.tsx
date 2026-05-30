import { useEffect, useRef, useState } from "react";
import { Download, Filter, Search } from "lucide-react";
import type {
  AdminDtrRecord,
  DtrFilters,
  StatusBadgeMap,
} from "../../../types/attendance";
import AdminDtrTable from "./AdminDtrTable";

type FilterOption<T extends string> = {
  label: string;
  value: T;
};

type DtrStatusFilter = DtrFilters["status"];
type DtrSortFilter = DtrFilters["sort"];

const STATUS_OPTIONS: FilterOption<DtrStatusFilter>[] = [
  { label: "All", value: "" },
  { label: "Present", value: "Present" },
  { label: "Late", value: "Late" },
  { label: "Undertime", value: "Undertime" },
  { label: "Overtime", value: "Overtime" },
  { label: "Absent", value: "Absent" },
];

const SORT_OPTIONS: FilterOption<DtrSortFilter>[] = [
  { label: "Latest", value: "latest" },
  { label: "Oldest", value: "oldest" },
];

type FilterDropdownProps<T extends string> = {
  value: T;
  options: FilterOption<T>[];
  isOpen: boolean;
  onToggle: () => void;
  onSelect: (value: T) => void;
};

function FilterDropdown<T extends string>({
  value,
  options,
  isOpen,
  onToggle,
  onSelect,
}: FilterDropdownProps<T>) {
  const selectedOption = options.find((option) => option.value === value);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={onToggle}
        className="pro-input flex w-full items-center justify-between text-left"
      >
        <span className="text-gray-700">{selectedOption?.label ?? "All"}</span>
        <span className="ml-3 shrink-0 text-gray-400">▾</span>
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full z-[220] mt-2 max-h-60 w-full overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg">
          {options.map((option) => (
            <button
              key={option.value || "all"}
              type="button"
              className={`block w-full px-4 py-3 text-left text-sm transition hover:bg-gray-50 ${
                option.value === value
                  ? "bg-emerald-50 text-emerald-700"
                  : "text-gray-700"
              }`}
              onClick={() => onSelect(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

type AdminDtrTabProps = {
  loadingDtr: boolean;
  dtrFilters: DtrFilters;
  setDtrFilters: React.Dispatch<React.SetStateAction<DtrFilters>>;
  setDtrPage: React.Dispatch<React.SetStateAction<number>>;
  filteredDtrRecords: AdminDtrRecord[];
  statusBadge: StatusBadgeMap;
  onEditDtr: (record: AdminDtrRecord) => void;
  onViewDtr: (record: AdminDtrRecord) => void;
  onExportCsv: () => void;
  dtrPage: number;
  totalDtrPages: number;
  recentlyEditedRowId: number | null;
};

const AdminDtrTab = ({
  loadingDtr,
  dtrFilters,
  setDtrFilters,
  setDtrPage,
  filteredDtrRecords,
  statusBadge,
  onEditDtr,
  onViewDtr,
  onExportCsv,
  dtrPage,
  totalDtrPages,
  recentlyEditedRowId,
}: AdminDtrTabProps) => {
  const [showFilters, setShowFilters] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<"status" | "sort" | null>(
    null
  );
  const [draftStatus, setDraftStatus] = useState<DtrStatusFilter>(
    dtrFilters.status
  );
  const [draftSort, setDraftSort] = useState<DtrSortFilter>(dtrFilters.sort);

  const filterRef = useRef<HTMLDivElement | null>(null);

  const hasActiveFilter = Boolean(dtrFilters.status || dtrFilters.search.trim() || dtrFilters.sort !== 'latest');

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (
        filterRef.current &&
        !filterRef.current.contains(event.target as Node)
      ) {
        setShowFilters(false);
        setOpenDropdown(null);
        setDraftStatus(dtrFilters.status);
        setDraftSort(dtrFilters.sort);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [dtrFilters.status, dtrFilters.sort]);

  const handleSearchChange = (value: string) => {
    setDtrFilters((prev) => ({ ...prev, search: value }));
    setDtrPage(1);
  };

  const handleApplyFilters = () => {
    setDtrFilters((prev) => ({
      ...prev,
      status: draftStatus,
      sort: draftSort,
    }));
    setDtrPage(1);
    setShowFilters(false);
    setOpenDropdown(null);
  };

  const handleClearDraft = () => {
    const clearedStatus: DtrStatusFilter = "";
    const clearedSort: DtrSortFilter = "latest";

    setDraftStatus(clearedStatus);
    setDraftSort(clearedSort);

    setDtrFilters((prev) => ({
      ...prev,
      status: clearedStatus,
      sort: clearedSort,
    }));

    setDtrPage(1);
    setShowFilters(false);
    setOpenDropdown(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-md">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={dtrFilters.search}
            onChange={(event) => handleSearchChange(event.target.value)}
            placeholder="Search by name or employee ID..."
            className="h-12 w-full rounded-2xl border border-gray-200 bg-white pl-11 pr-4 text-sm font-medium text-slate-700 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          />
        </div>

        <div className="flex items-center gap-3">
          <div className="relative overflow-visible" ref={filterRef}>
            <button
              type="button"
              onClick={() => {
                if (!showFilters) {
                  setDraftStatus(dtrFilters.status);
                  setDraftSort(dtrFilters.sort);
                }

                setShowFilters((prev) => !prev);
                setOpenDropdown(null);
              }}
              className={`btn btn-secondary flex items-center gap-2 ${hasActiveFilter ? "border-emerald-200 bg-emerald-50 text-emerald-700" : ""}`}
            >
              <Filter className="h-4 w-4" />
              Filter
            </button>

            {showFilters && (
              <div className="absolute right-0 top-full z-[200] mt-2 w-64 rounded-xl border border-gray-200 bg-white p-4 shadow-lg">
                <div className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Status
                    </label>

                    <FilterDropdown
                      value={draftStatus}
                      options={STATUS_OPTIONS}
                      isOpen={openDropdown === "status"}
                      onToggle={() =>
                        setOpenDropdown((current) =>
                          current === "status" ? null : "status"
                        )
                      }
                      onSelect={(value) => {
                        setDraftStatus(value);
                        setOpenDropdown(null);
                      }}
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Sort
                    </label>

                    <FilterDropdown
                      value={draftSort}
                      options={SORT_OPTIONS}
                      isOpen={openDropdown === "sort"}
                      onToggle={() =>
                        setOpenDropdown((current) =>
                          current === "sort" ? null : "sort"
                        )
                      }
                      onSelect={(value) => {
                        setDraftSort(value);
                        setOpenDropdown(null);
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={handleClearDraft}
                    >
                      Clear
                    </button>

                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={handleApplyFilters}
                    >
                      Apply
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onExportCsv}
            disabled={loadingDtr || filteredDtrRecords.length === 0}
            className="btn flex items-center gap-2 border-none bg-emerald-600 text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500"
          >
            <Download className="h-4 w-4" />
            Export
          </button>
        </div>
      </div>

      <AdminDtrTable
        loading={loadingDtr}
        records={filteredDtrRecords}
        statusBadge={statusBadge}
        onEdit={onEditDtr}
        onView={onViewDtr}
        page={dtrPage}
        totalPages={totalDtrPages}
        onPrev={() => setDtrPage((prev) => Math.max(1, prev - 1))}
        onNext={() => setDtrPage((prev) => Math.min(totalDtrPages, prev + 1))}
        recentlyEditedRowId={recentlyEditedRowId}
      />
    </div>
  );
};

export default AdminDtrTab;