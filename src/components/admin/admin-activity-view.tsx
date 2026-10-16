import Link from"next/link";
import{loadAdminActivity}from"@/lib/admin/activity/query";
import{AdminActivityWorkspaceClient}from"./admin-activity-workspace-client";

export async function AdminActivityView({params}:{params:Record<string,string|string[]|undefined>}){
 const read=(key:string)=>typeof params[key]==="string"?params[key]as string:"";
 const input={page:Number(read("page"))||1,pageSize:Number(read("pageSize"))||25,actor:read("actor"),action:read("action"),outcome:read("outcome"),from:read("from"),to:read("to"),networkId:read("network")};
 let data:Awaited<ReturnType<typeof loadAdminActivity>>|null=null;
 try{data=await loadAdminActivity(input);}catch{/* Permission/filter/storage failure stays closed. */}
 if(!data)return <section role="status" className="empty-state"><h2>Activity view unavailable</h2><p>Check your filters and current access, then retry. No historical attendance is inferred from missing records.</p><Link href="/admin/audit?view=activity" className="ghost-button">Reset activity filters</Link></section>;
  const query=new URLSearchParams({view:"activity",page:String(data.page),pageSize:String(data.pageSize),actor:input.actor,action:input.action,outcome:input.outcome,from:input.from,to:input.to});
  return <><p className="section-copy">Verified admin activity is separate from legacy audit records. Access dates do not measure attention or duty performance. Visitor location is unavailable where ingress cannot establish it.</p>
   <a className="ghost-button w-fit" href={"/admin/audit/export?"+query.toString()}>Export this activity page (without network details)</a>
   <AdminActivityWorkspaceClient key={query.toString()+input.networkId} {...data} filters={{actor:input.actor,action:input.action,outcome:input.outcome,dateFrom:input.from,dateTo:input.to}}/>
  </>;
}
