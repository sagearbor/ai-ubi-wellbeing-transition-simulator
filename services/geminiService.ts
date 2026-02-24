
import { GoogleGenAI } from "@google/genai";
import { ModelParameters } from "../types";

// Helper to downsample history to ~30 points to fit context window while keeping full range
const downsampleHistory = (history: any[]) => {
  if (history.length <= 30) return history;
  const step = Math.ceil(history.length / 30);
  return history.filter((_, i) => i % step === 0 || i === history.length - 1);
};

export const getRedTeamAnalysis = async (model: ModelParameters, results: any[]) => {
  const sampledResults = downsampleHistory(results);
  const prompt = `
    You are a hostile "Red Team" economist tasked with finding fatal flaws in this sophisticated AI-Economic Transition Model.
    
    Model Parameters:
    - Name: ${model.name}
    - Tax Rate: ${model.corporateTaxRate * 100}%
    - Incentive: ${model.adoptionIncentive * 100}%
    - Global Redistribution: ${model.globalRedistributionRate * 100}% (Share of tax going to global pot)
    - Base UBI: $${model.baseUBI}
    
    The simulation tracks Corruption (Kleptocracy), Inequality (Gini), and Governance.
    
    Simulation Data (Sampled):
    ${JSON.stringify(sampledResults)}
    
    Output a structured critique:
    1. **Critical Failure Points:** Identify weaknesses. Did high corruption countries starve their people? Did the US hoard too much wealth (low redistribution)?
    2. **Civil Unrest Probability:** Analyze the gap between the "Shadow Baseline" (Do nothing) and the "Real" outcome. If the Real outcome is low, risk is high.
    3. **Structural Recommendations:** Suggest specific changes to the Global Redistribution Rate or Tax Rate to save the failing nations.
    
    Tone: Critical, academic, uncompromising.
  `;

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: { thinkingConfig: { thinkingBudget: 2000 } }
    });
    return response.text;
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Red Team module offline. Check connection or API Key.";
  }
};

export const getSimulationSummary = async (model: ModelParameters, results: any[]) => {
  const sampledResults = downsampleHistory(results);
  const prompt = `
    You are a helpful simulation assistant. Summarize the run of the "${model.name}" model.
    
    Parameters: Tax: ${model.corporateTaxRate}, Global Rate: ${model.globalRedistributionRate}.
    Simulation Data:
    ${JSON.stringify(sampledResults)}

    Please provide:
    1. **What Happened:** A brief 2-sentence summary. Mention if the "Shadow Baseline" (Collapse) was avoided.
    2. **Key Observation:** Comment on the divergence between Rich and Poor nations based on the Redistribution Rate.
    3. **Suggested Tweaks:** Recommend changes to the Global Redistribution slider to optimize world stability.
    
    Tone: Helpful, constructive, concise.
  `;

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text;
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Summary service offline. Check connection or API Key.";
  }
};
