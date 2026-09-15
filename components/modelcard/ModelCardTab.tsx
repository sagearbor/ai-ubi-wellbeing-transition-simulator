/**
 * In-app model card: renders docs/design/model-card-default.md (the same file GitHub shows), so the
 * card a reader sees in the app can never drift from the reviewed document. Deep link: /?tab=modelcard.
 */
import React, { useMemo } from 'react';
import { marked } from 'marked';
import cardSource from '../../docs/design/model-card-default.md?raw';

const REPO_BLOB = 'https://github.com/sagearbor/ai-ubi-wellbeing-transition-simulator/blob/main/';
const MODEL_CARD_URL = `${REPO_BLOB}docs/design/model-card-default.md`;

/** Markdown -> HTML. The source is a file in this repository, not user input; raw HTML in it is escaped anyway. */
export function renderModelCard(markdown: string): string {
  const renderer = new marked.Renderer();
  renderer.html = ({ text }) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  renderer.link = ({ href, text }) => {
    const url = /^https?:\/\//.test(href) ? href : new URL(href, MODEL_CARD_URL).href;
    if (!/^https?:\/\//i.test(url)) return text;
    const attributeUrl = url.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    return `<a href="${attributeUrl}" target="_blank" rel="noreferrer">${text}</a>`;
  };
  renderer.table = function (token) {
    const head = token.header.map((c) => `<th>${this.parser.parseInline(c.tokens)}</th>`).join('');
    const rows = token.rows.map((r) => `<tr>${r.map((c) => `<td>${this.parser.parseInline(c.tokens)}</td>`).join('')}</tr>`).join('');
    return `<div class="mc-table"><table><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div>`;
  };
  return marked.parse(markdown, { renderer, async: false, gfm: true }) as string;
}

const STYLE = `
.mc { color: rgb(30 41 59); font-size: 14px; line-height: 1.6; }
.dark .mc { color: rgb(203 213 225); }
.mc h1 { font-size: 1.5rem; font-weight: 800; margin: 0 0 1rem; color: rgb(15 23 42); }
.mc h2 { font-size: 1.1rem; font-weight: 800; margin: 2rem 0 .75rem; padding-bottom: .4rem; border-bottom: 1px solid rgb(226 232 240); color: rgb(15 23 42); }
.mc h3 { font-size: .95rem; font-weight: 700; margin: 1.25rem 0 .5rem; color: rgb(15 23 42); }
.dark .mc h1, .dark .mc h2, .dark .mc h3 { color: white; border-color: rgb(30 41 59); }
.mc p, .mc ul, .mc ol { margin: .5rem 0; }
.mc ul { list-style: disc; padding-left: 1.25rem; } .mc ol { list-style: decimal; padding-left: 1.25rem; }
.mc li { margin: .2rem 0; }
.mc code { font-family: ui-monospace, monospace; font-size: .85em; background: rgb(241 245 249); padding: .05rem .3rem; border-radius: .25rem; }
.dark .mc code { background: rgb(30 41 59); }
.mc pre { background: rgb(241 245 249); padding: .75rem 1rem; border-radius: .75rem; overflow-x: auto; font-size: 12px; line-height: 1.45; }
.dark .mc pre { background: rgb(15 23 42); }
.mc pre code { background: none; padding: 0; }
.mc .mc-table { overflow-x: auto; margin: .75rem 0; }
.mc table { border-collapse: collapse; font-size: 12.5px; min-width: 100%; }
.mc th, .mc td { border: 1px solid rgb(226 232 240); padding: .35rem .55rem; text-align: left; vertical-align: top; }
.dark .mc th, .dark .mc td { border-color: rgb(51 65 85); }
.mc th { background: rgb(248 250 252); font-weight: 700; } .dark .mc th { background: rgb(30 41 59); }
.mc a { color: rgb(37 99 235); text-decoration: underline; text-underline-offset: 2px; }
.mc strong { font-weight: 700; }
`;

export default function ModelCardTab() {
  const html = useMemo(() => renderModelCard(cardSource), []);
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-8 py-8">
      <style>{STYLE}</style>
      <div className="mb-6 p-4 rounded-2xl border border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200 text-sm">
        This is the model card for the default conditional world model, with links to archived legacy evidence, rendered from{' '}
        <a className="underline font-semibold" href={MODEL_CARD_URL} target="_blank" rel="noreferrer">docs/design/model-card-default.md</a>.
        It says what the model covers, what each number rests on, and where it is known to fail.
      </div>
      <article className="mc" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
