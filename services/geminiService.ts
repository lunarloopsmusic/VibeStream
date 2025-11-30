
import { GoogleGenAI } from "@google/genai";
import { VisualizerConfig } from "../types";

const getClient = async (): Promise<GoogleGenAI> => {
  let apiKey = '';
  try {
    if (typeof process !== 'undefined' && process.env) {
      apiKey = process.env.API_KEY || '';
    }
  } catch (e) {}

  const win = window as any;
  if (!apiKey && win.aistudio && (await win.aistudio.hasSelectedApiKey())) {
      // Key injected internally
  }

  if (!apiKey) {
     console.warn("API Key missing");
  }

  return new GoogleGenAI({ apiKey: apiKey });
};

export const analyzeAudioForVisualizer = async (
  base64Audio: string,
  mimeType: string,
  fileName: string
): Promise<VisualizerConfig> => {
  const ai = await getClient();
  
  // Sanitize filename for display
  const cleanName = fileName.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ");

  const prompt = `Listen to this audio track. I am building a professional music visualizer.
  Return a JSON object configuration that matches the mood of the song.
  
  Schema:
  {
    "presetName": "string",
    "mode": "circular" | "linear",
    "primaryColor": "hex",
    "secondaryColor": "hex",
    "backgroundColor": "hex",
    "sensitivity": number (0.5-2.5),
    "smoothing": number (0.5-0.9),
    "showBars": boolean,
    "barCount": number,
    "barWidth": number,
    "barHeightScale": number,
    "mirror": boolean,
    "showParticles": boolean,
    "particleCount": number,
    "particleSpeed": number,
    "bloomStrength": number,
    "rotationSpeed": number
  }`;

  // Default "Safety" Config
  const defaultConfig: VisualizerConfig = {
    presetName: "Default Pulse",
    mode: "circular",
    primaryColor: "#a855f7",
    secondaryColor: "#3b82f6",
    backgroundColor: "#050505",
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
    rotationSpeed: 0.5,
    cinematicBars: false,
    vignette: 0.3,
    backgroundImage: null,
    bgImageOpacity: 0.5,
    bgImageBlur: 0,
    centerImage: null,
    centerImageSize: 1.0,
    centerImageCircular: true,
    text: {
      enabled: true,
      topText: cleanName,
      bottomText: "AUDIO VISUALIZER",
      fontFamily: "Inter",
      fontSize: 40,
      color: "#ffffff",
      opacity: 0.9,
      letterSpacing: 2,
      shadow: true
    }
  };

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
    const parsed = JSON.parse(jsonText);
    
    return {
      ...defaultConfig,
      ...parsed,
      text: {
        ...defaultConfig.text,
        color: parsed.primaryColor || "#ffffff" // Match text to primary color
      }
    };

  } catch (e) {
    console.error("Gemini Analysis Failed", e);
    return defaultConfig;
  }
};
