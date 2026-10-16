import "server-only";
import {isIP} from "node:net";
import type {AuditRequestContext} from "./model";
type HeaderReader={get(name:string):string|null};
export type VerifiedIngress="vercel_edge"|"unverified";
/** Callers choose ingress from trusted server configuration, never host/client headers.
 * Free Cloudflare -> Vercel exposes an observed edge, not verified visitor geography. */
export function resolveAuditRequestContext(headers:HeaderReader,verifiedIngress:VerifiedIngress):AuditRequestContext{
 const observed=verifiedIngress==="vercel_edge"?headers.get("x-forwarded-for")?.trim():null;
 const result:AuditRequestContext={observedIp:observed&&observed.length<=45&&isIP(observed)?observed:null,clientIp:null,countryCode:null,
  browser:null,os:null,deviceClass:null,networkSource:verifiedIngress};
 const ua=headers.get("user-agent");
 if(!ua || ua.length>512) return result;
 const browserPatterns=[["Edge",/Edg\/(\d{1,3})\./],["Firefox",/Firefox\/(\d{1,3})\./],["Chrome",/Chrome\/(\d{1,3})\./],["Safari",/Version\/(\d{1,3})\..*Safari/]] as const;
 for(const [name,pattern] of browserPatterns){const match=ua.match(pattern);if(match){result.browser=name+" "+match[1];break;}}
 result.os=/iPhone|iPad|iPod/.test(ua)?"iOS":/Android/.test(ua)?"Android":/Windows NT/.test(ua)?"Windows":/Macintosh|Mac OS X/.test(ua)?"macOS":/Linux/.test(ua)?"Linux":null;
 result.deviceClass=/iPad|Tablet/.test(ua)?"tablet":/Mobile|iPhone|iPod|Android/.test(ua)?"mobile":result.browser?"desktop":null;
 return result;
}
export function maskActivityIp(value:string|null):string|null{
 if(!value || !isIP(value))return null;
 return isIP(value)===4?value.split(".").slice(0,2).join(".")+".x.x":value.split(":").filter(Boolean).slice(0,2).join(":")+":…";
}
