#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const failures = [];

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function walk(directory) {
  const absolute = path.join(root, directory);
  const entries = fs.readdirSync(absolute, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const relative = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(relative));
    } else {
      files.push(relative);
    }
  }

  return files;
}

function uniqueMatches(source, regex) {
  return new Set([...source.matchAll(regex)].map((match) => match[1]));
}

function routeFromPagePath(relativePath) {
  const normalized = relativePath.replace(/\\/g, "/").replace(/\/page\.tsx$/, "");
  return normalized === "src/app/admin"
    ? "/admin"
    : normalized.replace(/^src\/app\/admin/, "/admin");
}

const accessSource = read("src/lib/admin/access.ts");
const siteSource = read("src/lib/site.ts");
const mappedRoutes = uniqueMatches(accessSource, /href:\s*"([^"]+)"/g);
const permissionUnion = uniqueMatches(accessSource, /\|\s*"((?:admin|cms)\.[^"]+)"/g);
const usedPermissions = uniqueMatches(
  accessSource,
  /requiredPermission:\s*"((?:admin|cms)\.[^"]+)"/g
);
const mappedRouteList = [...mappedRoutes].sort((left, right) => right.length - left.length);

const adminPages = walk("src/app/admin")
  .filter((file) => file.replace(/\\/g, "/").endsWith("/page.tsx"))
  .map(routeFromPagePath)
  .filter((route) => !route.startsWith("/admin/mfa/"));

for (const route of adminPages) {
  const isMapped =
    route === "/admin" ||
    mappedRouteList.some(
      (mappedRoute) => route === mappedRoute || route.startsWith(`${mappedRoute}/`)
    );

  if (!isMapped) {
    failures.push(`Admin route is not represented in access map: ${route}`);
  }
}

const requiredRoutes = [
  "/admin/admin-profiles",
  "/admin/bulk-operations",
  "/admin/content/about",
  "/admin/content/slider",
  "/admin/settings/contact",
];

for (const route of requiredRoutes) {
  if (!mappedRoutes.has(route)) {
    failures.push(`Expected admin route mapping is missing: ${route}`);
  }
}

for (const permission of usedPermissions) {
  if (!permissionUnion.has(permission)) {
    failures.push(`Permission used by access map is missing from AdminPermission: ${permission}`);
  }
}

const requiredPermissions = [
  "admin.membership.manage",
  "admin.certificates.manage",
  "admin.reports.read",
  "cms.media.manage",
  "cms.events.manage",
  "cms.gallery.manage",
  "cms.pages.manage",
  "cms.projects.manage",
];

for (const permission of requiredPermissions) {
  if (!permissionUnion.has(permission)) {
    failures.push(`Required permission is missing from AdminPermission: ${permission}`);
  }
}

const sqlSources = [
  "supabase/schema.sql",
  ...walk("supabase/migrations").filter((file) => file.endsWith(".sql")),
]
  .map(read)
  .join("\n");
const sqlPermissions = uniqueMatches(sqlSources, /['"]((?:admin|cms)\.[a-z0-9_.]+)['"]/g);

for (const permission of usedPermissions) {
  if (!sqlPermissions.has(permission)) {
    failures.push(`Access-map permission is missing from local RBAC SQL: ${permission}`);
  }
}

if (
  !siteSource.includes('import { getAdminNavigationLinks } from "@/lib/admin/access"') ||
  !siteSource.includes("getAdminNavigationLinks()")
) {
  failures.push("src/lib/site.ts must source adminNavigation from getAdminNavigationLinks().");
}

const securityRouteIndex = accessSource.indexOf('href: "/admin/settings/security"');
const securityRouteBlock =
  securityRouteIndex >= 0
    ? accessSource.slice(securityRouteIndex, accessSource.indexOf("},", securityRouteIndex))
    : "";

if (!securityRouteBlock.includes("requireAal2: true")) {
  failures.push("/admin/settings/security must require AAL2 in the central access map.");
}

if (failures.length > 0) {
  console.error("Admin access map check failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(
  `Admin access map check passed (${adminPages.length} admin page routes, ${usedPermissions.size} mapped permissions).`
);
