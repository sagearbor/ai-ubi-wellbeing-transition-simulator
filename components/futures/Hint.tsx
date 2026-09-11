/**
 * Hint — an inline ⓘ that explains a label in plain words.
 *
 * The owner's complaint was "Cost band (1-5)… i have no idea what that means", so every piece of
 * jargon in the futures tab gets one of these. It works two ways on purpose:
 *   - desktop: CSS hover/focus on the wrapping `group` (no JS, no flicker),
 *   - phone:   a tap toggles it, because there is no hover on a touch screen.
 *
 * The trigger renders as a 14px icon in the layout but carries a 44x44 absolutely-positioned hit
 * area, so tapping it is easy without pushing neighbouring text around.
 *
 *   <HintedLabel label="Cost band (1-5)" hint="Rough cost and political difficulty…" htmlFor="x" />
 *   Mean shift <Hint text="Change in expected goodness…" align="right" />
 */

import React, { useState } from 'react';
import { Info } from 'lucide-react';

export type HintAlign = 'left' | 'right';

export interface HintProps {
  /** The explanation. Plain sentences, no jargon of its own. */
  text: string;
  /** What the hint is about, for the screen-reader label ("What does X mean?"). */
  label?: string;
  /** Which edge of the tooltip lines up with the icon. Default 'left' (box hangs below-right). */
  align?: HintAlign;
  /** Extra classes on the 14px wrapper (e.g. `ml-0.5`). */
  className?: string;
}

export const Hint: React.FC<HintProps> = ({ text, label, align = 'left', className = '' }) => {
  const [open, setOpen] = useState(false);

  const visible = open
    ? 'visible opacity-100'
    : 'invisible opacity-0 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100';

  return (
    <span className={`group relative inline-flex h-3.5 w-3.5 shrink-0 align-[-2px] ml-1 ${className}`}>
      <button
        type="button"
        aria-label={label ? `What does ${label} mean?` : 'What does this mean?'}
        aria-expanded={open}
        onClick={(e) => {
          // Inside a <label> a click would otherwise fall through to the field.
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        onBlur={() => setOpen(false)}
        className="absolute left-1/2 top-1/2 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:text-slate-500 dark:hover:text-slate-300"
      >
        <Info size={14} aria-hidden="true" />
      </button>
      <span
        role="tooltip"
        className={`pointer-events-none absolute top-full z-50 mt-2 w-max max-w-64 rounded-lg bg-slate-900 px-2.5 py-2 text-[11px] font-normal normal-case leading-snug tracking-normal text-white shadow-lg ring-1 ring-black/10 transition-opacity duration-100 dark:bg-slate-700 dark:text-slate-50 ${
          align === 'right' ? 'right-0' : 'left-0'
        } ${visible}`}
      >
        {text}
      </span>
    </span>
  );
};

export interface HintedLabelProps extends Omit<HintProps, 'label' | 'text'> {
  /** The visible label text. */
  label: React.ReactNode;
  /** The explanation shown in the tooltip. */
  hint: string;
  /** When given the label is a real <label for=…>; otherwise it is a <span>. */
  htmlFor?: string;
  /** Classes for the label element itself. */
  className?: string;
}

/** A label with its ⓘ already attached. */
export const HintedLabel: React.FC<HintedLabelProps> = ({ label, hint, htmlFor, className = '', align }) => {
  const inner = (
    <>
      {label}
      <Hint text={hint} label={typeof label === 'string' ? label : undefined} align={align} />
    </>
  );
  return htmlFor ? (
    <label className={className} htmlFor={htmlFor}>
      {inner}
    </label>
  ) : (
    <span className={className}>{inner}</span>
  );
};

export default Hint;
