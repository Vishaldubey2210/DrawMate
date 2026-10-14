import React, { useState } from 'react';
import { DrawingTool, BRUSH_SIZES, PALETTE_COLORS } from './drawing.types.js';
import { useDrawingSession } from './useDrawingSession.js';
import { useDrawingCanvas } from './useDrawingCanvas.js';
import { DrawingCanvas } from './DrawingCanvas.js';
import { DrawingToolbar } from './DrawingToolbar.js';
import { DrawingStatus } from './DrawingStatus.js';
import { Button } from '../../components/ui/Button.js';
import { Badge } from '../../components/ui/Badge.js';
import { LoadingSkeleton } from '../../components/ui/LoadingSkeleton.js';
import { UserCheck, RefreshCw, Sparkles } from 'lucide-react';

interface DrawingStudioProps {
  roomCode: string;
  currentUserId: string;
  currentUserName: string;
  players?: Array<{ userId: string; displayName: string }>;
  isHost?: boolean;
}

export const DrawingStudio: React.FC<DrawingStudioProps> = ({
  roomCode,
  currentUserId,
  currentUserName,
  players = [],
  isHost = false,
}) => {
  const [activeTool, setActiveTool] = useState<DrawingTool>('brush');
  const [activeColor, setActiveColor] = useState<string>(PALETTE_COLORS[0].hex);
  const [activeWidth, setActiveWidth] = useState<number>(BRUSH_SIZES[0].value);

  const {
    drawerId,
    isDrawer,
    revision,
    strokes,
    remoteActiveStroke,
    isLoading,
    startStroke,
    appendPoints,
    endStroke,
    undo,
    redo,
    clear,
    setDrawerHarness,
    requestSnapshot,
  } = useDrawingSession({
    roomCode,
    currentUserId,
  });

  const {
    canvasRef,
    containerRef,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerCancel,
  } = useDrawingCanvas({
    isDrawer,
    activeTool,
    activeColor,
    activeWidth,
    canonicalStrokes: strokes,
    remoteActiveStroke,
    onStrokeStart: startStroke,
    onAppendPoints: appendPoints,
    onStrokeEnd: endStroke,
  });

  const drawerPlayer = players.find((p) => p.userId === drawerId);
  const drawerName = drawerPlayer
    ? drawerPlayer.displayName
    : drawerId === currentUserId
    ? currentUserName
    : undefined;

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <LoadingSkeleton className="h-10 w-full rounded-2xl" />
        <LoadingSkeleton className="h-[480px] w-full rounded-3xl" />
        <LoadingSkeleton className="h-16 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Development-Only Test Harness Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-amber-500/10 dark:bg-amber-400/10 border border-amber-500/20 rounded-2xl">
        <div className="flex items-center gap-2">
          <Badge variant="warning" className="text-xs font-bold uppercase tracking-wider">
            Dev Harness
          </Badge>
          <span className="text-xs text-amber-800 dark:text-amber-300 font-medium">
            Phase 3 Real-Time Canvas Test Environment
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {!isDrawer ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDrawerHarness(currentUserId)}
              className="flex items-center gap-1.5 text-xs py-1 h-8 rounded-xl border-amber-500/40 hover:bg-amber-500/20"
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Claim Drawer Role</span>
            </Button>
          ) : (
            players.length > 1 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const other = players.find((p) => p.userId !== currentUserId);
                  if (other) setDrawerHarness(other.userId);
                }}
                className="flex items-center gap-1.5 text-xs py-1 h-8 rounded-xl border-amber-500/40 hover:bg-amber-500/20"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Pass Drawer Role</span>
              </Button>
            )
          )}

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={requestSnapshot}
            title="Refresh snapshot from server"
            className="flex items-center gap-1 text-xs py-1 h-8 text-amber-900 dark:text-amber-200"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sync</span>
          </Button>
        </div>
      </div>

      {/* Drawing Status Header */}
      <DrawingStatus
        isDrawer={isDrawer}
        drawerName={drawerName}
        revision={revision}
        strokeCount={strokes.length}
      />

      {/* HTML5 Canvas Surface */}
      <DrawingCanvas
        canvasRef={canvasRef}
        containerRef={containerRef}
        isDrawer={isDrawer}
        activeTool={activeTool}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
      />

      {/* Real-time Drawing Toolbar */}
      <DrawingToolbar
        isDrawer={isDrawer}
        activeTool={activeTool}
        activeColor={activeColor}
        activeWidth={activeWidth}
        strokeCount={strokes.length}
        onSelectTool={setActiveTool}
        onSelectColor={setActiveColor}
        onSelectWidth={setActiveWidth}
        onUndo={undo}
        onRedo={redo}
        canRedo={true}
        onClear={clear}
      />
    </div>
  );
};
