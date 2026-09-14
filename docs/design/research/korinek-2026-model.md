# Korinek et al. (2026): the faithful port

Model: `data/core/korinek-2026-faithful.json`. Overlays: `data/core/overlays/korinek-faithful-{modest,extreme,pegged-rental,rigid-wage}.json`.
Checks: `src/core/korinekFaithful.test.ts` and the model's in-file `tests`. Oracle data: `data/core/korinek-2026-faithful.expected.json`.

This is a port of the model itself, written from the paper's equations. The reduced-form endpoint fit
`data/core/korinek-2026.json` stays in place beside it and is not changed.

## Sources

| Tag | What | Where | Identity |
|---|---|---|---|
| **WP** | Korinek, Jones, Sacher, Cotter & McCrory, "Economic Scenarios for Transformative AI", The Anthropic Institute Working Paper No. 2026-02, September 2026, 57 pp. | https://www-cdn.anthropic.com/files/4zrzovbb/website/cf58f84d46a4a76bf5a5b039ac695fba6b80041c.pdf | sha256 `9fe6667ec24b8a1dce3cde7c8ae5d5e6631bb95f68dae82dbd827cbfa2410327`, fetched 2026-09-13 |
| **Explorer** | The authors' scenario explorer, model chunk | https://www.anthropic.com/_next/static/chunks/2bnydcp8p6u_h.js (page https://www.anthropic.com/institute/econ-scenarios) | sha256 `a95300ab26134e7f4133d302aa220a987b95fb1e02788f37a6b6aff402ab506e`, fetched 2026-09-13. Banner: scenario_explorer @ d113601e (2026-08-26), note V0.97. No licence stated. |

**How the explorer was used.** No code from it is in this repository, and this document contains none.
It was used in three ways only:

1. As the source of four unrounded calibration numbers that Table 1 prints rounded. Each is labelled
   in its parameter's `source.note`.
2. As a black-box oracle. It was run headless to produce the numbers in `korinek-2026-faithful.expected.json`.
3. To settle three points the paper leaves implicit. They are listed under "Readings" below.

Every equation in the model file was written from WP.

## What the model is

Everything is measured as a log gap from the no-AI path at the same date, with the labour force
normalised to L = 1. The model runs monthly from t0 = 2024.0 to 2030.0, which is 73 steps. 2030.0 is
the date that the scenario values and Table 3 refer to. The paper's figures run 2025 to 2030, so the
paths do not go further.

Each month the model does five things, in the order of Appendix A:

1. **Paths.** Evaluate the scenario paths m, d and a at t and at t+1.
2. **Full-employment economy.** Solve the Proposition 1 economy: the rental gap, the labour share, the
   wage, output per worker, capital, measured TFP, and the two employment targets.
3. **Cognitive wage and demand.** Compare employment with next month's targets. Get the clearing
   cognitive wage from system (39) at the attached force. Move the sticky wage (eq 30). Get cognitive
   demand at that wage from (39).
4. **Labour flows.** Compute quits, layoffs, openings, effective search, hires and finding rates, then
   update the employment and pool stocks.
5. **Reporting and ideas.** Report the actual economy (39) at realised employment. Set the research
   uplift to the GDP gap and step the ideas stock.

## Equation mapping (paper → model variable)

Page numbers are WP's printed page numbers. "Unknown" means the variable is a `solves` block unknown.

