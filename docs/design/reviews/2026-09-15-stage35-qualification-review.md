## Forensic Analysis: Task 5 at 05cbcd1

**Domain Lens:** Principal simulation engineer and quantitative methods reviewer. Read-only independent review; no repository code edits or delegated review. Scope: Task5 instructions/brief/report/diff, qualification/profile implementation, relevant engine dependencies, v3 sections4/6/9/10 and qualification-design addenda, model card and README. Root owns browser and active-result integration.

### Executive Summary

**Spec: changes required. Quality: changes required at the qualification boundary. Numerical evidence: passes for narrowly conditional source/allocation accounting at the frozen default month0–60 points.** The 383-case artifact independently reconciles under the explicitly hypothetical monetary/source definition; its arithmetic supports narrow acceptance, not empirical macro/wellbeing validation. Do not activate the qualification record until source freshness and browser identity issues below are resolved and tested.

### Claim Verification

| Claim | Verdict | Evidence/Reasoning |
|---|---|---|
| Complete final evidence | Verified | Independently streamed383 cases ×61months ×128countries and79corporations; exact compressed and ordered case hashes match. |
| Source/request/funding conservation | Verified | Separately recomputed every corporate source, availability, request, funded amount, reserved amount, slack and unfunded amount from case inputs. |
| Complete resident allocation | Verified | Independently recomputed all global/customer/HQ destinations and population weights, then checked all2,990,464 country receipts and monthly aggregate reconciliation. |
| Raw mapping/components and coverage | Verified computationally | Recomputed income regression, annual income denominator, transfer ratio/log response, assumed unemployment loss, raw index and population-weighted summary; checked8,945 invalid country rows and unavailable full-roster headlines. |
| Meaningful nudges and thresholds | Verified computationally | Actual heterogeneous contribution nudges, positive-from-zero comparison, exhaustion plateau and both sides of adoption/unemployment/raw bounds present and checked. |
| Actual input changes cannot inherit review | Verified within current exact-state mechanism | Memory-only accepted-record probe confirms acceptance for baseline and refusal after output, corporate money, workforce, imported flag or nonfinite mutation, and when equations supplied. |
| Qualification binds currently executing implementation | Flawed | Resolver only compares static bundled manifest hashes. Build/dev do not enforce current source freshness. |
| Exact Node baseline identities qualify genuine browser baseline | Flawed, root-observed | Root measured46/61 browser identities differing solely due tiny derived illustrative-output roundoff. |
| Scientific macro/wellbeing qualification | Not established, accurately limited | Macro conditions and wellbeing mappings remain illustrative; causal timing, induced demand and total welfare are unsupported. |

### Internal Consistency Issues

**P1 — Browser baseline identity includes platform-sensitive illustrative outputs.** `simulation/qualification.ts:22` hashes the entire run, including conditional wellbeing and summary floating-point outputs. Root independently compared Node and Chrome153: only15/61 identities match;165 numeric differences comprise80income,80raw,3transfer and2summary fields, maximum1.4210854715202004e-14. No actual input, macro, accounting or nonnumeric difference was found. At month0 HUN income is62.186777274656095 versus62.18677727465609. This prevents the intended default from consistently obtaining even a narrowly accounting badge. Fix by separating exact actual input/structural identity from derived illustrative values and checking derived outputs under explicitly fixed tolerances. Do not blanket-round actual authored input values or erase workforce/money/history distinctions. Preserve importedUnverified/equation refusal. Root evidence is reported as root evidence, not my independent browser test.

**P1 — Executing source is not enforced against the pinned manifest.** `simulation/qualification.ts:22,64` uses `structure.hash` loaded from JSON and compares it only with other bundled JSON values; `scripts/response-profile.ts:34` performs the real source check only when that script is invoked. `package.json:8` builds directly with Vite, and development similarly has no freshness gate. After acceptance, changing code without refreshing manifest leaves the old source identity in the resolver; any unchanged exact snapshot can still receive a badge against a stale implementation. This violates the stated strict source-change invalidation contract. Add mandatory source verification at build and an honest dev/runtime freshness mechanism; regression-test a source edit that leaves baseline numerics unchanged. Merely running the manual check once during review does not enforce future builds.

### Best Practices Violations

The two P1 issues above are trust/acceptance defects, not failed economic arithmetic. No critical arithmetic defect found. The generator streams cases, preserves omissions/failures and distinguishes independent review from generated checks appropriately.

The source manifest covers the actual conditional accounting implementation and direct dataset/workforce inputs. Its broader claim of dependency completeness should be narrowed or strengthened: `src/services/equationParser.ts` imports `mathParser.ts`, which is absent; `src/core/validate.ts` imports schemas absent from the manifest, and fixture data dependencies are omitted. Those omitted paths do not execute in the reviewed default conditional accounting path (uploaded equations are refused), so they do not invalidate the independently checked frozen arithmetic, but the manifest is not a transitive closure of everything it includes. The lockfile pins intended dependencies, not installed bytes; the report appropriately disclaims arbitrary-platform bitwise reproducibility.

