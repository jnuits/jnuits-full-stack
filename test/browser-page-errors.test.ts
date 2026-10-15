import { describe, expect, it } from "vitest";
import { isDepartingWebKitPrefetchError } from "../e2e/helpers/page-errors";
const baseURL="https://127.0.0.1:3130";
const error="/127.0.0.1:3130/portal/projects?_rsc=fixture due to access control checks.";
const name="Fetch API cannot load https";
describe("WebKit departing-document error classification",()=>{
 it("recognizes only the locally reproduced same-origin RSC cancellation while a replacement document is pending",()=>{
  expect(isDepartingWebKitPrefetchError({message:error,name,browserName:"webkit",baseURL,replacingDocument:true})).toBe(true);
 });
 it.each([
  {message:error,replacingDocument:false},
  {message:error,browserName:"chromium"},
  {message:error,name:"Fetch API cannot load http"},
  {message:error,name:"Error"},
  {message:error.replace("127.0.0.1:3130","attacker.test")},
  {message:error.replace("/portal/projects","/api/profile/direct")},
  {message:error.replace("?_rsc=fixture","")},
  {message:"Refused to load script due to Content Security Policy"},
  {message:"Hydration failed"},
 ])("keeps genuine runtime, CSP and non-prefetch failures actionable: %j",override=>{
  expect(isDepartingWebKitPrefetchError(Object.assign({message:error,name,browserName:"webkit",baseURL,replacingDocument:true},override))).toBe(false);
 });
});
