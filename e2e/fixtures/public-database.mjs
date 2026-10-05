// Read-only public shell fixtures for production-build CI, never live acceptance.
// No Auth, CAPTCHA, mail or non-placeholder database endpoint is intercepted.
if(process.env.JNUITS_PUBLIC_BROWSER_FIXTURES!=="1" || process.env.NEXT_PUBLIC_SUPABASE_URL!=="https://example.supabase.co")throw new Error("Public browser fixtures require the reserved CI database endpoint and explicit opt-in.");

// Optional large archive fixtures, confined to the same reserved read-only endpoint.
const contentFixtures = process.env.JNUITS_CONTENT_BROWSER_FIXTURES === "1";
const blogs = Array.from({length:40},(_,index)=>{
  const number=40-index;
  return {id:"00000000-0000-4000-8000-"+String(number).padStart(12,"0"),
    content_type:"blog",status:"published",slug:"fixture-blog-"+number,title:"Fixture Blog "+number,
    category:number%2?"Activities":"Tech",summary:"Disposable archive fixture.",excerpt:"Disposable archive fixture.",
    body:"# Disposable article",published_at:"2026-10-05T00:00:00Z",created_at:"2026-10-05T00:00:00Z",
    updated_at:"2026-10-05T00:00:00Z",read_time:"5 min read",media_assets:null};
});
function archiveResponse(url,method){
  if(!contentFixtures)return null;
  if(url.pathname==="/rest/v1/rpc/get_public_blog_categories")
    return new Response(JSON.stringify(["Activities","Tech"]),{headers:{"Content-Type":"application/json"}});
  if(url.pathname!=="/rest/v1/content_posts")return null;
  const type=url.searchParams.get("content_type");
  if(type!=="eq.blog")return null;
  let rows=blogs;
  const category=url.searchParams.get("category");
  if(category?.startsWith("ilike."))rows=rows.filter(row=>row.category.toLowerCase()===category.slice(6).toLowerCase());
  const slug=url.searchParams.get("slug");
  if(slug?.startsWith("eq."))rows=rows.filter(row=>row.slug===slug.slice(3));
  const offset=Number(url.searchParams.get("offset")||0);
  const limit=Number(url.searchParams.get("limit")||rows.length);
  const single=method!=="HEAD" && (url.searchParams.get("select")||"").includes(", body");
  const body=single?(rows[0]||null):rows.slice(offset,offset+limit);
  return new Response(method==="HEAD"?null:JSON.stringify(body),{status:200,
    headers:{"Content-Type":"application/json","Content-Range":"*/"+rows.length}});
}
const originalFetch=globalThis.fetch;
globalThis.fetch=async(input,options)=>{
  const url=new URL(typeof input==="string"||input instanceof URL?input:input.url);
  if(url.origin==="https://example.supabase.co" && url.pathname.startsWith("/rest/v1/")){
    const method=options?.method??(input instanceof Request?input.method:"GET");
    if(!["GET","HEAD","POST"].includes(method))throw new Error("Unexpected fixture database mutation.");
    if(method==="POST" && !url.pathname.startsWith("/rest/v1/rpc/"))throw new Error("Fixture database writes are forbidden.");
    const archive=archiveResponse(url,method); if(archive)return archive;
    return new Response(method==="HEAD"?null:"[]",{status:200,headers:{"Content-Type":"application/json","Content-Range":"*/0"}});
  }
  return originalFetch(input,options);
};
