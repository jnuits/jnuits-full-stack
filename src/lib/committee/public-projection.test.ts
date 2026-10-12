import { describe, expect, it } from "vitest";

import {
  projectPublicCommitteeDirectory,
  type PublicCommitteeProjectionInput,
} from "./public-projection";

function makeInput(): PublicCommitteeProjectionInput {
  return {
    advisors: [],
    assignments: [
      {
        display_name: null,
        id: "assignment-joint-b",
        is_public: true,
        member_id: "member-b",
        public_title_override: null,
        role_id: "role-joint",
        sort_order: 20,
        status: "active",
        term_id: "term-6",
      },
      {
        display_name: null,
        id: "assignment-joint-a",
        is_public: true,
        member_id: "member-president",
        public_title_override: null,
        role_id: "role-joint",
        sort_order: 20,
        status: "active",
        term_id: "term-6",
      },
      {
        display_name: null,
        id: "assignment-president",
        is_public: true,
        member_id: "member-president",
        public_title_override: null,
        role_id: "role-president",
        sort_order: 1,
        status: "active",
        term_id: "term-6",
      },
      {
        display_name: null,
        id: "assignment-sub-executive",
        is_public: true,
        member_id: "member-a",
        public_title_override: null,
        role_id: "role-sub",
        sort_order: 1,
        status: "active",
        term_id: "term-6",
      },
      {
        display_name: "Teacher advisor",
        id: "assignment-advisor",
        is_public: true,
        member_id: null,
        public_title_override: null,
        role_id: "role-advisor",
        sort_order: 1,
        status: "active",
        term_id: "term-6",
      },
      {
        display_name: "Hidden position",
        id: "assignment-hidden-position",
        is_public: true,
        member_id: null,
        public_title_override: null,
        role_id: "role-hidden",
        sort_order: 1,
        status: "active",
        term_id: "term-6",
      },
      {
        display_name: "Private assignment",
        id: "assignment-private",
        is_public: false,
        member_id: null,
        public_title_override: null,
        role_id: "role-joint",
        sort_order: 1,
        status: "active",
        term_id: "term-6",
      },
      {
        display_name: "Planned assignment",
        id: "assignment-planned",
        is_public: true,
        member_id: null,
        public_title_override: null,
        role_id: "role-joint",
        sort_order: 1,
        status: "planned",
        term_id: "term-6",
      },
      {
        display_name: null,
        id: "assignment-history",
        is_public: true,
        member_id: "member-a",
        public_title_override: "Former President",
        role_id: "role-president",
        sort_order: 1,
        status: "completed",
        term_id: "term-5",
      },
      {
        display_name: "Missing role",
        id: "assignment-missing-role",
        is_public: true,
        member_id: null,
        public_title_override: null,
        role_id: "role-missing",
        sort_order: 1,
        status: "active",
        term_id: "term-6",
      },
    ],
    departments: [
      { code: "cse", name: "Computer Science and Engineering" },
    ],
    members: [
      {
        avatar_secure_url: "https://example.com/a.jpg",
        department_code: "cse",
        facebook_url: "https://facebook.com/a",
        full_name: "Alpha Member",
        id: "member-a",
        jnuits_id: "JNUITS-2023001",
        linkedin_url: null,
        website_url: null,
        email: "private@example.com",
        phone: "+8801000000000",
        portal_access_status: "frozen",
      } as PublicCommitteeProjectionInput["members"][number],
      {
        avatar_secure_url: null,
        department_code: null,
        facebook_url: null,
        full_name: "Beta Member",
        id: "member-b",
        jnuits_id: "JNUITS-2023002",
        linkedin_url: null,
        website_url: null,
      },
      {
        avatar_secure_url: null,
        department_code: "cse",
        facebook_url: null,
        full_name: "President Member",
        id: "member-president",
        jnuits_id: "JNUITS-2023003",
        linkedin_url: null,
        website_url: null,
      },
    ],
    positions: [
      {
        id: "position-joint",
        is_public: true,
        max_slots: 2,
        min_slots: 0,
        priority: 10,
        public_label: "Joint Secretary",
        public_label_bn: "যুগ্ম সম্পাদক",
        role_group: "executive",
        role_id: "role-joint",
        target_slots: 2,
        term_id: "term-6",
      },
      {
        id: "position-president-6",
        is_public: true,
        max_slots: 1,
        min_slots: 1,
        priority: 20,
        public_label: "President",
        public_label_bn: null,
        role_group: "executive",
        role_id: "role-president",
        target_slots: 1,
        term_id: "term-6",
      },
      {
        id: "position-sub",
        is_public: true,
        max_slots: 3,
        min_slots: 0,
        priority: 30,
        public_label: "Sub Executive Member",
        public_label_bn: null,
        role_group: "sub_executive",
        role_id: "role-sub",
        target_slots: 3,
        term_id: "term-6",
      },
      {
        id: "position-advisor",
        is_public: true,
        max_slots: 1,
        min_slots: 0,
        priority: 1,
        public_label: "Advisor",
        public_label_bn: null,
        role_group: "advisor",
        role_id: "role-advisor",
        target_slots: 1,
        term_id: "term-6",
      },
      {
        id: "position-hidden",
        is_public: false,
        max_slots: 1,
        min_slots: 0,
        priority: 1,
        public_label: "Internal role",
        public_label_bn: null,
        role_group: "executive",
        role_id: "role-hidden",
        target_slots: 1,
        term_id: "term-6",
      },
      {
        id: "position-president-5",
        is_public: true,
        max_slots: 1,
        min_slots: 0,
        priority: 1,
        public_label: "President",
        public_label_bn: null,
        role_group: "executive",
        role_id: "role-president",
        target_slots: 1,
        term_id: "term-5",
      },
    ],
    roles: [
      { code: "joint-secretary", id: "role-joint" },
      { code: "president", id: "role-president" },
      { code: "sub-executive-member", id: "role-sub" },
      { code: "advisor", id: "role-advisor" },
      { code: "internal", id: "role-hidden" },
    ],
    terms: [
      {
        date_confidence: "verified",
        election_date: "2026-07-07",
        ends_on: null,
        id: "term-6",
        is_current: true,
        is_public: true,
        slug: "sixth-committee",
        starts_on: "2026-07-07",
        status: "active",
        summary: "Current committee",
        target_executive_slots: 99,
        tenure_note: null,
        term_kind: "executive",
        term_number: 6,
        title: "6th Executive Committee",
        voter_rule_note: null,
      },
      {
        date_confidence: "estimated",
        election_date: null,
        ends_on: "2026-07-06",
        id: "term-5",
        is_current: false,
        is_public: true,
        slug: "fifth-committee",
        starts_on: "2025-01-01",
        status: "archived",
        summary: null,
        target_executive_slots: 18,
        tenure_note: null,
        term_kind: "executive",
        term_number: 5,
        title: "5th Executive Committee",
        voter_rule_note: null,
      },
      {
        date_confidence: "verified",
        election_date: null,
        ends_on: null,
        id: "term-hidden",
        is_current: false,
        is_public: false,
        slug: "hidden",
        starts_on: "2024-01-01",
        status: "archived",
        summary: null,
        target_executive_slots: 12,
        tenure_note: null,
        term_kind: "executive",
        term_number: 4,
        title: "Hidden Committee",
        voter_rule_note: null,
      },
    ],
  };
}

