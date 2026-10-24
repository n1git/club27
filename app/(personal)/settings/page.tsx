import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { requireRole } from "@/lib/auth/guard";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DeleteAccountForm } from "@/components/shared/delete-account-form";
import { MyConsentsCard } from "@/components/shared/my-consents-card";
import { DetailsPanel, GROUP, PageTop } from "@/components/personal/page-top";
import { getAccountConsents } from "@/lib/data/consents";

export const metadata: Metadata = { title: "Pengaturan" };

const ERRORS: Record<string, string> = {
  sandi: "Kata sandi konfirmasi salah.",
  batas: "Terlalu banyak percobaan. Coba lagi beberapa menit lagi.",
  gagal: "Ekspor gagal dibuat. Coba lagi nanti.",
  data: "Permintaan tidak valid.",
};

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ galat?: string }> }) {
  const user = await requireRole("personal");
  const [{ galat }, consents] = await Promise.all([searchParams, getAccountConsents(user.accountId)]);
  const error = galat ? ERRORS[galat] : null;
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <PageTop title="Pengaturan" subtitle="Akun, privasi, dan data Anda." />
      <ul className={GROUP}>
        <li>
          <Link
            href="/settings/account"
            className="flex min-h-16 items-center gap-3 px-4 py-3 ui-transition hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          >
            <span className="flex min-w-0 flex-1 flex-col leading-tight">
              <span className="text-sm font-semibold">Akun</span>
              <span className="text-xs text-muted-foreground">Foto, bio, lencana, data akun, profil publik, organisasi, dan kata sandi.</span>
            </span>
            <ChevronRight size={18} aria-hidden="true" className="shrink-0 text-muted-foreground" />
          </Link>
        </li>
      </ul>
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <div className="flex flex-col gap-3">
        <DetailsPanel title="Persetujuan saya" description="Syarat, privasi, dan data kesehatan.">
          <MyConsentsCard consents={consents} />
        </DetailsPanel>
        <DetailsPanel title="Ekspor data" description="Unduh data akun Anda sebagai ZIP berisi CSV.">
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              Latihan, teman, postingan, komentar, cerita, pesan, grup, event, dan permintaan gabung klub. Data klub tempat Anda menjadi anggota dikelola klub dan tidak ikut.
            </p>
            <form method="post" action="/api/export/account" className="flex max-w-sm flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="export-password">Konfirmasi dengan kata sandi Anda</Label>
                <Input id="export-password" name="confirmPassword" type="password" required maxLength={128} autoComplete="current-password" />
              </div>
              <Button type="submit" variant="outline" className="w-fit">
                Unduh ZIP
              </Button>
            </form>
          </div>
        </DetailsPanel>
        <DetailsPanel title="Hapus akun" description="Tidak bisa dibatalkan." danger>
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              Menghapus akun, profil, catatan latihan, catatan kesehatan, teman, postingan, komentar, cerita, pesan, grup yang Anda buat, dan event. Akun yang masih terhubung ke klub atau organisasi tidak bisa dihapus dari sini.
            </p>
            <DeleteAccountForm />
          </div>
        </DetailsPanel>
      </div>
    </div>
  );
}
