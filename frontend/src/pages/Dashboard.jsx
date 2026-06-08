import React, { useEffect, useMemo, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, Search, Download, Paperclip, Inbox } from "lucide-react";
import { listPayments, getStats } from "@/lib/api";
import StatCard, { formatINR } from "@/components/StatCard";
import StatusBadge from "@/components/StatusBadge";
import PaymentFormDialog from "@/components/PaymentFormDialog";
import PaymentDetailDialog from "@/components/PaymentDetailDialog";

const STATUS_FILTERS = ["All", "Pending", "Failed", "Refunded", "Lost"];

const formatDate = (iso) => {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return iso;
  }
};

const toCSV = (rows) => {
  const headers = [
    "Date", "Merchant", "Amount", "Method", "Transaction ID",
    "Bank", "Status", "Notes", "Screenshot",
  ];
  const esc = (v) => {
    const s = v === null || v === undefined ? "" : String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push([
      r.payment_date, r.merchant, r.amount, r.payment_method, r.transaction_id,
      r.bank_name, r.status, r.notes, r.screenshot_filename || "",
    ].map(esc).join(","));
  }
  return lines.join("\n");
};

export default function Dashboard() {
  const [payments, setPayments] = useState([]);
  const [stats, setStats] = useState({
    total_stuck: 0, pending_count: 0, recovered_amount: 0, lost_amount: 0, total_records: 0,
  });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [loading, setLoading] = useState(true);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [list, s] = await Promise.all([
        listPayments({
          status: statusFilter === "All" ? undefined : statusFilter,
          search: search || undefined,
        }),
        getStats(),
      ]);
      setPayments(Array.isArray(list) ? list : []);
      setStats(s);
    } catch (e) {
      console.error("Dashboard fetch failed:", e);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search]);

  useEffect(() => {
    const t = setTimeout(fetchAll, 250);
    return () => clearTimeout(t);
  }, [fetchAll]);

  const openCreate = () => { setEditing(null); setFormOpen(true); };
  const openEdit = (p) => { setEditing(p); setFormOpen(true); };
  const openDetail = (p) => { setSelected(p); setDetailOpen(true); };

  const exportCsv = () => {
    const csv = toCSV(payments);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `failed-payments-${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const totalRecords = useMemo(() => payments.length, [payments]);

  return (
    <div className="min-h-screen bg-white text-[#0A0A0A]">
      {/* Header */}
      <header className="border-b border-[#E5E5E5]">
        <div className="max-w-[1400px] mx-auto px-6 md:px-10 py-6 flex items-center justify-between gap-4">
          <div className="flex items-baseline gap-3">
            <div className="font-display text-2xl md:text-3xl font-black tracking-tighter">
              SK Made<span className="text-[#B91C1C]">.</span>
            </div>
            <span className="label-caps hidden sm:inline-block ml-2">Failed Payment Ledger</span>
          </div>
          <Button
            data-testid="add-payment-button"
            onClick={openCreate}
            className="rounded-sm bg-[#0A0A0A] hover:bg-[#262626] text-white"
          >
            <Plus className="w-4 h-4 mr-2" /> Log Payment
          </Button>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-6 md:px-10 py-8 md:py-10">
        {/* Hero / intro */}
        <section className="mb-10 animate-fade-up">
          <div className="font-display text-4xl sm:text-5xl lg:text-6xl font-black tracking-tighter leading-[1.05] max-w-3xl">
            Track every rupee that vanished
            <span className="text-[#A3A3A3]"> — until it comes back.</span>
          </div>
          <p className="mt-4 text-[#525252] max-w-2xl text-base">
            Log debited but failed transactions with screenshots. Watch pending,
            recovered, and lost amounts move in real time.
          </p>
        </section>

        {/* Stats */}
        <section
          data-testid="stats-grid"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8 mb-10 animate-fade-up"
        >
          <StatCard
            type="stuck"
            label="Amount Stuck"
            value={formatINR(stats.total_stuck)}
            sublabel={`${stats.pending_count} pending`}
            testid="stat-amount-stuck"
          />
          <StatCard
            type="pending"
            label="Total Records"
            value={stats.total_records}
            sublabel="Across all statuses"
            testid="stat-total-records"
          />
          <StatCard
            type="recovered"
            label="Recovered"
            value={formatINR(stats.recovered_amount)}
            sublabel="Refunded back"
            testid="stat-recovered"
          />
          <StatCard
            type="lost"
            label="Lost"
            value={formatINR(stats.lost_amount)}
            sublabel="Written off"
            testid="stat-lost"
          />
        </section>

        {/* Filters */}
        <section className="mb-6 flex flex-col md:flex-row md:items-center gap-3 md:gap-4">
          <div className="relative flex-1 max-w-xl">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#737373]" />
            <Input
              data-testid="search-input"
              placeholder="Search merchant, txn id, bank…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 rounded-sm bg-[#FAFAFA] border-[#E5E5E5] focus-visible:ring-1 focus-visible:ring-black"
            />
          </div>
          <div className="flex items-center gap-3">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger
                data-testid="status-filter"
                className="w-40 rounded-sm bg-[#FAFAFA] border-[#E5E5E5]"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-sm">
                {STATUS_FILTERS.map((s) => (
                  <SelectItem key={s} value={s} data-testid={`status-filter-option-${s}`}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              data-testid="export-csv-button"
              onClick={exportCsv}
              disabled={!payments.length}
              className="rounded-sm border-[#E5E5E5]"
            >
              <Download className="w-4 h-4 mr-2" /> Export CSV
            </Button>
          </div>
        </section>

        {/* Table */}
        <section className="border border-[#E5E5E5] rounded-sm overflow-hidden bg-white">
          <div className="overflow-x-auto">
            <Table data-testid="payments-table">
              <TableHeader>
                <TableRow className="hover:bg-transparent border-b border-[#E5E5E5]">
                  <TableHead className="label-caps">Date</TableHead>
                  <TableHead className="label-caps">Merchant</TableHead>
                  <TableHead className="label-caps">Method</TableHead>
                  <TableHead className="label-caps">Txn ID</TableHead>
                  <TableHead className="label-caps">Bank</TableHead>
                  <TableHead className="label-caps text-right">Amount</TableHead>
                  <TableHead className="label-caps">Status</TableHead>
                  <TableHead className="label-caps text-center">Shot</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-12 text-[#737373]">Loading…</TableCell></TableRow>
                ) : payments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-16">
                      <div className="flex flex-col items-center gap-3 text-[#737373]">
                        <Inbox className="w-8 h-8" />
                        <div className="font-display text-lg font-bold text-[#0A0A0A]">No records yet</div>
                        <div className="text-sm">Log your first failed payment to begin tracking.</div>
                        <Button
                          onClick={openCreate}
                          data-testid="empty-add-button"
                          className="rounded-sm bg-[#0A0A0A] hover:bg-[#262626] text-white mt-2"
                        >
                          <Plus className="w-4 h-4 mr-2" /> Log Payment
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  payments.map((p) => (
                    <TableRow
                      key={p.id}
                      data-testid={`payment-row-${p.id}`}
                      onClick={() => openDetail(p)}
                      className="row-hover cursor-pointer border-b border-[#E5E5E5] last:border-b-0"
                    >
                      <TableCell className="py-4 text-sm text-[#0A0A0A] whitespace-nowrap">
                        {formatDate(p.payment_date)}
                      </TableCell>
                      <TableCell className="py-4 text-sm font-medium text-[#0A0A0A]">{p.merchant}</TableCell>
                      <TableCell className="py-4 text-sm text-[#525252]">{p.payment_method}</TableCell>
                      <TableCell className="py-4 text-xs font-mono text-[#525252] max-w-[160px] truncate">
                        {p.transaction_id || "—"}
                      </TableCell>
                      <TableCell className="py-4 text-sm text-[#525252]">{p.bank_name || "—"}</TableCell>
                      <TableCell className="py-4 text-right text-sm font-mono font-semibold text-[#0A0A0A] whitespace-nowrap">
                        {formatINR(p.amount)}
                      </TableCell>
                      <TableCell className="py-4"><StatusBadge status={p.status} /></TableCell>
                      <TableCell className="py-4 text-center">
                        {p.screenshot_path ? (
                          <Paperclip className="w-4 h-4 inline-block text-[#0A0A0A]" />
                        ) : (
                          <span className="text-[#A3A3A3]">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </section>

        <div className="mt-4 text-xs text-[#737373]">
          Showing <span className="font-mono text-[#0A0A0A]">{totalRecords}</span> record{totalRecords === 1 ? "" : "s"}.
        </div>
      </main>

      <footer className="border-t border-[#E5E5E5] mt-16">
        <div className="max-w-[1400px] mx-auto px-6 md:px-10 py-6 flex items-center justify-between text-xs text-[#737373]">
          <span>SK Made · Personal payment recovery ledger</span>
          <span className="font-mono">v0.1</span>
        </div>
      </footer>

      <PaymentFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        editing={editing}
        onSaved={fetchAll}
      />
      <PaymentDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        payment={selected}
        onChanged={fetchAll}
        onEdit={(p) => { setEditing(p); setFormOpen(true); }}
      />
    </div>
  );
}