| Paper | Equation | Model variable(s) |
|---|---|---|
| (8), (8′) fn 11 p.26 | m_t = m̄/(1+e^{−κ_m(t−t_m)}), κ_m = (1/3.5) ln[((m̄−m₂₆)/m₂₆)(m₃₀/(m̄−m₃₀))]; same for d; a_t = a₀ + g_a(t−t₀) | `kappaM`, `tM`, `m`, `kappaD`, `tD`, `d`, `a0`, `a`; t+1: `mNext`, `dNext`, `aNext` |
| Table 1 note | m̄ = s_C/s_L, d̄ = 1 | `mBar` (= `wC`), `dBar` |
| (14) | s_L,t = 1 − B_t e^{(1−σ)Δln r}, B_t = s_K + s_L ψ m d (e^{−(1−σ)a} − ρ) | `Bt`, `costFactor`, `sLPot` = 1 − `kPot` |
| (15) | ℓ̃_N = −ln(1 − m d [1 − ρψ − (1−ψ)e^{−(1−σ)a}]) | `netTaskLoss`, `lNtilde`; t+1 `lNtildeNext` |
| (16), (5), Table A.1 B | Δln w = (Δln s_L + ℓ̃_N)/(1−σ) + Δln A; Δln(Y/L) = Δln w − Δln s_L | `lnSLPot`, `lnWPot`, `lnYLPot` |
| (17) | Δln K = ln((1−s_L)/s_K) + Δln(Y/L) − Δln r | `lnKPot` |
| (18), (6) | ε Δln r = Δln K, unique root, 0 at ε = ∞ | solve `capital-market-potential`, unknown `kPot`; `xPot` |
| (45) | Δln TFP = −(1/(1−σ)) ln[s_K + s_L(1 − m d(1−e^{−(1−σ)a})) e^{−(1−σ)Δln A}] | `lnTFP` |
| (13), Table A.1 B | ℓ*_N = ℓ_N,t0 e^{ℓ̃_N}; ℓ*_C = ℓ_C,t0 + ℓ_N,t0 − ℓ*_N | `tgtN`, `tgtC`, `tgtNNext`, `tgtCNext` |
| Table A.2 B | ℓ_o,t0 = (s_o/s_L)(L − Ū) | `ellC0`, `ellN0`; `sN0` = s_N,t0 |
| (38), p.21 | H̄_o = q̄_o ℓ_o,t0 = f̄_o Ū_o; f̄_o = Σ_j μ̄_oj H̄_j/S̄_j; Ū_C + Ū_N = Ū | `qBarC`, `qBarN`, `HBarC`, `HBarN`, solve `steady-state-pool-split` (unknown `poolShareC`), `UBarC`, `UBarN`, `SBarC`, `SBarN`, `fBarC`, `fBarN` |
| (38), p.21 | π̄_o = χ[1 − (H̄_o/(χS̄_o))^ι]^{1/ι}; (ℓ_C π̄_C + ℓ_N π̄_N)/(L−Ū) = 0.65; χ ≤ 1 (p.20) | `hirePerSearchC/N/Max`, solve `steady-state-matching-efficiency` (unknown `chiScaledInv`), `chiUncapped`, `chi`, `piBarC`, `piBarN` |
| Section 3.2, Table A.2 D | q̄ = 0.11/yr; q^T/q̄ = 0.06/0.11; group relatives from the E→U hazards | `sepMean`, `qXC`, `qTC`, `qXN`, `qTN` |
| (27), App. A | q_o,t = q^X + q^T f_o,t−1/f̄_o, entered as −ln(1 − q̂) | `fRatioC`, `fRatioN` (history 1), `qC`, `qN` |
| (28) | G_o = max{0, ln ℓ_o − ln ℓ*_o,t+1}; B_o = max{0, ln ℓ*_o,t+1 − ln ℓ_o} | `overhangC`, `shortfallC`, `overhangN`, `shortfallN` |
| (29) | N_C = ℓ_C + max{0, U_C − Ū_C} | `attachedC` |
| (39) at (N_C, ℓ_N) | clearing wage w^c_C | `shiftN`, `clrShiftC`, `clrX`, solve `clearing-wage` (unknown `kClr`), `clrU`, `lnWCClear` |
| (30) | ln(w_C/w) = ξ^{1/12} ln(w_C,t−1/w_t−1) + (1 − ξ^{1/12}) ln(w^c_C/w) | `wageGap` (history 0), `lnWC` |
| (39) solved for ℓ_C at w_C | ℓ^d_C; E = max{0, ℓ_C − ℓ^d_C}; Z = max{0, ℓ^d_C − ℓ_C} | `demF`, solve `demand-at-sticky-wage` (unknown `zDem`), `demU`, `demandC`, `excessC`, `unmetC` |
| (31) | D_C = max{0, E − q_C ℓ_C}; D_N ≡ 0 | `layoffsC` |
| (32) | v_C = [max{0, q_C ℓ_C − E} + θ^H Z]/π̄_C; v_N = (q_N + θ^H B_N)ℓ_N/π̄_N | `openingsC`, `openingsN` |
| (33) | S_C = U_C + μU_N; S_N = μU_C + U_N | `searchC`, `searchN` |
| (34) | H_j = χ S_j v_j/(S_j^ι + v_j^ι)^{1/ι} | `hiresC`, `hiresN` |
| (35) | f_C = H_C/S_C + μH_N/S_N; f_N = μH_C/S_C + H_N/S_N | `fC`, `fN` |
| (36) | ℓ_o,t+1 = (1 − q_o)ℓ_o − D_o + H_o | stocks `ellC`, `ellN` |
| (37) | U_o,t+1 = U_o + q_o ℓ_o + D_o − f_o U_o | stocks `poolGapC`, `poolGapN` (= U_o − Ū_o); `UC`, `UN` |
| (39) at (ℓ_C, ℓ_N), Table A.1 D | GDP, w_N, r, K, s_L of the actual economy | `actShiftC`, `actX`, solve `actual-economy` (unknown `kAct`), `actU`, `lnGDPGap`, `xAct`, `lnK`, `laborShare`, `lnWN`, `lnMPLC` |
| Table A.1 D | average wage, u^x, X_t, G_t, ℓ̃_C | `lnWavg`, `excessUnemployment`, `reallocation`, `aggOverhang`, `cogShift` |
| (22) | Δln R = Δln Y | `lnResearchGap` |
| (40), (42) | 1−φ_R = s_L(1−φ) + λ; Δg = g[e^{λΔln R − (1−φ_R)Δln A} − 1]; Δln A_t+1 = Δln A_t + hΔg | `oneMinusPhiR`, `g`, `growthGap`, stock `dlnA` |
| Table 3 rows | reporting definitions (see "Readings") | `gdpGapPct`, `gdpIndex`, `gdpGrowthPct`, `avgWagePct`, `cogWagePct`, `otherWagePct`, `netReturnPct`, `capitalPct`, `laborSharePct`, `capitalSharePct`, `laborIncomePct`, `cogWageBillPct`, `capitalIncomePct`, `cogEmpSinceMid2026Pct` (base `ellCMid2026`), `uCogPct`, `uAllPct`, `tfpPct`, `tfpGrowthPct`, `ideasPct`, `ideasGrowthPct` |

