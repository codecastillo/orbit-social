"use client";

import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ModalShell } from "@/components/orbit/forms";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => Promise<void> | void;
}

// Themed replacement for window.confirm. Uses the standard ModalShell so it
// matches the rest of the app's modals (create event, create room, etc).
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = false,
  onConfirm,
}: ConfirmDialogProps) {
  const [busy, setBusy] = useState(false);

  const handleConfirm = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="p-0 gap-0 border-0 bg-transparent shadow-none max-w-none w-auto ring-0"
        style={{ boxShadow: "none" }}
      >
        <ModalShell
          title={title}
          subtitle={description}
          accent={danger ? "var(--destructive)" : "var(--primary)"}
          width={460}
          danger={danger}
          primaryLabel={busy ? "…" : confirmLabel}
          secondaryLabel={cancelLabel}
          canSubmit={!busy}
          loading={busy}
          onPrimary={handleConfirm}
          onSecondary={() => onOpenChange(false)}
          onClose={() => onOpenChange(false)}
        >
          <div style={{ minHeight: 8 }} />
        </ModalShell>
      </DialogContent>
    </Dialog>
  );
}
