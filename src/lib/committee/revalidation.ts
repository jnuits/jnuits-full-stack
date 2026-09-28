import { revalidatePath } from "next/cache";

export function revalidatePublicCommitteeProjection() {
  revalidatePath("/committee");
  revalidatePath("/committee/[termSlug]", "page");
  revalidatePath("/members");
  revalidatePath("/members/[jnuitsId]", "page");
}
