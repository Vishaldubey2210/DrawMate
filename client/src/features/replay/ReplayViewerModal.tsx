import React, { useState, useEffect, useRef, useMemo } from 'react';
import { replayService } from '../../services/replayService.js';
import { DrawingReplay, ReplayEvent } from '../../types/index.js';
import { redrawAllStrokes } from '../drawing/drawing.utils.js';
import { Stroke } from '../drawing/drawing.types.js';
import {
  Play,
  Pause,
  RotateCcw,
  FastForward,
  X,
  Loader2,
  Calendar,
  Sparkles,
  Palette,
  Clock,
} from 'lucide-react';

interface ReplayViewerModalProps {
  gameId: string;
  roundNumber: number;
  onClose: () => void;
}

export const ReplayViewerModal: React.FC<ReplayViewerModalProps> = ({
  gameId,
  roundNumber,
  onClose,
}) => {
  const [replay, setReplay] = useState<DrawingReplay | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastTickTimeRef = useRef<number | null>(null);

  // Fetch replay data
  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    setError(null);

    replayService
      .getRoundReplay(gameId, roundNumber)
      .then((data) => {
        if (isMounted) {
          setReplay(data);
          setIsLoading(false);
          setIsPlaying(true); // Auto-start playback
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message || 'Failed to load drawing replay.');
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [gameId, roundNumber]);

  const totalDurationMs = replay ? Math.max(1000, replay.durationMs) : 1000;

  /**
   * Deterministically reconstructs strokes up to a given timeline offset
   */
  const reconstructStrokesAtTime = (events: ReplayEvent[], timeMs: number): Stroke[] => {
    const activeStrokes: Stroke[] = [];
    const strokeMap = new Map<string, Stroke>();

    for (const ev of events) {
      if (ev.offsetMs > timeMs) break;

      if (ev.type === 'stroke_start' && ev.data) {
        const stroke: Stroke = {
          strokeId: ev.data.strokeId,
          drawerId: ev.data.drawerId,
          tool: ev.data.tool,
          color: ev.data.color,
          width: ev.data.width,
          points: ev.data.points ? [...ev.data.points] : [],
          createdAt: ev.data.createdAt || Date.now(),
        };
        strokeMap.set(stroke.strokeId, stroke);
        activeStrokes.push(stroke);
      } else if (ev.type === 'stroke_points' && ev.data) {
        const stroke = strokeMap.get(ev.data.strokeId);
        if (stroke && Array.isArray(ev.data.points)) {
          stroke.points = [...stroke.points, ...ev.data.points];
        }
      } else if (ev.type === 'stroke_undo') {
        const undone = activeStrokes.pop();
        if (undone) {
          strokeMap.delete(undone.strokeId);
        }
      } else if (ev.type === 'stroke_clear') {
        activeStrokes.length = 0;
        strokeMap.clear();
      }
    }

    return activeStrokes;
  };

  /**
   * Renders the reconstructed state on the canvas
   */
  const renderCanvasAt = (timeMs: number) => {
    if (!canvasRef.current || !replay) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const strokes = reconstructStrokesAtTime(replay.events, timeMs);
    redrawAllStrokes(ctx, strokes, null, canvas.width, canvas.height);
  };

  // Redraw when time changes
  useEffect(() => {
    renderCanvasAt(currentTimeMs);
  }, [currentTimeMs, replay]);

  // Main animation / playback loop
  useEffect(() => {
    if (!isPlaying) {
      lastTickTimeRef.current = null;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      return;
    }

    const step = (timestamp: number) => {
      if (lastTickTimeRef.current === null) {
        lastTickTimeRef.current = timestamp;
      }
      const deltaMs = (timestamp - lastTickTimeRef.current) * playbackSpeed;
      lastTickTimeRef.current = timestamp;

      setCurrentTimeMs((prev) => {
        const next = prev + deltaMs;
        if (next >= totalDurationMs) {
          setIsPlaying(false);
          return totalDurationMs;
        }
        return next;
      });

      animationFrameRef.current = requestAnimationFrame(step);
    };

    animationFrameRef.current = requestAnimationFrame(step);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, playbackSpeed, totalDurationMs]);

  const handlePlayPause = () => {
    if (currentTimeMs >= totalDurationMs) {
      setCurrentTimeMs(0);
      setIsPlaying(true);
    } else {
      setIsPlaying(!isPlaying);
    }
  };

  const handleRestart = () => {
    setCurrentTimeMs(0);
    setIsPlaying(true);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = Number(e.target.value);
    setCurrentTimeMs(newTime);
  };

  const formatTime = (ms: number) => {
    const totalSec = Math.floor(ms / 1000);
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col text-slate-100 max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/80">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-white">Round {roundNumber} Drawing Replay</h3>
                {replay && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Word: {replay.secretWord}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                {replay ? `Drawn by ${replay.drawerDisplayName} • Category: ${replay.category}` : 'Loading timeline...'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content area */}
        <div className="p-6 flex-1 flex flex-col items-center justify-center bg-slate-950/50">
          {isLoading ? (
            <div className="py-24 flex flex-col items-center justify-center gap-3 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
              <p className="text-sm">Fetching recorded strokes...</p>
            </div>
          ) : error ? (
            <div className="py-24 flex flex-col items-center justify-center text-center gap-3 px-4">
              <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-400 flex items-center justify-center">
                <X className="w-6 h-6" />
              </div>
              <p className="text-sm text-red-400 max-w-md font-medium">{error}</p>
            </div>
          ) : (
            <div className="w-full flex flex-col items-center gap-4">
              {/* Canvas viewport */}
              <div className="relative w-full max-w-2xl aspect-[4/3] bg-white rounded-xl shadow-inner border border-slate-700/60 overflow-hidden flex items-center justify-center">
                <canvas
                  ref={canvasRef}
                  width={800}
                  height={600}
                  className="w-full h-full block bg-white"
                />
              </div>

              {/* Progress Bar scrubber */}
              <div className="w-full max-w-2xl flex flex-col gap-1.5 mt-2">
                <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
                  <span>{formatTime(currentTimeMs)}</span>
                  <span>{formatTime(totalDurationMs)}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={totalDurationMs}
                  value={currentTimeMs}
                  onChange={handleSeek}
                  className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
              </div>

              {/* Controls bar */}
              <div className="w-full max-w-2xl flex items-center justify-between pt-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={handlePlayPause}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium text-sm shadow-lg shadow-indigo-600/20 transition-colors"
                  >
                    {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    <span>{isPlaying ? 'Pause' : 'Play'}</span>
                  </button>
                  <button
                    onClick={handleRestart}
                    title="Restart from beginning"
                    className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                </div>

                {/* Speed selector */}
                <div className="flex items-center gap-1.5 bg-slate-800/80 p-1 rounded-xl border border-slate-700/60">
                  {[0.5, 1, 1.5, 2, 4].map((spd) => (
                    <button
                      key={spd}
                      onClick={() => setPlaybackSpeed(spd)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                        playbackSpeed === spd
                          ? 'bg-indigo-600 text-white shadow'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {spd}x
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
