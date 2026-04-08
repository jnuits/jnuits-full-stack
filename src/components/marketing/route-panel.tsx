type RoutePanelProps = {
  eyebrow: string;
  title: string;
  summary: string;
  highlights: string[];
};

export function RoutePanel({
  eyebrow,
  title,
  summary,
  highlights,
}: RoutePanelProps) {
  return (
    <div className="shell py-12">
      <div className="glass-card px-6 py-8 sm:px-8 sm:py-10">
        <span className="eyebrow">{eyebrow}</span>
        <h1 className="section-title mt-4">{title}</h1>
        <p className="section-copy mt-4">{summary}</p>
        <ul className="clean-list mt-8">
          {highlights.map((highlight) => (
            <li key={highlight}>{highlight}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
