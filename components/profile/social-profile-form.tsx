"use client";

import { useState } from "react";
import { Award } from "lucide-react";
import { updateSocialProfile } from "@/lib/actions/social-profile";
import type { SocialProfileSettings } from "@/lib/data/social";
import { cn } from "@/lib/utils";
import { ActionForm } from "@/components/shared/action-form";
import { ActionSubmitButton } from "@/components/shared/action-submit-button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const MAX_BADGES = 3;

export function SocialProfileForm({ settings }: { settings: SocialProfileSettings }) {
  const [bio, setBio] = useState(settings.bio);
  const [picked, setPicked] = useState<string[]>(settings.featured);

  function toggle(id: string) {
    setPicked((list) => (list.includes(id) ? list.filter((x) => x !== id) : list.length < MAX_BADGES ? [...list, id] : list));
  }

  return (
    <ActionForm action={updateSocialProfile} className="flex max-w-xl flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="bio">Bio</Label>
        <Textarea id="bio" name="bio" rows={3} maxLength={160} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Ceritakan singkat tentang Anda" />
        <p className="text-right text-xs tabular-nums text-muted-foreground">{bio.length}/160</p>
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">Lencana di profil</legend>
        <p className="text-xs text-muted-foreground">
          Pilih sampai {MAX_BADGES} lencana yang tampil di profil Anda ({picked.length}/{MAX_BADGES}).
        </p>
        {settings.earned.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">Belum ada lencana. Catat latihan untuk meraihnya.</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {settings.earned.map((b) => {
              const on = picked.includes(b.id);
              const locked = !on && picked.length >= MAX_BADGES;
              return (
                <li key={b.id}>
                  <label
                    className={cn(
                      "flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border p-3 ui-transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                      on ? "border-primary bg-accent/60" : "border-border bg-card",
                      locked && "cursor-not-allowed opacity-50",
                    )}
                  >
                    <input type="checkbox" name="badge" value={b.id} checked={on} disabled={locked} onChange={() => toggle(b.id)} className="sr-only" />
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                      <Award size={18} aria-hidden="true" />
                    </span>
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-sm font-semibold">{b.name}</span>
                      <span className="truncate text-xs text-muted-foreground">{b.description}</span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </fieldset>
      <ActionSubmitButton className="w-fit">Simpan</ActionSubmitButton>
    </ActionForm>
  );
}