The paper gives first-order rows next to the exact ones: (9)–(12), (19), (26) and (44). The simulation
uses only the exact rows (p.41), and so does this port. The first-order rows appear only in a
small-shock test.

### How system (39) becomes one unknown

System (39) has three rows: a price-index row, the two demand rows, and a capital row. Wages are
deflated by A_t, so ŵ = Δln w − Δln A.

**At a given employment (ℓ_C, ℓ_N):**

1. Each demand row gives Δln w_o = u/σ + shift_o, where u = Δln Y − (1−σ)Δln A. The shifts are
   - shift_C = [ln(Λ_C/(s_C/s_L)) − ln(ℓ_C/ℓ_C,t0)]/σ
   - shift_N = −ln(ℓ_N/ℓ_N,t0)/σ
2. Substituting these into the price-index row gives e^{(1−σ)u/σ} X = 1 − k, where
   - k = B_t e^{(1−σ)Δln r} is the capital share
   - X = s_L Λ_C e^{(1−σ)(shift_C − Δln A)} + s_N e^{(1−σ)(shift_N − Δln A)}
3. The one remaining unknown is k. The residual is Δln r − Δln K/ε, with
   - Δln r = ln(k/B)/(1−σ)
   - Δln K = ln(k/s_K) + Δln Y − Δln r

