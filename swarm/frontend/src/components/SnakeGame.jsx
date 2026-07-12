import { useEffect, useRef, useState, useCallback } from "react";

/* Calm snake for the panel-building wait. Sage snake, honey food, no sound,
   no flashing. Arrow keys or WASD. Starts only when the player chooses. */
const COLS = 20, ROWS = 14, CELL = 18;
const TICK_MS = 130;

export default function SnakeGame() {
  const canvasRef = useRef(null);
  const [running, setRunning] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(() => Number(localStorage.getItem("swarm_snake_best") || 0));

  const stateRef = useRef(null);

  const freshState = () => ({
    snake: [{ x: 5, y: 7 }, { x: 4, y: 7 }, { x: 3, y: 7 }],
    dir: { x: 1, y: 0 },
    queue: [],
    food: { x: 13, y: 7 },
    grow: 0,
  });

  const placeFood = (s) => {
    let spot;
    do {
      spot = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) };
    } while (s.snake.some(c => c.x === spot.x && c.y === spot.y));
    s.food = spot;
  };

  const draw = useCallback(() => {
    const ctx = canvasRef.current?.getContext("2d");
    const s = stateRef.current;
    if (!ctx || !s) return;
    ctx.clearRect(0, 0, COLS * CELL, ROWS * CELL);

    // Food — honey hex-ish dot
    ctx.fillStyle = "#E4A339";
    ctx.beginPath();
    ctx.arc(s.food.x * CELL + CELL / 2, s.food.y * CELL + CELL / 2, CELL / 2 - 3, 0, Math.PI * 2);
    ctx.fill();

    // Snake — sage, head brighter
    s.snake.forEach((c, i) => {
      ctx.fillStyle = i === 0 ? "#8FD0B8" : "#74B9A0";
      ctx.beginPath();
      ctx.roundRect(c.x * CELL + 1.5, c.y * CELL + 1.5, CELL - 3, CELL - 3, 5);
      ctx.fill();
    });
  }, []);

  const start = useCallback(() => {
    stateRef.current = freshState();
    setScore(0);
    setGameOver(false);
    setRunning(true);
  }, []);

  // Game tick
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      const s = stateRef.current;
      if (!s) return;
      if (s.queue.length) s.dir = s.queue.shift();
      const head = { x: s.snake[0].x + s.dir.x, y: s.snake[0].y + s.dir.y };

      const hitWall = head.x < 0 || head.y < 0 || head.x >= COLS || head.y >= ROWS;
      const hitSelf = s.snake.some(c => c.x === head.x && c.y === head.y);
      if (hitWall || hitSelf) {
        setRunning(false);
        setGameOver(true);
        setBest(b => {
          const nb = Math.max(b, s.snake.length - 3);
          localStorage.setItem("swarm_snake_best", String(nb));
          return nb;
        });
        return;
      }

      s.snake.unshift(head);
      if (head.x === s.food.x && head.y === s.food.y) {
        setScore(v => v + 1);
        placeFood(s);
      } else {
        s.snake.pop();
      }
      draw();
    }, TICK_MS);
    return () => clearInterval(id);
  }, [running, draw]);

  // Keyboard control (arrows + WASD); arrows shouldn't scroll the page
  useEffect(() => {
    if (!running) return;
    const onKey = (e) => {
      const s = stateRef.current;
      if (!s) return;
      const dirs = {
        ArrowUp: { x: 0, y: -1 }, w: { x: 0, y: -1 },
        ArrowDown: { x: 0, y: 1 }, s: { x: 0, y: 1 },
        ArrowLeft: { x: -1, y: 0 }, a: { x: -1, y: 0 },
        ArrowRight: { x: 1, y: 0 }, d: { x: 1, y: 0 },
      };
      const nd = dirs[e.key];
      if (!nd) return;
      e.preventDefault();
      const last = s.queue.length ? s.queue[s.queue.length - 1] : s.dir;
      if (nd.x === -last.x && nd.y === -last.y) return; // no instant reverse
      if (s.queue.length < 3) s.queue.push(nd);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [running]);

  useEffect(() => { if (stateRef.current) draw(); }, [draw, running, gameOver]);

  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
      padding: "18px 18px 16px",
      background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--radius)",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", width: COLS * CELL, alignItems: "center" }}>
        <span style={{ fontFamily: "var(--mono)", fontSize: 14, color: "var(--dim)", letterSpacing: "0.1em" }}>
          SNAKE, WHILE YOU WAIT
        </span>
        <span style={{ fontFamily: "var(--mono)", fontSize: 14, color: "var(--calm)", fontVariantNumeric: "tabular-nums" }}>
          {score} · best {Math.max(best, score)}
        </span>
      </div>

      <div style={{ position: "relative" }}>
        <canvas
          ref={canvasRef}
          width={COLS * CELL}
          height={ROWS * CELL}
          style={{ display: "block", background: "var(--ink)", borderRadius: 10, border: "1px solid var(--line)" }}
        />
        {(!running) && (
          <div style={{
            position: "absolute", inset: 0, display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", gap: 10,
            background: "rgba(16,20,29,0.82)", borderRadius: 10,
          }}>
            {gameOver && (
              <span style={{ fontFamily: "var(--ui)", fontSize: 17, color: "var(--text-2)" }}>
                Caught {score} — nice.
              </span>
            )}
            <button className="btn btn-primary" onClick={start} style={{ height: 44, fontSize: 16, padding: "0 22px" }}>
              {gameOver ? "Play again" : "Play snake"}
            </button>
            <span style={{ fontFamily: "var(--mono)", fontSize: 12.5, color: "var(--dim)" }}>
              Arrow keys or WASD
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
