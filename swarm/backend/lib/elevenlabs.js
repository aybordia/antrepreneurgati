// Voice ID map — ElevenLabs v2 voices
// Actual audio calls happen from the frontend to avoid streaming latency
export const VOICE_IDS = {
  Rachel: "EXAVITQu4vr4xnSDxMaL",       // warm, clear, American female
  Arnold: "VR6AewLTigWG4xSOukaG",        // deep, confident male
  Josh:   "TxGEqnHWrfWFTfGW9XjX",        // analytical, dry male
  Gigi:   "jBpfuIE2acCO8z3wKNLl",        // bright, energetic female
  Adam:   "pNInz6obpgDQGcFmaJgB",        // deliberate, serious older male
};

export function resolveVoiceId(voiceTarget) {
  return VOICE_IDS[voiceTarget] ?? VOICE_IDS.Rachel; // fallback to Rachel
}
