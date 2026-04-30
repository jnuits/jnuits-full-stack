export default function MemberProfileLoading() {
  return (
    <main className="profile-page">
      <div
        className="skeleton-line"
        style={{ height: 14, marginBottom: 32, width: 140 }}
      />
      <div className="profile-card">
        <div className="profile-hero">
          <div className="skeleton-circle" style={{ height: 96, width: 96 }} />
          <div>
            <div className="skeleton-line" style={{ marginBottom: 10, width: 180 }} />
            <div
              className="skeleton-line"
              style={{ borderRadius: 99, height: 22, width: 70 }}
            />
            <div className="skeleton-line" style={{ marginTop: 8, width: 120 }} />
          </div>
        </div>
      </div>
    </main>
  );
}
