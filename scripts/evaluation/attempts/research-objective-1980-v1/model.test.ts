import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { expect, test } from 'vitest';

test('six synthetic objective-model boundary and arithmetic checks', () => {
  const output = execFileSync(process.execPath, ['--test', fileURLToPath(new URL('./model.checks.mjs', import.meta.url))], { encoding: 'utf8' });
  expect(output).toContain('# pass 6');
  expect(output).toContain('# fail 0');
});
