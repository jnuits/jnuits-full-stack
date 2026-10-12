import { describe, expect, it } from "vitest";
import { projectCurrentCommitteeTitles } from "./current-titles";
const term = { id: "term", is_current: true, is_public: true, status: "active", term_kind: "executive" };
const position = { term_id: "term", role_id: "role", is_public: true, public_label: "President", role_group: "executive", priority: 10 };
const assignment = { id: "a", member_id: "member", term_id: "term", role_id: "role", is_public: true, status: "active", public_title_override: null, sort_order: 0 };
describe("current committee office labels", () => {
  it("uses the current public position and an authorized title override", () => {
    expect(projectCurrentCommitteeTitles([term], [position], [assignment]).get("member")).toEqual(["President"]);
    expect(projectCurrentCommitteeTitles([term], [position], [{ ...assignment, public_title_override: "Acting President" }]).get("member")).toEqual(["Acting President"]);
  });
  it.each([
    [{ ...term, is_current: false }, position, assignment],
    [{ ...term, is_public: false }, position, assignment],
    [{ ...term, status: "archived" }, position, assignment],
    [term, { ...position, is_public: false }, assignment],
    [term, position, { ...assignment, is_public: false }],
    [term, position, { ...assignment, status: "planned" }],
    [term, position, { ...assignment, status: "resigned" }],
  ])("excludes historical, unpublished and inactive appointments", (t, p, a) => {
    expect(projectCurrentCommitteeTitles([t], [p], [a]).size).toBe(0);
  });
  it("deduplicates and orders multiple active offices", () => {
    const deputy = { ...position, role_id: "deputy", public_label: "Vice President", priority: 20 };
    expect(projectCurrentCommitteeTitles([term], [deputy, position], [{ ...assignment, id: "b", role_id: "deputy" }, assignment, { ...assignment, id: "duplicate" }]).get("member")).toEqual(["President", "Vice President"]);
  });
});
