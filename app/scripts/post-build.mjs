import { existsSync } from 'node:fs';
import { join } from 'node:path';

const exe =
  process.platform === 'win32'
    ? join('src-tauri', 'target', 'release', 'fast-manager.exe')
    : join('src-tauri', 'target', 'release', 'fast-manager');

console.log('');
console.log('✓ Build hotový — aplikace se automaticky nespouští.');
console.log('');
if (existsSync(exe)) {
  console.log('Spusťte ji jedním z těchto příkazů:');
  console.log('  npm run tauri:run');
  console.log(`  ${exe}`);
} else {
  console.log('Spusťte: npm run tauri:run');
}
console.log('');
