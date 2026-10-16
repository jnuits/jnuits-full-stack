/** Shared pure formatter: safe in server and client presenters. */
export function formatDhakaDateTime(value:string|null|undefined):string{
 if(!value||!Number.isFinite(Date.parse(value)))return"Not recorded";
 return new Intl.DateTimeFormat("en-BD",{timeZone:"Asia/Dhaka",dateStyle:"medium",timeStyle:"short"}).format(new Date(value));
}
