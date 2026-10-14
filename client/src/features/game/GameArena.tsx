import React, { useState } from 'react';
import { useRoom } from '../../context/RoomContext.js';
import { useGameSession } from './useGameSession.js';
import { GameHeader } from './GameHeader.js';
import { GameChat } from './GameChat.js';
import { GameLeaderboard } from './GameLeaderboard.js';
import { WordSelectionModal } from './WordSelectionModal.js';
import { RoundResultsModal } from './RoundResultsModal.js';
import { ImposterVotingModal } from './ImposterVotingModal.js';
import { ImposterResultsModal } from './ImposterResultsModal.js';
import { GameOverScreen } from './GameOverScreen.js';
import { DrawingCanvas } from '../drawing/DrawingCanvas.js';
import { DrawingToolbar } from '../drawing/DrawingToolbar.js';
import { useDrawingCanvas } from '../drawing/useDrawingCanvas.js';
import { useDrawingSession } from '../drawing/useDrawingSession.js';
import { DrawingTool, BRUSH_SIZES, PALETTE_COLORS } from '../drawing/drawing.types.js';
import { LoadingSkeleton } from '../../components/ui/LoadingSkeleton.js';
import { Button } from '../../components/ui/Button.js';
import { Eye, AlertCircle } from 'lucide-react';

interface GameArenaProps {
  roomCode: string;
  currentUserId: string;
  onReturnToLobby?: () => void;
}

