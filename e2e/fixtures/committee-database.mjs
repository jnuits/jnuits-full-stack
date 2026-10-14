// Synthetic, read-only fixtures; imported only by the reserved endpoint harness.
const id=n=>"10000000-0000-4000-8000-"+String(n).padStart(12,"0");
const terms=[{id:id(1),slug:"fixture-seventh",title:"7th Executive Committee",term_number:7,is_current:true,status:"active",starts_on:"2026-10-01"},{id:id(2),slug:"fixture-fifth",title:"5th Executive Committee",term_number:5,is_current:false,status:"archived",starts_on:"2024-01-01"}].map(row=>({...row,date_confidence:"verified",election_date:null,ends_on:null,is_public:true,term_kind:"executive",summary:null,tenure_note:null,target_executive_slots:2,voter_rule_note:null}));
const roles=[{id:id(3),code:"president"},{id:id(4),code:"general-secretary"}];
const positions=terms.flatMap(term=>roles.map((role,index)=>({id:id(30+index+(term.term_number===7?0:10)),term_id:term.id,role_id:role.id,public_label:index?"General Secretary":"President",public_label_bn:null,role_group:"executive",priority:index*10,is_public:true,min_slots:1,max_slots:1,target_slots:1})));
const members=roles.map((role,index)=>({id:id(5+index),jnuits_id:"JnUITS-202600"+(index+1),full_name:index?"Fixture Secretary":"Fixture President",department_code:"cse",avatar_secure_url:index?null:"/logo.svg",facebook_url:null,linkedin_url:null,website_url:null,member_type:"current",lifecycle_status:"current",portal_access_status:"active",professional_visibility:"public",batch_no:18,departments:{name:"Computer Science and Engineering"}}));
members.push({id:id(7),jnuits_id:"JnUITS-2026003",full_name:"Fixture Alumni",department_code:"cse",avatar_secure_url:null,facebook_url:null,linkedin_url:null,website_url:null,member_type:"alumni",lifecycle_status:"alumni",portal_access_status:"active",professional_visibility:"public",batch_no:18,departments:{name:"Computer Science and Engineering"}});
const assignments=positions.map((position,index)=>({id:id(50+index),term_id:position.term_id,role_id:position.role_id,member_id:members[index%2].id,display_name:null,sort_order:index,status:position.term_id===id(1)?"active":"completed",is_public:true,public_title_override:null,speech:position.term_id===id(1)?"Working together for our members.":null}));
const advisors=["main_advisor","moderator_mentor","honorable_advisor","honorable_advisor"].map((advisor_type,index)=>({id:id(70+index),advisor_jnuits_id:null,advisor_type,full_name:"Fixture Advisor "+index,title:null,former_title:null,department:"University office",designation:"Faculty",avatar_secure_url:null,bio:"Public biography",speech:"A welcome from the advisor.",facebook_url:null,linkedin_url:null,website_url:null,jnu_profile_url:null,joined_on:"2024-01-01",left_on:index===3?"2025-01-01":null,tenure_display:null,date_confidence:"verified",status_note:null,is_current:index!==3,is_public:true,sort_order:index}));
const tables={committee_terms:terms,committee_roles:roles,committee_term_positions:positions,committee_assignments:assignments,members,advisor_profiles:advisors,departments:[{code:"cse",name:"Computer Science and Engineering"}]};
export function committeeResponse(url,method){
  if(process.env.JNUITS_COMMITTEE_BROWSER_FIXTURES!=="1")return null;
  if(url.pathname==="/rest/v1/rpc/get_member_directory_facets"){
    const facets=["counter","type"].flatMap(group=>["all","current","alumni"].map(key=>({facet_group:group,facet_key:key,item_count:key==="all"?members.length:members.filter(row=>row.member_type===key).length})));
    facets.push({facet_group:"department",facet_key:"cse",item_count:members.length});
    return new Response(JSON.stringify(facets),{status:200,headers:{"Content-Type":"application/json"}});
  }
  const name=url.pathname.replace("/rest/v1/","");let rows=tables[name];if(!rows)return null;
  for(const [key,value] of url.searchParams){
    if(value.startsWith("eq."))rows=rows.filter(row=>String(row[key])===value.slice(3));
    if(value.startsWith("neq."))rows=rows.filter(row=>String(row[key])!==value.slice(4));
    if(value.startsWith("in.(")){const wanted=value.slice(4,-1).split(",").map(v=>v.replaceAll('"',""));rows=rows.filter(row=>wanted.includes(String(row[key])));}
  }
  const offset=Number(url.searchParams.get("offset")||0),limit=Number(url.searchParams.get("limit")||rows.length);
  return new Response(method==="HEAD"?null:JSON.stringify(rows.slice(offset,offset+limit)),{status:200,headers:{"Content-Type":"application/json","Content-Range":"*/"+rows.length}});
}
