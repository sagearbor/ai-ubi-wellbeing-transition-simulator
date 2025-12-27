
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
    This simulates a CORPORATION-CENTRIC global UBI system where individual corporations voluntarily contribute to a blockchain-based global ledger. The economic model has these key dynamics:

    1. **Corporation-Driven Economics:** Individual corporations (tech giants like Apple, Google, Microsoft, Alibaba, etc.) generate AI revenue from automation. Each corporation independently chooses:
       - Contribution rate (5%-50% of AI revenue to UBI fund)
       - Distribution strategy: GLOBAL (equal per capita worldwide), CUSTOMER-WEIGHTED (to their customer countries), or HQ-LOCAL (only to headquarters country)
       - Policy stance: GENEROUS, MODERATE, or SELFISH

    2. **Direct-to-Wallet (Always Enabled):** The global UBI fund is blockchain-based and ALWAYS uses direct-to-wallet distribution. There is NO corruption leakage - funds go directly to citizens' digital wallets regardless of government quality. Nation-states CANNOT block this system.

    3. **Game Theory Dynamics:** Corporations face a prisoner's dilemma:
       - COOPERATION: High contribution rates maintain customer purchasing power, sustaining demand for corporate products
       - DEFECTION: Low contribution rates maximize short-term profit but risk demand collapse (poor customers can't buy products)
       - RACE TO BOTTOM: If too many corporations defect (go selfish), it triggers competitive pressure for others to defect
       - VIRTUOUS CYCLE: If enough corporations cooperate (generous), it creates positive feedback encouraging others to cooperate

    4. **Adaptive Corporate Behavior:** Corporations adjust policies based on:
       - Customer base wellbeing (if customers get poorer, revenue drops)
       - Projected demand collapse (if wellbeing trends down, corporations may increase UBI to save their market)
       - Competitor behavior (corporations observe and respond to rivals' policies)
       - Reputation effects (generous corporations gain customer preference, selfish ones lose market share)

    5. **Job Displacement vs UBI Coverage:** As AI adoption grows, workers lose jobs. The "displacement gap" is the number of displaced workers NOT receiving adequate UBI coverage. High gaps indicate crisis conditions.

    6. **Counterfactual Baseline:** The simulation tracks a parallel "shadow" timeline showing what happens WITHOUT the UBI intervention. Compare actual vs counterfactual outcomes to measure true impact.

    Model Parameters:
    - Name: ${model.name}
    - Default Corp Policy: ${model.defaultCorpPolicy} (initial policy stance for corporations)
    - Market Pressure: ${model.marketPressure * 100}% (how strongly customer demand affects corporate decisions)
    - AI Growth Rate: ${model.aiGrowthRate * 100}%/month (base rate of AI technology adoption)
    - Displacement Rate: ${model.displacementRate * 100}% (% of labor income lost at full AI adoption)
    - GDP Scaling: ${model.gdpScaling} (0=Equal UBI globally, 1=UBI proportional to GDP)

    Simulation Data (Sampled from full timeline of ${results.length} months):
    ${JSON.stringify(sampledResults)}

    Output a structured critique:
    1. **Corporate Behavior Realism:** Are corporations behaving realistically? Critique assumptions about:
       - Self-interest alignment (do corporations really benefit from UBI, or is this wishful thinking?)
       - Game theory dynamics (are prisoner's dilemma and Nash equilibrium modeled correctly?)
       - Adaptive policy responses (would real corporations adjust this way, or would shareholders block it?)
       - Reputation effects (do customers actually prefer generous corporations enough to change behavior?)

    2. **Distribution Strategy Failures:** Analyze the three distribution strategies:
       - GLOBAL: Does equal per-capita distribution create dependency or resentment?
       - CUSTOMER-WEIGHTED: Does this create perverse incentives (corporations only help their markets)?
       - HQ-LOCAL: Is this just nationalism in corporate clothing? Does it worsen inequality?

    3. **Game Theory Exploits:** Identify game theory failure modes:
       - Free rider problem (do small corporations exploit large ones' generosity?)
       - Race to bottom scenarios (can defection cascade uncontrollably?)
       - Coordination failure (can corporations get stuck in bad equilibria?)
       - Regulatory capture (will corporations use UBI as leverage to block actual regulation?)

    4. **Systemic Collapse Scenarios:** Find catastrophic failure points:
       - Mass unemployment without UBI coverage (displacement gap explosion)
       - Demand death spiral (poor customers → low revenue → lower UBI → poorer customers)
       - Geopolitical backlash (do nations strike back against corporate power?)
       - Wealth concentration (do AI corporations become too powerful to control?)

    5. **Structural Recommendations:** Suggest deep changes to the core philosophy, equations, or mechanisms. Challenge the fundamental assumption that voluntary corporate UBI can work at scale.

    Tone: Critical, academic, uncompromising. Find the fatal flaws this corporation-centric model is hiding.
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
    You are a helpful simulation assistant analyzing results from an AI-Economic Transition Model that simulates a CORPORATION-CENTRIC global UBI system.

    **CRITICAL CONTEXT - How This Economic Model Works:**

    1. **Corporation-Driven Economics:** Individual corporations (tech giants like Apple, Google, Microsoft, Alibaba, Tencent, etc.) independently decide their UBI contribution policies:
       - **Contribution Rate:** Each corp chooses 5%-50% of AI automation revenue to contribute
       - **Distribution Strategy:**
         * GLOBAL: Equal per-capita distribution to all humans worldwide (most altruistic)
         * CUSTOMER-WEIGHTED: Distribute proportionally to countries where they have customers (enlightened self-interest)
         * HQ-LOCAL: Only contribute to headquarters country (most selfish)
       - **Policy Stance:** GENEROUS (high contribution), MODERATE, or SELFISH (minimum contribution)

    2. **Direct-to-Wallet (Always Enabled):** The global UBI fund is blockchain-based with ZERO corruption. Funds go directly to citizens' digital wallets. Nation-states CANNOT block or tax this system. This is a fundamental assumption of the model.

    3. **Game Theory Dynamics (Prisoner's Dilemma):** Corporations face strategic choices:
       - **COOPERATION (Generous):** High UBI contributions maintain customer purchasing power → sustained product demand → stable revenue
       - **DEFECTION (Selfish):** Low contributions maximize short-term profit BUT risk demand collapse (poor customers can't buy products)
       - **RACE TO BOTTOM:** If too many corps defect, competitive pressure pushes others to defect (death spiral)
       - **VIRTUOUS CYCLE:** If enough corps cooperate, positive feedback encourages others to join (prosperity spiral)

    4. **Adaptive Corporate Behavior:** Corporations automatically adjust policies when:
       - Customer base wellbeing drops (threatens future sales)
       - Projected demand collapse exceeds threshold (customers getting too poor to buy)
       - Competitors change policies (Nash equilibrium pressure)
       - Reputation score drops (customers prefer generous corporations)

    5. **Job Displacement Crisis:** AI adoption displaces workers. The critical metric is "displacement gap" - workers who lost jobs but are NOT receiving adequate UBI. Large gaps indicate social crisis and demand collapse risk.

    6. **Counterfactual Baseline:** The simulation tracks a parallel "shadow" timeline showing outcomes WITHOUT corporate UBI. Compare actual vs counterfactual to measure true impact.

    Model Parameters for "${model.name}":
    - Default Corp Policy: ${model.defaultCorpPolicy} (initial stance: free-market, selfish-start, altruistic-start, or mixed-reality)
    - Market Pressure: ${model.marketPressure * 100}% (how responsive corps are to customer demand signals)
    - AI Growth Rate: ${model.aiGrowthRate * 100}%/month (base rate of AI technology spread)
    - Displacement Rate: ${model.displacementRate * 100}% (% of labor income lost at full AI adoption)
    - GDP Scaling: ${model.gdpScaling} (0=Equal UBI globally, 1=UBI proportional to GDP - affects inequality)

    Simulation Data (Sampled from full timeline of ${results.length} months):
    ${JSON.stringify(sampledResults)}

    Please provide:
    1. **What Happened:** A brief 2-3 sentence summary. Focus on:
       - Did corporations cooperate or defect (virtuous cycle vs race to bottom)?
       - Did adaptive policies prevent demand collapse, or did markets spiral downward?
       - How does actual outcome compare to the counterfactual baseline (would we have been better without corporate UBI)?
       - Are displacement gaps under control, or is social crisis brewing?

    2. **Key Observation:** Identify ONE critical trend about CORPORATE BEHAVIOR or GAME THEORY. Examples:
       - "Corporations entered a virtuous cycle, with 70% maintaining generous policies by month 50"
       - "Race to bottom detected: defection cascaded from 20% to 60% of corporations as competitive pressure mounted"
       - "Customer-weighted strategy dominated - corporations prioritized their own markets over global equality"
       - "Adaptive policies saved the system: corporations auto-corrected when demand collapse risk exceeded 40%"
       - "US-based corporations went protectionist (HQ-local) when domestic wellbeing dropped below 50"

    3. **Economically Sound Parameter Tweaks:** Suggest specific adjustments to CORPORATE behavior or MODEL parameters. CRITICAL RULES:
       - If race to bottom occurred: increase MARKET PRESSURE (make corps more responsive to demand signals) or start with ALTRUISTIC policies
       - If corporations are too selfish: switch Default Corp Policy to 'altruistic-start' or 'mixed-reality'
       - If displacement gaps are large: corporations need to contribute MORE - increase market pressure sensitivity
       - If demand collapse is happening: this proves the self-interest model works - corps SHOULD increase UBI to save customers
       - If virtuous cycle formed naturally: this validates the free-market approach - mention it's working as designed
       - If different distribution strategies are causing inequality: suggest which strategy (global/customer-weighted/hq-local) produces better outcomes
       - DO NOT suggest nation-level policies (nations don't control this system - corporations do)

    Tone: Helpful, constructive, focused on CORPORATE DECISIONS and GAME THEORY dynamics. Frame suggestions around corporate self-interest, not altruism.
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
