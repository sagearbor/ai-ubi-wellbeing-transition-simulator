# Wellbeing Transition Simulator: Core Physics & Logic

## 1. Core Economic Philosophy

The simulation models the tension between **Say's Law** ("Supply creates its own demand") and **Demand-Side constraints**.

- **The AI Supply Shock:** AI adoption creates massive efficiency gains (Supply), modeled as `Surplus`.
- **The Demand Bottleneck:** In a labor-based economy, as AI replaces labor, wages (Demand) fall. Without intervention, massive Supply meets crashing Demand, leading to a "Crisis of Underconsumption."
- **The Solution:** UBI (Universal Basic Income) is treated not as welfare, but as a mechanism to unlock the trapped Supply by restoring Demand.

## 2. The Equations

### A. Surplus Generation

Productivity scales exponentially with AI adoption.

```javascript
Efficiency = 1 + (Adoption^2 * 12)
RawSurplus = GDP_Per_Capita * Population * (Efficiency - 1)
```

*Note: We only tax the "Efficiency Gain" (Surplus), not the base GDP, to prevent taxing the pre-existing economy to death.*

### B. The "Ghost" Baseline (Shadow State)

To prove the value of intervention, we simultaneously run a hidden simulation of a "Do Nothing" world.

- **Logic:** Without UBI/Incentives, AI adoption is slower (lack of capital), and wages collapse without a safety net.
- **Formula:**
  
  ```javascript
  ShadowWage = GDP * (1 - ShadowAdoption * 0.9)
  ShadowWellbeing = Demand / (Demand + Subsistence)
  ```
  
- This acts as the "Control Group" (dashed line on charts).

### C. Wellbeing Physics (Michaelis-Menten Curve)

We map Income ($) to Wellbeing (0-100) using a saturation curve common in biology. Money yields diminishing returns.

```javascript
r = Demand / (Demand + Subsistence_Adjusted)
Wellbeing = r * 100
```

- **Subsistence Floor:** If `Demand < $800`, the score is penalized by 70% (The "North Korea Fix"). This prevents poor populations from appearing "happy" just because they are equally poor.

## 3. Political Dynamics & New Variables

### A. Governance (Democracy Index)

- **Range:** 0.0 (Authoritarian) to 1.0 (Full Democracy).
- **Impact:**
  1. **Adoption Speed:** Autocracies adopt faster initially (less red tape), but democracies sustain higher efficiency (less brain drain).
  2. **Anxiety Dampener:** High governance reduces the "Future Shock" anxiety penalty applied to wellbeing during rapid transitions.

### B. Corruption & The "Direct-to-Wallet" Bypass

- **The Leakage Problem:** In legacy systems, tax money sent to local governments is eaten by corruption (`graft`).
- **The Innovation:** Global Redistribution acts as a "Blockchain Bypass."
  - **Local Tax:** `RemainingTax * Corruption_Rate` is lost.
  - **Global Tax:** 100% arrives in the citizen's digital wallet, bypassing the local state.
- **Result:** High corruption nations *require* global intervention to save their populations, as domestic UBI fails.

### C. Inequality (Gini Coefficient)

- **Range:** 0.2 (Egalitarian) to 0.6+ (Highly Unequal).
- **The Inequality Damper:** We simulate the "Marginal Propensity to Consume" (MPC). $1M distributed to 1 person generates less economic velocity than $1k distributed to 1000 people.
- **Formula:** `EffectiveDemand = Income * (1 - Gini * 0.3)`
- High inequality reduces the "Realized Utility" of the nation's GDP.

## 4. Scenario Engine Data Structure

The state is initialized via `constants.ts` using the `CountryStats` interface:

```typescript
interface CountryStats {
  id: string;
  // Economic Base
  gdpPerCapita: number;
  population: number;

  // Socio-Political DNA
  gini: number;          // Inequality Damper
  governance: number;    // Resilience Modifier
  corruption: number;    // Leakage Coefficient
  socialResilience: number; // Anxiety Buffer
}
```

## 5. Summary of Key Mechanisms

1. **Graft Leakage:** `Tax * Corruption` = Money that vanishes from the simulation (stolen).
2. **Domestic vs Global Split:** Controlled by the `Global Redistribution Rate` slider.
  - 0% = Isolationism (Rich stay rich, corrupt stay poor).
  - 100% = Total Globalism (Perfect redistribution, local corruption bypassed).
3. **Local Resilience:** Determines how much the population panics (Wellbeing penalty) as AI Adoption moves from 10% to 50%.
