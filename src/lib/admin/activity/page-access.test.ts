import {beforeEach,expect,it,vi} from "vitest";
const m=vi.hoisted(()=>({permission:vi.fn(),user:vi.fn(),capture:vi.fn(),read:vi.fn()}));
vi.mock("server-only",()=>({}));
vi.mock("@/lib/auth/session",()=>({requireAdminPermission:m.permission,requireAdminUser:m.user}));
vi.mock("./capture-server",()=>({recordCurrentAdminWorkspaceAccess:m.capture}));
vi.mock("@/lib/auth/admin-verification/read-boundary",()=>({authorizeAdminRead:m.read}));
import {requireAdminPagePermission,requireAdminPageUser,authorizeAdminPageRead} from "./page-access";
beforeEach(()=>{vi.resetAllMocks();m.permission.mockResolvedValue({user:{id:"owned"}});m.user.mockResolvedValue({user:{id:"owned"}});});
it("records a rendered page only after its existing permission guard succeeds",async()=>{
 const options={fallbackPath:"/admin",requireAal2:true};
 expect(await requireAdminPagePermission("admin.audit.read",options)).toEqual({user:{id:"owned"}});
 expect(m.permission).toHaveBeenCalledWith("admin.audit.read",options);
 expect(m.permission.mock.invocationCallOrder[0]).toBeLessThan(m.capture.mock.invocationCallOrder[0]);
});
it("does not record a denied page or replace its redirect",async()=>{
 m.permission.mockRejectedValue(new Error("denied"));
 await expect(requireAdminPagePermission("admin.audit.read")).rejects.toThrow("denied");expect(m.capture).not.toHaveBeenCalled();
});
it("keeps self-service page access behind the original active-admin guard",async()=>{
 expect(await requireAdminPageUser({fallbackPath:"/admin"})).toEqual({user:{id:"owned"}});
 expect(m.user).toHaveBeenCalledWith({fallbackPath:"/admin"});expect(m.capture).toHaveBeenCalledOnce();
});
it("records verified read pages only after their original read authorization succeeds",async()=>{
 m.read.mockResolvedValueOnce({ok:false,code:"denied"});
 expect(await authorizeAdminPageRead("admin.security.read")).toEqual({ok:false,code:"denied"});
 expect(m.capture).not.toHaveBeenCalled();
 m.read.mockResolvedValueOnce({ok:true,value:{}});await authorizeAdminPageRead("admin.security.read");
 expect(m.capture).toHaveBeenCalledOnce();
});
