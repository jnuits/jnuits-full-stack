import "server-only";

import { cache } from "react";

import { getPublicCommitteeMemberProfileByJnuitsId } from "@/lib/committee/public";
import { getPublicMemberByJnuitsId } from "@/lib/members/directory";
import { formatMembershipIdForDisplay } from "@/lib/members/jnuits-id";
import {
  composePublicMemberProfile,
  type PublicMemberProfile,
} from "@/lib/members/public-profile-contract";

export const getPublicMemberProfileByJnuitsId = cache(
  async (jnuitsId: string): Promise<PublicMemberProfile | null> => {
    let decodedId: string;

    try {
      decodedId = decodeURIComponent(jnuitsId);
    } catch {
      return null;
    }

    const displayId = formatMembershipIdForDisplay(decodedId);

    if (!displayId) {
      return null;
    }

    const [directoryProfile, committeeProfile] = await Promise.all([
      getPublicMemberByJnuitsId(displayId),
      getPublicCommitteeMemberProfileByJnuitsId(displayId),
    ]);

    return composePublicMemberProfile(directoryProfile, committeeProfile);
  }
);
