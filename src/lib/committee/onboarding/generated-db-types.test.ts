import { describe, expectTypeOf, it } from "vitest";
import type { Tables, TablesInsert, TablesUpdate } from "@/lib/db/types";

describe("generated committee onboarding database types", () => {
  it("exposes per-term positions", () => {
    expectTypeOf<Tables<"committee_term_positions">["public_label"]>().toEqualTypeOf<string>();
    expectTypeOf<Tables<"committee_term_positions">["target_slots"]>().toEqualTypeOf<number>();
    expectTypeOf<TablesInsert<"committee_term_positions">["term_id"]>().toEqualTypeOf<string>();
    expectTypeOf<TablesUpdate<"committee_term_positions">["priority"]>().toEqualTypeOf<
      number | undefined
    >();
  });

  it("exposes draft provenance and exclusion state", () => {
    expectTypeOf<Tables<"bulk_operations">["source_kind"]>().toEqualTypeOf<string | null>();
    expectTypeOf<Tables<"bulk_operations">["draft_revision"]>().toEqualTypeOf<number>();
    expectTypeOf<Tables<"bulk_operations">["target_term_id"]>().toEqualTypeOf<string | null>();
    expectTypeOf<Tables<"bulk_operation_rows">["is_excluded"]>().toEqualTypeOf<boolean>();
  });

  it("exposes the canonical member intake catalog", () => {
    expectTypeOf<Tables<"departments">["short_code"]>().toEqualTypeOf<string>();
    expectTypeOf<TablesInsert<"departments">["short_code"]>().toEqualTypeOf<string>();
    expectTypeOf<Tables<"department_aliases">["department_code"]>().toEqualTypeOf<string>();
    expectTypeOf<Tables<"department_aliases">["normalized_alias"]>().toEqualTypeOf<string>();
    expectTypeOf<TablesInsert<"department_aliases">["alias"]>().toEqualTypeOf<string>();
    expectTypeOf<TablesUpdate<"department_aliases">["is_active"]>().toEqualTypeOf<
      boolean | undefined
    >();
    expectTypeOf<Tables<"members">["joined_on"]>().toEqualTypeOf<string | null>();
  });
});
