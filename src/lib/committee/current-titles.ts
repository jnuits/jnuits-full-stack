type Term = { id: string; is_current: boolean; is_public: boolean; status: string; term_kind: string };
type Position = { term_id: string; role_id: string; is_public: boolean; public_label: string; role_group: string; priority: number };
type Assignment = { id: string; member_id: string | null; term_id: string; role_id: string; is_public: boolean; status: string; public_title_override: string | null; sort_order: number };

export function projectCurrentCommitteeTitles(terms: readonly Term[], positions: readonly Position[], assignments: readonly Assignment[]) {
  const currentTerms = new Set(terms.filter((term) => term.is_current && term.is_public && term.status === "active" && term.term_kind === "executive").map((term) => term.id));
  const publicPositions = new Map(positions.filter((position) => currentTerms.has(position.term_id) && position.is_public && position.role_group !== "advisor").map((position) => [`${position.term_id}:${position.role_id}`, position]));
  const titles = new Map<string, string[]>();
  const eligible = assignments.flatMap((assignment) => {
    const position = publicPositions.get(`${assignment.term_id}:${assignment.role_id}`);
    if (!position || !assignment.member_id || !assignment.is_public || assignment.status !== "active") return [];
    const title = assignment.public_title_override?.trim() || position.public_label.trim();
    return title ? [{ assignment, position, title }] : [];
  }).sort((a, b) => a.position.priority - b.position.priority || a.assignment.sort_order - b.assignment.sort_order || a.assignment.id.localeCompare(b.assignment.id));
  for (const { assignment, title } of eligible) {
    const memberTitles = titles.get(assignment.member_id!) || [];
    if (!memberTitles.includes(title)) memberTitles.push(title);
    titles.set(assignment.member_id!, memberTitles);
  }
  return titles;
}
