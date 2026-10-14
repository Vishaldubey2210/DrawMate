import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  Brain,
  Eraser,
  Paintbrush,
  Trash2,
  Sparkles,
  ChevronDown,
  RefreshCw,
  Target,
  Zap,
  Info,
  CheckCircle2,
  AlertCircle,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { practiceService, SketchPrediction, PracticeHealthResponse } from '../../services/practiceService.js';

const COLORS = [
  '#000000', '#475569', '#ffffff', '#dc2626', '#ea580c',
  '#eab308', '#16a34a', '#06b6d4', '#2563eb', '#7c3aed',
  '#db2777', '#78350f',
];

const BRUSH_SIZES = [
  { label: 'Thin', value: 2, icon: 4 },
  { label: 'Medium', value: 6, icon: 9 },
  { label: 'Thick', value: 14, icon: 16 },
];

type DrawTool = 'brush' | 'eraser';

const ConfidenceBar: React.FC<{
  item: SketchPrediction;
  rank: number;
  targetWord: string;
}> = ({ item, rank, targetWord }) => {
  const pct = Math.round(item.confidence * 100);
  const isMatch = item.class_name.toLowerCase() === targetWord.toLowerCase();
  const colors = [
    'from-indigo-500 to-violet-500',
    'from-violet-500 to-fuchsia-500',
    'from-fuchsia-500 to-pink-500',
    'from-pink-500 to-rose-500',
    'from-slate-400 to-slate-500',
  ];
  const barColor = isMatch ? 'from-emerald-400 to-green-500' : colors[rank] || colors[4];

  return (
    <div className="flex items-center gap-3">
      <span
        className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${
          rank === 0
            ? 'bg-yellow-400 text-yellow-900'
            : rank === 1
            ? 'bg-slate-300 dark:bg-slate-600 text-slate-700 dark:text-slate-200'
            : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
        }`}
      >
        {rank + 1}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold capitalize text-slate-800 dark:text-slate-200 truncate">
              {item.class_name}
            </span>
            {isMatch && (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            )}
          </div>
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 shrink-0">{pct}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-700/60 overflow-hidden">
          <div
            className={`h-full rounded-full bg-gradient-to-r ${barColor} transition-all duration-700 ease-out`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
};

export const PracticePage: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null!);
  const containerRef = useRef<HTMLDivElement>(null!);
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  const [tool, setTool] = useState<DrawTool>('brush');
  const [color, setColor] = useState('#000000');
  const [brushSize, setBrushSize] = useState(BRUSH_SIZES[1].value);
  const [hasStrokes, setHasStrokes] = useState(false);

  const [health, setHealth] = useState<PracticeHealthResponse | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);
  const [predictions, setPredictions] = useState<SketchPrediction[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [aiMessage, setAiMessage] = useState<string | null>(null);
  const [analyzed, setAnalyzed] = useState(false);

  const [targetWord, setTargetWord] = useState<string>('');
  const [showWordPicker, setShowWordPicker] = useState(false);

  const logicalSize = useRef({ w: 800, h: 600 });

  useEffect(() => {
    setHealthLoading(true);
    practiceService
      .getHealth()
      .then((h) => {
        setHealth(h);
        if (h.classes.length > 0) {
          setTargetWord(h.classes[Math.floor(Math.random() * h.classes.length)]);
        }
      })
      .catch(() => {
        setHealth({ available: false, modelLoaded: false, classes: [], numClasses: 0 });
      })
      .finally(() => setHealthLoading(false));
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        const { width, height } = e.contentRect;
        if (width <= 0 || height <= 0) continue;

        // Preserve existing drawing before resizing canvas buffer
        let tempCanvas: HTMLCanvasElement | null = null;
        if (canvas.width > 0 && canvas.height > 0) {
          tempCanvas = document.createElement('canvas');
          tempCanvas.width = canvas.width;
          tempCanvas.height = canvas.height;
          const tempCtx = tempCanvas.getContext('2d');
          if (tempCtx) {
            tempCtx.drawImage(canvas, 0, 0);
          }
        }

        logicalSize.current = { w: width, h: height };
        const dpr = window.devicePixelRatio || 1;
        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);
        const ctx = canvas.getContext('2d')!;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(dpr, dpr);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);

        if (tempCanvas) {
          ctx.drawImage(tempCanvas, 0, 0, width, height);
        }
      }
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  const getPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Pointer capture might not be supported in some environments
    }
    isDrawingRef.current = true;
    const pt = getPoint(e);
    lastPointRef.current = pt;
    const ctx = canvasRef.current.getContext('2d')!;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, brushSize / 2, 0, Math.PI * 2);
    ctx.fillStyle = tool === 'eraser' ? '#ffffff' : color;
    ctx.fill();
    setHasStrokes(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    const pt = getPoint(e);
    const last = lastPointRef.current;
    if (!last) return;
    const ctx = canvasRef.current.getContext('2d')!;
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(pt.x, pt.y);
    ctx.strokeStyle = tool === 'eraser' ? '#ffffff' : color;
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    lastPointRef.current = pt;
  };

  const handlePointerUp = (e?: React.PointerEvent<HTMLCanvasElement>) => {
    if (e && e.currentTarget) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // Pointer capture release safety
      }
    }
    isDrawingRef.current = false;
    lastPointRef.current = null;
  };

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, logicalSize.current.w, logicalSize.current.h);
    setHasStrokes(false);
    setPredictions([]);
    setAiMessage(null);
    setAnalyzed(false);
  }, []);

  const analyzeDrawing = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas || analyzing) return;
    setAnalyzing(true);
    setAiMessage(null);
    try {
      const dataUrl = canvas.toDataURL('image/png');
      const base64 = dataUrl.split(',')[1];
      const result = await practiceService.predict(base64, 5);
      setPredictions(result.top_predictions);
      setAiMessage(result.message || null);
      setAnalyzed(true);
    } catch (err: any) {
      setAiMessage(err?.message || 'Prediction failed. Is the AI service running?');
      setPredictions([]);
    } finally {
      setAnalyzing(false);
    }
  }, [analyzing]);

  const pickRandomWord = () => {
    if (!health?.classes.length) return;
    const remaining = health.classes.filter((c) => c !== targetWord);
    const pool = remaining.length > 0 ? remaining : health.classes;
    setTargetWord(pool[Math.floor(Math.random() * pool.length)]);
    clearCanvas();
  };

  const topMatch = predictions[0];
  const isCorrect =
    analyzed &&
    topMatch &&
    topMatch.class_name.toLowerCase() === targetWord.toLowerCase() &&
    topMatch.confidence > 0.5;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <Brain className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              AI Practice Mode
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Draw a sketch — our trained CNN will try to recognize it
            </p>
          </div>
        </div>

        <div className="shrink-0 flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          {healthLoading ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-slate-400" />
          ) : health?.available && health.modelLoaded ? (
            <>
              <Wifi className="w-3.5 h-3.5 text-emerald-500" />
              <span className="text-emerald-600 dark:text-emerald-400">
                AI Online &middot; {health.numClasses} classes
              </span>
            </>
          ) : (
            <>
              <WifiOff className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-amber-600 dark:text-amber-400">AI Offline</span>
            </>
          )}
        </div>
      </div>

      {!healthLoading && (!health?.available || !health?.modelLoaded) && (
        <div className="flex items-start gap-3 p-4 rounded-2xl border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/30">
          <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
          <div className="text-xs text-amber-800 dark:text-amber-300 space-y-1">
            <p className="font-bold">Sketch recognition service is offline</p>
            <p>
              Start the FastAPI server:{' '}
              <code className="font-mono bg-amber-100 dark:bg-amber-900/60 px-1.5 py-0.5 rounded text-[11px]">
                uvicorn ml.sketch_recognizer.service.app:app --port 8000
              </code>
            </p>
            <p>You can still draw on the canvas while the service is offline.</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-6">
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-4 rounded-2xl border border-indigo-200/70 dark:border-indigo-900/60 bg-gradient-to-r from-indigo-50 to-violet-50 dark:from-indigo-950/40 dark:to-violet-950/30">
            <Target className="w-5 h-5 text-indigo-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-400 mb-0.5">Draw this word</p>
              <p className="text-2xl font-black text-indigo-700 dark:text-indigo-300 capitalize tracking-tight">
                {targetWord || '—'}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {health?.classes && health.classes.length > 0 && (
                <div className="relative">
                  <button
                    onClick={() => setShowWordPicker(!showWordPicker)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-indigo-700 dark:text-indigo-300 bg-white dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-50 dark:hover:bg-indigo-900/60 transition-colors"
                  >
                    Choose <ChevronDown className="w-3 h-3" />
                  </button>
                  {showWordPicker && (
                    <div className="absolute right-0 top-full mt-1 z-30 w-40 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-xl py-1 max-h-48 overflow-y-auto">
                      {health.classes.map((cls) => (
                        <button
                          key={cls}
                          onClick={() => { setTargetWord(cls); setShowWordPicker(false); clearCanvas(); }}
                          className={`w-full text-left px-3 py-1.5 text-xs capitalize font-medium transition-colors ${
                            cls === targetWord
                              ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-bold'
                              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                          }`}
                        >
                          {cls}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <button
                onClick={pickRandomWord}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-indigo-700 dark:text-indigo-300 bg-white dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-50 dark:hover:bg-indigo-900/60 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Random
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl p-1 gap-1">
              <button
                onClick={() => setTool('brush')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  tool === 'brush'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                <Paintbrush className="w-3.5 h-3.5" /> Brush
              </button>
              <button
                onClick={() => setTool('eraser')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  tool === 'eraser'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                <Eraser className="w-3.5 h-3.5" /> Eraser
              </button>
            </div>

            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
              {BRUSH_SIZES.map((bs) => (
                <button
                  key={bs.label}
                  onClick={() => setBrushSize(bs.value)}
                  className={`flex items-center justify-center w-8 h-8 rounded-lg transition-all ${
                    brushSize === bs.value
                      ? 'bg-white dark:bg-slate-700 shadow-sm'
                      : 'hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                  title={bs.label}
                >
                  <div
                    className="rounded-full bg-slate-800 dark:bg-slate-200"
                    style={{ width: bs.icon, height: bs.icon }}
                  />
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1 flex-wrap">
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => { setColor(c); setTool('brush'); }}
                  className={`w-6 h-6 rounded-lg border-2 transition-all hover:scale-110 ${
                    color === c && tool === 'brush'
                      ? 'border-indigo-500 scale-110 shadow-md'
                      : 'border-transparent'
                  }`}
                  style={{ backgroundColor: c }}
                  title={c}
                />
              ))}
            </div>

            <button
              onClick={clearCanvas}
              className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-100 dark:border-rose-900/50 hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" /> Clear
            </button>
          </div>

          <div
            ref={containerRef}
            className="relative w-full aspect-[4/3] max-h-[500px] bg-white rounded-2xl overflow-hidden border-2 border-slate-200 dark:border-slate-700 shadow-xl select-none"
            style={{ touchAction: 'none' }}
          >
            <canvas
              ref={canvasRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              className={`w-full h-full block ${tool === 'eraser' ? 'cursor-cell' : 'cursor-crosshair'}`}
              style={{ touchAction: 'none' }}
            />
            {!hasStrokes && (
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <Paintbrush className="w-10 h-10 text-slate-200 dark:text-slate-700 mb-2" />
                <p className="text-xs font-semibold text-slate-300 dark:text-slate-600">
                  Start drawing <span className="capitalize">{targetWord || 'something'}</span>…
                </p>
              </div>
            )}
          </div>

          <button
            onClick={analyzeDrawing}
            disabled={!hasStrokes || analyzing || !health?.available}
            className={`w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold transition-all ${
              hasStrokes && health?.available && !analyzing
                ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white hover:from-indigo-500 hover:to-violet-500 shadow-lg shadow-indigo-500/30 hover:-translate-y-0.5 active:translate-y-0'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
            }`}
          >
            {analyzing ? (
              <><RefreshCw className="w-4 h-4 animate-spin" /> AI is analyzing your sketch…</>
            ) : (
              <><Sparkles className="w-4 h-4" /> Ask AI to Recognize My Drawing</>
            )}
          </button>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-indigo-500" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  AI Predictions
                </h3>
              </div>
              {analyzed && (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${
                  isCorrect
                    ? 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                }`}>
                  {isCorrect ? (
                    <>
                      <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                      <span>Recognized!</span>
                    </>
                  ) : (
                    <span>Keep practicing</span>
                  )}
                </span>
              )}
            </div>
            <div className="p-4 space-y-3">
              {!analyzed && !analyzing && (
                <div className="text-center py-8">
                  <Brain className="w-10 h-10 mx-auto text-slate-200 dark:text-slate-700 mb-2" />
                  <p className="text-xs text-slate-400 dark:text-slate-500">
                    Draw something then press Analyze
                  </p>
                </div>
              )}
              {analyzing && (
                <div className="text-center py-8">
                  <div className="w-10 h-10 mx-auto mb-3 rounded-full border-4 border-indigo-200 dark:border-indigo-900 border-t-indigo-500 animate-spin" />
                  <p className="text-xs text-slate-400 dark:text-slate-500">Analyzing…</p>
                </div>
              )}
              {analyzed && predictions.length > 0 && (
                <div className="space-y-3">
                  {predictions.map((p, i) => (
                    <ConfidenceBar key={p.class_name} item={p} rank={i} targetWord={targetWord} />
                  ))}
                </div>
              )}
              {aiMessage && (
                <div className={`flex items-start gap-2 p-3 rounded-xl text-xs ${
                  predictions.length > 0
                    ? 'bg-slate-50 dark:bg-slate-800/60'
                    : 'bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40'
                }`}>
                  <Info className="w-3.5 h-3.5 mt-0.5 shrink-0 text-slate-400" />
                  <span className="text-slate-600 dark:text-slate-400">{aiMessage}</span>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
              <Info className="w-4 h-4 text-violet-500" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Drawing Tips
              </h3>
            </div>
            <ul className="px-4 py-3 space-y-2.5">
              {[
                'Keep the background white and strokes dark for best AI accuracy.',
                'Draw simple, recognizable outlines — the AI was trained on doodles.',
                'Use the full canvas and fill the space generously.',
                'Try a different angle if not recognized on the first attempt.',
                'Supported: airplane, apple, banana, bicycle, bird, car, cat, chair, clock, cloud, dog, fish, flower, house, key, moon, star, sun, tree, umbrella.',
              ].map((tip, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <span className="mt-0.5 w-4 h-4 rounded-full bg-violet-50 dark:bg-violet-950/40 border border-violet-200 dark:border-violet-900/40 text-violet-500 font-bold text-[9px] flex items-center justify-center shrink-0">
                    {i + 1}
                  </span>
                  {tip}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-3">
              <Target className="w-4 h-4 text-emerald-500" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Service Info
              </h3>
            </div>
            {healthLoading ? (
              <p className="text-xs text-slate-400">Checking…</p>
            ) : health?.available && health.modelLoaded ? (
              <div className="space-y-2 text-xs text-slate-600 dark:text-slate-400">
                <div className="flex justify-between">
                  <span>Model classes</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{health.numClasses}</span>
                </div>
                <div className="flex justify-between">
                  <span>Status</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">Ready</span>
                </div>
                <div className="flex justify-between">
                  <span>Architecture</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">CNN (PyTorch)</span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Service offline. Start the FastAPI server to enable predictions.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
