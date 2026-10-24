"use client";

import { switchContext } from "@/lib/actions/context";
import { ActionForm } from "@/components/shared/action-form";
import { Button } from "@/components/ui/button";

export interface ContextOption {
  key: string;
  label: string;
  detail: string;
}

export function ContextList({ options }: { options: ContextOption[] }) {
  return (
    <ul className="flex flex-col divide-y divide-border">
      {options.map((option) => (
        <li key={option.key}>
          <ActionForm action={switchContext} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
            <input type="hidden" name="key" value={option.key} />
            <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-sm font-semibold">
              {option.label.trim().slice(0, 1).toUpperCase()}
            </span>
            <span className="flex min-w-0 flex-1 flex-col text-sm leading-tight">
              <span className="truncate font-semibold">{option.label}</span>
              <span className="truncate text-xs text-muted-foreground">{option.detail}</span>
            </span>
            <Button type="submit" size="sm" variant="outline">
              Masuk
            </Button>
          </ActionForm>
        </li>
      ))}
    </ul>
  );
}

export function PersonalSwitch() {
  return (
    <ActionForm action={switchContext}>
      <input type="hidden" name="key" value="personal" />
      <Button type="submit" size="sm" variant="outline">
        Akun saya
      </Button>
    </ActionForm>
  );
}