**At a given cognitive wage** (the demand at the sticky wage), the same rows give:

- Δln w_N = Δln A + ln((1 − F − k)/s_N)/(1−σ), where F = s_L Λ_C e^{(1−σ)(Δln w_C − Δln A)}
- ℓ^d_C from the C demand row

The unknown is z = k/(1−F).

The two elimination steps are algebra on WP's rows. The test "the actual economy (39) evaluated at the
targets is Proposition 1" checks them: at every month, and in two scenarios, the three reported
quantities agree with Proposition 1 to 1e-10.

## Parameters and provenance

Every value comes from WP unless it is marked *explorer*. All explorer values are labelled `calibrated`
in the file, with the note "unrounded value from the authors' explorer code".

| Id | Value | Paper | Kind | Source |
|---|---|---|---|---|
| `sigma` | 0.5 | 0.5 | calibrated | Table 1 A, p.23 |
| `sL` | 0.6 | 0.60 | calibrated | Table 1 A ("conventional value") |
| `wC` | 0.6235251662 | 0.624 | calibrated, *explorer* | Table 1 A (CPS 2025); unrounded = 101,942/163,493 |
| `invEps` | 1/3 | ε = 3 | calibrated | Table 1 A; entered as 1/ε |
| `rBar`, `delta` | 0.115, 0.05 | same | calibrated | Table 1 A (reporting only) |
| `t0`, `tAnchor`, `tRead`, `h` | 2024, 2026.5, 2030, 1/12 | same | assumed | Table 1 A; fn 11 ("three and a half years") |
| `lambda` | 1 | 1 | assumed | Table 1 A ("no duplication") |
| `oneMinusPhi` | 3.1 | 3.1 | calibrated | Table 1 A (Bloom et al. 2020); 1−φ_R = 2.86 by (40) |
| `gA`, `n` | 0.01, 0.0033 | same | calibrated | Table 1 A |
| `mMid2026`, `dMid2026` | 0.14, 0.10 | same | calibrated | Table 1 B |
| `dBar` | 1 | 1 | assumed | Table 1 B |
| `m2030`, `d2030`, `aMid2026`, `ga` | 0.3, 0.4, 0.35, 0.028 (Substantial) | same | assumed | Table 1 B (scenario assumptions) |
| `psi`, `rho`, `mu`, `thetaH` | 0.75, 0.25, 0.08, 0.25 (Substantial) | same | assumed | Table 1 C (scenario assumptions) |
| `xi` | 0.5 | 0.50 | calibrated | Table 1 C (Section 3.4) |
| `Ubar` | 0.0384065685 | 0.038 (3.84 in text, p.26) | calibrated, *explorer* | Table 1 D (CPS 2025); unrounded = 6,530/170,023 |
| `qBarAnnual` | 0.11 | 0.11 | calibrated | Table A.2 D; Section 3.2 |
| `qTshare` | 0.06/0.11 | 0.55 | calibrated | Table A.2 D ("0.06 ... occupational moves and 0.05 for exits"); the explorer uses the same value |
| `sepHazardC`, `sepHazardN` | 0.0083586, 0.0183791 | 0.84 %, 1.84 % (ratio 0.69 / 1.52) | calibrated, *explorer* | Section 3.2 (IPUMS-CPS 2010–19); only the ratio enters |
| `muBar` | 0.17 | 0.17 | calibrated | Table 1 D; Section 3.2 |
| `iota` | 1.27 | 1.27 | calibrated | Table 1 D (den Haan et al. 2000) |
| `piBarMean` | 0.65 | 0.65 | calibrated | Table 1 D; fn 9 |

