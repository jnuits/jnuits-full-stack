import { describe, expect, it } from "vitest";
import { runAccountabilityOperator } from "./run-admin-accountability.mjs";
const env = { APP_BASE_URL: "https://jnuits.org.bd", CRON_SECRET: "operator-fixture-only" };
const receipt = { imported: 0, read: 3, backlog: false, coverage: "partial", errors: [] };
describe("bounded accountability operator", () => {
  it("defaults to a read-only source dry-run and reports only safe counters", async () => {
    const seen = [];
    const result = await runAccountabilityOperator([], env, { fetchImpl: async (url, init) => { seen.push({ url, init }); return Response.json({ ...receipt, extraPrivateData: "must-not-print" }); } });
    expect(result).toEqual({ ok: true, dryRun: true, ...receipt });
    expect(seen[0].url).toBe("https://jnuits.org.bd/api/cron/admin-accountability?dryRun=1");
    expect(seen[0].init.headers.Authorization).toBe("Bearer operator-fixture-only");
    expect(seen[0].init.redirect).toBe("error");
  });
  it("requires an explicit apply flag to collect trusted source receipts", async () => {
    let called;
    expect(await runAccountabilityOperator(["--apply"], env, { fetchImpl: async url => { called = url; return Response.json(receipt); } })).toMatchObject({ ok: true, dryRun: false });
    expect(called).toBe("https://jnuits.org.bd/api/cron/admin-accountability");
  });
  it("never sends the job credential to an unexpected origin or for unknown flags", async () => {
    for (const [args, config] of [[[], { ...env, APP_BASE_URL: "https://attacker.test" }], [[], { ...env, CRON_SECRET: "" }], [["--purge"], env]]) {
      expect(await runAccountabilityOperator(args, config, { fetchImpl: () => { throw new Error("must not call"); } })).toEqual({ ok: false, error: "configuration_invalid" });
    }
  });
  it("fails closed on invalid, failed or unavailable collection without leaking provider bodies", async () => {
    for (const response of [Response.json({ message: "secret" }, { status: 503 }), Response.json({ ...receipt, read: 999 }), Response.json({ ...receipt, errors: ["collection_unavailable"] })]) {
      expect(await runAccountabilityOperator([], env, { fetchImpl: async () => response })).toEqual({ ok: false, error: "collection_unavailable" });
    }
  });
  it("reports bounded notification counters as acceptance, preserving older collection-only receipts",async()=>{
    const result=await runAccountabilityOperator(["--apply"],env,{fetchImpl:async()=>Response.json({...receipt,notices:4,sends:2,digests:1,recipientEmails:["must-not-print@local.invalid"]})});
    expect(result).toEqual({ok:true,dryRun:false,...receipt,notices:4,sends:2,digests:1});
    expect(await runAccountabilityOperator(["--apply"],env,{fetchImpl:async()=>Response.json({...receipt,sends:11})})).toEqual({ok:false,error:"collection_unavailable"});
  });
});
