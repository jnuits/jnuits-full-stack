import {createRequire} from "node:module";
import {expect,it} from "vitest";
const require=createRequire(import.meta.url);
const {classifyFixtureResendRequest}=require("./admin-notification-qa-policy.cjs");
it("permits only intercepted sends and suppression reads for disposable identities",()=>{
 expect(classifyFixtureResendRequest("https://api.resend.com/suppressions/qa-never-aabbcc@local.invalid",{})).toEqual({kind:"suppression",to:"qa-never-aabbcc@local.invalid"});
 expect(classifyFixtureResendRequest("https://api.resend.com/emails",{method:"POST",body:JSON.stringify({to:["qa-never-aabbcc@local.invalid"]})})).toEqual({kind:"send",to:"qa-never-aabbcc@local.invalid"});
 expect(classifyFixtureResendRequest("http://127.0.0.1:55761/auth/v1/user",{})).toBeNull();
});
it("refuses real recipients, malformed or multi-recipient mail and other provider endpoints",()=>{
 for(const [url,input]of [["https://api.resend.com/suppressions/real@example.test",{}],["https://api.resend.com/emails",{method:"POST",body:JSON.stringify({to:["real@example.test"]})}],["https://api.resend.com/emails",{method:"POST",body:JSON.stringify({to:["qa-never-aabbcc@local.invalid","qa-super-aabbcc@local.invalid"]})}],["https://api.resend.com/domains",{}]])expect(()=>classifyFixtureResendRequest(url,input)).toThrow();
});
