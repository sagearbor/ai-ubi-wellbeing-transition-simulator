
import { GoogleGenAI } from "@google/genai";
import { ModelParameters } from "../types";

// Lazy initialization to avoid crashing app when API key is not set
let ai: GoogleGenAI | null = null;
const getAI = () => {
  if (!ai) {
    const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("No Gemini API key configured. Set GEMINI_API_KEY in your environment.");
    }
    ai = new GoogleGenAI({ apiKey });
  }
  return ai;
};

// Helper to downsample history to ~30 points to fit context window while keeping full range
const downsampleHistory = (history: any[]) => {
  if (history.length <= 30) return history;
  const step = Math.ceil(history.length / 30);
  return history.filter((_, i) => i % step === 0 || i === history.length - 1);
};

export const getRedTeamAnalysis = async (model: ModelParameters, results: any[]) => {
  const sampledResults = downsampleHistory(results);
  const prompt = `
    You are a hostile "Red Team" economist tasked with finding fatal flaws in this AI-Economic Transition Model.

    **CRITICAL CONTEXT - How This Economic Model Works:**
    This simulates a global UBI system funded by taxing AI-adopting corporations. The economic model has these key dynamics:

    1. **Wealth Redistribution Direction:** High-GDP countries (US, Germany, Japan) are NET FUNDERS - their corporations contribute more tax revenue than their citizens receive in UBI. Low-GDP countries (Nigeria, Bangladesh) are NET RECEIVERS - they receive more in UBI than they contribute. This is progressive wealth redistribution from rich to poor nations.

    2. **Governance & Corruption:** Countries have varying governance quality. Poor governance means UBI funds leak to corruption UNLESS direct-to-wallet technology (blockchain/digital wallets) is enabled, which bypasses corrupt institutions.

    3. **Job Displacement vs UBI Coverage:** As AI adoption grows, workers lose jobs. The "displacement gap" is the number of displaced workers NOT receiving adequate UBI coverage. High gaps indicate crisis conditions.

    4. **Counterfactual Baseline:** The simulation tracks a parallel "shadow" timeline showing what happens WITHOUT the UBI intervention. Compare actual vs counterfactual outcomes to measure true impact.

    5. **Inequality Dampening:** Within countries, high income inequality (Gini coefficient) means UBI has less impact on average wellbeing because the wealth gap absorbs the benefits.

    Model Parameters:
    - Name: ${model.name}
    - Corporate Tax Rate: ${model.corporateTaxRate * 100}% (higher = more UBI funding but may slow AI adoption)
    - Adoption Incentive: ${model.adoptionIncentive * 100}% (subsidy to encourage corporate AI adoption)
    - Base UBI: $${model.baseUBI}/month (baseline payment, adjusted by GDP and global redistribution rate)
    - GDP Scaling: ${model.gdpScaling} (0=Equal UBI for all countries, 1=UBI proportional to GDP, higher values reduce redistribution)
    - Global Redistribution: ${model.globalRedistributionRate * 100}% (higher = more funds flow from rich to poor countries)
    - Direct-to-Wallet: ${model.directToWalletEnabled ? 'Enabled (bypasses corruption)' : 'Disabled (corruption leaks funds)'}
    - Displacement Rate: ${model.displacementRate * 100}% (% of labor income lost at full AI adoption)

    Simulation Data (Sampled from full timeline of ${results.length} months):
    ${JSON.stringify(sampledResults)}

    Output a structured critique:
    1. **Critical Failure Points:** Identify 3 structural weaknesses (e.g., hyper-inflation, mass unemployment without UBI coverage, perverse incentives, funding collapse). Be specific about which countries or economic classes are failing and WHY.

    2. **Civil Unrest Probability:** Estimate % chance of revolution in wealthy vs developing nations. Consider displacement gaps, economic disparity, and governance quality.

    3. **Exploitation Risks:** Are any actors gaming the system? Are rich countries bearing unsustainable burden? Are poor countries trapped in dependency?

    4. **Structural Recommendations:** Suggest deep changes to the core philosophy, equations, or policy mechanisms. Challenge the fundamental assumptions of automated wealth redistribution.

    Tone: Critical, academic, uncompromising. Find the fatal flaws this model is hiding.
  `;

  try {
    const response = await getAI().models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
    });
    return response.text;
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Red Team module offline. Check API key or connection.";
  }
};

