# Independent review of PR #21 (Claude Code), 15 September 2026

Reviewed tip `20a8fefc1a0541cf6a3fbd1be5d428204f98b52e` (stacked on PR #20 `a064c2c`) in a separate
worktree; fixes on branch `claude/pr21-review-fixes`. No merge, deployment, expert contact or archive.

## Software checks (run, not read)

- `npm ci` and `npm run check` at the reviewed tip: 1,261 tests / 91 files, validators, ledger, build
  (AT-3 still reported as a miss). After the fixes: 1,267 tests / 91 files, same gates.
- `node --import tsx scripts/hindcast/export-experience.ts --check`: hashes and harness results match.
- `node --import tsx scripts/evaluation/run.ts package`: exit 0, frozen files unchanged (`git status` clean).

## Earlier concerns

| Concern | Result | Evidence |
|---|---|---|
| Financial-to-policy handoff | Fixed | "Paste a policy" opens `?tab=lab&side=A&entry=policy#finance=…`; the Lab selects the exact `reported-allocation-apple-fy2025`. |
| Honest model labels | Fixed in the Lab header; one inconsistency fixed here | Lab: "app-built, illustrative". The policy panel still said "Base model: imported"; now names the app-built origin (test added). |
| Audited sources | Fixed | All non-zero FY2025 v2 values match SEC 10-K XBRL on exact period dates; Apple cites its 10-K. NVIDIA's older period is labelled in the selector. |
| MIT / citation | Present | MIT text and CITATION.cff exist. `package.json` has no `license` field; adding one changes a qualification-hashed source, so it is left for the next qualification refresh. |
| Provider errors | Fixed; ordering corrected here | Referrer refusal shows a plain message and manual draft works. A refused connection was classified as a provider refusal; incidental "429"/"refuse" text was misclassified (tests added). |
| Mobile | Usable | No page-level horizontal overflow at 390 px on Explore, Compare, History and the Lab policy panel. The company selector text truncates. |

## Live AI extraction on an authorized origin

The deployed key's allowed referrers include `http://localhost:4173/*` (read from the key's restrictions,
not changed). The candidate was built with that key and served on `http://localhost:4173` — an
authorized origin, no spoofing, no deployment. The key-bearing build was deleted afterwards.

At the reviewed tip, 4 of 4 live extractions of the release smoke text "Set the policy share to 20
percent." produced a draft that could not run:
- 3 runs: the extractor attached a per-year `timeAssumption` to a percent → share mapping, which the
  validator correctly refuses ("the value is per year, but share declares no time basis");
- 1 run: the extractor echoed the prompt's list format, target `parameter policy_share`, and the mapping
  was demoted.

Fixed in `services/policyExtract.ts`: the prompt says shares/percentages/ratios have no time basis and
targets are bare ids; the parser strips a kind word only when it matches the mapping's kind, and
removes an extractor-supplied time assumption on a share-to-share mapping with a visible evidence note
(a hand-entered one still fails validation). After the fix, 4 of 4 live runs mapped `policy_share = 20
percent` and ran; the risk sentence came back outside-model; the downloaded bundle reopened with all 180
values reproduced (largest deviation 0).

## Other exercises

Manual fallback on an unauthorized origin; invalid quotation refused (`quote-not-found`); conflicting
setters refused (0.2 vs 0.35); setting a reported observation fails the run on `pinned-observations`;
training fixture "20 million USD each year" mapped and ran; a pre-patch financial link is refused
("Incompatible runtime"). A regression test now covers refusal of a self-consistent pre-patch policy
bundle. A failed saved-experiment import no longer leaves a stale "versions match" notice.

## Historical evaluation

Recomputed independently: held-out wellbeing MAE 0.3175 ladder points versus 0.2897 for persistence
(worse), GDP 7.51 versus 8.65 pp (better). Protocol committed before fitting; train years 2015–2018 only;
frozen coefficients reproduce by OLS; the UI states the worse-than-persistence result first; the ledger
does not record it as a success. Nothing was refit or retargeted. "Preregistered" overstates an in-repo
commit 13 minutes before fitting; "registered in-repo before fitting" is accurate.

## Not verified here

Deployed candidate behaviour on a Cloud Run tag URL, merged-release CI, promotion/rollback, first-time
user observations, expert feedback, archive metadata and journal eligibility.
