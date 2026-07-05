const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const TARGETS = ['src/app/admin', 'src/components/admin'];
const EXTENSIONS = new Set(['.tsx', '.ts', '.css']);

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    if (!EXTENSIONS.has(path.extname(entry.name))) return [];
    return [full];
  });
}

const checks = [
  {
    name: 'raw-table',
    pattern: /<table(?![^>]*(membership-table|admin-responsive-table|admin-queue-table))/g,
    message: 'Table is not using a known responsive admin table class.',
  },
  {
    name: 'manual-apply-filter',
    pattern: />\s*(Apply|Filter)\s*<\/button>/g,
    message: 'Filter form may still depend on a visible Apply/Filter button instead of auto-submit.',
  },
  {
    name: 'fixed-width-tailwind',
    pattern: /\b(?:w|min-w|max-w)-\[[^\]]+\]/g,
    message: 'Fixed width utility needs a mobile fallback or responsive wrapper.',
  },
  {
    name: 'inline-grid-template',
    pattern: /gridTemplateColumns\s*:/g,
    message: 'Inline grid template can bypass shared responsive breakpoints.',
  },
];

const findings = [];
for (const target of TARGETS) {
  for (const file of walk(path.join(ROOT, target))) {
    const rel = path.relative(ROOT, file).replaceAll(path.sep, '/');
    const text = fs.readFileSync(file, 'utf8');
    for (const check of checks) {
      let match;
      while ((match = check.pattern.exec(text)) !== null) {
        const line = text.slice(0, match.index).split(/\r?\n/).length;
        findings.push({ check: check.name, file: rel, line, message: check.message });
      }
    }
  }
}

const defaultBudget = 0;
const configuredBudget = Number.parseInt(
  process.env.ADMIN_UI_AUDIT_MAX_FINDINGS || `${defaultBudget}`,
  10
);
const findingBudget = Number.isFinite(configuredBudget)
  ? Math.max(0, configuredBudget)
  : defaultBudget;

if (findings.length === 0) {
  console.log('Admin responsive UI audit: no risky patterns found.');
  process.exit(0);
}

console.log(
  `Admin responsive UI audit: ${findings.length} finding(s), budget ${findingBudget}.`
);
for (const finding of findings.slice(0, 80)) {
  console.log(`- [${finding.check}] ${finding.file}:${finding.line} - ${finding.message}`);
}
if (findings.length > 80) {
  console.log(`... ${findings.length - 80} more finding(s) omitted.`);
}

if (findings.length > findingBudget) {
  console.error(
    `Admin responsive UI audit failed: ${findings.length} findings exceeds budget ${findingBudget}. ` +
      'Fix new findings or intentionally raise ADMIN_UI_AUDIT_MAX_FINDINGS with review.'
  );
  process.exit(1);
}

console.log('Admin responsive UI audit passed within the current finding budget.');
