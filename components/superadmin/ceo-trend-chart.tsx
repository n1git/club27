"use client";

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AXIS_TICK, ChartTable, TOOLTIP_STYLE, TOOLTIP_TEXT } from "@/components/reports/chart-parts";
import type { CeoTrendPoint } from "@/lib/data/ceo";

const label = (iso: string) => {
  const [, m, d] = iso.split("-");
  return `${Number(d)}/${Number(m)}`;
};

export function CeoTrendChart({ data }: { data: CeoTrendPoint[] }) {
  const rows = data.map((d) => ({ ...d, label: label(d.week_start) }));
  return (
    <div className="relative">
      <div className="h-64 w-full" role="img" aria-label="Diagram garis tren 12 minggu: WAU, latihan, dan akun baru; rinciannya ada pada tabel di bawah">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--color-border)" />
            <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={false} />
            <YAxis tick={AXIS_TICK} width={40} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={TOOLTIP_TEXT} itemStyle={TOOLTIP_TEXT} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line type="monotone" dataKey="wau" name="WAU" stroke="var(--color-foreground)" strokeWidth={2} dot={false} animationDuration={240} />
            <Line type="monotone" dataKey="workouts" name="Latihan" stroke="var(--color-accent-foreground)" strokeWidth={2} strokeDasharray="6 4" dot={false} animationDuration={240} />
            <Line type="monotone" dataKey="new_accounts" name="Akun baru" stroke="var(--color-muted-foreground)" strokeWidth={2} strokeDasharray="2 3" dot={false} animationDuration={240} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <ChartTable
        caption="Tren 12 minggu"
        head={["Minggu mulai", "WAU", "Latihan", "Akun baru", "Organisasi baru", "Post"]}
        rows={rows.map((d) => [d.label, String(d.wau), String(d.workouts), String(d.new_accounts), String(d.new_orgs), String(d.posts)])}
      />
    </div>
  );
}
