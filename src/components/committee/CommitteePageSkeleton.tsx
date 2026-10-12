function SkeletonBlock({ className }: { className: string }) {
  return <div className={`bg-muted ${className}`} />;
}

export function CommitteePageSkeleton() {
  return (
    <div className="shell flex animate-pulse flex-col gap-24 py-16">
      <div className="flex flex-col items-center gap-4 text-center">
        <SkeletonBlock className="h-7 w-48 rounded-full" />
        <SkeletonBlock className="h-16 w-3/4 rounded-2xl" />
        <SkeletonBlock className="h-6 w-1/2 rounded-xl" />
        <div className="mt-2 flex justify-center gap-3">
          <SkeletonBlock className="h-11 w-36 rounded-full" />
          <SkeletonBlock className="h-11 w-32 rounded-full" />
          <SkeletonBlock className="h-11 w-28 rounded-full" />
        </div>
        <div className="mt-8 grid w-full max-w-2xl grid-cols-3 gap-4">
          {[1, 2, 3].map((item) => (
            <SkeletonBlock className="h-20 rounded-xl" key={item} />
          ))}
        </div>
      </div>

      <div>
        <SkeletonBlock className="mb-8 h-12 w-80 rounded-xl" />
        <SkeletonBlock className="h-64 rounded-3xl" />
      </div>

      <div>
        <SkeletonBlock className="mb-8 h-12 w-64 rounded-xl" />
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <SkeletonBlock className="h-56 rounded-3xl" />
          <SkeletonBlock className="h-56 rounded-3xl" />
          <SkeletonBlock className="h-56 rounded-3xl" />
        </div>
      </div>

      <div>
        <SkeletonBlock className="mb-6 h-12 w-72 rounded-xl" />
        <div className="overflow-hidden rounded-2xl border border-border">
          {[1, 2, 3, 4, 5, 6].map((item) => (
            <div
              className="flex items-center gap-5 border-b border-border px-6 py-5 last:border-b-0"
              key={item}
            >
              <SkeletonBlock className="size-11 flex-shrink-0 rounded-xl" />
              <div className="flex-1">
                <SkeletonBlock className="mb-2 h-4 w-48 rounded" />
                <SkeletonBlock className="h-3 w-32 rounded" />
              </div>
              <SkeletonBlock className="h-10 w-24 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
