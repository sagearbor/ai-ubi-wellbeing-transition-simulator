import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { expect, test } from 'vitest';

test('nine synthetic health-model arithmetic and leakage checks', () => {
  const output = execFileSync(process.execPath, ['--test', fileURLToPath(new URL('./model.checks.mjs', import.meta.url))], { encoding: 'utf8' });
  expect(output).toContain('# pass 9');
  expect(output).toContain('# fail 0');
});
