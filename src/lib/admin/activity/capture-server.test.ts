import{beforeEach,expect,it,vi}from"vitest";
const m=vi.hoisted(()=>({actor:vi.fn(),headers:vi.fn(),entry:vi.fn(),access:vi.fn(),signin:vi.fn(),log:vi.fn()}));
vi.mock("server-only",()=>({}));vi.mock("next/headers",()=>({headers:m.headers}));
vi.mock("@/lib/auth/admin-verification/actor",()=>({loadAdminVerificationActor:m.actor}));
vi.mock("./capture",()=>({recordAdminWorkspaceEntry:m.entry,recordAdminPageAccess:m.access,recordAdminSignIn:m.signin}));
vi.mock("@/lib/errors/api-error",()=>({logServerError:m.log}));
import{recordCurrentAdminWorkspaceAccess,recordCurrentAdminSignIn}from"./capture-server";
const actor={userId:"owned",sessionId:"native",currentLevel:"aal1",enforced:false};
beforeEach(()=>{vi.resetAllMocks();m.actor.mockResolvedValue({ok:true,value:actor});m.headers.mockResolvedValue(new Headers({"x-jnuits-return-to":"/admin"}));});
it("captures only the verified current actor and keeps signin separate",async()=>{
 await recordCurrentAdminWorkspaceAccess();expect(m.entry.mock.calls[0][0]).toBe(actor);expect(m.access.mock.calls[0][0]).toBe(actor);expect(m.signin).not.toHaveBeenCalled();
 await recordCurrentAdminSignIn();expect(m.signin).toHaveBeenCalledWith(actor);
});
it("does not manufacture entry after native validation fails",async()=>{
 m.actor.mockResolvedValue({ok:false,code:"session_invalid"});await recordCurrentAdminWorkspaceAccess();await recordCurrentAdminSignIn();expect(m.entry).not.toHaveBeenCalled();expect(m.signin).not.toHaveBeenCalled();
});
it("does not retry business actions or reveal provider details after a capture failure",async()=>{
 m.entry.mockRejectedValue(new Error("secret raw provider response"));await recordCurrentAdminWorkspaceAccess();expect(m.entry).toHaveBeenCalledOnce();expect(JSON.stringify(m.log.mock.calls)).not.toContain("secret raw provider response");
});
