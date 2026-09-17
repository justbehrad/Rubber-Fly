import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUpRight,
  Check,
  CircleHelp,
  Download,
  Film,
  Focus,
  LoaderCircle,
  MousePointer2,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  X,
} from 'lucide-react';
import { ArenaRenderer } from './render/ArenaRenderer';
import { BrainRenderer } from './render/BrainRenderer';
import { recordingFrameTime } from './render/recordingCadence';
import { CATCH_PRESENTATION_SECONDS } from './render/CatchVisualState';
import { neuralColors, palette } from './theme/palette';
import { InfoModal } from './components/InfoModal';
import type { InfoModalKind } from './shared/infoModal';
import type { CircuitData, GameSnapshot, Neuron, WorkerCommand, WorkerEvent } from './shared/types';

// Warm up the canvas font before the first paintExport so ctx.fillText never
// falls back to sans-serif. Fire-and-forget: by the time the worker is ready
// and the user can click "اردک را بگیر", these promises have resolved.
document.fonts.load('800 46px Vazirmatn');
document.fonts.load('700 28px Vazirmatn');
document.fonts.load('500 28px Vazirmatn');
document.fonts.load('400 18px Vazirmatn');

const EMPTY: GameSnapshot = {
  mode: 'ready',
  time: 0,
  elapsed: 0,
  duration: 30,
  fly: { x: 500, y: 325, heading: -0.5, speed: 0 },
  threat: { x: 500, y: 325, active: false, swatting: 0 },
  neural: {
    retreat: 0,
    turn: 0,
    activity: new Float32Array(),
    disabled: new Uint8Array(),
    spikeCount: 0,
    meanHz: 0,
    aliveNeurons: 0,
  },
  lesion: 'intact',
  swats: 0,
  dodges: 0,
  swatCooldown: 0,
  simSpeed: 1,
  seed: 42,
};
// One real circuit, fully enabled. Smaller models remain offline test fixtures.
const configuredCircuit = import.meta.env.VITE_CIRCUIT_FILE || 'circuit-expanded.json';
const CIRCUIT_PATH = `/data/${configuredCircuit.replace(/^\/+|\.\./g, '')}`;
const fmt = (value: number) => new Intl.NumberFormat('fa-IR').format(value);
const getSeed = () => {
  const seed = Number(new URLSearchParams(location.search).get('seed'));
  return Number.isSafeInteger(seed) && seed > 0
    ? seed
    : crypto.getRandomValues(new Uint32Array(1))[0] || 42;
};

function Brand({ small = false }: { small?: boolean }) {
  return (
    <span className={`brand${small ? ' brand-small' : ''}`}>
      <img src="/favicon.svg" width={small ? 28 : 35} height={small ? 28 : 35} alt="" />
      <span>
        Rubber Fly<span className="brand-period">.</span>
      </span>
    </span>
  );
}

