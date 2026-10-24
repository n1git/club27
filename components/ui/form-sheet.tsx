"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { useActionFormState } from "@/components/shared/action-form";

const CloseContext = createContext<(() => void) | null>(null);

export function CloseOnSuccess() {
  const close = useContext(CloseContext);
  const state = useActionFormState();
  useEffect(() => {
    if (state.ok) close?.();
  }, [state, close]);
  return null;
}

export function FormSheet({ label, title, children, ...props }: ButtonProps & { label: React.ReactNode; title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" aria-haspopup="dialog" onClick={() => setOpen(true)} {...props}>
        {label}
      </Button>
      <BottomSheet open={open} onClose={() => setOpen(false)} title={title}>
        <CloseContext value={() => setOpen(false)}>
          <div className="p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">{children}</div>
        </CloseContext>
      </BottomSheet>
    </>
  );
}