The two scenario overlays change only the Table 1 B and C scenario values:

| Scenario | m₃₀ | d₃₀ | a (mid-2026) | g_a | ψ | ρ | μ | θ^H |
|---|---|---|---|---|---|---|---|---|
| Modest | 0.2 | 0.2 | 0.30 | 0 | 0.50 | 0.50 | 0.17 | 0.10 |
| Extreme | 0.5 | 0.6 | 0.45 | 0.10 | 0.90 | 0 | 0.04 | 0.50 |

**Why unrounded values are used.** With Table 1's rounded inputs, Substantial all-worker unemployment
comes out at 4.53, which prints as 4.5. The paper prints 4.6. A test pins this.

## Departures from the paper and authoring workarounds

None of these changes the mathematics. The oracle agreement below, about 1e-11, confirms that.

1. **Capital-share unknowns.** The four capital-market roots are solved for the capital share k on
   (0, 1), not for Δln r. The Δln r form takes ln(1 − B e^{(1−σ)x}), which is NaN for large x. The
   engine rejects non-finite residuals at the bracket ends, and mathjs `log` of a negative number
   returns a Complex. With k as the unknown, every log is finite across the bracket, and the bracket is
   a structural interval rather than a chosen bound.
2. **ε = ∞ is `invEps = 0`.** The expression language has no infinity and no `if`. The residual is
   Δln r − invEps·Δln K, so a pegged rental rate gives Δln r = 0 exactly. That is up to about 1e-14 of
   bisection noise, which is tested.
3. **Solve residuals are written inline.** A residual cannot use a helper variable that depends on its
   own unknown. Only the parts that depend on the unknown are inline; everything else is an ordinary
   variable.
4. **Pools are deviation stocks.** The stock is U_o − Ū_o, with `initial: 0`. The engine does not add
   the symbols in a stock's `initial` expression to the dependency graph (`src/core/engine.ts`,
   `compileModel`). An `initial` that reads the steady-state solve could therefore be evaluated before
   the solve and come out NaN. Employment stocks start from a parameter-only expression, which is safe.
5. **The lagged finding rate enters as f/f̄.** `history` must be a numeric literal, so the port lags the
   ratio f_o/f̄_o, with history 1 (f_o,t0−1 = f̄_o).
6. **The steady state is re-solved every month.** It depends only on parameters, so every month gives
   the same value, and that value is the t0 steady state.
7. **Pre-sample history for 12-month growth rows.** Zero gaps are assumed before 2024. This affects only
   growth rows dated before 2025.0, which the paper does not report.
8. **"Since mid-2026" base.** `ellCMid2026` records ℓ_C at the step where year = 2026.5. It uses
   max(0, 1 − 24|year − 2026.5|), which is 1 at 2026.5 and 0 at every other month. The value is
   meaningful only from mid-2026.
9. **χ ≤ 1** is applied as `min(1, chiUncapped)`, following p.20. It does not bind: χ = 0.757.
10. **ψ_t is a parameter.** Table A.2 defines ψ_t as a logistic, but every scenario holds it constant.
11. **Not supported.**
    - σ = 1: the equations divide by 1 − σ.
    - Settings where the demand at the sticky wage is infeasible (F ≥ 1): the engine reports
      `solve-no-root`, where the explorer silently keeps ℓ_C.
    - Neither case occurs at any published or stored setting.
12. **Explorer-only features are omitted:**
    - a ceiling of ln 30 and a floor of 0 on a_t;
    - a cap of 3 on κ;
    - alternative calibrations;
    - the first-order level toggle.

    None of these binds at any stored setting. The oracle script checked this per setting, and the
    counts are stored in the expected file.

No engine change was made.

The frictions above would each be smaller with one of two small engine changes:

