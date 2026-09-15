# Task 6 accessibility report

## Scope

Fixed the critical `aria-required-children` violation reported in `/private/tmp/beta-policy-mobile-axe.json` for the policy draft selector. The change is limited to `components/lab/PolicyPanel.tsx` and its existing lifecycle test.

## Root cause

The container declared `role="tablist"`, but it directly contained the Add/Remove draft action as well as the draft selectors. That child is not a tab, so the ARIA tablist contract was invalid. The draft selectors also had no associated tab panels or tab keyboard implementation, making tab semantics inaccurate for this interface.

## Repair

Draft A and Draft B are native buttons in a `role="group"` labeled “Draft selection.” Each selector exposes its current state with `aria-pressed`. The Add/Remove draft action remains a native button outside that labeled selector group. Existing click handlers, draft state, result invalidation, and layout classes are unchanged.

Native buttons retain ordinary Tab focus and Enter/Space activation without a custom keyboard handler.

## Regression coverage

The focused lifecycle regression verifies that:

- the selector is an accurately labeled button group;
- Draft A and Draft B expose exactly one pressed selection;
- selecting Draft B updates the pressed state;
- Remove draft B is not mixed into the selector group.

The test was observed failing before the component change because the group did not exist.

## Verification

- `npx vitest run components/lab/PolicyPanel.lifecycle.test.tsx`
- `npm run typecheck`

Both commands passed after the repair. Final real-browser axe and keyboard verification remains with the root task as assigned.
