export function MemberCardSkeleton() {
  return (
    <div className="member-card skeleton-card" aria-hidden="true">
      <div className="skeleton-header">
        <div className="skeleton-circle" style={{ height: 80, width: 80 }} />
        <div>
          <div className="skeleton-line" style={{ width: 140 }} />
          <div className="skeleton-line short" style={{ marginTop: 6, width: 60 }} />
        </div>
      </div>
      <div className="skeleton-line" style={{ marginTop: 12, width: 100 }} />
      <div className="skeleton-line" style={{ marginTop: 16, width: "80%" }} />
      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <div className="skeleton-circle small" />
        <div className="skeleton-circle small" />
      </div>
    </div>
  );
}

export function MemberCardSkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="members-grid">
      {Array.from({ length: count }).map((_, index) => (
        <MemberCardSkeleton key={index} />
      ))}
    </div>
  );
}
