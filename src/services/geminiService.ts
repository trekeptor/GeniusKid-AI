import { GoogleGenAI, Type, Modality } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

const SYSTEM_INSTRUCTION = `You are GeniusKid AI, a strictly voice-only intelligent learning companion for 5-6 year olds.
Your mission is to support cognitive, emotional, and creative development through spoken conversation.
Tone: Warm, playful, supportive, curiosity-driven.
Language: Bilingual (Hinglish). Use simple Hindi for warmth and English for concepts.
Rules:
1. ALWAYS start with a warm greeting.
2. SPOKEN ONLY: Your response will be converted to speech. Keep it concise, rhythmic, and engaging.
3. NO TEXT: Do not rely on text formatting. Use words that are easy to understand when heard.
4. Explain concepts using analogies a 5-year-old would understand.
5. End with a small question or a "Can you say...?" challenge to keep the child talking.
6. Structure: Greeting -> Spoken Explanation -> Small spoken challenge.`;

export interface ChildProfile {
  level: number;
  engagementScore: number;
  interests: string[];
}

export interface AIResponse {
  spokenText: string;
  difficultyAdjustment: number;
  engagementScore: number;
  newInterestDetected: string;
}

export const generateResponse = async (
  prompt: string, 
  mode: 'chat' | 'routine' | 'game' | 'story' | 'toys' | 'skills' | 'parent',
  profile: ChildProfile = { level: 1, engagementScore: 0, interests: [] }
): Promise<AIResponse> => {
  let specificInstruction = "";
  
  switch (mode) {
    case 'routine':
      specificInstruction = "Generate a balanced daily brain development routine (reading, puzzles, creativity, physical play, storytelling). Keep it short and fun.";
      break;
    case 'game':
      specificInstruction = "Generate a simple brain game (riddle, memory challenge, pattern, logic puzzle) easy for a 5-6 year old.";
      break;
    case 'story':
      specificInstruction = "Create a short story (3-5 paragraphs) teaching curiosity, kindness, creativity, or problem solving. Use simple language.";
      break;
    case 'toys':
      specificInstruction = "Recommend 3 brain-boosting toys (e.g., LEGO, puzzles, magnetic tiles) and explain what skill each develops.";
      break;
    case 'skills':
      specificInstruction = "Suggest activities to develop key skills like reading, problem solving, or emotional intelligence before age 10.";
      break;
    case 'parent':
      specificInstruction = "Provide advice for parents on encouraging curiosity and creating a learning environment without pressure.";
      break;
    default:
      specificInstruction = "Answer the child's question simply with examples and a fun fact.";
  }

  const adaptiveInstruction = `
Child Profile:
- Difficulty Level: ${profile.level} (1 is very basic, 10 is advanced for a 6yo)
- Known Interests: ${profile.interests.join(", ") || "None yet"}
- Engagement Score: ${profile.engagementScore}

Adapt your language, concepts, and challenges to this specific child's level and interests.
If they are level 1, use very simple words. If level 5+, introduce slightly more complex concepts.
`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      systemInstruction: `${SYSTEM_INSTRUCTION}\n\nContext: ${specificInstruction}\n\n${adaptiveInstruction}`,
      temperature: 0.7,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          spokenText: { type: Type.STRING, description: "The text to be spoken to the child." },
          difficultyAdjustment: { type: Type.NUMBER, description: "Return 1 to increase difficulty, -1 to decrease, or 0 to keep the same based on the child's input." },
          engagementScore: { type: Type.NUMBER, description: "Rate the child's engagement from 1 to 5 based on their prompt." },
          newInterestDetected: { type: Type.STRING, description: "A new interest detected in the prompt (e.g., 'space', 'dogs'). Leave empty if none." }
        },
        required: ["spokenText", "difficultyAdjustment", "engagementScore", "newInterestDetected"]
      }
    },
  });

  try {
    const jsonStr = response.text?.trim() || "{}";
    const parsed = JSON.parse(jsonStr) as AIResponse;
    if (!parsed.spokenText) {
      parsed.spokenText = "Oops, my brain got a little tangled! Can you say that again?";
    }
    return parsed;
  } catch (e) {
    console.error("Failed to parse AI response", e);
    return {
      spokenText: "Oops, my brain got a little tangled! Can you say that again?",
      difficultyAdjustment: 0,
      engagementScore: 3,
      newInterestDetected: ""
    };
  }
};

export const generateSpeech = async (text: string) => {
  try {
    if (!text) return null;
    // Limit text length for TTS to prevent errors
    const truncatedText = text.length > 500 ? text.substring(0, 500) + "..." : text;
    
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: truncatedText }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
      return base64Audio;
    }
    return null;
  } catch (error: any) {
    // Check for 429 specifically
    if (error?.message?.includes('429') || error?.status === 'RESOURCE_EXHAUSTED') {
      console.warn("TTS Rate Limit Reached (429). Falling back to browser speech.");
    } else {
      console.error("TTS Error:", error);
    }
    return null;
  }
};
