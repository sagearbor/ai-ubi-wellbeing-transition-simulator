/** Integrate the isolated synthetic/train-only Node suite with the existing Vitest check. */
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {expect, it} from 'vitest';

it('registered damped method passes synthetic and permitted training-only integrity checks', () => {
  const suite = fileURLToPath(new URL('./model.node-test.mjs', import.meta.url));
  const output = execFileSync(process.execPath, ['--test', suite], {encoding: 'utf8', timeout: 30_000});
  expect(output).toContain('# pass 13');
  expect(output).toContain('# fail 0');
}, 35_000);
