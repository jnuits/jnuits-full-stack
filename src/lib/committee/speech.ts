export const COMMITTEE_SPEECH_MAX_LENGTH = 160;

export function isCommitteeSpokespersonRole(code: string | null | undefined) {
  return code === "president" || code === "general-secretary";
}
