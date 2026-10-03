import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({ permission: vi.fn(), authorize: vi.fn(), admin: vi.fn(), flash: vi.fn(), rpc: vi.fn(), reserve: vi.fn() }));
vi.mock("next/navigation",()=>({redirect:(path:string)=>{throw new Error(`redirect:${path}`);}}));
vi.mock("next/cache",()=>({revalidatePath:vi.fn()}));
vi.mock("@/lib/auth/session",()=>({requireAdminPermission:mocks.permission, requireAuthenticatedUser:mocks.permission, hasPermission:async()=>true, requireAdminUser:mocks.permission}));
vi.mock("@/lib/auth/admin-verification/guard",()=>({authorizeAdminOperation:mocks.authorize,adminVerificationFailureMessage:()=>"Verify your account before completing this operation."}));
vi.mock("@/lib/auth/admin-verification/store",()=>({AdminVerificationStore:class {reserve=mocks.reserve;}}));
vi.mock("@/lib/supabase/admin",()=>({createAdminClient:mocks.admin}));
vi.mock("@/lib/supabase/server",()=>({createClient:async()=>({rpc:mocks.rpc})}));
vi.mock("@/lib/admin/flash",()=>({setAdminFlash:mocks.flash}));
import { changeAdminRoleAction, inviteAdminAction, updateAdminLifecycleAction, revokeAdminInvitationAction } from "./actions";
beforeEach(()=>{
  vi.clearAllMocks();
  mocks.permission.mockResolvedValue({user:{id:"11111111-1111-4111-8111-111111111111",adminRole:"super_admin"}});
  mocks.authorize.mockResolvedValue({ok:false,code:"verification_required"});
});

describe("reserved account operations",()=>{
  const profileId="22222222-2222-4222-8222-222222222222";
  const targetUserId="33333333-3333-4333-8333-333333333333";
  const attemptId="44444444-4444-4444-8444-444444444444";
  const payload={adminProfileId:profileId,confirmation:"FIXTURE"};
  function setup(){
    const events:string[]=[];
    const actor={userId:"11111111-1111-4111-8111-111111111111",sessionId:"55555555-5555-4555-8555-555555555555",email:"fictional-operator@example.com",emailConfirmed:true,roleVersion:1,currentLevel:"aal1",enforced:false,enrollment:"never"};
    mocks.permission.mockImplementation(async(_permission:string,options?:{requireAal2?:boolean})=>{
      if(options?.requireAal2)throw new Error("Unexpected MFA-only gate for email-verified operation");
      return {user:{id:actor.userId,adminRole:"super_admin"}};
    });
    mocks.authorize.mockResolvedValue({ok:true,value:{auth:{user:{id:actor.userId,adminRole:"super_admin"}},prepared:{actor}}});
    mocks.reserve.mockImplementation(async()=>{events.push("reserve");return {ok:true,value:{attemptId}};});
    const profiles={id:profileId,user_id:targetUserId,admin_code:"FIXTURE",email:"fictional-target@example.com",display_name:"Fictional target",is_active:true,status:"active",title:null};
    const roles=[{id:"role-grant",role_id:"role-id",user_id:targetUserId,rbac_platform_roles:{code:"content_admin"}}];
    const invitations={id:profileId,email:"fictional-target@example.com",invited_role_code:"content_admin",status:"pending",target_user_id:targetUserId,target_admin_profile_id:profileId};
    mocks.admin.mockReturnValue({
      rpc:mocks.rpc,
      from:(table:string)=>{
        const query={select:()=>query,eq:()=>query,is:async()=>({data:roles,error:null}),maybeSingle:async()=>({data:table==="admin_invitations"?invitations:profiles,error:null}),
          update:()=>{throw new Error("Parallel unverified service database write");}};
        return query;
      },
      auth:{admin:{updateUserById:async(id:string,attributes:{ban_duration:string})=>{expect(id).toBe(targetUserId);events.push(`auth:${attributes.ban_duration}`);return {error:null};}}},
    });
    mocks.rpc.mockImplementation(async(name:string,args:Record<string,unknown>)=>{
      if(name==="complete_admin_lifecycle_operation"){
        expect(args).toEqual({p_attempt_id:attemptId,p_payload:payload});events.push("complete");return {data:{ok:true,value:null},error:null};
      }
      if(name==="apply_admin_role_operation"){
        expect(args).toEqual({p_operation:"admin.role.remove",p_payload:payload,p_proof:"fixture-proof"});events.push("remove");return {data:{ok:true,value:{targetUserId,adminProfileId:profileId}},error:null};
      }
      if(name==="revoke_admin_invitation_verified"){
        expect(args).toEqual({p_payload:{invitationId:profileId,confirmation:"fictional-target@example.com"},p_proof:"fixture-proof"});events.push("revoke");return {data:{ok:true,value:null},error:null};
      }
      throw new Error(`Unexpected RPC: ${name}`);
    });
    return events;
  }
  it("allows an email-verified freeze only after reservation and atomically finalizes after Auth",async()=>{
    const events=setup();
    await expect(updateAdminLifecycleAction(form({...payload,intent:"freeze",verificationProof:"fixture-proof"}))).rejects.toThrow(/redirect:/);
    expect(events).toEqual(["reserve","auth:876000h","complete"]);
    expect(mocks.flash.mock.calls.at(-1)?.[0].tone).toBe("success");
  });
  it("does not call Auth after reservation is denied",async()=>{
    const events=setup();mocks.reserve.mockResolvedValue({ok:false,code:"verification_invalid"});
    await expect(updateAdminLifecycleAction(form({...payload,intent:"freeze",verificationProof:"fixture-proof"}))).rejects.toThrow(/redirect:/);
    expect(events).toEqual([]);
    expect(mocks.flash.mock.calls.at(-1)?.[0].tone).toBe("error");
  });
  it("reports uncertain completion without retrying or restoring the authorization",async()=>{
    const events=setup();mocks.rpc.mockImplementation(async()=>{events.push("complete-failed");return {data:null,error:{message:"database unavailable"}};});
    await expect(updateAdminLifecycleAction(form({...payload,intent:"freeze",verificationProof:"fixture-proof"}))).rejects.toThrow(/redirect:/);
    expect(events).toEqual(["reserve","auth:876000h","complete-failed"]);
    expect(mocks.flash.mock.calls.at(-1)?.[0].tone).toBe("error");
  });
  it("removes roles atomically before Auth cleanup, without parallel service RBAC writes",async()=>{
    const events=setup();
    await expect(updateAdminLifecycleAction(form({...payload,intent:"remove",verificationProof:"fixture-proof"}))).rejects.toThrow(/redirect:/);
    expect(events).toEqual(["remove","auth:none"]);
    expect(mocks.flash.mock.calls.at(-1)?.[0].tone).toBe("success");
  });
  it("revokes a pending invitation through its atomic protected boundary",async()=>{
    const events=setup();
    await expect(revokeAdminInvitationAction(form({invitationId:profileId,confirmation:"fictional-target@example.com",verificationProof:"fixture-proof"}))).rejects.toThrow(/redirect:/);
    expect(events).toEqual(["revoke"]);
    expect(mocks.flash.mock.calls.at(-1)?.[0].tone).toBe("success");
  });
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
