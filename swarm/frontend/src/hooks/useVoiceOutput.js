const ELEVENLABS_API_KEY = import.meta.env.VITE_ELEVENLABS_API_KEY;

// Module-level tracker — one audio plays at a time across all screens
let _activeAudio = null;

export function stopAllAudio() {
  if (_activeAudio) {
    _activeAudio.pause();
    _activeAudio.currentTime = 0;
    _activeAudio = null;
  }
  window.speechSynthesis?.cancel();
}

function speakWithBrowserTTS(text) {
  return new Promise((resolve) => {
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.rate = 1.0;
    utt.pitch = 1.0;
    const timeout = setTimeout(resolve, Math.max(text.length * 75, 3000));
    utt.onend = () => { clearTimeout(timeout); resolve(); };
    utt.onerror = () => { clearTimeout(timeout); resolve(); };
    window.speechSynthesis.speak(utt);
  });
}

// NOTE: ElevenLabs key is exposed in the browser bundle — acceptable for hackathon demo only.
export async function speakText({ text, voiceId, stability = 0.42, similarityBoost = 0.82 }) {
  // Stop anything currently playing before starting new audio
  stopAllAudio();

  if (!ELEVENLABS_API_KEY || !voiceId) {
    await speakWithBrowserTTS(text);
    return null;
  }

  try {
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: "POST",
      headers: {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_turbo_v2",
        voice_settings: { stability, similarity_boost: similarityBoost },
      }),
    });

    if (!response.ok) {
      await speakWithBrowserTTS(text);
      return null;
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);

    // Track globally so stopAllAudio() can kill it from anywhere
    _activeAudio = audio;

    audio.addEventListener("ended", () => {
      if (_activeAudio === audio) _activeAudio = null;
      URL.revokeObjectURL(url);
    }, { once: true });

    return audio;
  } catch {
    await speakWithBrowserTTS(text);
    return null;
  }
}