describe("public committee projection", () => {
  it("uses the term overlay for visibility, labels, configured seats, and stable ordering", () => {
    const directory = projectPublicCommitteeDirectory(makeInput());
    const current = directory.currentTerm;

    expect(directory.terms.map((term) => term.termNumber)).toEqual([6, 5]);
    expect(current?.slug).toBe("sixth-committee");
    expect(current?.targetExecutiveSlots).toBe(6);
    expect(current?.assignments.map((assignment) => assignment.id)).toEqual([
      "assignment-joint-a",
      "assignment-joint-b",
      "assignment-president",
      "assignment-sub-executive",
    ]);
    expect(current?.assignments.map((assignment) => assignment.roleTitle)).toEqual([
      "Joint Secretary",
      "Joint Secretary",
      "President",
      "Sub Executive Member",
    ]);
  });

  it("places the current term before a higher-numbered upcoming term", () => {
    const input = makeInput();
    const template = input.terms[0];

    input.terms = [
      ...input.terms,
      {
        ...template,
        election_date: null,
        id: "term-7",
        is_current: false,
        slug: "seventh-committee",
        starts_on: "2027-01-01",
        status: "upcoming",
        summary: "Upcoming committee",
        term_number: 7,
        title: "7th Executive Committee",
      },
    ];

    expect(
      projectPublicCommitteeDirectory(input).terms.map((term) => term.termNumber)
    ).toEqual([6, 7, 5]);
  });

  it("uses the stored term target only when no public roster positions are configured", () => {
    const directory = projectPublicCommitteeDirectory(makeInput());
    const historical = directory.terms.find((term) => term.id === "term-5");

    expect(historical?.targetExecutiveSlots).toBe(1);

    const withoutHistoricalPositions = makeInput();
    withoutHistoricalPositions.positions = withoutHistoricalPositions.positions.filter(
      (position) => position.term_id !== "term-5"
    );

    expect(
      projectPublicCommitteeDirectory(withoutHistoricalPositions).terms.find(
        (term) => term.id === "term-5"
      )?.targetExecutiveSlots
    ).toBe(18);
  });

  it("builds one safe committee profile with service across several terms", () => {
    const directory = projectPublicCommitteeDirectory(makeInput());
    const profile = directory.memberProfiles.find(
      (candidate) => candidate.jnuitsId === "JnUITS-2023001"
    );

    expect(profile?.appointments.map((appointment) => appointment.termNumber)).toEqual([
      6,
      5,
    ]);
    expect(profile).toEqual({
      appointments: [
        expect.objectContaining({
          assignmentId: "assignment-sub-executive",
          roleTitle: "Sub Executive Member",
          termSlug: "sixth-committee",
        }),
        expect.objectContaining({
          assignmentId: "assignment-history",
          roleTitle: "Former President",
          termSlug: "fifth-committee",
        }),
      ],
      avatarUrl: "https://example.com/a.jpg",
      departmentName: "Computer Science and Engineering",
      displayName: "Alpha Member",
      facebookUrl: "https://facebook.com/a",
      jnuitsId: "JnUITS-2023001",
      linkedinUrl: null,
      websiteUrl: null,
    });
    expect(Object.keys(profile || {})).not.toContain("email");
    expect(Object.keys(profile || {})).not.toContain("phone");
    expect(Object.keys(profile || {})).not.toContain("portalAccessStatus");
  });

  it("drops assignments with missing role or position relations without inventing data", () => {
    const directory = projectPublicCommitteeDirectory(makeInput());

    expect(
      directory.terms.flatMap((term) => term.assignments).map((assignment) => assignment.id)
    ).not.toContain("assignment-missing-role");
    expect(
      directory.terms.flatMap((term) => term.assignments).map((assignment) => assignment.id)
    ).not.toContain("assignment-advisor");
  });

  it("selects the highest published term when no term is marked current", () => {
    const input = makeInput();
    input.terms = input.terms.map((term) => ({ ...term, is_current: false }));

    expect(projectPublicCommitteeDirectory(input).currentTerm?.termNumber).toBe(6);
  });
});

