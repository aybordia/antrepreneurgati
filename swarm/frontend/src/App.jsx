import { useState, useEffect, useCallback } from "react";
import { AnimatePresence } from "framer-motion";
import SituationInput from "./components/SituationInput";
import MissionControl from "./components/MissionControl";
import VoiceSession from "./components/VoiceSession";
import Debrief from "./components/Debrief";
import AskSwarm from "./components/AskSwarm";
import Dashboard from "./components/Dashboard";
import SignIn from "./components/SignIn";
import Cursor from "./components/Cursor";
import { stopAllAudio } from "./hooks/useVoiceOutput";

const SCREENS = {
  DASHBOARD:       "DASHBOARD",
  SITUATION_INPUT: "SITUATION_INPUT",
  MISSION_CONTROL: "MISSION_CONTROL",
  VOICE_SESSION:   "VOICE_SESSION",
  DEBRIEF:         "DEBRIEF",
  ASK_SWARM:       "ASK_SWARM",
};

function decodeJwt(jwt) {
  try {
    const base64Url = jwt.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => `%${("00" + c.charCodeAt(0).toString(16)).slice(-2)}`)
        .join("")
    );
    return JSON.parse(jsonPayload);
  } catch (error) {
    return null;
  }
}

export default function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem("google_id_token"));
  const [screen, setScreen] = useState(SCREENS.DASHBOARD);
  const [situation, setSituation] = useState("");
  const [sessionData, setSessionData] = useState(null);
  const [sessionResult, setSessionResult] = useState(null);
  const [debriefResult, setDebriefResult] = useState(null);
  const [timedMode, setTimedMode] = useState(false);
  const [googleReady, setGoogleReady] = useState(false);

  useEffect(() => {
    const legacyScript = document.querySelector("script[src='https://accounts.google.com/gsi/client']");
    if (legacyScript) {
      setGoogleReady(true);
      return;
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => setGoogleReady(true);
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  const handleCredentialResponse = useCallback((response) => {
    if (!response?.credential) return;
    const payload = decodeJwt(response.credential);
    if (!payload) return;

    localStorage.setItem("google_id_token", response.credential);
    setToken(response.credential);
    setUser(payload);
  }, []);

  // Restore session from localStorage on load
  useEffect(() => {
    if (!token) return;
    const payload = decodeJwt(token);
    if (payload) {
      setUser(payload);
    } else {
      localStorage.removeItem("google_id_token");
      setToken(null);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSignOut = () => {
    window.google?.accounts?.id?.disableAutoSelect?.();
    localStorage.removeItem("google_id_token");
    setToken(null);
    setUser(null);
  };

  const getIdToken = useCallback(async () => {
    return token;
  }, [token]);

  const handleNewSession = () => { stopAllAudio(); setScreen(SCREENS.SITUATION_INPUT); };

  const handleLaunch = (sit, opts = {}) => {
    stopAllAudio();
    setSituation(sit);
    setTimedMode(opts.timedMode || false);
    setScreen(SCREENS.MISSION_CONTROL);
  };

  const handleBeginSession = (data) => {
    stopAllAudio();
    setSessionData(data);
    setScreen(SCREENS.VOICE_SESSION);
  };

  const handleEndSession = (result) => {
    stopAllAudio();
    setSessionResult(result);
    setScreen(SCREENS.DEBRIEF);
  };

  const handleAskSwarm = (debrief) => {
    stopAllAudio();
    setDebriefResult(debrief);
    setScreen(SCREENS.ASK_SWARM);
  };

  const handleRunAgain = () => {
    stopAllAudio();
    setSituation((s) => s.replace(" — harder mode", "") + " — harder mode");
    setSessionData(null);
    setSessionResult(null);
    setDebriefResult(null);
    setScreen(SCREENS.SITUATION_INPUT);
  };

  const handleBackToDashboard = () => {
    stopAllAudio();
    setScreen(SCREENS.DASHBOARD);
  };

  return (
    <div style={{ position: "relative", width: "100vw", height: "100vh", background: "#04040A" }}>
      <Cursor />
      {user && screen !== SCREENS.DASHBOARD && (
        <button
          onClick={handleBackToDashboard}
          style={{
            position: "fixed", left: 20, top: 20, zIndex: 1000,
            padding: "6px 14px", borderRadius: "8px",
            border: "1px solid rgba(255,255,255,0.1)",
            background: "rgba(255,255,255,0.04)",
            color: "var(--muted)", cursor: "pointer",
            fontFamily: "var(--mono)", fontSize: "11px",
            letterSpacing: "0.04em", transition: "all 0.18s",
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)"; e.currentTarget.style.color = "var(--text)"; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; e.currentTarget.style.color = "var(--muted)"; }}
        >
          ← Home
        </button>
      )}

      {user && (
        <div style={{ position: "fixed", right: 20, top: 20, zIndex: 1000, display: "flex", alignItems: "center", gap: "10px" }}>
          {user.picture && (
            <img src={user.picture} alt="" width={28} height={28} referrerPolicy="no-referrer"
              style={{ borderRadius: "50%", border: "1px solid rgba(255,255,255,0.12)" }} />
          )}
          <span style={{ color: "var(--muted)", fontFamily: "var(--mono)", fontSize: "11px", letterSpacing: "0.03em" }}>
            {user.name || user.email}
          </span>
          <button onClick={handleSignOut}
            style={{
              padding: "6px 14px", borderRadius: "8px",
              border: "1px solid rgba(255,255,255,0.1)",
              background: "rgba(255,255,255,0.04)",
              color: "var(--muted)", cursor: "pointer",
              fontFamily: "var(--mono)", fontSize: "11px",
              transition: "all 0.18s",
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)"; e.currentTarget.style.color = "var(--text)"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; e.currentTarget.style.color = "var(--muted)"; }}
          >
            Sign out
          </button>
        </div>
      )}

      {!user ? (
        <SignIn googleReady={googleReady} onCredential={handleCredentialResponse} />
      ) : (
        <AnimatePresence mode="wait">
          {screen === SCREENS.DASHBOARD && (
            <Dashboard key="dashboard" user={user} onNewSession={handleNewSession} getIdToken={getIdToken} />
          )}
          {screen === SCREENS.SITUATION_INPUT && (
            <SituationInput key="input" onLaunch={handleLaunch} initialSituation={situation} onBack={handleBackToDashboard} />
          )}
          {screen === SCREENS.MISSION_CONTROL && (
            <MissionControl key="mission" situation={situation} onBeginSession={handleBeginSession} getIdToken={getIdToken} />
          )}
          {screen === SCREENS.VOICE_SESSION && (
            <VoiceSession key="session" sessionData={sessionData} situation={situation} onEndSession={handleEndSession} getIdToken={getIdToken} timedMode={timedMode} />
          )}
          {screen === SCREENS.DEBRIEF && (
            <Debrief key="debrief" sessionResult={sessionResult} situation={situation} onRunAgain={handleRunAgain} onAskSwarm={handleAskSwarm} getIdToken={getIdToken} />
          )}
          {screen === SCREENS.ASK_SWARM && (
            <AskSwarm key="ask" sessionResult={sessionResult} situation={situation} debrief={debriefResult} onRunAgain={handleRunAgain} getIdToken={getIdToken} />
          )}
        </AnimatePresence>
      )}
    </div>
  );
}
