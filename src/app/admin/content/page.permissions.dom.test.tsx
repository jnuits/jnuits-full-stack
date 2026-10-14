import {createClient} from "@supabase/supabase-js";
import {render,screen} from "@testing-library/react";
import {beforeEach,expect,it,vi} from "vitest";
const state=vi.hoisted(()=>({client:null as unknown,allowed:new Set<string>(),queries:[] as URL[]}));
vi.mock("@/lib/auth/session",()=>({requireAdminPermission:async()=>({user:{id:"operator"}}),hasPermission:async(p:string)=>state.allowed.has(p)}));
vi.mock("@/lib/supabase/admin",()=>({createAdminClient:()=>state.client}));
vi.mock("@/lib/cloudinary/config",()=>({isCloudinaryConfigured:()=>false}));
import ContentHubPage from "./page";
beforeEach(()=>{
 state.allowed=new Set(); state.queries=[];
 state.client=createClient("https://fixture.supabase.co","fixture-key",{auth:{persistSession:false},global:{fetch:async input=>{state.queries.push(new URL(String(input))); return new Response(null,{headers:{"content-range":"*/3"}});}}});
});
it("does not advertise or count content outside the operator permissions",async()=>{
 state.allowed.add("cms.projects.manage"); render(await ContentHubPage());
 expect(screen.getByRole("link",{name:/Projects/})).toBeInTheDocument();
 expect(screen.queryByRole("link",{name:/Blogs/})).not.toBeInTheDocument();
 expect(state.queries).toHaveLength(1); expect(state.queries[0].pathname).toContain("/projects");
});
it("offers dedicated allowed singleton and form/settings workspaces",async()=>{
 state.allowed=new Set(["cms.pages.manage","cms.forms.manage","admin.settings.read"]); render(await ContentHubPage());
 for(const label of ["About","Slider","Forms","Contact Settings"]) expect(screen.getByRole("link",{name:new RegExp(label)})).toBeInTheDocument();
 expect(state.queries.every(q=>q.pathname.endsWith("/content_pages")||q.pathname.endsWith("/forms"))).toBe(true);
});
it("keeps an empty authorized hub usable without broad database reads",async()=>{
 render(await ContentHubPage()); expect(state.queries).toEqual([]); expect(screen.getByRole("heading",{name:"Content"})).toBeInTheDocument();
});
