// Runs every tests/e2e/*.e2e.js file in order and reports a summary.
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const files = fs.readdirSync(__dirname).filter((f) => f.endsWith('.e2e.js')).sort();
let failed = 0;
for (const f of files) {
  console.log(`\n${f}`);
  const r = spawnSync(process.execPath, [path.join(__dirname, f)], { stdio: 'inherit' });
  if (r.status !== 0) { failed++; console.log(`  ✗ ${f} failed`); }
}
console.log(failed ? `\n${failed} of ${files.length} browser test files failed` : `\nAll ${files.length} browser test files passed`);
process.exit(failed ? 1 : 0);
