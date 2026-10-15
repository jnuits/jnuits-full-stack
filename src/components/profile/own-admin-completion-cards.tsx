import {getOwnCompletionPresentation,getOwnLinkedMemberCompletion} from "@/lib/profile/completion-server";
import {ProfileCompletionCard} from "./profile-completion-card";

/** Called only by admin home and the owned self-profile view. */
export async function OwnAdminCompletionCards(){
 const [admin,linked]=await Promise.all([getOwnCompletionPresentation("admin"),getOwnLinkedMemberCompletion()]);
 return <>
  {admin?<ProfileCompletionCard {...admin} title="Admin profile completeness"/>:null}
  {linked?<ProfileCompletionCard {...linked}/>:null}
 </>;
}
