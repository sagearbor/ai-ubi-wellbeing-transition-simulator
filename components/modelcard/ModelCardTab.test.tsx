import React from 'react';
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import ModelCardTab, { renderModelCard } from './ModelCardTab';

const DOCS = 'https://github.com/sagearbor/ai-ubi-wellbeing-transition-simulator/blob/main/docs/design/';

describe('renderModelCard', () => {
  it('renders the actual conditional default scope and its document-relative evidence links', () => {
    const html = renderModelCard(readFileSync('docs/design/model-card-default.md', 'utf8'));
    expect(html).toContain('world-conditional-v1');
    expect(html).toContain('Macro and conditional wellbeing remain illustrative');
    expect(html).toContain('not adaptation time, realized life satisfaction');
    for (const path of ['research/cash-transfer-wellbeing-evidence.md', 'conditional-response-v1.md', 'model-card-legacy.md']) {
      expect(html).toContain(`href="${DOCS}${path}"`);
    }
  });

  it('renders a scrollable table from an explicit markdown fixture', () => {
    const html = renderModelCard('| Output | Scope |\n|---|---|\n| Accounting | Conditional |');
    expect(html).toContain('<div class="mc-table"><table>');
    expect(html).toContain('<th>Output</th>');
    expect(html).toContain('<td>Conditional</td>');
  });

  it('escapes raw HTML and resolves relative, parent and fragment links from the card document', () => {
    const html = renderModelCard('<script>alert(1)</script>\n\n[note](./research/note.md) [parent](../guide.md) [part](#scope) [ext](https://example.org)');
    expect(html).not.toContain('<script>');
    expect(html).toContain(`href="${DOCS}research/note.md"`);
    expect(html).toContain('href="https://github.com/sagearbor/ai-ubi-wellbeing-transition-simulator/blob/main/docs/guide.md"');
    expect(html).toContain(`href="${DOCS}model-card-default.md#scope"`);
    expect(html).toContain('href="https://example.org"');
  });

  it('does not turn non-web protocols into executable links', () => {
    expect(renderModelCard('[bad](javascript:alert%281%29)')).not.toContain('href=');
  });

  it('introduces the current default without an obsolete candidate label', () => {
    const html = renderToStaticMarkup(<ModelCardTab />);
    expect(html).toContain('default conditional world model');
    expect(html).not.toContain('and its evidence-anchored candidate');
  });
});
