"use client";

import Link from "next/link";
import { Dumbbell, UserPlus, Users } from "lucide-react";
import { useQuickAdd } from "./quick-add";

const ROW =
  "flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left ui-transition hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring";

function Tile({ children }: { children: React.ReactNode }) {
  return <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary">{children}</span>;
}

export function HomeEmpty() {
  const quickAdd = useQuickAdd();
  return (
    <section aria-labelledby="start-title" className="mx-4 my-6 flex flex-col gap-3 sm:mx-0">
      <div>
        <h2 id="start-title" className="text-base font-semibold">
          Mulai dari sini
        </h2>
        <p className="text-sm text-muted-foreground">Feed terisi saat teman Anda membagikan latihan. Tiga langkah pertama:</p>
      </div>
      <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
        <li>
          <button type="button" onClick={() => quickAdd?.open("friend")} className={ROW}>
            <Tile>
              <UserPlus size={20} aria-hidden="true" />
            </Tile>
            <span className="flex flex-col leading-tight">
              <span className="text-sm font-semibold">Tambah teman</span>
              <span className="text-xs text-muted-foreground">Pakai username yang persis sama.</span>
            </span>
          </button>
        </li>
        <li>
          <button type="button" onClick={() => quickAdd?.open("workout")} className={ROW}>
            <Tile>
              <Dumbbell size={20} aria-hidden="true" />
            </Tile>
            <span className="flex flex-col leading-tight">
              <span className="text-sm font-semibold">Catat latihan pertama</span>
              <span className="text-xs text-muted-foreground">Sekecil apa pun, itu sudah dihitung.</span>
            </span>
          </button>
        </li>
        <li>
          <Link href="/join" className={ROW}>
            <Tile>
              <Users size={20} aria-hidden="true" />
            </Tile>
            <span className="flex flex-col leading-tight">
              <span className="text-sm font-semibold">Gabung klub</span>
              <span className="text-xs text-muted-foreground">Masukkan kode dari admin klub.</span>
            </span>
          </Link>
        </li>
      </ul>
    </section>
  );
}
