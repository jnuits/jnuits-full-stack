import {describe,expect,it} from "vitest";
import {memberCompletionEvidence} from "./completion-evidence";
import {evaluateProfileCompletion} from "./completion";
const member={full_name:"Synthetic Person",jnuits_id:"JnUITS-2023001",department_code:"CSE",batch_no:7,student_id:"M200305026",avatar_secure_url:"https://res.cloudinary.com/example/image/upload/photo.jpg",phone:"01712345678",current_organization:"Example",designation:"Engineer",work_location:"Dhaka",workplace_applicability:null};
describe("canonical completion evidence",()=>{
 const evidence=(patch:Partial<typeof member>={})=>memberCompletionEvidence({...member,...patch},{emailVerified:true,departmentRecognized:true});
 it("phone_format_counts",()=>{expect(evidence().phone).toBe(true);expect(evidence({phone:"not a phone"}).phone).toBe(false)});
 it("workplace_requires_three_parts",()=>{expect(evidence().workplace).toBe(true);expect(evidence({designation:""}).workplace).toBe(false)});
 it("legacy populated workplace counts without backfill",()=>expect(evaluateProfileCompletion("member",evidence()).percent).toBe(100));
 it("explicit not-applicable requires blank values",()=>{const e=memberCompletionEvidence({...member,current_organization:null,designation:null,work_location:null,workplace_applicability:"not_applicable"},{emailVerified:true,departmentRecognized:true});expect(e.workplaceApplicable).toBe(false);expect(evaluateProfileCompletion("member",e).percent).toBe(100)});
 it("a contradictory declaration is unavailable",()=>{const e=memberCompletionEvidence({...member,workplace_applicability:"not_applicable"},{emailVerified:true,departmentRecognized:true});expect(evaluateProfileCompletion("member",e).status).toBe("unavailable")});
 it("does not use public visibility or request payload to score",()=>{const original=evidence();expect(memberCompletionEvidence({...member,professional_visibility:"private",payload:{phone:"new"}},{emailVerified:true,departmentRecognized:true})).toEqual(original)});
 it("verified Auth email is required independently of member email",()=>expect(memberCompletionEvidence(member,{emailVerified:false,departmentRecognized:true}).email).toBe(false));
});
