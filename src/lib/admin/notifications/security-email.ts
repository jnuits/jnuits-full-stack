import { buildAdminAdvisoryEmail } from "@/lib/notifications/email-builders";
import type { AdminRecommendation } from "@/components/admin/admin-recommendations-card";

const base = "https://jnuits.org.bd";
const preferences = base + "/admin/settings/profile";
function checkedLink(path: string) {
  if (!/^\/admin\/[a-z0-9/_-]+$/.test(path)) throw new Error("Invalid recommendation destination");
  return base + path;
}
export function buildAdminSecurityEmail(input: {title: string; summary: string; actorLabel: string; occurredAt: string}) {
  const date = new Date(input.occurredAt);
  if (!Number.isFinite(date.getTime())) throw new Error("Invalid notice time");
  const title = input.title.replace(/[\r\n]/g, " ").slice(0, 160);
  const paragraphs = [input.summary.slice(0,512), "Actor: " + input.actorLabel.slice(0,200), "Recorded change (UTC): " + date.toISOString()];
  const links = [{label:"View your security notices",href:base+"/admin/notifications"}];
  return { subject: "JnUITS: " + title, html: buildAdminAdvisoryEmail({title,paragraphs,links}),
    text: [title,...paragraphs,links[0].href,"Manage optional email preferences: " + preferences].join("\n\n") };
}
export function buildAdminRecommendationsEmail(input: readonly AdminRecommendation[], monthKey: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(monthKey) || input.length === 0) throw new Error("No current-month recommendations");
  const items = input.slice(0,3);
  const links = items.map(item => ({label:item.label,href:checkedLink(item.href)}));
  const title = "Your JnUITS recommendations for " + monthKey;
  const paragraphs = items.map(item => item.label + ": " + item.explanation);
  return {subject:title,html:buildAdminAdvisoryEmail({title,paragraphs,links}),
    text:[title,...items.map((item,i)=>paragraphs[i]+"\n"+links[i].href),"This monthly email is optional. Manage preferences: "+preferences].join("\n\n")};
}
