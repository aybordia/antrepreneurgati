// Video room provider for peer-to-peer practice.
// Default: Jitsi Meet (meet.jit.si) — free, no API key, no billing. Rooms are
// random unguessable names on the public Jitsi server; nothing is recorded.
// Optional: set VIDEO_PROVIDER=daily (with DAILY_API_KEY) to use Daily.co.
import crypto from "crypto";
import { createPeerRoom as createDailyRoom, dailyConfigured } from "./daily.js";

export async function createPeerRoom() {
  const wantsDaily = (process.env.VIDEO_PROVIDER || "").toLowerCase() === "daily";
  if (wantsDaily && dailyConfigured()) {
    const room = await createDailyRoom();
    return { ...room, provider: "daily" };
  }
  // Jitsi: no server-side setup at all — an unguessable room name IS the room
  const name = `SwarmPractice${crypto.randomBytes(16).toString("hex")}`;
  return { provider: "jitsi", name, url: `https://meet.jit.si/${name}` };
}
