export default function PortalLoading() {
  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="animate-pulse space-y-3">
        <div className="h-4 w-24 rounded bg-muted" />
        <div className="h-9 w-64 max-w-full rounded-lg bg-muted" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            className="h-28 animate-pulse rounded-xl border border-border bg-muted/60"
            key={index}
          />
        ))}
      </div>
    </div>
  );
}
