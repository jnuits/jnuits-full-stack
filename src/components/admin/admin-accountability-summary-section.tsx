import{loadAdminAccountabilitySummary}from"@/lib/admin/activity/query";
import{AdminActivitySummaryView}from"./admin-activity-summary";
export async function AdminAccountabilitySummarySection({targetUserId}:{targetUserId?:string}={}){
 let summary:Awaited<ReturnType<typeof loadAdminAccountabilitySummary>>|null=null;
 try{summary=await loadAdminAccountabilitySummary(targetUserId);}catch{/* Advisory data stays unavailable without blocking self-service. */}
 if(!summary)return <section className="section-band" role="status"><h2>Account activity unavailable</h2><p className="section-copy">Current access or collection evidence could not be verified. Missing history does not mean never used.</p></section>;
 return <AdminActivitySummaryView summary={summary}/>;
}
