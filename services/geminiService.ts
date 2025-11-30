
import { GoogleGenAI } from "@google/genai";
import { VisualizerConfig } from "../types";

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
     console.warn("API Key missing");
  }

  return new GoogleGenAI({ apiKey: apiKey });
};

/**
 * Analyzes audio to determine advanced visualizer settings.
 * Uses Gemini 2.5 Flash (Free Tier).
 */
export const analyzeAudioForVisualizer = async (
  base64Audio: string,
  mimeType: string
): Promise<VisualizerConfig> => {
  const ai = await getClient();
  
  const prompt = `Listen to this audio track. I am building a complex audio visualizer like Vizzy.io.
  Return a JSON object configuration that matches the mood of the song.
  
  The schema must be:
  {
    "presetName": "Creative name for this vibe",
    "mode": "circular" | "linear",
    "primaryColor": "hex",
    "secondaryColor": "hex",
    "backgroundColor": "hex (usually dark)",
    "sensitivity": number (0.5 to 2.5),
    "smoothing": number (0.5 to 0.9),
    "showBars": boolean,
    "barCount": number (64 for simple, 128 for detailed),
    "barWidth": number (2 to 20),
    "barHeightScale": number (1.0 to 2.5),
    "mirror": boolean (true for symmetry),
    "showParticles": boolean,
    "particleCount": number (50 to 200),
    "particleSpeed": number (1 to 5),
    "bloomStrength": number (10 to 40),
    "rotationSpeed": number (-2 to 2)
  }

  Logic:
  - EDM/Trap/Bass: Mode="circular", High sensitivity, High bloom, Particles=true.
  - Lo-Fi/Ambient: Mode="linear", Low sensitivity, High smoothing, Pastel colors.
  - Rock/Metal: Mode="linear", Red/Black colors, High particle speed, Mirror=true.
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
    // Fallback config
    return {
      presetName: "Fallback Rhythm",
      mode: "circular",
      primaryColor: "#a855f7",
      secondaryColor: "#3b82f6",
      backgroundColor: "#09090b",
      sensitivity: 1.5,
      smoothing: 0.8,
      showBars: true,
      barCount: 64,
      barWidth: 6,
      barHeightScale: 1.5,
      mirror: false,
      showParticles: true,
      particleCount: 50,
      particleSpeed: 2,
      bloomStrength: 20,
      rotationSpeed: 0.5
    };
  }
};
