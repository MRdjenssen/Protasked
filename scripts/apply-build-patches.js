const { spawnSync } = require('child_process');
const path = require('path');

const patches = [
  'apply-task-layout-overhaul.js',
  'apply-task-layout-tablet-tweaks.js',
  'apply-admin-calendar-overhaul.js',
  'apply-admin-extra-completion-counter.js',
  'apply-admin-button-color-tweaks.js',
];

for (const patch of patches) {
  const patchPath = path.join(__dirname, patch);
  const result = spawnSync(process.execPath, [patchPath], { stdio: 'inherit' });

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

console.log('Applied all Protasked build patches.');