### Independent checks and identities

Artifact: `/private/tmp/alignment-stage35/tmp/qualification/world-conditional-v1-profile.jsonl.gz`,504,339,476bytes.

- Compressed SHA256: `6983c38b06153d079d1dbd28118f4e4c714861cd84d68faf3ac7da884c52d50b`.
- Payload: `877296a7cada3c388589b5384f736bf585e36e7b4ba808b8905327a83c8c1f09`.
- Header: `dcf73208986c869ae213556b807cd1c5566197bb1634a9faccc4a1b9849631d5`.
- Structure: `79a17161eec810cc6959c830b24527209b8d06db443cb6018425ec5a5dd3a372`.
- Independent Python stream: `/private/tmp/independent-profile-review.py`; output `/private/tmp/independent-profile-review-output.json`. Pass:383cases,23,363monthly snapshots,2,990,464country rows,1,845,677corporation rows. All ordered case payload hashes equal the frozen manifest. Arithmetic tolerance2e-10relative/2e-9absolute; mapping validity uses exact retained JS raw at0/100 rather than misclassifying independent logarithm roundoff as a domain error.
- Independent baseline USA recurrence: `/private/tmp/selected-equation-review.py`. Derived adoption, GDP baseline/level, labor share, displaced pool and unemployment equations separately in Python; all60transitions pass1e-12relative/1e-9absolute checks.
- Generated `node --import tsx scripts/response-profile.ts --check` also passes,12.951seconds, zero missing/incomplete/altered/duplicated/failed/accounting/output failures. This is supplementary, not the independent evidence.
- `/private/tmp/alignment-stage35-qualification-probe.ts`: memory-only accepted-record positive path and adversarial refusals pass. No qualification file was modified. An initial ESM JSON import-attribute probe used a distinct module-cache instance and failed to override the resolver record; corrected probe imports through the same tsx path. No product defect inferred from that harness setup failure.

Selected independently checked results:

- Baseline source250.132625billion/month, funded25.74225625, unused224.39036875. Month0full-roster raw/value56.312219861882014, population7,443.352million, two assumed-GDP countries covering49.4988million.
- −1%/+1% relative contribution nudges fund25.4848336875/25.9996788125billion/month; month60raw index56.91986140050905/56.920661069960744. These are explicit scenario responses, not measured causal effects.
- Zero-rate comparison funds0. Setting every rate0.001 funds0.250132625billion/month; month0raw rises from56.267045396720874 to56.26745353013222. Near-zero control is connected.
- Funding below/at/above available produces124.9412461875/125.0663125/125.0663125funded, with0/0/0.1250663125unfunded. The2×request yields125.0663125unfunded. This is a genuine modeled finance plateau, not evidence about corporate profits.
- Mapping floor probes yield USA raw+1.623021717e-9,0,−1.623035928e-9; ceiling probes99.9999999937528,100,100.00000000624719. Raw values retained, validity changes correctly.
- Unemployment-cap neighbors raw0.599999/0.6/0.600001 and cognitive-cap neighbors0.899999/0.9/0.900001 cross as intended. Adoption exact-target fixture evaluates0.9990000000000002 due floating point; raw cap flag is correctly true under its literal >0.999 rule, a numerical-boundary detail rather than behavioral evidence.
- Full factorial cases, including81dose/population cases, were included in full arithmetic/allocation/mapping checks; their frequencies are not probability estimates.

### Unaddressed Failure Modes

Future code changes can retain stale bundled review authority unless source checking becomes mandatory. Exact hashing of derived floating outputs fails portable default identification. Neither problem is repaired by the currently pending record or by passing arithmetic tests; pending status only prevents premature current acceptance.

Strict exact-point review is otherwise appropriately conservative: changed inputs and imported snapshots are unreviewed, and no sampled-grid interpolation claim is made. Broader equations, parameter regions, full national accounts, firm ownership costs, demand responses, adaptation timing and total welfare remain outside this narrow acceptance. Raw country validity must continue to gate only the illustrative headline, not erase valid accounting.

### Recommendations

1. Fix exact input identity versus separately tolerance-checked outputs; verify all61genuine browser baseline points and reject real input changes.
2. Enforce source-manifest freshness in supported build/dev paths, with targeted stale-source regression.
3. Regenerate/rebind evidence if any hashed source changes; preserve this artifact's numerical acceptance as an audit of its exact version, not automatic acceptance of replacements.
4. After independent review of the final changed contract and root integration checks, a trusted local record may accept only the exact default month0–60conditional accounting points. Keep macro/wellbeing illustrative, timing/demand/net welfare unsupported. Do not mark broad empirical Stage3 qualification complete.

### Confidence Assessment

High confidence in the frozen artifact's conditional accounting, allocation and component arithmetic: independently recomputed all retained records with separate Python formulas. High confidence in the identified source-boundary flaw from code inspection, and browser flaw from root's exhaustive platform comparison. Software acceptance remains withheld pending the two P1 fixes and final integration evidence.