export const GameArena: React.FC<GameArenaProps> = ({
  roomCode,
  currentUserId,
  onReturnToLobby,
}) => {
  const [activeTool, setActiveTool] = useState<DrawingTool>('brush');
  const [activeColor, setActiveColor] = useState<string>(PALETTE_COLORS[0].hex);
  const [activeWidth, setActiveWidth] = useState<number>(BRUSH_SIZES[0].value);

  // Authoritative Game Session
  const {
    game,
    isDrawer: isGameDrawer,
    countdownSeconds,
    isLoading: isGameLoading,
    selectWord,
    submitGuess,
  } = useGameSession({
    roomCode,
    currentUserId,
  });

  // Authoritative drawer identification (classic vs imposter mode)
  const effectiveDrawerId =
    game?.gameMode === 'imposter'
      ? (game.imposter?.activeDrawingPlayerId || game.imposterState?.activeDrawingPlayerId || game.drawerId)
      : game?.drawerId;

  // Phase 3 Drawing Canvas Session
  const {
    strokes,
    remoteActiveStroke,
    startStroke,
    appendPoints,
    endStroke,
    undo,
    redo,
    canRedo,
    clear,
  } = useDrawingSession({
    roomCode,
    currentUserId,
    authoritativeDrawerId: effectiveDrawerId,
  });

  const { isSpectator } = useRoom();

  // Active drawing canvas hook (authorized only if drawer, not spectator, and in drawing/imposter phase)
  const canDraw =
    !isSpectator &&
    isGameDrawer &&
    (game?.phase === 'drawing' || game?.phase === 'imposter_drawing');

  const {
    canvasRef,
    containerRef,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerCancel,
  } = useDrawingCanvas({
    isDrawer: canDraw,
    activeTool,
    activeColor,
    activeWidth,
    canonicalStrokes: strokes,
    remoteActiveStroke,
    onStrokeStart: startStroke,
    onAppendPoints: appendPoints,
    onStrokeEnd: endStroke,
  });

  if (isGameLoading || !game) {
    return (
      <div className="space-y-6 animate-pulse">
        <LoadingSkeleton className="h-16 w-full rounded-2xl" />
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <LoadingSkeleton className="h-96 lg:col-span-3 rounded-3xl" />
          <LoadingSkeleton className="h-96 rounded-3xl" />
        </div>
      </div>
    );
  }

  // If game concluded, present Game Over screen
  if (game.phase === 'game_over') {
    return (
      <GameOverScreen
        winner={game.winner}
        scores={game.scores}
        onReturnToLobby={onReturnToLobby || (() => window.location.reload())}
      />
    );
  }

  // If match cancelled (e.g. not enough players left)
  if (game.phase === 'cancelled') {
    return (
      <div className="p-8 sm:p-12 text-center rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl space-y-5 animate-in fade-in duration-300">
        <div className="w-16 h-16 rounded-2xl bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto shadow-sm">
          <AlertCircle className="w-8 h-8" />
        </div>
        <div className="space-y-1.5 max-w-md mx-auto">
          <h2 className="text-xl font-black text-slate-900 dark:text-white">Match Concluded</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            A player left the match, and not enough players remain to continue. The match has ended cleanly.
          </p>
        </div>
        <div className="pt-2">
          <Button
            size="md"
            variant="primary"
            onClick={onReturnToLobby || (() => window.location.reload())}
            className="px-6"
          >
            Return to Room Lobby
          </Button>
        </div>
      </div>
    );
  }

  const isWordSelectionOpen = game.phase === 'word_selection';
  const isRoundResultsOpen = game.phase === 'round_ending';
  const hasGuessedCorrectly = game.recentGuesses.some(
    (m) => m.userId === currentUserId && m.isCorrect
  );

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* Top Game Header with Round, Timer, and Word/Masked Hints */}
      <GameHeader
        game={game}
        isDrawer={isGameDrawer}
        countdownSeconds={countdownSeconds}
      />

      {/* Spectator Mode Indicator Banner */}
      {isSpectator && (
        <div className="p-3.5 bg-indigo-50/90 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-2xl flex items-center justify-between text-indigo-700 dark:text-indigo-300 px-5 text-xs shadow-sm">
          <span className="flex items-center gap-2 font-bold">
            <Eye className="w-4 h-4 text-indigo-500 shrink-0" />
            Spectator Mode Active — You are observing this match in real-time
          </span>
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 hidden sm:inline">
            Drawing canvas interaction & guessing are disabled
          </span>
        </div>
      )}

      {/* Main Grid: Left Roster/Leaderboard (1 col), Canvas Center (2 cols), Chat Right (1 col) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column: Live Scores & Leaderboard (3 cols) */}
        <div className="lg:col-span-3 order-2 lg:order-1 space-y-4">
          <GameLeaderboard
            scores={game.scores}
            currentDrawerId={game.drawerId}
            guessedUserIds={game.recentGuesses.filter((g) => g.isCorrect).map((g) => g.userId)}
          />
        </div>

        {/* Center: HTML5 Canvas & Toolbar (6 cols) */}
        <div className="lg:col-span-6 order-1 lg:order-2 space-y-3">
          <DrawingCanvas
            canvasRef={canvasRef}
            containerRef={containerRef}
            isDrawer={canDraw}
            activeTool={activeTool}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerCancel}
          />

          {/* Drawing Toolbar (Active only for authorized drawer during drawing phase) */}
          <DrawingToolbar
            isDrawer={canDraw}
            activeTool={activeTool}
            activeColor={activeColor}
            activeWidth={activeWidth}
            strokeCount={strokes.length}
            onSelectTool={setActiveTool}
            onSelectColor={setActiveColor}
            onSelectWidth={setActiveWidth}
            onUndo={undo}
            onRedo={redo}
            canRedo={canRedo}
            onClear={clear}
          />
        </div>

        {/* Right Column: Live Guess Chat & Guess Input (3 cols) */}
        <div className="lg:col-span-3 order-3">
          <GameChat
            messages={game.recentGuesses}
            isDrawer={isGameDrawer}
            hasGuessedCorrectly={hasGuessedCorrectly}
            isSpectator={isSpectator}
            onSendGuess={submitGuess}
          />
        </div>
      </div>

      {/* Word Selection Modal (Drawer chooses word, guessers see waiting indicator) */}
      <WordSelectionModal
        isOpen={isWordSelectionOpen && !isSpectator}
        isDrawer={isGameDrawer}
        drawerName={game.drawerName}
        choices={game.word.choices}
        countdownSeconds={countdownSeconds}
        onSelectWord={selectWord}
      />

      {/* Round Results Summary Modal */}
      <RoundResultsModal
        isOpen={isRoundResultsOpen}
        summary={game.lastRoundSummary}
        countdownSeconds={countdownSeconds}
      />

      {/* Imposter Voting Modal */}
      <ImposterVotingModal
        isOpen={game.phase === 'imposter_voting' && !isSpectator}
        game={game}
        currentUserId={currentUserId}
        countdownSeconds={countdownSeconds}
        roomCode={roomCode}
      />

      {/* Imposter Results Modal */}
      <ImposterResultsModal
        isOpen={game.phase === 'imposter_results'}
        game={game}
        countdownSeconds={countdownSeconds}
      />
    </div>
  );
};
