import { useState, useEffect, useCallback, useRef } from 'react';
import { getSocket } from '../../services/socket.js';
import { useToast } from '../../context/ToastContext.js';
import { SanitizedGameSnapshot, GuessMessage, RoundSummary } from './game.types.js';

interface UseGameSessionProps {
  roomCode: string;
  currentUserId: string;
}

export function useGameSession({ roomCode, currentUserId }: UseGameSessionProps) {
  const socket = getSocket();
  const toast = useToast();

  const [game, setGame] = useState<SanitizedGameSnapshot | null>(null);
  const [countdownSeconds, setCountdownSeconds] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const isDrawer = Boolean(
    game &&
    (game.gameMode === 'imposter'
      ? (game.imposter?.activeDrawingPlayerId === currentUserId ||
         game.imposterState?.activeDrawingPlayerId === currentUserId ||
         game.drawerId === currentUserId)
      : game.drawerId === currentUserId)
  );

  /**
   * Fetches latest sanitized game state snapshot from server
   */
  const fetchGameState = useCallback(() => {
    if (!roomCode) return;
    socket.emit('game:get_state', { roomCode }, (res: any) => {
      setIsLoading(false);
      if (res?.success && res.game) {
        setGame(res.game);
      }
    });
  }, [socket, roomCode]);

  // Initial fetch and listener subscriptions
  useEffect(() => {
    if (!roomCode) return;

    fetchGameState();

    const handleState = (snapshot: SanitizedGameSnapshot) => {
      setIsLoading(false);
      setGame(snapshot);
    };

    const handleStarted = () => {
      fetchGameState();
    };

    const handleGuessResult = (msg: GuessMessage) => {
      setGame((prev) => {
        if (!prev) return prev;
        const exists = prev.recentGuesses.some((m) => m.id === msg.id);
        if (exists) return prev;
        return {
          ...prev,
          recentGuesses: [...prev.recentGuesses, msg],
        };
      });
    };

    const handlePlayerGuessed = (data: { displayName: string; points: number }) => {
      toast.success(`${data.displayName} guessed the word! (+${data.points} pts)`);
    };

    const handleHintRevealed = (data: { masked: string; revealedIndex: number }) => {
      setGame((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          word: {
            ...prev.word,
            masked: data.masked,
            revealedIndices: [...prev.word.revealedIndices, data.revealedIndex],
          },
        };
      });
    };

    const handleRoundEnded = (summary: RoundSummary) => {
      setGame((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          phase: 'round_ending',
          lastRoundSummary: summary,
        };
      });
    };

    const handleGameOver = () => {
      setGame((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          phase: 'game_over',
        };
      });
      toast.success('Game concluded! Check out the final leaderboard!');
    };

    const handleCancelled = (data: { reason: string }) => {
      toast.info(`Match ended: ${data.reason}`);
      setGame((prev) => {
        if (!prev) return prev;
        return { ...prev, phase: 'cancelled' };
      });
    };

    const handleError = (data: { error: string }) => {
      if (data?.error) {
        toast.error(data.error);
      }
    };

    socket.on('game:state', handleState);
    socket.on('game:started', handleStarted);
    socket.on('game:guess_result', handleGuessResult);
    socket.on('game:player_guessed', handlePlayerGuessed);
    socket.on('game:hint_revealed', handleHintRevealed);
    socket.on('game:round_ended', handleRoundEnded);
    socket.on('game:over', handleGameOver);
    socket.on('game:cancelled', handleCancelled);
    socket.on('game:error', handleError);

    return () => {
      socket.off('game:state', handleState);
      socket.off('game:started', handleStarted);
      socket.off('game:guess_result', handleGuessResult);
      socket.off('game:player_guessed', handlePlayerGuessed);
      socket.off('game:hint_revealed', handleHintRevealed);
      socket.off('game:round_ended', handleRoundEnded);
      socket.off('game:over', handleGameOver);
      socket.off('game:cancelled', handleCancelled);
      socket.off('game:error', handleError);
    };
  }, [socket, roomCode, fetchGameState, toast]);

  // Synchronize countdown timer from authoritative deadline
  useEffect(() => {
    if (!game || !game.timer.deadline) {
      setCountdownSeconds(0);
      return;
    }

    const updateCountdown = () => {
      const remainingMs = game.timer.deadline - Date.now();
      const seconds = Math.max(0, Math.ceil(remainingMs / 1000));
      setCountdownSeconds(seconds);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 500);

    return () => clearInterval(interval);
  }, [game]);

  /**
   * Host starts the game
   */
  const startGame = useCallback((): Promise<void> => {
    return new Promise((resolve, reject) => {
      socket.emit('game:start', { roomCode }, (res: any) => {
        if (res?.success) {
          resolve();
        } else {
          const errMsg = res?.error || 'Failed to start game.';
          toast.error(errMsg);
          reject(new Error(errMsg));
        }
      });
    });
  }, [socket, roomCode, toast]);

  /**
   * Drawer selects word from choices
   */
  const selectWord = useCallback(
    (word: string): Promise<void> => {
      return new Promise((resolve, reject) => {
        socket.emit('game:word_select', { roomCode, word }, (res: any) => {
          if (res?.success) {
            resolve();
          } else {
            const errMsg = res?.error || 'Failed to select word.';
            toast.error(errMsg);
            reject(new Error(errMsg));
          }
        });
      });
    },
    [socket, roomCode, toast]
  );

  /**
   * Guesser submits a guess
   */
  const submitGuess = useCallback(
    (text: string): Promise<boolean> => {
      return new Promise((resolve, reject) => {
        socket.emit('game:guess', { roomCode, text }, (res: any) => {
          if (res?.success) {
            resolve(res.isCorrect);
          } else {
            const errMsg = res?.error || 'Failed to submit guess.';
            toast.error(errMsg);
            reject(new Error(errMsg));
          }
        });
      });
    },
    [socket, roomCode, toast]
  );

  return {
    game,
    isDrawer,
    countdownSeconds,
    isLoading,
    startGame,
    selectWord,
    submitGuess,
    fetchGameState,
  };
}