export const getSimulationSummary = async (model: ModelParameters, results: any[]) => {
  const sampledResults = downsampleHistory(results);
  const prompt = `
    You are a helpful simulation assistant analyzing results from an AI-Economic Transition Model that simulates global UBI funded by corporate AI taxation.

    **CRITICAL CONTEXT - How This Economic Model Works:**

    1. **Wealth Redistribution Flow:** High-GDP countries (wealthy nations) are NET FUNDERS - they contribute more in corporate tax revenue than they receive in UBI. Low-GDP countries (developing nations) are NET RECEIVERS - they receive substantially more in UBI than they contribute. This creates progressive wealth redistribution from rich to poor countries.

    2. **Governance Impact:** Countries with poor governance experience corruption leakage (funds stolen before reaching citizens) UNLESS direct-to-wallet technology is enabled, which uses blockchain/digital identity to bypass corrupt institutions and deliver funds directly to citizens.

    3. **Job Displacement Crisis:** AI adoption displaces workers. The critical metric is the "displacement gap" - workers who lost jobs but are NOT adequately covered by UBI. Large gaps lead to social crisis, regardless of overall economic growth.

    4. **Counterfactual Comparison:** The simulation runs a parallel "shadow" timeline showing outcomes WITHOUT UBI intervention. Always compare actual results to this counterfactual baseline to measure true impact.

    5. **Inequality Effects:** High income inequality (Gini coefficient) within countries dampens UBI effectiveness. In highly unequal societies, UBI provides less wellbeing improvement because the wealth gap absorbs the benefits.

    6. **Policy Levers:**
       - **Corporate Tax Rate:** Higher rates generate more UBI funding but may slow AI adoption
       - **Adoption Incentive:** Subsidizes corporations to adopt AI faster
       - **GDP Scaling:** Controls how much UBI varies by country wealth (0=Equal for all, 1=Proportional to GDP)
       - **Global Redistribution Rate:** Controls what % of funds flow globally vs staying local (higher = more rich-to-poor transfer)
       - **Direct-to-Wallet:** Bypasses corruption when enabled
       - **Displacement Rate:** % of labor income lost at full AI adoption

    Model Parameters for "${model.name}":
    - Corporate Tax Rate: ${model.corporateTaxRate * 100}%
    - Adoption Incentive: ${model.adoptionIncentive * 100}%
    - AI Growth Rate: ${model.aiGrowthRate * 100}%/month
    - Base UBI: $${model.baseUBI}/month
    - GDP Scaling: ${model.gdpScaling} (0=Flat, 1=Proportional)
    - Global Redistribution: ${model.globalRedistributionRate * 100}%
    - Direct-to-Wallet: ${model.directToWalletEnabled ? 'Enabled' : 'Disabled'}
    - Displacement Rate: ${model.displacementRate * 100}%

    Simulation Data (Sampled from full timeline of ${results.length} months):
    ${JSON.stringify(sampledResults)}

    Please provide:
    1. **What Happened:** A brief 2-3 sentence summary. Focus on: Did UBI outpace displacement? Did developing countries benefit? Did wealthy countries face backlash? How does actual outcome compare to the counterfactual baseline?

    2. **Key Observation:** Identify ONE critical trend across the timeline. Examples: "Displacement gaps widened in developing nations despite UBI growth", "Corruption leakage negated 40% of benefits in low-governance countries", "Wealthy country citizens experienced wage stagnation while funding grew".

    3. **Economically Sound Parameter Tweaks:** Suggest specific slider adjustments to improve outcomes. CRITICAL RULES:
       - If developing countries are struggling: suggest HIGHER global redistribution rate or LOWER GDP scaling (they need to RECEIVE more, not give more)
       - If wealthy countries face political backlash: suggest LOWER tax rates or HIGHER adoption incentives
       - If corruption is high: recommend enabling direct-to-wallet
       - If displacement gaps are large: increase base UBI or slow AI growth rate
       - If adoption is stalled: increase incentives or reduce tax rates
       - Do NOT suggest changes that worsen economic inequality or violate redistribution logic

    Tone: Helpful, constructive, economically literate. Only suggest parameter changes, not equation changes.
  `;

  try {
    const response = await getAI().models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
    });
    return response.text;
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Summary service offline. Check API key or connection.";
  }
};
