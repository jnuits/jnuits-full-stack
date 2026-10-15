import {describe,expect,it} from "vitest";
import {evaluateProfileCompletion,type CompletionEvidence} from "./completion";
const complete:CompletionEvidence={name:true,jnuitsId:true,email:true,department:true,batch:true,studentId:true,photo:true,phone:true,workplace:true,workplaceApplicable:true};
describe("version 1 private completion",()=>{
 it("current_member_nine_checks",()=>expect(evaluateProfileCompletion("member",complete)).toMatchObject({version:1,percent:100,completed:9,applicable:9,missing:[]}));
 it("alumni_eight_checks",()=>expect(evaluateProfileCompletion("alumni",{...complete,studentId:false})).toMatchObject({percent:100,applicable:8}));
 it("admin_three_checks",()=>expect(evaluateProfileCompletion("admin",{...complete,phone:false,workplace:false})).toMatchObject({percent:100,applicable:3}));
 it("rounds only actual applicable checks",()=>{expect(evaluateProfileCompletion("member",{...complete,phone:false}).percent).toBe(89);expect(evaluateProfileCompletion("alumni",{...complete,phone:false}).percent).toBe(88);});
 it("explicit_not_applicable_excludes_group",()=>{expect(evaluateProfileCompletion("member",{...complete,workplace:false,workplaceApplicable:false})).toMatchObject({percent:100,applicable:8,completed:8});expect(evaluateProfileCompletion("alumni",{...complete,workplace:false,workplaceApplicable:false}).applicable).toBe(7)});
 it("unanswered_workplace_is_incomplete",()=>expect(evaluateProfileCompletion("alumni",{...complete,workplace:false,workplaceApplicable:true})).toMatchObject({percent:88,missing:["workplace"]}));
 it("empty_partial_complete",()=>expect(evaluateProfileCompletion("member",Object.fromEntries(Object.keys(complete).map(k=>[k,k==="workplaceApplicable"])) as CompletionEvidence)).toMatchObject({percent:0,completed:0}));
 it("unknown_is_unavailable",()=>expect(evaluateProfileCompletion("member",{...complete,email:null})).toMatchObject({status:"unavailable",percent:null,missing:[]}));
 it("an irrelevant unknown cannot hide own admin completeness",()=>expect(evaluateProfileCompletion("admin",{...complete,workplace:null,workplaceApplicable:null})).toMatchObject({status:"available",percent:100}));
});
