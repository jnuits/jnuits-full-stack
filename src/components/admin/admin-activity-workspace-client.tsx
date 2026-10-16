"use client";
import{useTransition}from"react";
import{useRouter,useSearchParams}from"next/navigation";
import{AdminActivityPanel,type AdminActivityPanelProps,type ActivityFilterState}from"./admin-activity-panel";

export function AdminActivityWorkspaceClient(props:Omit<AdminActivityPanelProps,"onFilterChange"|"onPageChange"|"onRequestFullNetwork">){
 const router=useRouter(),search=useSearchParams();const[pending,startTransition]=useTransition();
 function href(changes:Record<string,string|undefined>){
  const params=new URLSearchParams(search.toString());params.set("view","activity");
  for(const[key,value]of Object.entries(changes)){if(value)params.set(key,value);else params.delete(key);}
  return "/admin/audit?"+params.toString();
 }
 function navigate(changes:Record<string,string|undefined>){startTransition(()=>router.push(href(changes)));}
 function filter(filters:ActivityFilterState){navigate({actor:filters.actor,action:filters.action,outcome:filters.outcome,from:filters.dateFrom,to:filters.dateTo,page:"1",network:undefined});}
 const lastPage=Math.max(1,Math.ceil(props.totalItems/(props.pageSize??25)));
 const navigation={previousHref:props.page>1?href({page:String(props.page-1),network:undefined}):null,nextHref:props.page<lastPage?href({page:String(props.page+1),network:undefined}):null,resetHref:"/admin/audit?view=activity",networkHrefs:Object.fromEntries(props.items.filter(item=>item.canRequestFullNetwork).map(item=>[item.id,href({network:item.id})]))};
 return <div aria-busy={pending}><AdminActivityPanel {...props} navigation={navigation} onFilterChange={filter} onPageChange={page=>navigate({page:String(page),network:undefined})} onRequestFullNetwork={network=>navigate({network})}/>{pending?<p role="status" className="section-copy">Loading activity…</p>:null}</div>;
}
