import {expect,it} from "vitest";
import {buildAdminSecurityEmail,buildAdminRecommendationsEmail} from "./security-email";
it("renders safe peer security copy and one canonical private inbox link",()=>{
 const result=buildAdminSecurityEmail({title:'Admin role changed <script>',summary:'An account changed & remains private.',actorLabel:'<img src=x>',occurredAt:'2026-10-16T04:00:00Z'});
 expect(result.html).not.toContain('<script>');expect(result.html).not.toContain('<img src=x>');expect(result.html).toContain('&lt;img src=x&gt;');expect(result.text).toContain('https://jnuits.org.bd/admin/notifications');
});
it("renders at most three permitted suggestions and rejects links outside the dashboard",()=>{
 const items=Array.from({length:5},(_,i)=>({id:String(i),label:'Suggestion '+i,explanation:'Review personal details',href:'/admin/settings/profile'}));
 const result=buildAdminRecommendationsEmail(items,'2026-10');expect(result.text).toContain('Suggestion 2');expect(result.text).not.toContain('Suggestion 3');
 expect(()=>buildAdminRecommendationsEmail([{...items[0],href:'https://evil.invalid'}],'2026-10')).toThrow();
 expect(()=>buildAdminRecommendationsEmail([], '2026-10')).toThrow();
});
it("does not present optional digests as mandatory account security mail",()=>{
 const result=buildAdminRecommendationsEmail([{id:'own-profile',label:'Complete your profile',explanation:'Review missing details',href:'/admin/settings/profile'}],'2026-10');
 expect(result.text).toContain('optional');expect(result.text).toContain('https://jnuits.org.bd/admin/settings/profile');expect(result.text).not.toMatch(/AAL2|verify this session|XP|rank/i);
});
