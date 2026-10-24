import { Input } from "@/components/ui/input";
import { buttonVariants } from "@/components/ui/button";

export function MonthPicker({ month, action }: { month: string; action: string }) {
  return (
    <form action={action} className="flex items-end gap-2">
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        Bulan
        <Input type="month" name="bulan" defaultValue={month.slice(0, 7)} className="w-44" />
      </label>
      <button type="submit" className={buttonVariants({ variant: "outline" })}>
        Tampilkan
      </button>
    </form>
  );
}