export default function App() {
  const [circuit, setCircuit] = useState<CircuitData | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [snapshot, setSnapshot] = useState<GameSnapshot>(EMPTY);
  const [modal, setModal] = useState<InfoModalKind | null>('welcome');
  const [paused, setPaused] = useState(false);
  const [recording, setRecording] = useState(false);
  const [replaying, setReplaying] = useState(false);
  const [catchSettled, setCatchSettled] = useState(false);
  const catchSettledRef = useRef(false);
  const [hasReplay, setHasReplay] = useState(false);
  const [toast, setToast] = useState('');
  const [selectedNeuron, setSelectedNeuron] = useState<Neuron | null>(null);
  const [modelStatus, setModelStatus] = useState('در حال بارگذاری مدار…');
  const [fps, setFps] = useState(60);
  const [touchUsed, setTouchUsed] = useState(false);
  const aimRef = useRef({ x: 500, y: 325, active: false });
  const seedRef = useRef(getSeed());
  const brainGesture = useRef<[number, number] | null>(null);
  const worker = useRef<Worker | null>(null);
  const framePending = useRef(false);
  const workerHealthy = useRef(false);
  const arenaCanvas = useRef<HTMLCanvasElement>(null);
  const startButton = useRef<HTMLButtonElement>(null);
  const brainCanvas = useRef<HTMLCanvasElement>(null);
  const arena = useRef<ArenaRenderer | null>(null);
  const brain = useRef<BrainRenderer | null>(null);
  const live = useRef(EMPTY);
  const painted = useRef(EMPTY);
  const circuitRef = useRef<CircuitData | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const releaseRecording = useRef<(() => void) | null>(null);
  const composite = useRef<HTMLCanvasElement | null>(null);
  const replayFrames = useRef<GameSnapshot[]>([]);
  const highlightFrames = useRef<GameSnapshot[]>([]);
  const highlightUntil = useRef(-Infinity);
  const replay = useRef<{ frames: GameSnapshot[]; cursor: number; label: string } | null>(null);
  const pausedRef = useRef(false);
  const modalRef = useRef(modal);
  modalRef.current = modal;
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const command = useCallback((message: WorkerCommand) => worker.current?.postMessage(message), []);
  const notify = useCallback((message: string) => {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 4000);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setReady(false);
    setError('');
    setModelStatus('در حال بارگذاری مدار…');
    framePending.current = false;
    workerHealthy.current = false;
    setCircuit(null);
    circuitRef.current = null;
    live.current = EMPTY;
    painted.current = EMPTY;
    setSnapshot(EMPTY);
    replay.current = null;
    replayFrames.current = [];
    highlightFrames.current = [];
    highlightUntil.current = -Infinity;
    setReplaying(false);
    setHasReplay(false);
    setSelectedNeuron(null);
    setPaused(false);
    pausedRef.current = false;
    fetch(CIRCUIT_PATH, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('مدار عصبی بارگذاری نشد. دوباره تلاش کنید.');
        const data = (await response.json()) as CircuitData;
        if (!data.neurons?.length || !data.edges?.length)
          throw new Error('فایل مدار عصبی ناقص است.');
        if (!active) return;
        setModelStatus('در حال اتصال نورون‌ها…');
        setCircuit(data);
        circuitRef.current = data;
        const engine = new Worker(new URL('./game/game.worker.ts', import.meta.url), {
          type: 'module',
        });
        worker.current = engine;
        let lastUi = 0;
        let lastSaved = -Infinity;
        let previousTime = -Infinity;
        let previousMode = 'ready';
        let previousSwats = 0;
        engine.onmessage = ({ data: message }: MessageEvent<WorkerEvent>) => {
          if (!active) return;
          if (message.type === 'frame-done') {
            framePending.current = false;
            return;
          }
          if (message.type === 'ready') {
            workerHealthy.current = true;
            setReady(true);
            setModelStatus('');
          }
          if (message.type === 'error') {
            workerHealthy.current = false;
            framePending.current = false;
            setError(message.message);
            setReady(false);
          }
          if (message.type === 'snapshot') {
            if (message.snapshot.swats > previousSwats) {
              highlightFrames.current = replayFrames.current.slice(-15);
              highlightUntil.current = message.snapshot.time + 3;
            }
            previousSwats = message.snapshot.swats;
            live.current = message.snapshot;
            if (message.snapshot.time < previousTime) lastSaved = -Infinity;
            const now = performance.now();
            if (
              !replay.current &&
              (now - lastUi > 100 || message.snapshot.mode !== painted.current.mode)
            ) {
              lastUi = now;
              setSnapshot(message.snapshot);
            }
            if (message.snapshot.mode === 'playing' && message.snapshot.time - lastSaved >= 0.064) {
              lastSaved = message.snapshot.time;
              replayFrames.current.push(message.snapshot);
              if (replayFrames.current.length > 165) replayFrames.current.shift();
              if (message.snapshot.time <= highlightUntil.current) {
                highlightFrames.current.push(message.snapshot);
                if (highlightFrames.current.length > 80) highlightFrames.current.shift();
              }
            }
            if (message.snapshot.mode === 'ready') {
              lastSaved = -Infinity;
            }
            if (message.snapshot.mode === 'caught' || message.snapshot.mode === 'escaped') {
              if (previousMode === 'playing') {
                replayFrames.current.push(message.snapshot);
                if (message.snapshot.time <= highlightUntil.current)
                  highlightFrames.current.push(message.snapshot);
              }
              setHasReplay(replayFrames.current.length > 2);
            }
            previousTime = message.snapshot.time;
            previousMode = message.snapshot.mode;
          }
        };
        engine.onerror = () => {
          workerHealthy.current = false;
          framePending.current = false;
          setError('شبیه‌سازی متوقف شد. برای شروع دوباره صفحه را بارگذاری کنید.');
          setReady(false);
        };
        engine.postMessage({
          type: 'init',
          circuit: data,
          seed: seedRef.current,
        } satisfies WorkerCommand);
      })
      .catch((err) => {
        if (active && err.name !== 'AbortError')
          setError(err instanceof Error ? err.message : 'بارگذاری مغز ممکن نشد.');
      });
    return () => {
      active = false;
      controller.abort();
      worker.current?.terminate();
      worker.current = null;
      framePending.current = false;
      workerHealthy.current = false;
    };
  }, []);

  useEffect(() => {
    if (!arenaCanvas.current) return;
    try {
      arena.current = new ArenaRenderer(arenaCanvas.current);
    } catch {
      setError(
        'مرورگر نتوانست نمای سه‌بعدی را اجرا کند. از مرورگر جدید با شتاب‌دهی سخت‌افزاری استفاده کنید.',
      );
      return;
    }
    const canvas = arenaCanvas.current;
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      if (width && height) arena.current?.resize(width, height);
    });
    observer.observe(canvas);
    return () => {
      observer.disconnect();
      arena.current?.dispose();
      arena.current = null;
    };
  }, []);

  useEffect(() => {
    if (!circuit || !brainCanvas.current) return;
    try {
      brain.current = new BrainRenderer(brainCanvas.current, circuit);
    } catch {
      notify('نمایشگر مغز به شتاب‌دهی گرافیکی نیاز دارد؛ شبیه‌سازی همچنان فعال است.');
      return;
    }
    const canvas = brainCanvas.current;
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      if (width && height) brain.current?.resize(width, height);
    });
    observer.observe(canvas);
    return () => {
      observer.disconnect();
      brain.current?.dispose();
      brain.current = null;
    };
  }, [circuit, notify]);

  const paintExport = useCallback(() => {
    if (!arenaCanvas.current || !brainCanvas.current) return null;
    if (!composite.current) {
      composite.current = document.createElement('canvas');
      composite.current.width = 1440;
      composite.current.height = 1000;
    }
    const output = composite.current;
    const ctx = output.getContext('2d');
    if (!ctx) return null;
    const drawView = (
      source: HTMLCanvasElement,
      x: number,
      y: number,
      width: number,
      height: number,
      crop?: { x: number; y: number; width: number; height: number },
    ) => {
      const area = crop ?? { x: 0, y: 0, width: source.width, height: source.height };
      const scale = Math.min(width / area.width, height / area.height);
      const w = area.width * scale,
        h = area.height * scale;
      ctx.drawImage(
        source,
        area.x,
        area.y,
        area.width,
        area.height,
        x + (width - w) / 2,
        y + (height - h) / 2,
        w,
        h,
      );
    };
    const state = painted.current;
    ctx.fillStyle = palette.paper;
    ctx.fillRect(0, 0, 1440, 1000);

    // ── header ────────────────────────────────────────────────────
    ctx.fillStyle = palette.ink;
    ctx.font = '800 40px Vazirmatn, sans-serif';
    ctx.fillText('Rubber Fly.', 40, 63);

    // Anchor the Persian tagline a fixed gap after the title. Vazirmatn's
    // Latin is narrower than Bricolage, so a hardcoded x would drift.
    const titleWidth = ctx.measureText('Rubber Fly.').width;
    ctx.font = '500 28px Vazirmatn, sans-serif';
    ctx.fillText('اردک را بگیر؛ اگر می‌توانی.', 40 + titleWidth + 24, 61);

    ctx.font = '400 18px Vazirmatn, sans-serif';
    ctx.fillStyle = palette.muted;
    ctx.textAlign = 'right';
    ctx.fillText('مدار واقعی · پرواز آرکید', 1396, 60);
    ctx.textAlign = 'left';

    // ── arena panel ───────────────────────────────────────────────
    ctx.fillStyle = palette.scene;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(34, 96, 1060, 800, 25);
    ctx.fill();
    ctx.clip();
    drawView(arenaCanvas.current, 34, 96, 1060, 800);
    ctx.restore();

    // ── brain panel ───────────────────────────────────────────────
    ctx.fillStyle = palette.brain;
    ctx.beginPath();
    ctx.roundRect(1110, 96, 296, 800, 25);
    ctx.fill();

    ctx.fillStyle = palette.onBrain;
    ctx.font = '700 28px Vazirmatn, sans-serif';
    ctx.fillText('ذهن کوچک.', 1134, 145);

    drawView(brainCanvas.current, 1120, 171, 276, 480, brain.current?.getExportCrop());

    ctx.fillStyle = palette.lime;
    ctx.font = '800 46px Vazirmatn, sans-serif';
    ctx.fillText(fmt(state.neural.aliveNeurons), 1134, 726);

    ctx.fillStyle = palette.onBrainMuted;
    ctx.font = '400 18px Vazirmatn, sans-serif';
    ctx.fillText('نورون فعال', 1134, 754);
    ctx.fillText(`${compact(circuitRef.current?.edges.length ?? 0)} اتصال واقعی`, 1134, 786);

    // ── stats line ────────────────────────────────────────────────
    ctx.font = '700 25px Vazirmatn, sans-serif';
    ctx.fillStyle = palette.ink;
    ctx.fillText(
      `${state.mode === 'caught' ? `گرفته شد: ${state.elapsed.toFixed(1)} ثانیه` : `${state.elapsed.toFixed(1)} ثانیه دوام آورد`}   ·   ${state.swats} ضربه   ·   ${state.dodges} خطا`,
      40,
      944,
    );

    // ── footer ────────────────────────────────────────────────────
    ctx.font = '400 16px Vazirmatn, sans-serif';
    ctx.fillStyle = palette.muted;
    ctx.textAlign = 'right';
    ctx.fillText(`MaleCNS v1.0 · ${location.host}`, 1398, 980);
    ctx.textAlign = 'left';

    // ── speed badge ───────────────────────────────────────────────
    if (replay.current || state.simSpeed < 0.95) {
      ctx.fillStyle = palette.ink;
      ctx.fillRect(53, 116, 286, 37);
      ctx.fillStyle = palette.paper;
      ctx.font = '400 17px Vazirmatn, sans-serif';
      ctx.fillText(
        replay.current ? 'بازپخش آهسته · ۰٫۴×' : `شبیه‌سازی · سرعت ${state.simSpeed.toFixed(2)}×`,
        67,
        141,
      );
    }
    return output;
  }, []);

  useEffect(() => {
    let frame = 0;
    let last = performance.now();
    let lastReplayUi = 0;
    let lastExportPaint: number | null = null;
    let fpsStart = last,
      frameCount = 0;
    const tick = (now: number) => {
      // A visible frame can wake a timer-throttled worker. One outstanding
      // heartbeat at most; the worker still owns elapsed time and fixed steps.
      if (
        worker.current &&
        workerHealthy.current &&
        !framePending.current &&
        live.current.mode === 'playing' &&
        !document.hidden &&
        !pausedRef.current &&
        !replay.current &&
        !modalRef.current
      ) {
        framePending.current = true;
        command({ type: 'frame' });
      }
      frameCount++;
      if (now - fpsStart > 1000) {
        setFps(Math.min(240, Math.round((frameCount * 1000) / (now - fpsStart))));
        frameCount = 0;
        fpsStart = now;
      }
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      let state = live.current;
      if (replay.current) {
        const frames = replay.current.frames;
        // Replay and its cosmetic tail use the same held/clamped clock. A
        // hidden tab or Help dialog cannot skip past an unseen impact.
        if (!document.hidden && !modalRef.current) replay.current.cursor += dt * 0.4;
        const at = replay.current.cursor;
        const index = frames.findIndex((f) => f.time >= at);
        const finalFrame = frames[frames.length - 1];
        // Hold the real final catch for its cosmetic squash/recoil. No new
        // physics or neural frames are fabricated for this replay tail.
        if (
          index === -1 &&
          finalFrame.mode === 'caught' &&
          at - finalFrame.time < CATCH_PRESENTATION_SECONDS
        ) {
          state = finalFrame;
          if (now - lastReplayUi > 100) {
            setSnapshot(state);
            lastReplayUi = now;
          }
        } else if (index === -1) {
          replay.current = null;
          setReplaying(false);
          setSnapshot(live.current);
          command({
            type: 'pause',
            paused: pausedRef.current || document.hidden || !!modalRef.current,
          });
        } else {
          state = frames[index];
          if (now - lastReplayUi > 100) {
            setSnapshot(state);
            lastReplayUi = now;
          }
        }
      }
      painted.current = state;
      arena.current?.update(state);
      const catchAge = arena.current?.render(dt, {
        rate: replay.current ? 0.4 : 1,
        held: document.hidden || !!modalRef.current,
      });
      const settled =
        state.mode === 'caught' && (catchAge == null || catchAge >= CATCH_PRESENTATION_SECONDS);
      if (settled !== catchSettledRef.current) {
        catchSettledRef.current = settled;
        setCatchSettled(settled);
      }
      brain.current?.update(state);
      brain.current?.render(dt);
      // The recorder captures 30 fps. Avoid drawing two expensive composite
      // frames per captured frame on a 60 Hz display (or more on faster ones).
      if (recorder.current?.state === 'recording') {
        const frameTime = recordingFrameTime(lastExportPaint, now);
        if (frameTime !== null) {
          paintExport();
          lastExportPaint = frameTime;
        }
      } else {
        lastExportPaint = null;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [command, paintExport]);

  useEffect(() => {
    const onVisibility = () =>
      command({
        type: 'pause',
        paused: document.hidden || pausedRef.current || !!replay.current || modal !== null,
      });
    document.addEventListener('visibilitychange', onVisibility);
    if (ready) onVisibility();
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [command, modal, ready]);

  useEffect(
    () => () => {
      clearTimeout(toastTimer.current);
      if (recorder.current) {
        recorder.current.onstop = null;
        recorder.current.onerror = null;
        if (recorder.current.state !== 'inactive') recorder.current.stop();
      }
      releaseRecording.current?.();
    },
    [],
  );

  const endReplay = useCallback(() => {
    replay.current = null;
    setReplaying(false);
  }, []);
  const focusArena = useCallback(
    () => arenaCanvas.current?.parentElement?.focus({ preventScroll: true }),
    [],
  );
  const focusEntry = useCallback(() => {
    if (startButton.current && !startButton.current.disabled)
      startButton.current.focus({ preventScroll: true });
    else arenaCanvas.current?.parentElement?.focus({ preventScroll: true });
  }, []);
  const startRound = useCallback(() => {
    if (!ready || error || modalRef.current) return;
    endReplay();
    replayFrames.current = [];
    setHasReplay(false);
    setPaused(false);
    pausedRef.current = false;
    highlightFrames.current = [];
    highlightUntil.current = -Infinity;
    aimRef.current.active = false;
    command({ type: 'pointer', x: 500, y: 325, active: false });
    command({ type: 'pause', paused: false });
    command({ type: 'start' });
    focusArena();
  }, [command, ready, error, endReplay, focusArena]);
  const reset = useCallback(() => {
    endReplay();
    setPaused(false);
    pausedRef.current = false;
    command({ type: 'pause', paused: false });
    command({ type: 'reset' });
    replayFrames.current = [];
    setHasReplay(false);
    highlightFrames.current = [];
    highlightUntil.current = -Infinity;
    aimRef.current.active = false;
    focusArena();
  }, [command, endReplay, focusArena]);
  const swat = useCallback(() => {
    if (
      modalRef.current ||
      live.current.mode !== 'playing' ||
      pausedRef.current ||
      replay.current ||
      !aimRef.current.active ||
      live.current.swatCooldown > 0
    )
      return;
    command({ type: 'swat' });
  }, [command]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      // Native dialog cancellation owns Escape. Game shortcuts never bypass
      // the initial acknowledgement or fire behind an open modal.
      if (modal) return;
      const target = event.target as HTMLElement;
      if (target.closest('button, input, select, textarea, a, [role="dialog"]')) return;
      if (event.code === 'Space' && !modal) {
        event.preventDefault();
        if (live.current.mode !== 'playing') startRound();
        else swat();
      }
      if (
        ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key) &&
        !modal &&
        live.current.mode === 'playing' &&
        !replay.current
      ) {
        event.preventDefault();
        const aim = aimRef.current.active ? aimRef.current : { x: 500, y: 325 };
        aimRef.current = {
          x: Math.max(
            0,
            Math.min(
              1000,
              aim.x + (event.key === 'ArrowLeft' ? -35 : event.key === 'ArrowRight' ? 35 : 0),
            ),
          ),
          y: Math.max(
            0,
            Math.min(
              650,
              aim.y + (event.key === 'ArrowUp' ? -35 : event.key === 'ArrowDown' ? 35 : 0),
            ),
          ),
          active: true,
        };
        command({ type: 'pointer', ...aimRef.current });
      }
      if (event.key.toLowerCase() === 'r' && !modal) reset();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [startRound, swat, reset, modal, command]);

  const setPointer = (event: React.PointerEvent<HTMLDivElement>) => {
    if (
      modalRef.current ||
      replay.current ||
      !arena.current ||
      (event.target as HTMLElement).closest('button')
    )
      return;
    const point = arena.current.screenToWorld(event.clientX, event.clientY);
    aimRef.current = { ...point, active: true };
    if (event.pointerType === 'touch') setTouchUsed(true);
    command({ type: 'pointer', ...aimRef.current });
  };
  const togglePause = () => {
    const next = !paused;
    setPaused(next);
    pausedRef.current = next;
    command({ type: 'pause', paused: next });
    focusArena();
  };
  const startReplay = () => {
    if (replayFrames.current.length < 3) return;
    const highlight = highlightFrames.current.length >= 3;
    const frames = highlight ? highlightFrames.current : replayFrames.current.slice(-90);
    replay.current = {
      frames,
      cursor: frames[0].time,
      label: highlight ? 'آخرین ضربه' : 'ثانیه‌های پایانی',
    };
    setReplaying(true);
    command({ type: 'pause', paused: true });
  };
  const saveImage = () => {
    arena.current?.render(0);
    brain.current?.render(0);
    const canvas = paintExport();
    canvas?.toBlob((blob) => {
      if (blob) downloadBlob(blob, 'rubber-fly-snapshot.png');
    }, 'image/png');
  };
  const toggleRecord = () => {
    if (recorder.current) {
      if (recorder.current.state === 'recording') recorder.current.stop();
      return;
    }
    if (!('MediaRecorder' in window) || !HTMLCanvasElement.prototype.captureStream) {
      saveImage();
      notify('ضبط ویدئو در این مرورگر پشتیبانی نمی‌شود؛ تصویر ذخیره شد.');
      return;
    }
    const output = paintExport();
    if (!output) return;
    const mime = ['video/mp4;codecs=avc1.42E01E', 'video/webm;codecs=vp9', 'video/webm'].find(
      (type) => MediaRecorder.isTypeSupported(type),
    );
    if (!mime) {
      saveImage();
      notify('تصویر ذخیره شد؛ این مرورگر خروجی ویدئو را پشتیبانی نمی‌کند.');
      return;
    }
    let stream: MediaStream | null = null;
    try {
      stream = output.captureStream(30);
      const recording = new MediaRecorder(stream, {
        mimeType: mime,
        videoBitsPerSecond: 5_000_000,
      });
      recorder.current = recording;
      const chunks: BlobPart[] = [];
      recording.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      const timer = setTimeout(() => {
        if (recording.state === 'recording') recording.stop();
      }, 30_000);
      const cleanup = () => {
        clearTimeout(timer);
        stream?.getTracks().forEach((track) => {
          track.stop();
        });
        releaseRecording.current = null;
      };
      releaseRecording.current = cleanup;
      recording.onstop = () => {
        cleanup();
        setRecording(false);
        downloadBlob(
          new Blob(chunks, { type: mime }),
          `rubber-fly-replay.${mime.includes('mp4') ? 'mp4' : 'webm'}`,
        );
        notify('ویدئوی شما آماده است.');
        recorder.current = null;
      };
      recording.onerror = () => {
        recording.onstop = null;
        cleanup();
        setRecording(false);
        recorder.current = null;
        notify('ضبط کامل نشد؛ همچنان می‌توانید تصویر ذخیره کنید.');
      };
      recording.start(1000);
      setRecording(true);
      notify('هر دو نما در حال ضبط‌اند؛ ضبط پس از ۳۰ ثانیه خودکار متوقف می‌شود.');
    } catch {
      stream?.getTracks().forEach((track) => {
        track.stop();
      });
      releaseRecording.current?.();
      recorder.current = null;
      setRecording(false);
      saveImage();
      notify('خروجی ویدئو شروع نشد؛ تصویر جایگزین ذخیره شد.');
    }
  };

  const timeLeft = Math.max(0, snapshot.duration - snapshot.elapsed);
  const result = snapshot.mode === 'caught' || snapshot.mode === 'escaped';
  const intro = snapshot.mode === 'ready';
  const populations = useMemo(() => {
    const groups = [
      { label: 'بینایی', role: 'sensory', color: neuralColors.vision, sum: 0, count: 0, active: 0 },
      {
        label: 'شبکه',
        role: 'interneuron',
        color: neuralColors.network,
        sum: 0,
        count: 0,
        active: 0,
      },
      {
        label: 'فرار',
        role: 'descending',
        color: neuralColors.escape,
        sum: 0,
        count: 0,
        active: 0,
      },
    ];
    circuit?.neurons.forEach((cell, index) => {
      if (snapshot.neural.disabled[index]) return;
      const group = groups[cell.type === 'LC16' ? 0 : cell.type === 'MDN' ? 2 : 1];
      const value = snapshot.neural.activity[index] || 0;
      group.sum += value;
      group.count++;
      if (value > 0.1) group.active++;
    });
    return groups;
  }, [circuit, snapshot.neural]);
  const activeNeurons = populations.reduce((total, group) => total + group.active, 0);
  const selectedIndex =
    selectedNeuron && circuit
      ? circuit.neurons.findIndex((cell) => cell.id === selectedNeuron.id)
      : -1;
  const selectedActivity = selectedIndex >= 0 ? snapshot.neural.activity[selectedIndex] || 0 : 0;
  const flightLabel = intro
    ? 'آماده'
    : paused
      ? 'توقف'
      : result
        ? snapshot.mode === 'caught'
          ? 'گرفته شد'
          : 'فرار کرد'
        : snapshot.fly.flightState === 'evading'
          ? 'جا خالی می‌دهد'
          : snapshot.fly.flightState === 'darting'
            ? 'شتاب می‌گیرد'
            : 'در حال پرواز';
  return (
    <>
      <main>
        <h1 className="sr-only">Rubber Fly؛ اردک را بگیر، اگر می‌توانی.</h1>
        <section className="experiment-layout" aria-label="بازی اردک و فعالیت زنده‌ی نورونی">
          <div className="arena-card">
            <div className="panel-heading">
              <a className="brand-link" href="/" aria-label="خانه Rubber Fly">
                <Brand small />
              </a>
              <div className="arena-tools">
                <button
                  type="button"
                  className="icon-button"
                  aria-label="راهنمای بازی"
                  onClick={() => setModal('help')}
                >
                  <CircleHelp size={17} />
                </button>
              </div>
            </div>
            {/* biome-ignore lint/a11y/useSemanticElements: This canvas game group is not a form fieldset. */}
            <div
              className={`arena-viewport${intro ? ' is-ready' : ''}`}
              role="group"
              // biome-ignore lint/a11y/noNoninteractiveTabindex: The game needs a focus target for its documented arrow and Space controls.
              tabIndex={0}
              aria-label="محوطه‌ی پرواز اردک؛ برای نشانه‌گیری حرکت کنید و کلیک یا Space را بزنید."
              onPointerMove={setPointer}
              onPointerLeave={(event) => {
                if (!replay.current && event.pointerType !== 'touch') {
                  aimRef.current.active = false;
                  command({ type: 'pointer', x: 0, y: 0, active: false });
                }
              }}
              onPointerDown={(event) => {
                if ((event.target as HTMLElement).closest('button')) return;
                setPointer(event);
                if (event.pointerType !== 'touch') swat();
              }}
            >
              <canvas
                className="arena-canvas"
                ref={arenaCanvas}
                aria-label="نمای جانبی یک اردک بال‌دار کارتونی در حال پرواز"
              />
              {!intro && (
                <span className={`flight-state state-${snapshot.fly.flightState || 'cruising'}`}>
                  {flightLabel}
                </span>
              )}
              {snapshot.mode === 'playing' && snapshot.simSpeed < 0.85 && (
                <span className="sim-speed">
                  سرعت اجرا {snapshot.simSpeed.toFixed(2)}× —{' '}
                  {recording
                    ? 'برای کاهش فشار، ضبط را متوقف کنید'
                    : 'دستگاه در حال جبران عقب‌ماندگی است'}
                </span>
              )}
              {intro && !error && (
                <div className="start-overlay">
                  <button
                    type="button"
                    ref={startButton}
                    className="primary-button start-button"
                    onClick={startRound}
                    disabled={!ready}
                  >
                    {ready ? (
                      <>
                        <Play size={20} fill="currentColor" />
                        اردک را بگیر
                      </>
                    ) : (
                      <>
                        <LoaderCircle className="spin" size={19} />
                        {modelStatus}
                      </>
                    )}
                  </button>
                  <span>۳۰ ثانیه؛ جلوتر از اردک نشانه بگیر.</span>
                </div>
              )}
              {error && (
                <div className="error-overlay" role="alert">
                  <strong>بازی باید دوباره اجرا شود.</strong>
                  <p>{error}</p>
                  <button
                    type="button"
                    className="primary-button"
                    disabled={recording}
                    onClick={() => location.reload()}
                  >
                    {recording ? 'برای بارگذاری، ضبط را متوقف کنید' : 'بارگذاری دوباره'}
                  </button>
                </div>
              )}
              {paused && !result && !intro && !replaying && (
                <div className="pause-overlay">
                  <h2>توقف</h2>
                  <button
                    type="button"
                    className="primary-button play-button"
                    onClick={togglePause}
                  >
                    <Play size={18} />
                    ادامه
                  </button>
                </div>
              )}
              {result && !replaying && (snapshot.mode !== 'caught' || catchSettled) && (
                <div
                  className={`result-overlay${snapshot.mode === 'caught' ? ' result-caught' : ''}`}
                >
                  <span className="result-icon">
                    {snapshot.mode === 'caught' ? <Focus size={30} /> : <Sparkles size={30} />}
                  </span>
                  <h2>{snapshot.mode === 'caught' ? 'گرفتمت!' : 'اردک برنده شد.'}</h2>
                  <p>
                    {snapshot.mode === 'caught'
                      ? `${snapshot.elapsed.toFixed(1)} ثانیه · ${snapshot.swats} ضربه`
                      : `${snapshot.dodges} خطا؛ اردک با غرور فرار کرد.`}
                  </p>
                  <div className="result-actions">
                    <button
                      type="button"
                      className="primary-button play-button"
                      onClick={startRound}
                    >
                      <RotateCcw size={17} />
                      بازی دوباره
                    </button>
                    <button type="button" className="secondary-button" onClick={saveImage}>
                      <Download size={17} />
                      ذخیره
                    </button>
                  </div>
                  {hasReplay && (
                    <button
                      type="button"
                      className="text-button replay-button"
                      onClick={startReplay}
                    >
                      <Film size={16} />
                      بازپخش آهسته
                    </button>
                  )}
                </div>
              )}
              {replaying && (
                <div className="replay-badge">
                  <Film size={16} />
                  {replay.current?.label} · 0.4×
                  <button
                    type="button"
                    onClick={() => {
                      endReplay();
                      command({ type: 'pause', paused: pausedRef.current });
                      setSnapshot(live.current);
                    }}
                  >
                    خروج از بازپخش <X size={14} />
                  </button>
                </div>
              )}
              <button
                type="button"
                className={`mobile-swat${touchUsed ? ' touch-visible' : ''}`}
                disabled={
                  snapshot.mode !== 'playing' || paused || replaying || snapshot.swatCooldown > 0
                }
                onPointerDown={(event) => event.stopPropagation()}
                onClick={swat}
              >
                <Focus size={21} />
                ضربه
              </button>
            </div>
            <div className="arena-bottom">
              <div className="score-stat">
                <span>زمان</span>
                <strong className={timeLeft < 6 && snapshot.mode === 'playing' ? 'time-low' : ''}>
                  {String(Math.ceil(timeLeft)).padStart(2, '0')}
                  <small>s</small>
                </strong>
              </div>
              <div className="score-stat">
                <span>ضربه</span>
                <strong>{String(snapshot.swats).padStart(2, '0')}</strong>
              </div>
              <div className="score-stat">
                <span>خطا</span>
                <strong>{String(snapshot.dodges).padStart(2, '0')}</strong>
              </div>
              <div className="round-controls">
                <button
                  type="button"
                  className="icon-button"
                  aria-label="شروع دوباره"
                  title="شروع دوباره (R)"
                  onClick={reset}
                  disabled={!ready}
                >
                  <RotateCcw size={19} />
                </button>
                <button
                  type="button"
                  className="icon-button"
                  aria-label={paused ? 'ادامه بازی' : 'توقف بازی'}
                  onClick={togglePause}
                  disabled={!ready || intro || result || replaying}
                >
                  {paused ? <Play size={19} /> : <Pause size={19} />}
                </button>
              </div>
            </div>
            <div className="play-controls">
              <p>
                <MousePointer2 size={16} />
                <span className="desktop-instruction">جلوتر کلیک کن · برخورد با ¼ ثانیه تأخیر</span>
                <span className="touch-instruction">جلوتر بکش و «ضربه» را بزن.</span>
              </p>
              <div className="export-controls">
                <button
                  type="button"
                  className={`text-button${recording ? ' is-recording' : ''}`}
                  onClick={toggleRecord}
                  disabled={!ready && !recording}
                >
                  <span className="record-dot" />
                  {recording ? 'توقف ضبط' : 'ضبط ویدئو'}
                </button>
                <button type="button" className="text-button" onClick={saveImage} disabled={!ready}>
                  <Download size={16} />
                  تصویر
                </button>
              </div>
              <div className="performance">
                <span className={fps < 35 ? 'performance-warn' : ''}>{fps} fps</span>
                <span>
                  {snapshot.mode === 'playing'
                    ? `${snapshot.simSpeed.toFixed(2)}× sim`
                    : 'روی دستگاه'}
                </span>
              </div>
            </div>
          </div>

          <aside className="brain-card" aria-label="مدار عصبی زنده">
            <div className="panel-heading brain-heading">
              <h2>
                ذهن کوچک<span>.</span>
              </h2>
            </div>
            <div className="brain-view">
              <canvas
                ref={brainCanvas}
                aria-label="موقعیت نورون‌های واقعی با درخشش متناسب با شلیک شبیه‌سازی‌شده"
                onPointerDown={(event) => {
                  brainGesture.current = [event.clientX, event.clientY];
                }}
                onPointerUp={(event) => {
                  const start = brainGesture.current;
                  if (start && Math.hypot(event.clientX - start[0], event.clientY - start[1]) < 5)
                    setSelectedNeuron(brain.current?.pick(event.clientX, event.clientY) ?? null);
                  brainGesture.current = null;
                }}
              />
              {!circuit && (
                <span className="brain-loading">
                  <LoaderCircle size={25} className="spin" />
                  {modelStatus}
                </span>
              )}
              <div className="brain-live-count">
                <strong>{fmt(activeNeurons)}</strong>
                <span>فعال در لحظه</span>
              </div>
              {selectedNeuron && (
                <div className="neuron-tag">
                  <strong>
                    {selectedNeuron.type || 'نورون'} · {selectedNeuron.side}
                  </strong>
                  <span>
                    سلول {selectedNeuron.id} · فعالیت اخیر {Math.round(selectedActivity * 100)}٪
                  </span>
                  <button
                    type="button"
                    aria-label="بستن جزئیات نورون"
                    onClick={() => setSelectedNeuron(null)}
                  >
                    <X size={14} />
                  </button>
                </div>
              )}
              <span className="brain-orbit-hint">برای چرخش بکش · یک نورون را لمس کن</span>
            </div>
            <section className="population-strip" aria-label="فعالیت اخیر گروه‌های نورونی">
              {populations.map((group) => (
                <div
                  className="population"
                  key={group.role}
                  style={{ '--population-color': group.color } as React.CSSProperties}
                  title={`${group.active} نورون فعال از ${group.count} نورون روشن`}
                >
                  <span>
                    <i />
                    {group.label}
                  </span>
                  <div className="population-meter">
                    <i
                      style={{
                        width: `${group.count ? Math.min(100, (group.sum / group.count) * 250) : 0}%`,
                      }}
                    />
                  </div>
                  <strong>
                    {group.active}
                    <small> / {group.count}</small>
                  </strong>
                </div>
              ))}
            </section>
            <section className="circuit-readout" aria-label="مدار واقعی کاملاً فعال">
              <div>
                <strong>{circuit ? fmt(circuit.neurons.length) : '—'}</strong>
                <span>نورون</span>
              </div>
              <div>
                <strong>{circuit ? compact(circuit.edges.length) : '—'}</strong>
                <span>اتصال واقعی</span>
              </div>
            </section>
            <footer className="brain-footer">
              <button type="button" className="text-button" onClick={() => setModal('about')}>
                مدار واقعی؛ پرواز آرکید. <CircleHelp size={14} />
              </button>
              <a href="https://male-cns.janelia.org/" target="_blank" rel="noreferrer">
                MaleCNS · CC BY 4.0 <ArrowUpRight size={12} />
              </a>
            </footer>
          </aside>
        </section>
      </main>
      {toast && (
        <div className="toast" role="status">
          <Check size={17} />
          {toast}
        </div>
      )}
      {modal && (
        <InfoModal
          kind={modal}
          circuit={circuit}
          onClose={() => setModal(null)}
          onEntered={focusEntry}
        />
      )}
    </>
  );
}

function compact(number: number) {
  return number >= 1_000_000
    ? `${(number / 1_000_000).toFixed(2)}M`
    : number >= 1000
      ? `${(number / 1000).toFixed(number >= 100_000 ? 0 : 1)}k`
      : fmt(number);
}
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}