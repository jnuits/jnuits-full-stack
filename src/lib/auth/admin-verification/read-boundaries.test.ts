import {beforeEach, describe, expect, it, vi} from "vitest";
const mocks=vi.hoisted(()=>({authorize:vi.fn(), cookie:vi.fn(), health:vi.fn()}));
vi.mock("next/headers",()=>({cookies:async()=>({get:mocks.cookie})}));
vi.mock("@/lib/auth/admin-verification/guard",()=>({authorizeAdminOperation:mocks.authorize,adminVerificationFailureMessage:()=>"Verify your account before viewing this information."}));
vi.mock("@/lib/admin/system-health",()=>({buildSystemHealthSnapshot:mocks.health}));
import SecurityPage from "@/app/admin/settings/security/page";
import HealthPage from "@/app/admin/system-health/page";
import RetentionPage from "@/app/admin/retention/page";
beforeEach(()=>{
  vi.clearAllMocks();
  mocks.authorize.mockResolvedValue({ok:false,code:"verification_required"});
  mocks.cookie.mockReturnValue({value:"fixture-read-proof"});
  mocks.health.mockResolvedValue({checks:[],counts:{ok:0,warn:0,fail:0},generatedAt:"2026-10-03T00:00:00Z"});
});
describe("protected page reads authorize their named scope before data fetching",()=>{
  it.each([
    ["admin.security.read","jnuits-admin-security-read",SecurityPage],
    ["admin.system_health.read","jnuits-admin-health-read",HealthPage],
    ["admin.retention.read","jnuits-admin-retention-read",RetentionPage],
  ] as const)("blocks %s without rendering the protected screen",async(operation,name,page)=>{
    const result=await page();
    expect(result.props.role).toBe("alert");
    expect(mocks.cookie).toHaveBeenCalledWith(name);
    expect(mocks.authorize).toHaveBeenCalledWith({operation,payload:{}},"fixture-read-proof");
    expect(mocks.health).not.toHaveBeenCalled();
  });
  it("loads health data only after its exact named authorization succeeds",async()=>{
    mocks.authorize.mockResolvedValue({ok:true,value:{}});
    const result=await HealthPage();
    expect(result.props.role).not.toBe("alert");
    expect(mocks.health).toHaveBeenCalledOnce();
    expect(mocks.authorize.mock.invocationCallOrder[0]).toBeLessThan(mocks.health.mock.invocationCallOrder[0]);
  });
});
