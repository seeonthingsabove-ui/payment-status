import React, { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import StatusBadge from "@/components/StatusBadge";
import { formatINR } from "@/components/StatCard";
import { updatePayment, deletePayment, screenshotUrl } from "@/lib/api";
import { Trash2, ImageOff, ExternalLink } from "lucide-react";

const STATUSES = ["Pending", "Failed", "Refunded", "Lost"];

export default function PaymentDetailDialog({ open, onOpenChange, payment, onChanged, onEdit }) {
  const [status, setStatus] = useState(payment?.status || "Pending");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  React.useEffect(() => {
    if (payment) setStatus(payment.status);
  }, [payment]);

  if (!payment) return null;

  const saveStatus = async () => {
    if (status === payment.status) return;
    setSaving(true);
    try {
      await updatePayment(payment.id, { status });
      toast.success("Status updated");
      onChanged?.();
    } catch (e) {
      toast.error("Update failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setConfirmOpen(false);
    setDeleting(true);
    try {
      await deletePayment(payment.id);
      toast.success("Payment deleted");
      onOpenChange(false);
      onChanged?.();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  const Field = ({ label, value, mono }) => (
    <div className="py-3 border-b border-[#E5E5E5] last:border-b-0">
      <div className="label-caps mb-1">{label}</div>
      <div className={`text-sm text-[#0A0A0A] ${mono ? "font-mono" : ""} break-words`}>
        {value || <span className="text-[#A3A3A3]">—</span>}
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="payment-detail-dialog"
        className="max-w-4xl rounded-sm border-[#E5E5E5] p-0 overflow-hidden"
      >
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-[#E5E5E5]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <DialogTitle className="font-display text-2xl font-bold tracking-tight text-[#0A0A0A]">
                {payment.merchant}
              </DialogTitle>
              <div className="mt-1 flex items-center gap-3">
                <span className="font-mono text-2xl font-bold text-[#0A0A0A]">
                  {formatINR(payment.amount)}
                </span>
                <StatusBadge status={payment.status} />
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 max-h-[70vh] overflow-y-auto">
          <div className="px-6 py-4">
            <Field label="Date" value={payment.payment_date} />
            <Field label="Payment Method" value={payment.payment_method} />
            <Field label="Transaction ID" value={payment.transaction_id} mono />
            <Field label="Bank" value={payment.bank_name} />
            <Field label="Notes" value={payment.notes} />

            <div className="pt-5">
              <Label className="label-caps">Update Status</Label>
              <div className="mt-2 flex gap-2">
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger data-testid="detail-status-select" className="rounded-sm bg-[#FAFAFA] border-[#E5E5E5] w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-sm">
                    {STATUSES.map((s) => (
                      <SelectItem key={s} value={s} data-testid={`detail-status-option-${s}`}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  data-testid="detail-save-status-button"
                  onClick={saveStatus}
                  disabled={saving || status === payment.status}
                  className="rounded-sm bg-[#0A0A0A] hover:bg-[#262626] text-white"
                >
                  {saving ? "Saving…" : "Save"}
                </Button>
              </div>
            </div>
          </div>

          <div className="px-6 py-4 border-t md:border-t-0 md:border-l border-[#E5E5E5] bg-[#FAFAFA]">
            <div className="label-caps mb-3">Screenshot</div>
            {payment.screenshot_path ? (
              <a
                href={screenshotUrl(payment.screenshot_path)}
                target="_blank"
                rel="noreferrer"
                data-testid="screenshot-link"
                className="group block border border-[#E5E5E5] rounded-sm overflow-hidden bg-white"
              >
                <img
                  src={screenshotUrl(payment.screenshot_path)}
                  alt="payment screenshot"
                  className="w-full max-h-[60vh] object-contain transition-transform group-hover:scale-[1.01]"
                />
                <div className="flex items-center justify-between px-3 py-2 border-t border-[#E5E5E5] text-xs text-[#525252]">
                  <span className="truncate">{payment.screenshot_filename || "screenshot"}</span>
                  <span className="inline-flex items-center gap-1">Open <ExternalLink className="w-3 h-3" /></span>
                </div>
              </a>
            ) : (
              <div className="border border-dashed border-[#E5E5E5] rounded-sm p-10 text-center text-[#737373]">
                <ImageOff className="w-6 h-6 mx-auto mb-2 opacity-60" />
                <div className="text-sm">No screenshot attached</div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t border-[#E5E5E5] bg-white flex items-center justify-between sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            data-testid="detail-delete-button"
            onClick={() => setConfirmOpen(true)}
            disabled={deleting}
            className="text-[#B91C1C] hover:bg-red-50 rounded-sm"
          >
            <Trash2 className="w-4 h-4 mr-2" /> {deleting ? "Deleting…" : "Delete"}
          </Button>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              data-testid="detail-edit-button"
              onClick={() => { onOpenChange(false); onEdit?.(payment); }}
              className="rounded-sm border-[#E5E5E5]"
            >
              Edit
            </Button>
            <Button
              type="button"
              data-testid="detail-close-button"
              onClick={() => onOpenChange(false)}
              className="rounded-sm bg-[#0A0A0A] hover:bg-[#262626] text-white"
            >
              Close
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent data-testid="delete-confirm-dialog" className="rounded-sm border-[#E5E5E5]">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-xl font-bold tracking-tight">
              Delete this record?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[#525252]">
              This will permanently remove the payment entry and detach its screenshot. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="delete-cancel-button" className="rounded-sm border-[#E5E5E5]">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              data-testid="delete-confirm-button"
              onClick={handleDelete}
              className="rounded-sm bg-[#B91C1C] hover:bg-[#991B1B] text-white"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
