"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

export const LazyCeoTrendChart = dynamic(() => import("./ceo-trend-chart").then((m) => m.CeoTrendChart), {
  ssr: false,
  loading: () => (
    <div role="status" aria-label="Memuat diagram">
      <Skeleton className="h-64 w-full" />
    </div>
  ),
});
