import{expect,it}from"vitest";
import{formatDhakaDateTime}from"./format";
it("formats event instants in Dhaka on both server and client",()=>{
 expect(formatDhakaDateTime("2026-10-15T20:00:00Z")).toMatch(/16/);
 expect(formatDhakaDateTime("2026-10-15T20:00:00Z")).toMatch(/2:00/);
});
it.each([null,undefined,"invalid"])("keeps absent or invalid timestamps unknown %s",value=>expect(formatDhakaDateTime(value)).toBe("Not recorded"));
