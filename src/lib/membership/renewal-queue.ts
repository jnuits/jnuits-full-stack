export const renewalQueues = [
  ["unknown", "Unknown joining dates"], ["upcoming", "Upcoming renewals"], ["overdue", "Overdue renewals"],
  ["renewal", "Renewal requests"], ["departure", "Departure requests"], ["appeal", "Departure appeals"], ["alumni", "Alumni requests"],
] as const;
export type RenewalQueue = (typeof renewalQueues)[number][0];
export type RenewalQueueRow = {
  memberId: string; fullName: string; jnuitsId: string; joinedOn: string | null; dueOn: string | null;
  lifecycleStatus: string; portalAccessStatus: string; pathStatus: string; overdueDays: number;
  requestId: string | null; requestType: string | null; requestedAt: string | null; requestUpdatedAt: string | null; requestNote: string | null;
};
export type RenewalQueueData = { queue: RenewalQueue; page: number; pageSize: number; total: number; rows: RenewalQueueRow[]; error?: string };
