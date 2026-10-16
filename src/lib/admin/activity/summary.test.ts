import {describe,expect,it} from "vitest";
import {classifyAdminActivity} from "./summary";
const now=new Date("2026-10-31T04:00:00Z");
const base={accessActivatedAt:"2026-01-01T00:00:00Z",invitationStatus:"accepted" as const,firstEntryAt:null,lastSignInAt:null,lastWorkspaceAccessAt:null,lastCompletedWorkAt:null,completedWorkCount:null,coverage:{state:"current" as const,observedSince:"2025-12-01T00:00:00Z",continuousSince:"2025-12-01T00:00:00Z",lastCollectedAt:"2026-10-31T03:00:00Z"},now};
describe("evidence-qualified admin activity",()=>{
 it("qualifies observed never-used only from continuous coverage since activation",()=>{const r=classifyAdminActivity(base);expect(r.status).toBe("never_used");expect(r.observedSince).toBe(base.coverage.observedSince)});
 it("keeps legacy activation before coverage unknown",()=>expect(classifyAdminActivity({...base,accessActivatedAt:"2024-01-01T00:00:00Z"}).status).toBe("history_unavailable"));
 it("an empty source is not proof of never logging in",()=>expect(classifyAdminActivity({...base,coverage:{...base.coverage,state:"unavailable",continuousSince:null}}).status).toBe("history_unavailable"));
 it("keeps pending invitations distinct",()=>expect(classifyAdminActivity({...base,invitationStatus:"pending"}).status).toBe("invitation_pending"));
 it("does not classify revoked targets as idle or never-used",()=>expect(classifyAdminActivity({...base,invitationStatus:"revoked"}).status).toBe("history_unavailable"));
 it("uses six calendar months in Dhaka including month-end clamping",()=>{expect(classifyAdminActivity({...base,lastWorkspaceAccessAt:"2026-04-30T03:59:59Z"}).status).toBe("not_seen_six_months");expect(classifyAdminActivity({...base,lastWorkspaceAccessAt:"2026-04-30T04:00:01Z"}).status).toBe("seen_recently")});
 it("fresh access on an old session is observed recently",()=>expect(classifyAdminActivity({...base,lastSignInAt:"2025-01-01T00:00:00Z",lastWorkspaceAccessAt:"2026-10-30T00:00:00Z"}).status).toBe("seen_recently"));
 it("a coverage gap prevents negative claims but not fresh positive evidence",()=>{const gap={...base.coverage,state:"partial" as const,continuousSince:"2026-10-01T00:00:00Z"};expect(classifyAdminActivity({...base,lastSignInAt:"2026-01-01T00:00:00Z",coverage:gap}).status).toBe("history_unavailable");expect(classifyAdminActivity({...base,lastWorkspaceAccessAt:"2026-10-30T00:00:00Z",coverage:gap}).status).toBe("seen_recently")});
 it("does not turn unavailable work counts into zero",()=>expect(classifyAdminActivity(base).completedWorkCount).toBeNull());
 it("separates work from login dates",()=>{const r=classifyAdminActivity({...base,lastWorkspaceAccessAt:"2026-10-30T00:00:00Z",lastCompletedWorkAt:"2026-10-29T00:00:00Z",completedWorkCount:3,periodLabel:"Last three calendar months"});expect(r.lastSignInAt).toBeNull();expect(r.lastCompletedWorkAt).toBe("2026-10-29T00:00:00Z");expect(r.completedWorkCount).toBe(3)});
});