- dependency-tracking a stock's `initial` expression;
- letting a solve residual re-evaluate the variables downstream of its unknown.

Neither is required.

## Readings where the paper is implicit (resolved by consulting the explorer, then verified)

1. **Wages deflated by A in (39).** Table A.1 says "wages deflated by A_t" but does not write out the A
   terms. The port puts e^{(1−σ)(Δln w_o − Δln A)} in the price-index row. It uses Δln Y − Δln A in the
   demand rows and the undeflated Δln Y in the capital row. This is the explorer's reading, and the
   Proposition 1 identity test confirms it.
2. **Rate conversion.** The continuous-rate conversion q = −ln(1 − q̂) is applied to the whole quit
   fraction q^X + q^T f_t−1/f̄. The steady-state q̄_o uses the same conversion, and so do H̄_o = q̄_o ℓ_o,t0
   and the stock updates.
3. **Table 3 reporting definitions:**
   - GDP, labour share, wages, return and capital are the actual economy (39) at realised employment,
     not the Proposition 1 potential.
   - Cognitive unemployment is U_C/(ℓ_C + U_C). All-worker unemployment is U_C + U_N.
   - Labour income is (w_C ℓ_C + w_N ℓ_N)/(ℓ_C,t0 + ℓ_N,t0) − 1.
   - Capital income is e^{Δln r + Δln K} − 1.
   - Growth rates are 12-month log changes plus the no-AI growth rate: g + n for GDP, g_A for TFP, g for
     ideas.
   - The GDP index is 100·e^{(g+n)(t−t0) + Δln Y}.

   Every one of these reproduces Table 3.

## Checks and results

All checks were run on 2026-09-13 with `npx vitest run src/core` (267 tests pass),
`npm run validate:core` (OK) and `npm run typecheck` (clean).

### Published numbers (tolerance: half the printed digit plus 10 percent, 0.055 for one decimal)

| Check | Cells | Result | Max abs error |
|---|---|---|---|
| Table 3, Modest / Substantial / Extreme, all 20 rows (p.31) | 60 | all reproduce | 0.049 |
| Table 3, No-AI column as a limiting case | 20 | all reproduce | 0.049 (u_C 2.851 vs 2.9) |
| Table 5, ε ∈ {1, 3, 6, ∞} × two scenarios × 5 rows (p.37) | 40 | all reproduce | 0.049 |
| Table 6, ξ columns × 7 rows (p.38) | 49 | all reproduce | 0.049 |
| Footnote 14: GDP +7.2; labour income −4.3 % of no-AI GDP | 2 | 7.214; −4.309 | 0.014 |
| Section 2.1.3: rental +4.6 %, wage +1.9 %, exact level TFP 0.029 | 3 | 4.623; 1.874; 0.0291 | 0.026 |
| Sections 2.2, 4.2–4.3: Extreme Δln R 0.28, ideas +0.6 %, long-run +10 %, GDP +40 % vs mid-2026, 9 % transfer; Substantial N employment +4.6 % | 6 | 0.281; 0.607; 9.8; 40.3; 8.8; 4.596 | within printed rounding |
| Section 2.3.2: Ū_C 1.76, Ū_N 2.08, π̄ 0.66/0.64, χ 0.76, f̄ 0.23, q̄ 0.63/1.40 %, u 2.9/5.4 %, switching share 1/7 | 12 | 1.7593; 2.0814; 0.659/0.635; 0.757; 0.231; 0.634/1.399; 2.85/5.44; 0.1436 | within printed rounding |
| Table A.2: κ_m, κ_d, a₂₀₃₀ for three scenarios | 9 | all reproduce | — |
| Appendix A: ideas recursion within 0.02 pp of closed form (43), Extreme 2030 | 1 | 0.6048 vs 0.6244 (trapezoid on the monthly grid), gap 0.0196 pp | — |
| Rounded Table 1 inputs miss a printed digit (Substantial u_all 4.53) | 1 | confirmed | — |

