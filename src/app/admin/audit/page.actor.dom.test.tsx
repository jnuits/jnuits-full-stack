import {render,screen} from "@testing-library/react";
import {expect,it,vi} from "vitest";
vi.mock("@/lib/auth/session",()=>({requireAdminPermission:async()=>({})}));
vi.mock("@/lib/admin/audit-explorer",async original=>({...await original<typeof import("@/lib/admin/audit-explorer")>(),loadAuditExplorerData:async()=>({actions:[],entityTypes:[],events:[],totalCount:0,actorOptions:[{userId:"fixture-actor",label:"Fixture Operator"}]})}));
import AdminAuditPage from "./page";
it("offers actor suggestions and preserves arbitrary custom values and all export filters",async()=>{
 render(await AdminAuditPage({searchParams:Promise.resolve({actor:"legacy-custom",q:"search",action:"changed",entityType:"fixture",from:"2026-01-01",to:"2026-01-02"})}));
 const input=screen.getByRole("combobox",{name:/Actor/});expect(input).toHaveValue("legacy-custom");expect(input).toHaveAttribute("list","audit-actors");
 const option=document.querySelector('#audit-actors option[value="fixture-actor"]');expect(option).toHaveAttribute("label","Fixture Operator");
 const link=screen.getByRole("link",{name:/Export/}); const url=new URL(link.getAttribute("href")!,"https://example.com");
 for(const [key,value] of Object.entries({actor:"legacy-custom",q:"search",action:"changed",entityType:"fixture",from:"2026-01-01",to:"2026-01-02"}))expect(url.searchParams.get(key)).toBe(value);
});
