// Daily.co room creation for peer-to-peer practice sessions.
// Rooms are ephemeral (1 hour), capped at 2 participants, and nothing is
// recorded — this is a live practice space, not a recorded session.
const DAILY_API = "https://api.daily.co/v1";

export function dailyConfigured() {
  return Boolean(process.env.DAILY_API_KEY);
}

export async function createPeerRoom() {
  if (!dailyConfigured()) {
    const err = new Error("Peer sessions are not configured yet (missing DAILY_API_KEY).");
    err.status = 503;
    throw err;
  }
  const res = await fetch(`${DAILY_API}/rooms`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.DAILY_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      privacy: "public", // unguessable URL; room expires in 1h
      properties: {
        exp: Math.floor(Date.now() / 1000) + 60 * 60,
        max_participants: 2,
        start_video_off: true,   // camera is opt-in, per user, inside the call
        start_audio_off: false,
        enable_screenshare: false,
        // recording stays off by design: Daily rooms don't record unless a
        // recording property is explicitly enabled, and we never enable it
        eject_at_room_exp: true,
      },
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const err = new Error(`Daily room creation failed (${res.status}): ${body.slice(0, 200)}`);
    err.status = 502;
    throw err;
  }
  const room = await res.json();
  return { url: room.url, name: room.name };
}
