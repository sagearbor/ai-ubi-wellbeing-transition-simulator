import { describe, expect, it } from 'vitest';
import { buildClauseInventory, locateQuote, sourceCoverage } from './clauses';
import { SOURCE_TEXT } from './testDrafts';

const ids = (text: string) => buildClauseInventory(text).clauses.map((c) => `${c.heading ? 'H ' : ''}${c.id}`);

describe('buildClauseInventory', () => {
  it('splits legislative text on sections and the (a)/(1)/(A)/(i)/(I) hierarchy, headings apart', () => {
    const text = `SEC. 4. GRANTS.

    (a) Grants Authorized.--
            (1) In general.--The Secretary shall award grants.
            (2) Duration.--A grant shall not exceed 4 years.
    (b) Priorities.--The Secretary shall--
            (1) give priority to--
                    (A) partnerships--
                            (i) with a plan; and
                                    (I) to retain employment; or
                                    (II) to advance; and
                            (ii) that backfill; and
                    (B) others.
    (h) Other.--Text.
    (i) Last.--Text.`;
    expect(ids(text)).toEqual([
      'H sec4',
      'H sec4(a)',
      'sec4(a)(1)',
      'sec4(a)(2)',
      'sec4(b)',
      'sec4(b)(1)',
      'sec4(b)(1)(A)',
      'sec4(b)(1)(A)(i)',
      'sec4(b)(1)(A)(i)(I)',
      'sec4(b)(1)(A)(i)(II)',
      'sec4(b)(1)(A)(ii)',
      'sec4(b)(1)(B)',
      'sec4(h)',
      'sec4(i)',
    ]);
  });

  it('does not mistake a wrapped cross-reference or quoted matter for structure', () => {
    const text = `SEC. 2. APPLICATIONS.
    (a) Contents.--Each application submitted under paragraph
        (1) shall include a plan.
    (b) Amendment.--Section 170 is amended by adding at the end the following:
    \`\`(e) Authorization.--There are authorized $40,000,000.''.`;
    expect(ids(text)).toEqual(['H sec2', 'sec2(a)', 'sec2(b)']);
  });

  it('is deterministic: same text, same ids', () => {
    expect(buildClauseInventory(SOURCE_TEXT)).toEqual(buildClauseInventory(SOURCE_TEXT));
    expect(ids(SOURCE_TEXT)).toEqual(['H sec1', 'sec1(a)', 'sec1(b)', 'sec1(c)']);
  });

  it('falls back to paragraphs and sentences for ordinary prose', () => {
    const prose = 'The city will pay every resident $500 a month. Payments start in 2027.\n\nThe program is reviewed after two years.';
    const inv = buildClauseInventory(prose);
    expect(inv.structure).toBe('paragraphs');
    expect(inv.clauses.map((c) => [c.id, c.text])).toEqual([
      ['p1.s1', 'The city will pay every resident $500 a month.'],
      ['p1.s2', 'Payments start in 2027.'],
      ['p2', 'The program is reviewed after two years.'],
    ]);
  });
});

describe('locateQuote and sourceCoverage', () => {
  it('locates quotes across line breaks, in original offsets', () => {
    const spans = locateQuote('appropriated $12,000,000 for each of fiscal years', SOURCE_TEXT);
    expect(spans).toHaveLength(1);
    const [s, e] = spans[0];
    expect(SOURCE_TEXT.slice(s, e).replace(/\s+/g, ' ')).toBe('appropriated $12,000,000 for each of fiscal years');
    expect(locateQuote('shall', SOURCE_TEXT)).toHaveLength(2);
    expect(locateQuote('nowhere', SOURCE_TEXT)).toEqual([]);
  });

  it('a quote spanning clauses covers each; an ambiguous one covers none', () => {
    const draft = {
      provisions: [
        { id: 'span', quote: 'training. (b) Each participant', summary: '', status: 'unresolved' as const, reason: 'x' },
        { id: 'amb', quote: 'shall', summary: '', status: 'unresolved' as const, reason: 'x' },
      ],
      source: { title: 't', excerptChars: 0 },
    };
    const c = sourceCoverage(draft, SOURCE_TEXT);
    expect(c.detail.find((d) => d.id === 'sec1(a)')?.provisions).toEqual(['span']);
    expect(c.detail.find((d) => d.id === 'sec1(b)')?.provisions).toEqual(['span']);
    expect(c.uncovered).toEqual(['sec1(c)']);
    expect(c.ambiguousQuotes).toEqual(['amb']);
  });
});
