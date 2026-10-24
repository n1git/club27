import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/guard";
import { isMinorAccount } from "@/lib/auth/social-access";
import { activeHealthConsent } from "@/lib/data/consents";
import { giveHealthConsent } from "@/lib/actions/health";
import { HEALTH_CONSENT_TEXT } from "@/lib/consent";
import { ActionForm } from "@/components/shared/action-form";
import { ActionSubmitButton } from "@/components/shared/action-submit-button";
import { bmi as bmiOf, getHealthData } from "@/lib/data/health";
import { formatJakartaDate, formatMeasure } from "@/lib/format";
import { MeasurementForm } from "@/components/health/measurement-form";
import { MeasurementList } from "@/components/health/measurement-list";
import { PageTop, Section } from "@/components/personal/page-top";
import { FormSheet } from "@/components/ui/form-sheet";

export const metadata: Metadata = { title: "Kesehatan" };
export const unstable_dynamicStaleTime = 0;

const dateLabel = (date: string) => formatJakartaDate(`${date}T00:00:00+07:00`, { dateStyle: "medium" });
const SUBTITLE = "Tinggi dan berat badan Anda. Hanya Anda yang bisa melihat data ini.";

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-border bg-card p-4">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-2xl font-semibold tabular-nums leading-none">{value}</dd>
    </div>
  );
}

export default async function HealthPage() {
  const user = await requireRole("personal");
  const [minor, consent] = await Promise.all([isMinorAccount(user.accountId), activeHealthConsent(user.accountId)]);
  if (minor) notFound();
  if (!consent) {
    return (
      <div className="flex max-w-xl flex-col gap-6">
        <PageTop title="Kesehatan" subtitle={SUBTITLE} mobileSubtitle="Hanya Anda yang bisa melihatnya." />
        <section aria-labelledby="consent-title" className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4">
          <h2 id="consent-title" className="text-sm font-semibold">
            Persetujuan data kesehatan
          </h2>
          <ActionForm action={giveHealthConsent} className="flex flex-col gap-4">
            <p className="text-sm">{HEALTH_CONSENT_TEXT}</p>
            <label className="flex min-h-11 items-start gap-3 text-sm">
              <input type="checkbox" name="agree" required className="mt-0.5 size-5 shrink-0 accent-accent-foreground" />
              <span>Saya setuju</span>
            </label>
            <ActionSubmitButton className="w-fit">Setujui dan lanjutkan</ActionSubmitButton>
          </ActionForm>
        </section>
      </div>
    );
  }
  const data = await getHealthData();
  const { latestWeight, bmi, bmiOn } = data.summary;

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <PageTop title="Kesehatan" subtitle={SUBTITLE} mobileSubtitle="Hanya Anda yang bisa melihatnya.">
        <FormSheet label="Catat" title="Catat pengukuran" size="sm">
          <MeasurementForm today={data.today} />
        </FormSheet>
      </PageTop>

      <section className="flex flex-col gap-2">
        <dl className="grid grid-cols-2 gap-3">
          <Tile label="Berat terakhir" value={formatMeasure(latestWeight?.weightKg ?? null, " kg")} />
          <Tile label="IMT" value={formatMeasure(bmi)} />
        </dl>
        <p className="text-xs text-muted-foreground">
          {latestWeight ? `Berat dari catatan ${dateLabel(latestWeight.measuredOn)}. ` : ""}
          {bmiOn ? `IMT dari catatan ${dateLabel(bmiOn)}.` : "IMT muncul setelah ada catatan dengan tinggi dan berat badan di tanggal yang sama."}
        </p>
      </section>

      <Section title="Riwayat" count={data.rows.length}>
        <MeasurementList rows={data.rows.map((r) => ({ ...r, bmi: bmiOf(r.heightCm, r.weightKg) }))} today={data.today} />
      </Section>
    </div>
  );
}
