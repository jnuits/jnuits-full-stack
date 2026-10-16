import{afterEach,expect,it,vi}from"vitest";
const m=vi.hoisted(()=>({run:vi.fn()}));
vi.mock("@/lib/admin/accountability-job",()=>({runAdminAccountability:m.run}));
import{GET}from"./route";
afterEach(()=>{vi.unstubAllEnvs();vi.clearAllMocks()});
it("rejects absent or wrong job auth without signed-in-user helpers or collection",async()=>{
 vi.stubEnv("VERCEL_ENV","production");vi.stubEnv("CRON_SECRET","disposable-test-secret-only");
 for(const authorization of ["","Bearer wrong"]){expect((await GET(new Request("https://jnuits.org.bd/api/cron/admin-accountability",{headers:{authorization}}))).status).toBe(401);}
 expect(m.run).not.toHaveBeenCalled();
});
it("never runs collection in preview or with missing configuration",async()=>{
 vi.stubEnv("VERCEL_ENV","preview");expect((await GET(new Request("https://jnuits.org.bd/api/cron/admin-accountability"))).status).toBe(503);expect(m.run).not.toHaveBeenCalled();
});
it("runs one bounded production batch and exposes no source records",async()=>{
 vi.stubEnv("VERCEL_ENV","production");vi.stubEnv("CRON_SECRET","disposable-test-secret-only");m.run.mockResolvedValue({imported:3,read:3,backlog:false,coverage:"partial",errors:[]});
 const response=await GET(new Request("https://jnuits.org.bd/api/cron/admin-accountability",{headers:{authorization:"Bearer disposable-test-secret-only"}}));
 expect(response.status).toBe(200);expect(m.run).toHaveBeenCalledWith(expect.objectContaining({dryRun:false}));expect(response.headers.get("cache-control")).toContain("no-store");
});
