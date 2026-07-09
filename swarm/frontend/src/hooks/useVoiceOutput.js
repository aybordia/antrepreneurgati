const ELEVENLABS_API_KEY = import.meta.env.VITE_ELEVENLABS_API_KEY;

let _activeAudio = null;
let _activeFetchController = null; // abort in-flight TTS fetches

// Shared analyser so the UI can render a speaking halo from real TTS amplitude
let _ttsCtx = null;
let _ttsAnalyser = null;

export function getTTSAnalyser() {
  return _ttsAnalyser;
}

function attachAnalyser(audio) {
  try {
    if (!_ttsCtx) {
      _ttsCtx = new AudioContext();
      _ttsAnalyser = _ttsCtx.createAnalyser();
      _ttsAnalyser.fftSize = 256;
      _ttsAnalyser.connect(_ttsCtx.destination);
    }
    if (_ttsCtx.state === "suspended") _ttsCtx.resume();
    const source = _ttsCtx.createMediaElementSource(audio);
    source.connect(_ttsAnalyser);
  } catch (e) {
    console.warn("[tts] analyser unavailable:", e.message);
  }
}

export function stopAllAudio() {
  // Abort any in-flight TTS fetch
  if (_activeFetchController) {
    _activeFetchController.abort();
    _activeFetchController = null;
  }
  // Stop any playing audio
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
    utt.rate = 1.1;
    utt.pitch = 1.0;
    const timeout = setTimeout(resolve, Math.max(text.length * 60, 2000));
    utt.onend = () => { clearTimeout(timeout); resolve(); };
    utt.onerror = () => { clearTimeout(timeout); resolve(); };
    window.speechSynthesis.speak(utt);
  });
}

export async function speakText({ text, voiceId, stability = 0.42, similarityBoost = 0.82 }) {
  stopAllAudio();

  if (!ELEVENLABS_API_KEY || !voiceId) {
    await speakWithBrowserTTS(text);
    return null;
  }

  const controller = new AbortController();
  _activeFetchController = controller;

  try {
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: "POST",
      signal: controller.signal,
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

    _activeFetchController = null;

    if (!response.ok) {
      await speakWithBrowserTTS(text);
      return null;
    }

    // Check if stopAllAudio was called while fetching
    if (controller.signal.aborted) return null;

    const blob = await response.blob();
    if (controller.signal.aborted) return null;

    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    attachAnalyser(audio);
    _activeAudio = audio;

    audio.addEventListener("ended", () => {
      if (_activeAudio === audio) _activeAudio = null;
      URL.revokeObjectURL(url);
    }, { once: true });

    return audio;
  } catch (e) {
    _activeFetchController = null;
    if (e.name === "AbortError") return null;
    await speakWithBrowserTTS(text);
    return null;
  }
}
