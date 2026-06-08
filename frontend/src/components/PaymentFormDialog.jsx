import React, { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Upload, Image as ImageIcon, X } from "lucide-react";
import { createPayment, updatePayment, uploadScreenshot, screenshotUrl } from "@/lib/api";

const METHODS = ["UPI", "Card", "NetBanking", "Wallet", "Other"];
const STATUSES = ["Pending", "Failed", "Refunded", "Lost"];

const todayIso = () => new Date().toISOString().slice(0, 10);

const empty = {
  amount: "",
  payment_date: todayIso(),
  merchant: "",
  payment_method: "UPI",
  transaction_id: "",
  bank_name: "",
  status: "Pending",
  notes: "",
  screenshot_path: null,
  screenshot_filename: null,
};

export default function PaymentFormDialog({ open, onOpenChange, editing, onSaved }) {
  const [form, setForm] = useState(empty);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(editing ? { ...empty, ...editing } : empty);
    }
  }, [open, editing]);

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    setUploading(true);
    try {
      const res = await uploadScreenshot(file);
      update("screenshot_path", res.storage_path);
      update("screenshot_filename", res.filename);
      toast.success("Screenshot uploaded");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Upload failed");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const removeScreenshot = () => {
    update("screenshot_path", null);
    update("screenshot_filename", null);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.merchant.trim()) {
      toast.error("Merchant is required");
      return;
    }
    const amt = parseFloat(form.amount);
    if (!amt || amt <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        amount: amt,
        payment_date: form.payment_date,
        merchant: form.merchant.trim(),
        payment_method: form.payment_method,
        transaction_id: form.transaction_id?.trim() || "",
        bank_name: form.bank_name?.trim() || "",
        status: form.status,
        notes: form.notes?.trim() || "",
        screenshot_path: form.screenshot_path,
        screenshot_filename: form.screenshot_filename,
      };
      if (editing?.id) {
        await updatePayment(editing.id, payload);
        toast.success("Payment updated");
      } else {
        await createPayment(payload);
        toast.success("Payment added");
      }
      onSaved?.();
      onOpenChange(false);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="payment-form-dialog"
        className="max-w-2xl rounded-sm border-[#E5E5E5] p-0 overflow-hidden"
      >
        <form onSubmit={submit}>
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-[#E5E5E5]">
            <DialogTitle className="font-display text-2xl font-bold tracking-tight text-[#0A0A0A]">
              {editing ? "Edit Payment" : "Log Failed Payment"}
            </DialogTitle>
            <DialogDescription className="text-sm text-[#737373]">
              Record details of money debited without a successful transaction.
            </DialogDescription>
          </DialogHeader>

          <div className="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <Label className="label-caps">Amount (₹)</Label>
                <Input
                  data-testid="form-amount"
                  type="number" step="0.01" min="0"
                  value={form.amount}
                  onChange={(e) => update("amount", e.target.value)}
                  placeholder="e.g. 1499.00"
                  className="rounded-sm bg-[#FAFAFA] border-[#E5E5E5] focus-visible:ring-1 focus-visible:ring-black"
                />
              </div>
              <div className="space-y-2">
                <Label className="label-caps">Date</Label>
                <Input
                  data-testid="form-date"
                  type="date"
                  value={form.payment_date}
                  onChange={(e) => update("payment_date", e.target.value)}
                  className="rounded-sm bg-[#FAFAFA] border-[#E5E5E5] focus-visible:ring-1 focus-visible:ring-black"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label className="label-caps">Merchant / Website</Label>
                <Input
                  data-testid="form-merchant"
                  value={form.merchant}
                  onChange={(e) => update("merchant", e.target.value)}
                  placeholder="e.g. BESCOM bill, Amazon, Airtel"
                  className="rounded-sm bg-[#FAFAFA] border-[#E5E5E5] focus-visible:ring-1 focus-visible:ring-black"
                />
              </div>
              <div className="space-y-2">
                <Label className="label-caps">Payment Method</Label>
                <Select value={form.payment_method} onValueChange={(v) => update("payment_method", v)}>
                  <SelectTrigger data-testid="form-method" className="rounded-sm bg-[#FAFAFA] border-[#E5E5E5]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-sm">
                    {METHODS.map((m) => (
                      <SelectItem key={m} value={m} data-testid={`method-option-${m}`}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="label-caps">Status</Label>
                <Select value={form.status} onValueChange={(v) => update("status", v)}>
                  <SelectTrigger data-testid="form-status" className="rounded-sm bg-[#FAFAFA] border-[#E5E5E5]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-sm">
                    {STATUSES.map((s) => (
                      <SelectItem key={s} value={s} data-testid={`status-option-${s}`}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="label-caps">Transaction ID</Label>
                <Input
                  data-testid="form-txn"
                  value={form.transaction_id}
                  onChange={(e) => update("transaction_id", e.target.value)}
                  placeholder="UPI ref / Order ID"
                  className="rounded-sm bg-[#FAFAFA] border-[#E5E5E5] focus-visible:ring-1 focus-visible:ring-black font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label className="label-caps">Bank Name</Label>
                <Input
                  data-testid="form-bank"
                  value={form.bank_name}
                  onChange={(e) => update("bank_name", e.target.value)}
                  placeholder="e.g. HDFC, ICICI"
                  className="rounded-sm bg-[#FAFAFA] border-[#E5E5E5] focus-visible:ring-1 focus-visible:ring-black"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label className="label-caps">Notes</Label>
                <Textarea
                  data-testid="form-notes"
                  value={form.notes}
                  onChange={(e) => update("notes", e.target.value)}
                  placeholder="What happened? e.g. amount debited but order not placed"
                  className="rounded-sm bg-[#FAFAFA] border-[#E5E5E5] focus-visible:ring-1 focus-visible:ring-black min-h-[80px]"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label className="label-caps">Screenshot</Label>
                {form.screenshot_path ? (
                  <div className="border border-[#E5E5E5] rounded-sm p-3 flex items-start gap-3 bg-[#FAFAFA]">
                    <img
                      src={screenshotUrl(form.screenshot_path)}
                      alt="screenshot"
                      className="w-24 h-24 object-cover border border-[#E5E5E5] rounded-sm"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-[#0A0A0A] truncate">
                        {form.screenshot_filename || "screenshot"}
                      </div>
                      <div className="text-xs text-[#737373] mt-1">Uploaded</div>
                      <button
                        type="button"
                        data-testid="remove-screenshot-button"
                        onClick={removeScreenshot}
                        className="mt-2 inline-flex items-center gap-1 text-xs text-[#B91C1C] hover:underline"
                      >
                        <X className="w-3 h-3" /> Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <label
                    htmlFor="screenshot-input"
                    data-testid="screenshot-dropzone"
                    className="block border border-dashed border-neutral-300 bg-[#FAFAFA] hover:bg-neutral-100 transition-colors rounded-sm p-8 cursor-pointer text-center"
                  >
                    <div className="flex flex-col items-center gap-2">
                      {uploading ? (
                        <>
                          <Upload className="w-6 h-6 text-[#737373] animate-pulse" />
                          <span className="text-sm text-[#737373]">Uploading…</span>
                        </>
                      ) : (
                        <>
                          <ImageIcon className="w-6 h-6 text-[#737373]" />
                          <span className="text-sm text-[#525252]">
                            Click to upload screenshot
                          </span>
                          <span className="text-xs text-[#737373]">PNG, JPG, WEBP — up to 10 MB</span>
                        </>
                      )}
                    </div>
                    <input
                      id="screenshot-input"
                      data-testid="screenshot-input"
                      type="file"
                      accept="image/*"
                      onChange={handleFile}
                      className="hidden"
                      disabled={uploading}
                    />
                  </label>
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="px-6 py-4 border-t border-[#E5E5E5] bg-white">
            <Button
              type="button"
              variant="outline"
              data-testid="form-cancel-button"
              onClick={() => onOpenChange(false)}
              className="rounded-sm border-[#E5E5E5]"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              data-testid="form-submit-button"
              disabled={saving || uploading}
              className="rounded-sm bg-[#0A0A0A] hover:bg-[#262626] text-white"
            >
              {saving ? "Saving…" : editing ? "Save Changes" : "Add Payment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
