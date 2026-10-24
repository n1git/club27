import { Award } from "lucide-react";
import type { ProfileBadge } from "@/lib/data/social";
import { Avatar } from "./avatar";

export function ProfileHeader({
  name,
  username,
  avatarUrl,
  counts,
  bio,
  badges,
  children,
}: {
  name: string;
  username: string;
  avatarUrl: string | null;
  counts: { posts: number; friends: number } | null;
  bio?: string | null;
  badges?: ProfileBadge[];
  children?: React.ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4">
      <div className="flex items-center gap-5 sm:gap-8">
        <Avatar name={name} src={avatarUrl} size={88} />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h1 className="truncate text-xl font-semibold leading-tight">{name}</h1>
          <p className="truncate text-sm text-muted-foreground">@{username}</p>
          {counts ? (
            <dl className="mt-2 flex gap-6 text-sm">
              <div className="flex flex-col items-center sm:flex-row sm:gap-1.5">
                <dd className="font-semibold tabular-nums">{counts.posts}</dd>
                <dt className="text-muted-foreground">postingan</dt>
              </div>
              <div className="flex flex-col items-center sm:flex-row sm:gap-1.5">
                <dd className="font-semibold tabular-nums">{counts.friends}</dd>
                <dt className="text-muted-foreground">teman</dt>
              </div>
            </dl>
          ) : null}
        </div>
      </div>
      {bio ? <p className="max-w-prose whitespace-pre-line break-words text-sm">{bio}</p> : null}
      {badges?.length ? (
        <ul className="flex flex-wrap gap-2" aria-label="Lencana">
          {badges.map((b) => (
            <li key={b.id} title={b.description} className="flex items-center gap-2 rounded-xl bg-secondary py-1 pl-1 pr-3 text-xs font-medium">
              <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Award size={14} aria-hidden="true" />
              </span>
              {b.name}
            </li>
          ))}
        </ul>
      ) : null}
      {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
    </header>
  );
}
