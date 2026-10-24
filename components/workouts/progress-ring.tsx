import { cn } from "@/lib/utils";

const RADIUS = 46;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function ProgressRing({
  sessions,
  goal,
  className,
  children,
}: {
  sessions: number;
  goal: number | null;
  className?: string;
  children?: React.ReactNode;
}) {
  const progress = goal ? Math.min(1, sessions / goal) : 0;
  return (
    <div className={cn("relative shrink-0", className)}>
      <svg viewBox="0 0 100 100" className="size-full -rotate-90" aria-hidden="true" focusable="false">
        <circle cx="50" cy="50" r={RADIUS} fill="none" strokeWidth="9" className="stroke-secondary" />
        {goal ? (
          <circle
            cx="50"
            cy="50"
            r={RADIUS}
            fill="none"
            strokeWidth="9"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={CIRCUMFERENCE * (1 - progress)}
            className="stroke-primary motion-safe:transition-[stroke-dashoffset] motion-safe:duration-700"
          />
        ) : null}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}
