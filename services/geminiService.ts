import { GoogleGenAI } from "@google/genai";

// We separate the client logic. 
// 'strictMode' = true means we ideally want a paid key (for Veo).
// 'strictMode' = false means a free key is fine (for Flash).
const getClient = async (strictMode: boolean = false): Promise<GoogleGenAI> => {
  const win = window as any;
  
  // Only force the UI picker if we are in strict mode (Video Generation)
  // and we are in the AI Studio preview environment.
  if (strictMode && win.aistudio) {
    const hasKey = await win.aistudio.hasSelectedApiKey();
    if (!hasKey) {
      try {
        await win.aistudio.openSelectKey();
      } catch (e) {
        console.warn("Key selection dialog cancelled or failed", e);
      }
    }
  }
  
  // Initialize with the environment variable injected by the platform.
  let apiKey = '';
  try {
    if (typeof process !== 'undefined' && process.env) {
      apiKey = process.env.API_KEY || '';
    }
  } catch (e) {
    console.warn("Could not access process.env");
  }

  // If we still don't have a key after checking env, try the window global (last resort)
  if (!apiKey && win.aistudio && (await win.aistudio.hasSelectedApiKey())) {
    // In some envs, the key might be injected differently, but usually process.env is the standard.
    // We rely on the fact that openSelectKey updates process.env in the runner.
  }

  if (!apiKey) {
    // If it's strict mode (Veo), we error out.
    // If it's not strict (Analysis), we also error out because we need *some* key.
    throw new Error("API_KEY is missing. Please ensure you have configured it in your environment.");
  }

  return new GoogleGenAI({ apiKey: apiKey });
};

/**
 * Analyzes the uploaded audio to generate a creative video prompt.
 * Uses Gemini 2.5 Flash (Free Tier eligible).
 */
export const analyzeAudioAndGeneratePrompt = async (
  base64Audio: string,
  mimeType: string
): Promise<string> => {
  // Pass false to allow free keys
  const ai = await getClient(false);
  
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: mimeType,
            data: base64Audio,
          },
        },
        {
          text: `You are an expert music video director. Listen to this audio track. 
          Describe a visual scene that perfectly matches the mood, rhythm, and genre of this music.
          The description will be used as a prompt for an AI video generator (like Veo).
          
          Guidelines:
          - Be highly descriptive about lighting, color palette, and movement.
          - Do not mention specific copyrighted characters or artists.
          - Keep it under 80 words.
          - Focus on the visual aesthetic (e.g., "Neon-lit cyberpunk street in rain," "Calm ocean waves at sunset," "Abstract geometric shapes pulsing").
          - Output ONLY the prompt text.`,
        },
      ],
    },
  });

  return response.text || "A cool visualizer for this music track.";
};

/**
 * Generates a video using Google Veo based on the prompt.
 * Requires a PAID API Key (Veo is not free).
 */
export const generateVideo = async (
  prompt: string,
  aspectRatio: '16:9' | '9:16',
  resolution: '720p' | '1080p'
): Promise<string> => {
  // Pass true to enforce paid key checks in supported environments
  const ai = await getClient(true);

  // Initial request to start video generation
  let operation = await ai.models.generateVideos({
    model: 'veo-3.1-fast-generate-preview',
    prompt: prompt,
    config: {
      numberOfVideos: 1,
      resolution: resolution,
      aspectRatio: aspectRatio,
    },
  });

  // Polling loop
  while (!operation.done) {
    // Wait 5 seconds before checking again
    await new Promise((resolve) => setTimeout(resolve, 5000));
    operation = await ai.operations.getVideosOperation({ operation: operation });
  }

  const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;

  if (!videoUri) {
    throw new Error("Failed to generate video URI.");
  }

  let keyParam = '';
  try {
     if (typeof process !== 'undefined' && process.env && process.env.API_KEY) {
        keyParam = `&key=${process.env.API_KEY}`;
     }
  } catch(e) {}

  const downloadUrl = `${videoUri}${keyParam}`;
  
  const videoResponse = await fetch(downloadUrl);
  if (!videoResponse.ok) {
    throw new Error("Failed to download generated video.");
  }
  
  const blob = await videoResponse.blob();
  return URL.createObjectURL(blob);
};