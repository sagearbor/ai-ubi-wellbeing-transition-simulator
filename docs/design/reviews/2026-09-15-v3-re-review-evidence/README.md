# Evidence for the independent re-review of 436a16e

Reviewed 15 September 2026. These are reviewer-authored probes and actual logs, not implementation patches.

## Files

- `alignment-review-check-436a16e-unrestricted.log.txt`: complete configured check; 901 tests / 53 files, all validators, ledger check, build.
- `reviewer-original-probes.ts`, `review-original-436a16e.log.txt`: the previous review's counterexamples rerun.
- `reviewer-new-probes.ts`, `reviewer-new-probes-436a16e.log.txt`: solver acceptance, training invariants, policy units/coverage, zero transfers, reference horizon and US scenarios.
- `reviewer-integrity-probes.ts`, `reviewer-integrity-436a16e.log.txt`: ledger mutation, allocation preflight (no large allocation), Monte Carlo identity, independent matrix OLS and clustered uncertainty, governance transformation/threshold, dividend, import identity.
- `reviewer-ledger-full-probe.ts`, `reviewer-ledger-full-436a16e.log.txt`: the complete repository ledger CLI with one in-memory known-miss mutation. Fresh computation and normal discovery/checks retained. Exit 0; only stderr warning: the Markdown rendering is stale. No repository ledger file was edited.
- `reviewer-final-probes.ts`, `reviewer-final-436a16e.log.txt`: uploaded-equation regression, ledger mutation with the actual existing test source, exact dependency values, complete-source bundle reproduction and deliberate stored-result corruption.
- `reviewer-legacy-probe.ts`, `legacy-before-bb85a92.json.gz`, `legacy-after-436a16e.json.gz`, `legacy-comparison.txt`: full states from independently executed pre/post-migration checkouts; both models, months 0–120. Only the new dataset-ID field is excluded. The normalized JSON outputs match exactly.
- `reviewer-oracle.cjs`, `review-oracle-436a16e.log.txt`: checksum-gated extraction/execution of the authors' explorer kernel; 7,150 reference values compared.
- `review-migration-436a16e.log.txt`, `review-profile-436a16e.log.txt`, `review-hindcast-436a16e.log.txt`: rerun reports.

## Reproduce

Use an isolated checkout pinned to `436a16e0ea81c7744037c0e34813bcae925c2ffc`, with its locked dependencies installed. Reviewer source files are stored with an extra `.txt` suffix so they are not compiled as application code. Copy them into the isolated checkout root and remove that final `.txt` suffix so their relative imports resolve. Then run, from that checkout:

```sh
node --import tsx reviewer-original-probes.ts
node --import tsx reviewer-new-probes.ts
node --import tsx reviewer-integrity-probes.ts
node --import tsx reviewer-final-probes.ts
node --import tsx reviewer-ledger-full-probe.ts --check
node --import tsx reviewer-legacy-probe.ts /private/tmp/legacy-after-436a16e.json
```

The legacy probe must also run in a separate checkout at `bb85a92`. Compare parsed JSON recursively, or compare the normalized output bytes. The governance OLS calculation uses mathjs matrix operations, not the repository's anchor-fitting helper.

The authors' source is deliberately not included. The oracle adapter accepts a local source path as its first argument. At review time the source was available at:

[Authors' explorer JavaScript](https://www.anthropic.com/_next/static/chunks/2bnydcp8p6u_h.js)

Required SHA-256: `a95300ab26134e7f4133d302aa220a987b95fb1e02788f37a6b6aff402ab506e`. The adapter rejects a different source; do not silently update the checksum if the site changes.

The memory-limit probe calls preflight only. It intentionally does not execute the 625-million-cell draw.

The numerical outputs demonstrate implementation behavior on these inputs. They do not prove empirical correctness of any economic model.

