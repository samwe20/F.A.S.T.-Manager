import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const exe =
  process.platform === 'win32'
    ? join('src-tauri', 'target', 'release', 'fast-manager.exe')
    : join('src-tauri', 'target', 'release', 'fast-manager');

if (!existsSync(exe)) {
  console.error('Release build nenalezen. Nejdriv spustte: npm run tauri:build');
  process.exit(1);
}

console.log(`Spouštím ${exe} …`);
const child = spawn(exe, { stdio: 'ignore', detached: true, shell: true });
child.unref();
