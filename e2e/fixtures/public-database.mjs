// Read-only public shell fixtures for production-build CI, never live acceptance.
// No Auth, CAPTCHA, mail or non-placeholder database endpoint is intercepted.
if(process.env.JNUITS_PUBLIC_BROWSER_FIXTURES!=="1" || process.env.NEXT_PUBLIC_SUPABASE_URL!=="https://example.supabase.co")throw new Error("Public browser fixtures require the reserved CI database endpoint and explicit opt-in.");
const originalFetch=globalThis.fetch;
globalThis.fetch=async(input,options)=>{
  const url=new URL(typeof input==="string"||input instanceof URL?input:input.url);
  if(url.origin==="https://example.supabase.co" && url.pathname.startsWith("/rest/v1/")){
    const method=options?.method??(input instanceof Request?input.method:"GET");
    if(!["GET","HEAD","POST"].includes(method))throw new Error("Unexpected fixture database mutation.");
    if(method==="POST" && !url.pathname.startsWith("/rest/v1/rpc/"))throw new Error("Fixture database writes are forbidden.");
    return new Response(method==="HEAD"?null:"[]",{status:200,headers:{"Content-Type":"application/json","Content-Range":"*/0"}});
  }
  return originalFetch(input,options);
};
