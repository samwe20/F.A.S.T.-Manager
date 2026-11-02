import type { VaultDir } from './vaultDir';
import { snapshotFromDb, snapshotToDb } from './vaultDb';
import { readSnapshot, writeSnapshot } from './vaultIo';
import { linkedDirectory } from './vaultLink';

let chain: Promise<void> = Promise.resolve();

export async function exportDirectory(dir: VaultDir): Promise<void> {
  await writeSnapshot(dir, await snapshotFromDb());
}

export async function importDirectory(dir: VaultDir): Promise<void> {
  await snapshotToDb(await readSnapshot(dir));
}

export async function exportLinkedVault(): Promise<boolean> {
  const dir = await linkedDirectory();
  if (!dir) return false;
  await exportDirectory(dir);
  return true;
}

export function scheduleVaultExport(): Promise<boolean> {
  const run = chain.then(() => exportLinkedVault());
  chain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export async function importLinkedVault(): Promise<boolean> {
  const dir = await linkedDirectory();
  if (!dir || !(await dir.exists('vault.json'))) return false;
  await importDirectory(dir);
  return true;
}
