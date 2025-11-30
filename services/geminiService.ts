import { GoogleGenAI } from "@google/genai";

const getClient = async (): Promise<GoogleGenAI> => {
  // Check for Veo-compatible key selection
  // Cast window to any to access aistudio property without type conflicts
  const win = window as any;
  if (win.aistudio) {
    const hasKey = await win.aistudio.hasSelectedApiKey();
    if (!hasKey) {
      await win.aistudio.openSelectKey();
    }
  }
  
  // Initialize with the environment variable injected by the platform.
  // We use a safety check for 'process' to avoid crashes in browser environments (like Cloudflare Pages)
  // where 'process' might not be polyfilled by the build tool.
  let apiKey = '';
  try {
    if (typeof process !== 'undefined' && process.env) {
      apiKey = process.env.API_KEY || '';
    }
  } catch (e) {
    // Ignore reference errors
    console.warn("Could not access process.env");
  }

  return new GoogleGenAI({ apiKey: apiKey });
};

/**
 * Analyzes the uploaded audio to generate a creative video prompt.
 */
export const analyzeAudioAndGeneratePrompt = async (
  base64Audio: string,
  mimeType: string
): Promise<string> => {
  const ai = await getClient();
  
  // Using gemini-2.5-flash for efficient multimodal analysis
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
 */
export const generateVideo = async (
  prompt: string,
  aspectRatio: '16:9' | '9:16',
  resolution: '720p' | '1080p'
): Promise<string> => {
  const ai = await getClient();

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

  // The URI requires the API key appended to fetch the actual binary data
  // However, for the <video> src, we usually need a signed URL or a blob.
  // The SDK docs suggest fetching it. We will fetch and blob it to ensure it plays nicely.
  
  // We need the key again for the fetch. 
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