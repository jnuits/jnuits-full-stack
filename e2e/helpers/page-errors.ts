import type { Page } from "@playwright/test";

/** WebKit #43120: same-origin prefetches in a departing document can be
 * reported as access-control page errors before any request reaches the server.
 * Never excuse an API, foreign-origin or stable-document failure. */
export function isDepartingWebKitPrefetchError({message,name="",browserName,baseURL,replacingDocument}:{message:string;name?:string;browserName:string;baseURL:string;replacingDocument:boolean}) {
  if(browserName!=="webkit"||!replacingDocument)return false;
  const short=/^\/+([^\s]+) due to access control checks\.$/.exec(message);
  const full=/^Fetch API cannot load (https?:\/\/[^\s]+) due to access control checks\.$/.exec(message);
  const engineName=/^(?:XMLHttpRequest|Fetch API) cannot load (https?)$/.exec(name);
  if(!full&&(!short||!engineName))return false;
  try{
    const base=new URL(baseURL);
    const url=new URL(full?full[1]:engineName![1]+"://"+short![1]);
    return url.origin===base.origin&&url.searchParams.has("_rsc")
      &&!/(?:^|\/)(?:export|download)(?:\/|$)/.test(url.pathname)
      &&(url.pathname==="/"||["/portal","/admin"].some(root=>url.pathname===root||url.pathname.startsWith(root+"/")));
  }catch{return false;}
}

export function collectPageErrors(page:Page,browserName:string,baseURL:string){
  let replacingDocument=false;
  const unexpectedErrors:string[]=[];
  const departingPrefetchCancellations:string[]=[];
  page.on("request",request=>{if(request.isNavigationRequest()&&request.frame()===page.mainFrame())replacingDocument=true;});
  page.on("framenavigated",frame=>{if(frame===page.mainFrame())replacingDocument=false;});
  page.on("requestfailed",request=>{if(request.isNavigationRequest()&&request.frame()===page.mainFrame())replacingDocument=false;});
  page.on("pageerror",error=>{
    const target=isDepartingWebKitPrefetchError({message:error.message,name:error.name,browserName,baseURL,replacingDocument})?departingPrefetchCancellations:unexpectedErrors;
    target.push(error.message);
  });
  return {unexpectedErrors,departingPrefetchCancellations};
}