describe("public committee quotes", () => {
  it("projects a published leadership quote without exposing internal notes", () => {
    const input=makeInput();
    input.assignments=input.assignments.map(row => ({ ...row, speech: row.id === "assignment-president" ? "Lead with care." : null, bio: "PRIVATE operator notes" }));
    const publicRow=projectPublicCommitteeDirectory(input).currentTerm?.assignments.find(row => row.id === "assignment-president");
    expect(publicRow).toHaveProperty("speech", "Lead with care.");
    expect(publicRow).not.toHaveProperty("bio");
    input.assignments=input.assignments.map(row => ({...row, is_public: false}));
    expect(JSON.stringify(projectPublicCommitteeDirectory(input))).not.toContain("Lead with care.");
  });
  it("exposes an advisor's intentionally published speech and hides private advisors", () => {
    const input=makeInput();
    input.advisors=[{ advisor_jnuits_id:null, advisor_type:"main_advisor", avatar_secure_url:null, bio:"Profile biography", date_confidence:"verified", department:"University office", designation:"Vice-Chancellor", facebook_url:null, former_title:null, full_name:"Synthetic advisor", id:"advisor-1", is_current:true, is_public:true, jnu_profile_url:null, joined_on:null, left_on:null, linkedin_url:null, sort_order:0, speech:"Welcome to JnUITS.", status_note:null, tenure_display:null, title:null, website_url:null }];
    expect(projectPublicCommitteeDirectory(input).advisors[0]).toMatchObject({speech:"Welcome to JnUITS.",sortOrder:0,department:"University office"});
    input.advisors[0]!.is_public=false;
    expect(projectPublicCommitteeDirectory(input).advisors).toEqual([]);
  });
});
