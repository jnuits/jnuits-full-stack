import {beforeEach,describe,expect,it,vi} from "vitest";
const m=vi.hoisted(()=>({portal:vi.fn(),admin:vi.fn(),snapshot:vi.fn(),user:vi.fn(),query:vi.fn()}));
vi.mock("server-only",()=>({}));
vi.mock("@/lib/auth/session",()=>({requirePortalIdentity:m.portal,requireAdminUser:m.admin,hasMemberPortalAccessRole:(roles:string[])=>roles.some(role=>["member","alumni"].includes(role))}));
vi.mock("@/lib/portal/member",()=>({getPortalMemberSnapshot:m.snapshot}));
vi.mock("@/lib/supabase/server",()=>({createClient:async()=>({auth:{getUser:m.user}})}));
vi.mock("@/lib/supabase/admin",()=>({createAdminClient:()=>({from:(table:string)=>{const q={select:()=>q,eq:()=>q,maybeSingle:()=>m.query(table)};return q;}})}));
import {getOwnProfileCompletion,getOwnCompletionPresentation,getOwnLinkedMemberCompletion} from "./completion-server";
const user={id:"owned-user",email:"verified@local.invalid",email_confirmed_at:"2026-10-14T00:00:00Z"};
const member={id:"member",user_id:"owned-user",full_name:"Owned Member",jnuits_id:"JnUITS-2023001",department_code:"CSE",batch_no:7,student_id:"M200305026",avatar_secure_url:"https://example.invalid/saved.jpg",phone:"+8801712345678",current_organization:"Example",designation:"Engineer",work_location:"Dhaka",workplace_applicability:null,member_type:"current",lifecycle_status:"current"};
describe("owned completion adapter",()=>{
 beforeEach(()=>{vi.clearAllMocks();m.portal.mockResolvedValue({user:{id:"owned-user"}});m.admin.mockResolvedValue({user:{id:"owned-user"}});m.user.mockResolvedValue({data:{user},error:null});m.snapshot.mockResolvedValue({member,access:{canMutate:true},profileChangeRequests:[]});m.query.mockImplementation((table)=>Promise.resolve({data:table==="departments"?{code:"CSE"}:{user_id:"owned-user",display_name:"Own Admin",avatar_secure_url:"https://example.invalid/admin.jpg"},error:null}));});
 it("scores canonical legacy department/batch for own account",async()=>{expect(await getOwnProfileCompletion("member")).toMatchObject({status:"available",percent:100});expect(m.snapshot).toHaveBeenCalledWith("owned-user")});
 it("never scores another user's unexpected snapshot",async()=>{m.snapshot.mockResolvedValue({member:{...member,user_id:"other"},access:{canMutate:true}});expect(await getOwnProfileCompletion("member")).toBeNull()});
 it("preserves unlinked and restricted behavior",async()=>{m.snapshot.mockResolvedValue({member:null,access:{canMutate:false}});expect(await getOwnProfileCompletion("member")).toBeNull()});
 it("does not let a requested kind change actual member classification",async()=>{m.snapshot.mockResolvedValue({member:{...member,member_type:"alumni",lifecycle_status:"alumni"},access:{canMutate:true}});expect(await getOwnProfileCompletion("member")).toBeNull()});
 it("shows unavailable evidence on failed verified email lookup",async()=>{m.user.mockResolvedValue({data:{user:null},error:{message:"private error"}});expect(await getOwnProfileCompletion("member")).toMatchObject({status:"unavailable",percent:null})});
 it("scores admin's own profile independently without forced member link",async()=>{expect(await getOwnProfileCompletion("admin")).toMatchObject({percent:100,applicable:3});expect(m.snapshot).not.toHaveBeenCalled()});
 it("pending correction cannot improve canonical score or offer duplicate request",async()=>{m.snapshot.mockResolvedValue({member:{...member,full_name:""},access:{canMutate:true},profileChangeRequests:[{status:"pending",request_type:"profile_change",payload:{fullName:"Requested Name"}}]});const result=await getOwnCompletionPresentation("member");expect(result?.summary.percent).toBe(89);expect(result?.nextSteps[0]).toMatchObject({field:"name",state:"pending_review"});expect(JSON.stringify(result)).not.toContain("Requested Name");expect(JSON.stringify(result)).not.toContain(user.email)});
 it("ignores a caller's extra identity argument",async()=>{await Reflect.apply(getOwnProfileCompletion,null,["member","forged-user"]);expect(m.snapshot).toHaveBeenCalledWith("owned-user")});

it("returns no linked score for admin-only accounts without entering a portal guard",async()=>{
 m.admin.mockResolvedValue({user:{id:"owned-user"},roles:["content_admin"]});
 expect(await getOwnLinkedMemberCompletion()).toBeNull();
 expect(m.snapshot).not.toHaveBeenCalled(); expect(m.portal).not.toHaveBeenCalled();
});
it("scores only the current admin's linked alumni profile using its canonical classification",async()=>{
 m.admin.mockResolvedValue({user:{id:"owned-user"},roles:["content_admin","alumni"]});
 m.snapshot.mockResolvedValue({member:{...member,member_type:"alumni",lifecycle_status:"alumni",phone:null},access:{canMutate:true}});
 const result=await getOwnLinkedMemberCompletion();
 expect(result).toMatchObject({title:"Linked alumni profile completeness",summary:{percent:88,applicable:8}});
 expect(m.snapshot).toHaveBeenCalledWith("owned-user");
});
it("does not expose a restricted or mismatched linked profile to an admin",async()=>{
 m.admin.mockResolvedValue({user:{id:"owned-user"},roles:["super_admin","member"]});
 m.snapshot.mockResolvedValue({member:{...member,user_id:"other"},access:{canMutate:true}});
 expect(await getOwnLinkedMemberCompletion()).toBeNull();
 m.snapshot.mockResolvedValue({member,access:{canMutate:false}});
 expect(await getOwnLinkedMemberCompletion()).toBeNull();
});

});
