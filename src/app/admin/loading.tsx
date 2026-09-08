export default function AdminLoading() {
  return (
    <div className="admin-content space-y-6 p-6">
      <div className="animate-pulse space-y-3">
        <div className="h-4 w-28 rounded bg-[var(--muted)]" />
        <div className="h-9 w-72 max-w-full rounded-lg bg-[var(--muted)]" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            className="h-24 animate-pulse rounded-xl border border-border bg-[var(--muted)]/60"
            key={index}
          />
        ))}
      </div>
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            className="h-16 animate-pulse rounded-xl border border-border bg-[var(--muted)]/60"
            key={index}
          />
        ))}
      </div>
    </div>
  );
}
