import {describe,expect,it} from "vitest";
import {shiftDhakaMonths,isActivityDetailExpired,isActivitySummaryExpired} from "./retention";
describe("three-calendar-month retention",()=>{
 it("clamps month end and leap days in Asia/Dhaka",()=>{expect(shiftDhakaMonths(new Date("2026-10-31T04:30:00Z"),-6).toISOString()).toBe("2026-04-30T04:30:00.000Z");expect(shiftDhakaMonths(new Date("2028-05-31T04:30:00Z"),-3).toISOString()).toBe("2028-02-29T04:30:00.000Z")});
 it("retains a late event for at least three months from ingestion",()=>expect(isActivityDetailExpired({occurredAt:"2025-01-01T00:00:00Z",recordedAt:"2026-10-01T00:00:00Z"},new Date("2026-10-31T04:00:00Z"))).toBe(false));
 it("expires details only after both event and ingestion horizons",()=>{expect(isActivityDetailExpired({occurredAt:"2026-06-01T00:00:00Z",recordedAt:"2026-07-01T00:00:00Z"},new Date("2026-10-31T04:00:00Z"))).toBe(true);expect(isActivityDetailExpired({occurredAt:"2026-07-31T04:00:00Z",recordedAt:"2026-07-31T04:00:00Z"},new Date("2026-10-31T04:00:00Z"))).toBe(false)});
 it("never expires a live/frozen account summary from a last-seen date",()=>expect(isActivitySummaryExpired({permanentlyRemovedAt:null,incidentHold:false},new Date("2030-01-01T00:00:00Z"))).toBe(false));
 it("honors incident hold and permanent-removal grace",()=>{expect(isActivitySummaryExpired({permanentlyRemovedAt:"2026-01-01T00:00:00Z",incidentHold:true},new Date("2026-10-31T00:00:00Z"))).toBe(false);expect(isActivitySummaryExpired({permanentlyRemovedAt:"2026-10-01T00:00:00Z",incidentHold:false},new Date("2026-10-31T00:00:00Z"))).toBe(false)});
});
