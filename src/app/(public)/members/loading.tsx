import { MemberCardSkeletonGrid } from "@/components/members/member-card-skeleton";

export default function MembersLoading() {
  return (
    <div className="shell py-10">
      <section className="border-b border-[var(--line)] pb-8">
        <div className="max-w-3xl">
          <div className="member-skeleton-shimmer h-12 w-3/4 rounded-lg" />
          <div className="member-skeleton-shimmer mt-4 h-4 w-2/3 rounded" />
        </div>
        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              className="member-skeleton-shimmer h-20 rounded-xl border border-[var(--line)]"
              key={index}
            />
          ))}
        </div>
      </section>
      <div className="member-skeleton-shimmer mt-6 h-16 rounded-xl border border-[var(--line)]" />
      <section className="mt-8">
        <MemberCardSkeletonGrid />
      </section>
    </div>
  );
}
