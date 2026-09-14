import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { renderModelCard } from './ModelCardTab';

describe('renderModelCard', () => {
  it('renders the real card with headings, scrollable tables and the candidate section', () => {
    const html = renderModelCard(readFileSync('docs/design/model-card-default.md', 'utf8'));
    expect(html).toContain('<h2');
    expect(html).toContain('<div class="mc-table"><table>');
    expect(html).toMatch(/Candidate variant \(stage 4\)/);
    expect(html).toMatch(/Policy-effect benchmarks/);
  });

  it('escapes raw HTML and sends relative links to the repository', () => {
    const html = renderModelCard('<script>alert(1)</script>\n\n[card](docs/x.md) [ext](https://example.org)');
    expect(html).not.toContain('<script>');
    expect(html).toContain('href="https://github.com/sagearbor/ai-ubi-wellbeing-transition-simulator/blob/main/docs/x.md"');
    expect(html).toContain('href="https://example.org"');
  });
});
