import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({ permission: vi.fn(), authorize: vi.fn(), admin: vi.fn(), flash: vi.fn(), rpc: vi.fn() }));
vi.mock("next/navigation",()=>({redirect:(path:string)=>{throw new Error(`redirect:${path}`);}}));
vi.mock("next/cache",()=>({revalidatePath:vi.fn()}));
vi.mock("@/lib/auth/session",()=>({requireAdminPermission:mocks.permission, requireAuthenticatedUser:mocks.permission, hasPermission:async()=>true, requireAdminUser:mocks.permission}));
vi.mock("@/lib/auth/admin-verification/guard",()=>({authorizeAdminOperation:mocks.authorize,adminVerificationFailureMessage:()=>"Verify your account before completing this operation."}));
vi.mock("@/lib/supabase/admin",()=>({createAdminClient:mocks.admin}));
vi.mock("@/lib/supabase/server",()=>({createClient:async()=>({rpc:mocks.rpc})}));
vi.mock("@/lib/admin/flash",()=>({setAdminFlash:mocks.flash}));
import { changeAdminRoleAction, inviteAdminAction, updateAdminLifecycleAction, revokeAdminInvitationAction } from "./actions";
beforeEach(()=>{
  vi.clearAllMocks();
  mocks.permission.mockResolvedValue({user:{id:"11111111-1111-4111-8111-111111111111",adminRole:"super_admin"}});
  mocks.authorize.mockResolvedValue({ok:false,code:"verification_required"});
});
function form(fields:Record<string,string>){const value=new FormData();for(const [name,text] of Object.entries(fields))value.set(name,text);return value;}
describe("admin operation action verification before side effects",()=>{
  it.each([
    ["role",changeAdminRoleAction,{adminProfileId:"22222222-2222-4222-8222-222222222222",roleCode:"admin",confirmation:"FIXTURE"}],
    ["invite",inviteAdminAction,{inviteMode:"email",email:"fictional@example.com",roleCode:"content_admin"}],
    ["freeze",updateAdminLifecycleAction,{adminProfileId:"22222222-2222-4222-8222-222222222222",intent:"freeze",confirmation:"FIXTURE"}],
    ["remove",updateAdminLifecycleAction,{adminProfileId:"22222222-2222-4222-8222-222222222222",intent:"remove",confirmation:"FIXTURE"}],
    ["revoke",revokeAdminInvitationAction,{invitationId:"22222222-2222-4222-8222-222222222222",confirmation:"fictional@example.com"}],
  ] as const)("denies %s before service Auth/profile/role writes",async(_name,action,fields)=>{
    await expect(action(form(fields))).rejects.toThrow(/redirect:/);
    expect(mocks.admin).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.flash.mock.calls[0]?.[0].message).toMatch(/Verify your account/);
  });
});
