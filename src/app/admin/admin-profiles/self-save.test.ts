import {createClient} from "@supabase/supabase-js";
import {beforeEach,expect,it,vi} from "vitest";
const state=vi.hoisted(()=>({client:null as unknown,flash:vi.fn(),fail:false,writes:[] as unknown[]}));
vi.mock("next/navigation",()=>({redirect:(path:string)=>{throw new Error(`Redirect ${path}`)}}));
vi.mock("next/cache",()=>({revalidatePath:vi.fn()}));
vi.mock("@/lib/auth/session",()=>({requireAdminUser:async()=>({user:{id:"11111111-1111-4111-8111-111111111111",adminRole:"content_admin"}}),hasPermission:async()=>false}));
vi.mock("@/lib/supabase/admin",()=>({createAdminClient:()=>state.client}));
vi.mock("@/lib/admin/flash",()=>({setAdminFlash:state.flash}));
vi.mock("@/lib/security/security-events",()=>({recordSecurityEvent:vi.fn()}));
import {updateAdminProfileAction} from "./actions";
const own="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
function form(values:Record<string,string>={}){const f=new FormData();Object.entries({adminProfileId:own,displayName:"Updated own profile",title:"Editor",...values}).forEach(([k,v])=>f.set(k,v));return f;}
beforeEach(()=>{
 vi.clearAllMocks();state.fail=false;state.writes=[];
 state.client=createClient("https://fixture.supabase.co","fixture-key",{auth:{persistSession:false},global:{fetch:async(input,init)=>{
  const url=new URL(String(input));if(init?.method==="PATCH"){state.writes.push(JSON.parse(String(init.body)));return state.fail ? Response.json({message:"Fixture update failure"},{status:400}):Response.json([]);}
  if(url.pathname.endsWith("/admin_profiles"))return Response.json({id:own,user_id:"11111111-1111-4111-8111-111111111111",admin_code:"Fixture",display_name:"Old",status:"active",is_active:true});
  if(url.pathname.endsWith("/rbac_user_platform_roles"))return Response.json([{rbac_platform_roles:{code:"content_admin"}}]);return Response.json([]);
 }}});
});
it("returns a restricted operator's successful own save to My Profile with visible feedback",async()=>{
 await expect(updateAdminProfileAction(form())).rejects.toThrow("Redirect /admin/settings/profile");expect(state.writes).toHaveLength(1);expect(state.flash).toHaveBeenLastCalledWith(expect.objectContaining({tone:"success"}),"/admin");
});
it("returns an own-save failure to the same usable self page",async()=>{
 state.fail=true;await expect(updateAdminProfileAction(form())).rejects.toThrow("Redirect /admin/settings/profile");expect(state.flash).toHaveBeenLastCalledWith(expect.objectContaining({tone:"error"}),"/admin");
});
it("returns malformed own-profile input to self without a database mutation",async()=>{
 await expect(updateAdminProfileAction(form({displayName:""}))).rejects.toThrow("Redirect /admin/settings/profile");expect(state.writes).toEqual([]);
});