### Identities, every month (modest, substantial, extreme, and extreme at ε = 1, ξ = 0.9)

| Identity | Result |
|---|---|
| ℓ_C + ℓ_N + U_C + U_N = 1 | < 1e-12 |
| Σ f_o U_o = Σ H_j | < 1e-14 |
| H_j ≤ χ·min(S_j, v_j) and f_o ≤ 1 | holds |
| s_L + s_K = 1 | holds |
| Wage identity (5) | < 1e-13 |
| Capital rows (18) and (39) | < 1e-10 |
| Marginal-product income shares equal 1 − k | < 1e-9 |
| G_N = 0 | holds |
| B_C negligible on the scenario paths | at most 0.0011 |
| (39) at the targets equals Proposition 1 (Substantial and Extreme) | < 1e-10 |

### Limiting cases

| Case | Result |
|---|---|
| No AI | Every gap stays below 1e-5 %; u = Ū and ℓ_C = ℓ_C,t0 to 1e-9; no layoffs |
| ε = ∞ | Δln r stays within 1e-13 of 0 in both economies; net return 6.5; wage = level channel + Δln A to 1e-12 |
| ξ = 0 | Zero layoffs every month; w_C = w^c_C |
| ξ = 0.5, Extreme | Layoffs do occur |
| ξ = 1 | w_C = w every month |
| ψ = 0 | B = s_K; s_L = 1 − s_K e^{(1−σ)x} |
| Small shocks | The exact ℓ̃_N and Δln r converge to the first-order rows (19) and (11): the relative error shrinks with the shock and is < 1e-3 at scale 1e-4 |
| θ^H = 1 vs 0.1 | Peak unemployment is lower with faster posting |

### Oracle paths

`korinek-2026-faithful.expected.json` holds 26 series, stored every 3 months from 2024.0 to 2030.0, at
11 settings:

- the three presets;
- Substantial at ε = 1;
- Extreme at ε = ∞;
- Extreme at ξ = 0;
- Substantial at ξ = 0.9;
- Substantial at σ = 0.3;
- Substantial at μ = 0.02 with θ^H = 1;
- Substantial at ρ = 1 with ψ = 0.2;
- footnote 14.

Every stored value agrees with the port to about 1e-11 (percent series) and 1e-13 (levels). The tests
use tolerances of 1e-8 and 1e-10. This verifies the transcription against the authors' own
implementation; it is not independent of them. The published tables are the independent check.

### Not reproduced or not checkable

- **Footnote 14, "a transfer equal to 84 percent of GDP gains".** The paper does not define the
  transfer. Holding the cognitive wage bill at its no-AI level costs s_C,t0 × (the fall in the cognitive
  wage bill); at the footnote-14 setting that is 0.374 × 16.8 % of no-AI GDP against a GDP gain of
  7.2 %, which is about 87 %, not 84 %. The same construction gives the Extreme "about 9 percent of
  GDP" (8.8), which is tested. The footnote's 84 is therefore not reproduced and has no test.
- **Section 4.2, "cognitive workers rises from 2.9 percent in mid-2026".** The model's mid-2026 rate on
  the Substantial path is 3.06. 2.9 is the normal level, so the text is probably loose. No test.
- **Table 4.** It reports medians of outcomes across 3,259 survey respondents, which needs the microdata.
- **Figures 2–4.** They print only the January 2030 values, which Table 3 already covers.

## Run time

One full run (73 months, 6 bisections a month) takes about 60 ms in Node on the development machine.

- **Opening the model in the Lab** runs the model about three times (baseline, overlays, tests), about
  0.2 s.
- **The Lab's Uncertainty toggle** runs 200 Monte Carlo runs, about 12 s of blocking work. No parameter
  in this file declares a `range`, so every one of those runs is identical. Either skip Monte Carlo
  when nothing is ranged, or add ranges to the scenario assumptions.
