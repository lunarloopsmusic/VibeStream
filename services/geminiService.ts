import { GoogleGenAI, SchemaType } from "@google/genai";

const getClient = async (): Promise<GoogleGenAI> => {
  let apiKey = '';
  try {
    if (typeof process !== 'undefined' && process.env) {
      apiKey = process.env.API_KEY || '';
    }
  } catch (e) {}

  // Fallback for AI Studio preview
  const win = window as any;
  if (!apiKey && win.aistudio && (await win.aistudio.hasSelectedApiKey())) {
      // Key injected internally
  }

  if (!apiKey) {
     // Allow proceeding without key for UI dev, but API calls will fail gracefully later
     console.warn("API Key missing");
  }

  return new GoogleGenAI({ apiKey: apiKey });
};

/**
 * Analyzes audio to determine visualizer settings (Colors, Style, Sensitivity).
 * Uses Gemini 2.5 Flash (Free Tier).
 */
export const analyzeAudioForVisualizer = async (
  base64Audio: string,
  mimeType: string
): Promise<any> => {
  const ai = await getClient();
  
  const prompt = `Listen to this audio track. I am building a canvas audio visualizer.
  Return a JSON object configuration that matches the mood of the song.
  
  The schema must be:
  {
    "style": "bars" | "wave" | "orb" | "particles",
    "primaryColor": "hex code string (e.g. #FF0055)",
    "secondaryColor": "hex code string",
    "sensitivity": number between 0.5 (chill) and 2.5 (intense),
    "moodDescription": "short string describing the vibe"
  }

  - For energetic/techno/rock songs, use 'bars' or 'particles' and high sensitivity.
  - For calm/ambient songs, use 'wave' or 'orb' and low sensitivity.
  - Pick colors that match the emotion (Red/Orange for aggressive, Blue/Purple for calm).
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          { inlineData: { mimeType: mimeType, data: base64Audio } },
          { text: prompt },
        ],
      },
      config: {
        responseMimeType: "application/json",
      }
    });

    const jsonText = response.text || "{}";
    return JSON.parse(jsonText);
  } catch (e) {
    console.error("Gemini Analysis Failed", e);
    // Fallback config if AI fails
    return {
      style: "bars",
      primaryColor: "#a855f7",
      secondaryColor: "#3b82f6",
      sensitivity: 1.2,
      moodDescription: "Upbeat fallback rhythm"
    };
  }
};
