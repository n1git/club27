"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ChevronRight } from "lucide-react";
import { deleteMeasurement } from "@/lib/actions/health";
import type { Measurement } from "@/lib/data/health";
import { formatJakartaDate, formatMeasure } from "@/lib/format";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { MeasurementForm } from "./measurement-form";

const day = (d: string) => formatJakartaDate(`${d}T00:00:00+07:00`, { dateStyle: "medium" });

type Row = Measurement & { bmi: number | null };

export function MeasurementList({ rows, today }: { rows: Row[]; today: string }) {
  const [open, setOpen] = useState<Row | null>(null);
  const [, start] = useTransition();

  function remove(row: Row) {
    if (!window.confirm("Hapus catatan ini?")) return;
    setOpen(null);
    const form = new FormData();
    form.set("measurementId", row.id);
    start(async () => {
      const id = toast.loading("Memproses…");
      const result = await deleteMeasurement({}, form);
      if (result.ok) toast.success(result.message ?? "Catatan dihapus", { id });
      else toast.error(result.error ?? "Gagal menghapus", { id });
    });
  }

  if (rows.length === 0) return <p className="rounded-2xl border border-dashed border-border p-5 text-sm text-muted-foreground">Belum ada catatan kesehatan.</p>;
  return (
    <>
      <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
        {rows.map((row) => (
          <li key={row.id}>
            <button
              type="button"
              onClick={() => setOpen(row)}
              aria-haspopup="dialog"
              className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left ui-transition hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            >
              <span className="flex min-w-0 flex-1 flex-col leading-tight">
                <span className="text-sm font-semibold">{day(row.measuredOn)}</span>
                <span className="text-xs text-muted-foreground">
                  {formatMeasure(row.heightCm, " cm")} · {formatMeasure(row.weightKg, " kg")} · IMT {formatMeasure(row.bmi)}
                </span>
              </span>
              <ChevronRight size={18} aria-hidden="true" className="shrink-0 text-muted-foreground" />
            </button>
          </li>
        ))}
      </ul>
      <BottomSheet open={open !== null} onClose={() => setOpen(null)} title={open ? `Catatan ${day(open.measuredOn)}` : "Catatan"}>
        {open ? (
          <div className="flex flex-col gap-4 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <MeasurementForm key={open.id} today={today} entry={open} />
            <button type="button" onClick={() => remove(open)} className="w-fit text-sm font-medium text-destructive underline-offset-4 hover:underline">
              Hapus catatan
            </button>
          </div>
        ) : null}
      </BottomSheet>
    </>
  );
}
