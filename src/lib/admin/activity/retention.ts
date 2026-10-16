const dhakaParts=new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Dhaka",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"});
function parts(date:Date){return Object.fromEntries(dhakaParts.formatToParts(date).filter(p=>p.type!=="literal").map(p=>[p.type,Number(p.value)]));}
function asUtc(p:Record<string,number>){return Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute,p.second);}
/** Calendar arithmetic uses IANA Dhaka offsets and clamps end-of-month days. */
export function shiftDhakaMonths(date:Date,months:number):Date{
 if(!Number.isFinite(date.getTime())||!Number.isInteger(months))throw new RangeError("Valid date and integer month shift required.");
 const p=parts(date);const month=new Date(Date.UTC(p.year,p.month-1+months,1));
 const target={...p,year:month.getUTCFullYear(),month:month.getUTCMonth()+1,day:Math.min(p.day,new Date(Date.UTC(month.getUTCFullYear(),month.getUTCMonth()+1,0)).getUTCDate())};
 const local=asUtc(target)+date.getUTCMilliseconds();let instant=local;
 for(let i=0;i<3;i++){const offset=asUtc(parts(new Date(instant)))-Math.floor(instant/1000)*1000;const next=local-offset;if(next===instant)break;instant=next;}
 return new Date(instant);
}
export function isActivityDetailExpired(event:{occurredAt:string;recordedAt:string},now:Date):boolean{
 const cutoff=shiftDhakaMonths(now,-3).getTime();
 return Date.parse(event.occurredAt)<cutoff&&Date.parse(event.recordedAt)<cutoff;
}
export function isActivitySummaryExpired(summary:{permanentlyRemovedAt:string|null;incidentHold:boolean},now:Date):boolean{
 return !summary.incidentHold&&summary.permanentlyRemovedAt!==null&&Date.parse(summary.permanentlyRemovedAt)<shiftDhakaMonths(now,-3).getTime();
}
