import { requireAdminUser } from "@/lib/auth/session";
import { loadAdminRecommendationInputs } from "@/lib/admin/recommendation-inputs";
import { buildAdminRecommendations } from "@/lib/admin/recommendations";
import { AdminRecommendationsCard } from "./admin-recommendations-card";

export async function AdminRecommendationsSection() {
  const auth = await requireAdminUser();
  if (!auth.user) return null;
  const inputs = await loadAdminRecommendationInputs(auth.user.id, new Date(), false);
  return inputs ? <AdminRecommendationsCard recommendations={buildAdminRecommendations(inputs)} /> : null;
}
