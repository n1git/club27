"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { MessageCircle, MoreHorizontal, Search } from "lucide-react";
import { blockAccount, removeFriend, respondFriend, unblockAccount } from "@/lib/actions/social";
import type { ActionState } from "@/lib/actions/types";
import type { FriendLists, Person } from "@/lib/data/social";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/social/avatar";
import { Button } from "@/components/ui/button";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { QuickAddTrigger } from "./quick-add";

const GROUP = "divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card";
const ROW =
  "flex min-h-12 w-full items-center px-4 text-left text-sm font-medium hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring";

function Count({ n }: { n: number }) {
  return <span className="rounded-md bg-secondary px-1.5 py-0.5 text-xs font-medium tabular-nums text-secondary-foreground">{n}</span>;
}

function Who({ person, href = true }: { person: Person; href?: boolean }) {
  const body = (
    <>
      <Avatar name={person.fullName} src={person.avatarUrl} size={48} />
      <span className="flex min-w-0 flex-col leading-tight">
        <span className="truncate text-sm font-semibold">{person.fullName}</span>
        <span className="truncate text-xs text-muted-foreground">@{person.username}</span>
      </span>
    </>
  );
  return href ? (
    <Link href={`/${person.username}`} className="flex min-w-0 flex-1 items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      {body}
    </Link>
  ) : (
    <div className="flex min-w-0 flex-1 items-center gap-3">{body}</div>
  );
}

