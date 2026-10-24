import { FeedSkeleton } from "@/components/social/post-skeleton";
import { Skeleton } from "@/components/ui/skeleton";
import { SkelCard } from "@/components/ui/skeletons";
import { StoriesBarSkeleton } from "./home-stories";

function StripSkeleton() {
  return (
    <div className="flex items-center gap-3 border-b border-border px-4 py-3 lg:hidden">
      <Skeleton className="size-12 shrink-0 rounded-full" />
      <div className="flex flex-1 flex-col gap-2">
        <Skeleton className="h-3.5 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      <Skeleton className="h-8 w-16 rounded-md" />
    </div>
  );
}

export function HomeSkeleton() {
  return (
    <div className="page-spinner flex flex-col gap-6">
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,34rem)_minmax(0,1fr)]">
        <div className="-mx-4 flex min-w-0 flex-col sm:mx-0">
          <StoriesBarSkeleton />
          <StripSkeleton />
          <FeedSkeleton />
        </div>
        <div className="flex flex-col gap-4 lg:col-start-2 lg:row-start-1">
          <div className="hidden flex-col gap-4 rounded-2xl border border-border bg-card p-4 lg:flex">
            <Skeleton className="h-4 w-1/2" />
            <div className="flex items-center gap-4">
              <Skeleton className="size-20 shrink-0 rounded-full" />
              <div className="flex flex-1 flex-col gap-3">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-20" />
              </div>
            </div>
            <Skeleton className="h-8 w-full rounded-md" />
          </div>
          <SkelCard lines={2} />
        </div>
      </div>
    </div>
  );
}
