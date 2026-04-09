const fs = require('fs');
const file = 'src/app/globals.css';
let content = fs.readFileSync(file, 'utf8');
const marker = '.metric-card__value {';
const idx = content.indexOf(marker);
const closeIdx = content.indexOf('}', idx);
const newRules = [
  '',
  '.metric-card--warning {',
  '  border-color: color-mix(in oklab, var(--brand-gold) 28%, transparent);',
  '  background: color-mix(in oklab, var(--brand-gold) 5%, var(--card));',
  '}',
  '',
  '.metric-card--warning .metric-card__value {',
  '  color: color-mix(in oklab, var(--brand-gold) 80%, var(--foreground));',
  '}',
  '',
  '.metric-card--success {',
  '  border-color: color-mix(in oklab, var(--brand-green) 24%, transparent);',
  '  background: color-mix(in oklab, var(--brand-green) 5%, var(--card));',
  '}',
  '',
  '.metric-card--success .metric-card__value {',
  '  color: var(--brand-green);',
  '}',
  '',
  '.metric-card--danger {',
  '  border-color: color-mix(in oklab, var(--brand-rust) 28%, transparent);',
  '  background: color-mix(in oklab, var(--brand-rust) 5%, var(--card));',
  '}',
  '',
  '.metric-card--danger .metric-card__value {',
  '  color: var(--brand-rust);',
  '}',
  '',
].join('\n');
content = content.slice(0, closeIdx + 1) + newRules + content.slice(closeIdx + 1);
fs.writeFileSync(file, content, 'utf8');
console.log('Done. File size:', content.length, 'chars');
