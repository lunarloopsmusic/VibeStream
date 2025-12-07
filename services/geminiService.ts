
import { GoogleGenAI } from "@google/genai";
import { VisualizerConfig, LyricLine } from "../types";

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

// Helper to strip markdown code blocks if present
const cleanJsonString = (str: string): string => {
  try {
    // Remove ```json ... ``` or ``` ... ```
    return str.replace(/```json\n?|```\n?|```/g, "").trim();
  } catch (e) {
    return str;
  }
};

export const generateLyrics = async (base64Audio: string, mimeType: string): Promise<{ content: string, syncData: LyricLine[] }> => {
  const ai = await getClient();
  
  // Updated prompt to request structured JSON with timestamps
  const prompt = `Listen to this audio. Transcribe the lyrics and provide precise start timestamps for each line.
  
  Return strictly a JSON array of objects. Do not include markdown formatting or backticks.
  Schema:
  [
    { "time": number (seconds, e.g. 12.5), "text": "string (lyric line)" }
  ]

  If it is instrumental, return an empty array [].
  Ignore intro/outro instrumental parts, just caption the vocals.`;

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

    const rawText = response.text || "[]";
    const cleanedText = cleanJsonString(rawText);
    
    let syncData: LyricLine[] = [];
    try {
        syncData = JSON.parse(cleanedText);
    } catch (e) {
        console.warn("Failed to parse synced lyrics JSON, falling back to text", e);
        // Fallback: If it returns plain text for some reason
        return { content: rawText, syncData: [] };
    }

    // Reconstruct the full text content from the array
    const content = syncData.map(line => line.text).join('\n');

    return { content, syncData };

  } catch (e) {
    console.error("Lyrics Generation Failed. Mime:", mimeType, "Error:", e);
    throw new Error("API Request Failed");
  }
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
  Return a raw JSON object (no markdown formatting) configuration that matches the mood of the song.
  
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
    "rotationSpeed": number,
    "rainbowMode": boolean,
    "shakeStrength": number
  }`;

  // Default "Safety" Config
  const defaultConfig: VisualizerConfig = {
    presetName: "Default Pulse",
    mode: "circular",
    primaryColor: "#a855f7",
    secondaryColor: "#3b82f6",
    backgroundColor: "#050505",
    colorMode: "gradient",
    rainbowMode: false,
    colorCycleSpeed: 0.5,
    sensitivity: 1.5,
    smoothing: 0.8,
    showBars: true,
    spectrumStyle: "bars",
    spectrumScale: 1.0,
    barCount: 64,
    barWidth: 6,
    barHeightScale: 1.5,
    barRoundness: 1.0,
    showBaseCircularLine: false,
    fillOpacity: 0.5,
    mirror: true,
    showParticles: true,
    particleCount: 50,
    particleSpeed: 2,
    particleStyle: 'circle',
    particleDirection: 'random',
    bloomStrength: 20,
    rotationSpeed: 0.5,
    cinematicBars: false,
    vignette: 0.3,
    shakeStrength: 0,
    backgroundImage: null,
    bgImageOpacity: 0.5,
    bgImageBlur: 0,
    centerType: 'image',
    centerImage: null,
    centerImageSize: 1.0,
    centerImageCircular: true,
    centerTextConfig: {
        content: "LOGO",
        fontFamily: "Russo One",
        fontSize: 60,
        color: "#ffffff",
        strokeColor: "#000000",
        strokeWidth: 2,
        glowColor: "#a855f7",
        glowStrength: 0
    },
    text: {
      enabled: true,
      topText: cleanName,
      bottomText: "VIBESTREAM",
      fontFamily: "Inter",
      fontSize: 40,
      color: "#ffffff",
      opacity: 0.9,
      letterSpacing: 2,
      shadow: true
    },
    lyrics: {
      enabled: false,
      content: "",
      syncData: [], 
      fontFamily: "Montserrat",
      fontSize: 32,
      color: "#ffffff",
      animationStyle: "highlight",
      opacity: 0.9,
      yOffset: 0
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

    const rawText = response.text || "{}";
    const cleanedText = cleanJsonString(rawText);
    const parsed = JSON.parse(cleanedText);
    
    return {
      ...defaultConfig,
      ...parsed,
      text: {
        ...defaultConfig.text,
        color: parsed.primaryColor || "#ffffff" 
      },
      centerTextConfig: {
          ...defaultConfig.centerTextConfig,
          glowColor: parsed.primaryColor || "#a855f7"
      }
    };

  } catch (e) {
    console.error("Gemini Analysis Failed", e);
    return defaultConfig;
  }
};
