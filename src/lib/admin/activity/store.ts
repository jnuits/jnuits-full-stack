import "server-only";
import {createAdminClient} from "@/lib/supabase/admin";
import {asFlexibleClient} from "@/lib/supabase/flexible";
import {adminActivityEventSchema,type AdminActivityEvent} from "./model";
/** Private service receipt boundary. Browsers cannot select trusted actor/outcome. */
export async function appendTrustedAdminActivity(event:AdminActivityEvent,sessionId:string|null):Promise<"stored"|"duplicate">{
 const validated=adminActivityEventSchema.parse(event);
 const {data,error}=await asFlexibleClient(createAdminClient()).rpc("append_admin_activity",{p_event:validated,p_session_id:sessionId});
 if(error || !["stored","duplicate"].includes(data))throw new Error("Activity receipt could not be stored");
 return data;
}
