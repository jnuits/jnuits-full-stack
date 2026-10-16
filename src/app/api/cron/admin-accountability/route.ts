import{createHash,timingSafeEqual}from"node:crypto";
import{runAdminAccountability}from"@/lib/admin/accountability-job";
export const runtime="nodejs";
export const maxDuration=30;
export async function GET(request:Request){
 const headers={"Cache-Control":"private, no-store"};
 const secret=process.env.CRON_SECRET;
 if(process.env.VERCEL_ENV!=="production"||!secret)return Response.json({error:"Job unavailable"},{status:503,headers});
 const digest=(value:string)=>createHash("sha256").update(value).digest();
 if(!timingSafeEqual(digest(request.headers.get("authorization")??""),digest("Bearer "+secret)))return Response.json({error:"Unauthorized"},{status:401,headers});
 const now=new Date();
 const result=await runAdminAccountability({now,dryRun:new URL(request.url).searchParams.get("dryRun")==="1",deadline:new Date(now.getTime()+20000)});
 return Response.json(result,{status:result.errors.length?503:200,headers});
}
