
import { GoogleGenAI, Type } from "@google/genai";
import { ModelParameters } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

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
    
    Model Parameters:
    - Name: ${model.name}
    - Tax Rate: ${model.corporateTaxRate * 100}%
    - Incentive: ${model.adoptionIncentive * 100}%
    - Base UBI: $${model.baseUBI}
    - GDP Scaling (Wealth Gradient): ${model.gdpScaling} (0=Flat, 1=Proportional)
    
    Simulation Data (Sampled from full timeline of ${results.length} months):
    ${JSON.stringify(sampledResults)}
    
    Output a structured critique:
    1. **Critical Failure Points:** Identify 3 structural weaknesses (e.g., hyper-inflation, class warfare, stagnant adoption). Be specific about which countries are failing.
    2. **Civil Unrest Probability:** Estimate % chance of revolution in G7 vs Global South.
    3. **Structural Recommendations:** Suggest deep changes to the equations or core philosophy.
    
    Tone: Critical, academic, uncompromising.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: { thinkingConfig: { thinkingBudget: 2000 } }
    });
    return response.text;
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Red Team module offline. Check connection.";
  }
};

export const getSimulationSummary = async (model: ModelParameters, results: any[]) => {
  const sampledResults = downsampleHistory(results);
  const prompt = `
    You are a helpful simulation assistant. Summarize the run of the "${model.name}" model and suggest parameter tweaks.
    
    Parameters: Tax: ${model.corporateTaxRate}, Incentive: ${model.adoptionIncentive}, Growth: ${model.aiGrowthRate}, GDP Scaling: ${model.gdpScaling}.
    Simulation Data (Sampled from full timeline of ${results.length} months):
    ${JSON.stringify(sampledResults)}

    Please provide:
    1. **What Happened:** A brief 2-sentence summary of the world state (e.g., "Adoption stalled but wellbeing is high").
    2. **Key Observation:** One interesting trend in the data looking at the whole timeline.
    3. **Suggested Tweaks:** Specific recommendations for the sliders (Tax, Incentive, Growth, GDP Scaling) to improve outcomes.
    
    Tone: Helpful, constructive, concise. Do not suggest changing equations, only parameters.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text;
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Summary service offline.";
  }
};
