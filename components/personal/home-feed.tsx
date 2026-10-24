import Link from "next/link";
import { getFeed } from "@/lib/data/social";
import { getReadyClubTypes } from "@/lib/club-type";
import { HomeEmpty } from "@/components/personal/home-empty";
import { PostCard } from "@/components/social/post-card";
import { buttonVariants } from "@/components/ui/button";

export async function HomeFeed({ accountId, before }: { accountId: string; before?: string }) {
  const [feed, clubTypes] = await Promise.all([getFeed(accountId, before), getReadyClubTypes()]);
  const sportLabels = Object.fromEntries(clubTypes.map((t) => [t.code, t.name.replace(/^Klub\s+/, "")]));
  return (
    <section aria-labelledby="feed-title" className="flex flex-col sm:gap-4">
      <h2 id="feed-title" className="sr-only">
        Feed teman
      </h2>
      {feed.posts.length === 0 ? (
        <HomeEmpty />
      ) : (
        feed.posts.map((post) => <PostCard key={post.id} post={post} sportLabels={sportLabels} />)
      )}
      {feed.hasMore ? (
        <div className="px-4 py-4 sm:px-0 sm:py-0">
          <Link href={`/?sebelum=${encodeURIComponent(feed.posts[feed.posts.length - 1].createdAt)}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
            Postingan sebelumnya
          </Link>
        </div>
      ) : null}
    </section>
  );
}
