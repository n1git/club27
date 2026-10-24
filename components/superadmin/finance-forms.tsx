"use client";

import { addExpense, copyExpensesFromLastMonth, deleteExpense, recordRefund, setGatewayFee, updateFeeRate } from "@/lib/actions/platform-finance";
import { ActionForm } from "@/components/shared/action-form";
import { ActionSubmitButton } from "@/components/shared/action-submit-button";
import { TriggerDialog } from "@/components/ui/dialog";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { EXPENSE_CATEGORIES, EXPENSE_LABEL } from "@/lib/data/platform-finance";

export function ExpenseForm({ month }: { month: string }) {
  return (
    <ActionForm action={addExpense} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <input type="hidden" name="month" value={month} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="exp-category">Kategori</Label>
        <Select id="exp-category" name="category" defaultValue="infrastruktur">
          {EXPENSE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {EXPENSE_LABEL[c]}
            </option>
          ))}
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="exp-vendor">Vendor</Label>
        <Input id="exp-vendor" name="vendor" required maxLength={100} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="exp-amount">Jumlah (Rp)</Label>
        <Input id="exp-amount" name="amountIdr" type="number" inputMode="decimal" min={0} step="1" required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="exp-orig">Jumlah asli (opsional)</Label>
        <Input id="exp-orig" name="originalAmount" type="number" inputMode="decimal" min={0} step="0.01" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="exp-cur">Mata uang asli</Label>
        <Input id="exp-cur" name="originalCurrency" maxLength={3} placeholder="USD" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="exp-note">Catatan</Label>
        <Input id="exp-note" name="note" maxLength={500} />
      </div>
      <ActionSubmitButton className="w-fit">Tambah biaya</ActionSubmitButton>
    </ActionForm>
  );
}

export function CopyExpensesForm({ month }: { month: string }) {
  return (
    <ActionForm action={copyExpensesFromLastMonth}>
      <input type="hidden" name="month" value={month} />
      <ActionSubmitButton variant="outline" className="w-fit">
        Salin dari bulan lalu
      </ActionSubmitButton>
    </ActionForm>
  );
}

export function DeleteExpenseForm({ id }: { id: string }) {
  return (
    <ActionForm action={deleteExpense}>
      <input type="hidden" name="id" value={id} />
      <ActionSubmitButton variant="ghost" size="sm" confirmMessage="Hapus biaya ini?">
        Hapus
      </ActionSubmitButton>
    </ActionForm>
  );
}

export function FeeRateForm({ paymentType, label, percent, fixedIdr }: { paymentType: string; label: string; percent: number; fixedIdr: number }) {
  return (
    <ActionForm action={updateFeeRate} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="paymentType" value={paymentType} />
      <span className="w-40 text-sm font-medium">{label}</span>
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        Persen
        <Input name="percent" type="number" inputMode="decimal" min={0} max={100} step="0.001" defaultValue={percent} className="w-24" />
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        Tetap (Rp)
        <Input name="fixedIdr" type="number" inputMode="decimal" min={0} step="1" defaultValue={fixedIdr} className="w-28" />
      </label>
      <ActionSubmitButton size="sm" variant="outline">
        Simpan
      </ActionSubmitButton>
    </ActionForm>
  );
}

export function GatewayFeeForm({ renewalId, actual }: { renewalId: string; actual: number | null }) {
  return (
    <ActionForm action={setGatewayFee} className="flex items-center gap-1.5">
      <input type="hidden" name="renewalId" value={renewalId} />
      <Input
        name="fee"
        type="number"
        inputMode="decimal"
        min={0}
        step="1"
        defaultValue={actual ?? ""}
        placeholder="Aktual"
        aria-label="Biaya gateway aktual"
        className="h-8 w-24"
      />
      <ActionSubmitButton size="sm" variant="ghost">
        Simpan
      </ActionSubmitButton>
    </ActionForm>
  );
}

export function RefundDialog({ renewalId, label, max, today }: { renewalId: string; label: string; max: number; today: string }) {
  return (
    <TriggerDialog trigger={<span className={buttonVariants({ variant: "outline", size: "sm" })}>Refund</span>}>
      <h2 className="mb-1 text-lg font-semibold">Catat refund</h2>
      <p className="mb-4 text-sm text-muted-foreground">
        {label}. Ini hanya mencatat; kembalikan uangnya manual di Midtrans atau lewat transfer. Invoice dan kwitansi tidak berubah.
      </p>
      <ActionForm action={recordRefund} className="flex flex-col gap-3">
        <input type="hidden" name="renewalId" value={renewalId} />
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`rf-amount-${renewalId}`}>Jumlah (maks {max.toLocaleString("id-ID")})</Label>
          <Input id={`rf-amount-${renewalId}`} name="amount" type="number" inputMode="decimal" min={1} max={max} step="1" required />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`rf-date-${renewalId}`}>Tanggal refund</Label>
            <Input id={`rf-date-${renewalId}`} name="refundedAt" type="date" defaultValue={today} required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`rf-method-${renewalId}`}>Cara</Label>
            <Select id={`rf-method-${renewalId}`} name="method" defaultValue="transfer">
              <option value="transfer">Transfer</option>
              <option value="midtrans">Midtrans</option>
              <option value="lainnya">Lainnya</option>
            </Select>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`rf-reason-${renewalId}`}>Alasan</Label>
          <Textarea id={`rf-reason-${renewalId}`} name="reason" required minLength={5} maxLength={500} rows={2} />
        </div>
        <ActionSubmitButton className="w-fit">Catat refund</ActionSubmitButton>
      </ActionForm>
    </TriggerDialog>
  );
}
