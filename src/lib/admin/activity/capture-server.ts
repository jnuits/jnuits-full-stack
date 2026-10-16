import "server-only";
import{cache}from"react";
import{headers}from"next/headers";
import{loadAdminVerificationActor}from"@/lib/auth/admin-verification/actor";
import{logServerError}from"@/lib/errors/api-error";
import{recordAdminWorkspaceEntry,recordAdminPageAccess,recordAdminSignIn}from"./capture";

export const recordCurrentAdminWorkspaceAccess=cache(async()=>{
 try{
  const requestHeaders=new Headers(await headers());
  if(requestHeaders.has("next-router-prefetch")||/prefetch|prerender/i.test((requestHeaders.get("purpose")??"")+" "+(requestHeaders.get("sec-purpose")??"")))return;
  const actor=await loadAdminVerificationActor();if(!actor.ok)return;
  await Promise.all([recordAdminWorkspaceEntry(actor.value,requestHeaders),recordAdminPageAccess(actor.value,requestHeaders)]);
 }catch{logServerError("admin activity capture unavailable",{code:"activity_capture_unavailable"});}
});
/** Only the successful admin-destined login action invokes this boundary. */
export async function recordCurrentAdminSignIn(){
 try{const actor=await loadAdminVerificationActor();if(actor.ok)await recordAdminSignIn(actor.value);}
 catch{logServerError("admin sign-in receipt unavailable",{code:"activity_capture_unavailable"});}
}