export function FriendsView({ lists }: { lists: FriendLists }) {
  const [query, setQuery] = useState("");
  const [menu, setMenu] = useState<Person | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [, start] = useTransition();

  const friends = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? lists.friends.filter((f) => f.person.fullName.toLowerCase().includes(q) || f.person.username.includes(q)) : lists.friends;
  }, [lists.friends, query]);

  function run(key: string, action: (prev: ActionState, form: FormData) => Promise<ActionState>, fields: Record<string, string>, done: string, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    setMenu(null);
    const form = new FormData();
    for (const [k, v] of Object.entries(fields)) form.set(k, v);
    setBusy(key);
    start(async () => {
      const result = await action({}, form);
      setBusy(null);
      if (result.ok) toast.success(result.message ?? done);
      else toast.error(result.error ?? "Gagal memproses");
    });
  }

  const dim = (key: string) => (busy === key ? "opacity-50" : undefined);

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      {lists.incoming.length ? (
        <section aria-labelledby="req-title" className="flex flex-col gap-2 lg:col-start-2 lg:row-start-1">
          <h2 id="req-title" className="flex items-center gap-2 text-sm font-semibold">
            Permintaan masuk <Count n={lists.incoming.length} />
          </h2>
          <ul className={GROUP}>
            {lists.incoming.map((r) => (
              <li key={r.friendshipId} className={cn("flex items-center gap-3 px-4 py-3", dim(r.friendshipId))}>
                <Who person={r.person} />
                <Button size="sm" disabled={busy === r.friendshipId} onClick={() => run(r.friendshipId, respondFriend, { friendshipId: r.friendshipId, accept: "1" }, "Kalian sekarang berteman")}>
                  Terima
                </Button>
                <Button size="sm" variant="outline" disabled={busy === r.friendshipId} onClick={() => run(r.friendshipId, respondFriend, { friendshipId: r.friendshipId, accept: "0" }, "Permintaan ditolak")}>
                  Tolak
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="friends-title" className="flex min-w-0 flex-col gap-3 lg:col-start-1 lg:row-span-3 lg:row-start-1">
        <h2 id="friends-title" className="flex items-center gap-2 text-sm font-semibold">
          Teman <Count n={lists.friends.length} />
        </h2>
        {lists.friends.length > 4 ? (
          <label className="relative block">
            <span className="sr-only">Cari teman</span>
            <Search size={16} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari teman"
              className="h-11 w-full rounded-xl border border-input bg-background pl-9 pr-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-sm"
            />
          </label>
        ) : null}
        {lists.friends.length === 0 ? (
          <div className="flex flex-col items-start gap-3 rounded-2xl border border-dashed border-border p-5">
            <p className="text-sm text-muted-foreground">Belum ada teman. Tambah teman dengan username yang persis sama, lalu lihat latihan mereka di feed.</p>
            <QuickAddTrigger kind="friend" size="sm">
              Tambah teman
            </QuickAddTrigger>
          </div>
        ) : friends.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-5 text-sm text-muted-foreground">Tidak ada teman yang cocok dengan &ldquo;{query}&rdquo;.</p>
        ) : (
          <ul className={GROUP}>
            {friends.map((f) => (
              <li key={f.friendshipId} className="flex items-center gap-2 py-2 pl-4 pr-2">
                <Who person={f.person} />
                <Link
                  href={`/messages/${f.person.username}`}
                  aria-label={`Kirim pesan ke ${f.person.fullName}`}
                  className="flex size-11 shrink-0 items-center justify-center rounded-full text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <MessageCircle size={20} aria-hidden="true" />
                </Link>
                <button
                  type="button"
                  aria-label={`Opsi untuk ${f.person.fullName}`}
                  aria-haspopup="dialog"
                  onClick={() => setMenu(f.person)}
                  className="flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <MoreHorizontal size={20} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {lists.outgoing.length || lists.blocked.length ? (
        <div className="flex flex-col gap-3 lg:col-start-2">
          {lists.outgoing.length ? (
            <details className="group rounded-2xl border border-border bg-card">
              <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 px-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                Permintaan terkirim <Count n={lists.outgoing.length} />
              </summary>
              <ul className="divide-y divide-border border-t border-border">
                {lists.outgoing.map((r) => (
                  <li key={r.friendshipId} className={cn("flex items-center gap-3 px-4 py-3", dim(r.friendshipId))}>
                    <Who person={r.person} />
                    <Button size="sm" variant="outline" disabled={busy === r.friendshipId} onClick={() => run(r.friendshipId, removeFriend, { accountId: r.person.id }, "Permintaan dibatalkan")}>
                      Batalkan
                    </Button>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
          {lists.blocked.length ? (
            <details className="group rounded-2xl border border-border bg-card">
              <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 px-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                Diblokir <Count n={lists.blocked.length} />
              </summary>
              <ul className="divide-y divide-border border-t border-border">
                {lists.blocked.map((p) => (
                  <li key={p.id} className={cn("flex items-center gap-3 px-4 py-3", dim(p.id))}>
                    <Who person={p} href={false} />
                    <Button size="sm" variant="outline" disabled={busy === p.id} onClick={() => run(p.id, unblockAccount, { accountId: p.id }, "Blokir dibuka")}>
                      Buka blokir
                    </Button>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>
      ) : null}

      <BottomSheet open={menu !== null} onClose={() => setMenu(null)} title="Teman">
        {menu ? (
          <div className="flex flex-col">
            <div className="flex items-center gap-3 px-4 py-4">
              <Avatar name={menu.fullName} src={menu.avatarUrl} size={48} />
              <div className="min-w-0">
                <p className="truncate font-semibold">{menu.fullName}</p>
                <p className="truncate text-xs text-muted-foreground">@{menu.username}</p>
              </div>
            </div>
            <ul className="divide-y divide-border border-t border-border pb-[env(safe-area-inset-bottom)]">
              <li>
                <Link href={`/${menu.username}`} className={ROW}>
                  Lihat profil
                </Link>
              </li>
              <li>
                <Link href={`/messages/${menu.username}`} className={ROW}>
                  Kirim pesan
                </Link>
              </li>
              <li>
                <button type="button" className={cn(ROW, "text-destructive")} onClick={() => run(menu.id, removeFriend, { accountId: menu.id }, "Teman dihapus", `Hapus ${menu.fullName} dari teman?`)}>
                  Hapus dari teman
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className={cn(ROW, "text-destructive")}
                  onClick={() => run(menu.id, blockAccount, { accountId: menu.id }, "Pengguna diblokir", `Blokir ${menu.fullName}? Pertemanan akan dihapus dan Anda tidak saling melihat konten.`)}
                >
                  Blokir
                </button>
              </li>
            </ul>
          </div>
        ) : null}
      </BottomSheet>
    </div>
  );
}
