import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { GameStatus, RoomState, Player, Question, User, Buzz, PlayerCategory } from '../types';
import { authService } from '../services/authService';
import { sessionService } from '../services/sessionService';
import { playerService } from '../services/playerService';
import { questionService } from '../services/questionService';
import { buzzService } from '../services/buzzService';
import { realtimeService } from '../services/realtimeService';
import { rpcService } from '../services/rpcService';
import { generateQuestions } from '../geminiService';

interface Session {
  id: string;
  code: string;
  status: GameStatus;
  current_question_index: number;
  debt_amount?: number;
  q_per_user?: number;
}

interface GameContextType {
  // Auth
  user: User | null;
  setUser: (user: User | null) => void;
  logout: () => void;

  // Session
  session: Session | null;
  setSession: (session: Session | null) => void;

  // Players
  players: Player[];
  setPlayers: (players: Player[]) => void;
  currentPlayerId: string | null;
  setCurrentPlayerId: (id: string | null) => void;

  // Questions
  questions: Question[];
  setQuestions: (questions: Question[]) => void;

  // Buzzer
  buzzedPlayers: Buzz[];
  setBuzzedPlayers: (buzzes: Buzz[]) => void;

  // Status
  status: GameStatus;
  setStatus: (status: GameStatus) => void;

  // Actions
  setupGame: (allPlayers: Player[], debt: number, questionsPerCategory: number) => Promise<void>;
  handleBuzz: (playerId: string) => Promise<void>;
  validateAnswer: (playerId: string | null, points: number, moveNext: boolean) => Promise<void>;
  resetBuzzer: () => Promise<void>;
  skipQuestion: () => Promise<void>;
  rejoinSession: (sessionId: string, sessionCode: string) => Promise<{ success: boolean; isPlaying?: boolean }>;
  resetGame: () => void;
  fetchBuzzState: (sessionId?: string) => Promise<void>;

  // Room state helper
  getRoomState: () => RoomState;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

export const useGame = () => {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
};

interface GameProviderProps {
  children: ReactNode;
}

export const GameProvider: React.FC<GameProviderProps> = ({ children }) => {
  // Auth state
  const [user, setUser] = useState<User | null>(authService.getCurrentUser());

  // Game state
  const [session, setSession] = useState<Session | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [buzzedPlayers, setBuzzedPlayers] = useState<Buzz[]>([]);
  const [currentPlayerId, setCurrentPlayerId] = useState<string | null>(localStorage.getItem('mdev_player_id'));
  const [status, setStatus] = useState<GameStatus>(GameStatus.LOBBY);

  // Ref pour éviter les re-créations de callback
  const sessionIdRef = React.useRef<string | null>(null);

  // Mettre à jour la ref quand session.id change
  useEffect(() => {
    sessionIdRef.current = session?.id || null;
  }, [session?.id]);

  // Fetch buzz state - stable callback sans dépendance sur session
  const fetchBuzzState = useCallback(async (sessionId?: string) => {
    const sid = sessionId || sessionIdRef.current;
    if (!sid) return;

    const buzzes = await buzzService.getBuzzesBySession(sid);
    setBuzzedPlayers(buzzes);
  }, []);

  // Polling for buzzer state - seulement pendant PLAYING
  useEffect(() => {
    if (!session?.id || status !== GameStatus.PLAYING) return;

    const currentSessionId = session.id;
    const pollInterval = setInterval(() => fetchBuzzState(currentSessionId), 1000);
    return () => clearInterval(pollInterval);
  }, [session?.id, status, fetchBuzzState]);

  // Real-time subscriptions - seulement quand PLAYING ou RESULTS
  useEffect(() => {
    const currentSessionId = session?.id;
    // Ne pas créer de subscriptions pendant LOBBY ou GENERATING
    if (!currentSessionId || status === GameStatus.GENERATING || status === GameStatus.LOBBY) return;

    let isSubscribed = true; // Flag pour éviter les updates après unsubscribe

    const sessionSub = realtimeService.subscribeToSession(currentSessionId, (payload) => {
      if (!isSubscribed) return;
      const updated = payload.new as Session;
      setSession(updated);
      setStatus(updated.status as GameStatus);
    });

    const playersSub = realtimeService.subscribeToPlayers(currentSessionId, async () => {
      if (!isSubscribed) return;
      const playersData = await playerService.getPlayersBySession(currentSessionId);
      if (isSubscribed) setPlayers(playersData);
    });

    const buzzSub = realtimeService.subscribeToBuzzes(currentSessionId, async () => {
      if (!isSubscribed) return;
      await fetchBuzzState(currentSessionId);
    });

    const questionsSub = realtimeService.subscribeToQuestions(currentSessionId, async () => {
      if (!isSubscribed) return;
      const questionsData = await questionService.getQuestionsBySession(currentSessionId);
      if (isSubscribed) setQuestions(questionsData);
    });

    return () => {
      isSubscribed = false;
      realtimeService.unsubscribe(sessionSub);
      realtimeService.unsubscribe(playersSub);
      realtimeService.unsubscribe(buzzSub);
      realtimeService.unsubscribe(questionsSub);
    };
  }, [session?.id, status]); // Dépend aussi de status pour recréer après GENERATING

  const setupGame = async (allPlayers: Player[], debt: number, questionsPerCategory: number) => {
    if (!session) return;

    try {
      await sessionService.startGenerating(session.id, debt, questionsPerCategory);

      const allCategories: PlayerCategory[] = [];
      allPlayers.forEach(p => {
        p.categories.forEach(cat => {
          if (!allCategories.find(c => c.name.toLowerCase() === cat.name.toLowerCase())) {
            allCategories.push(cat);
          }
        });
      });

      if (allCategories.length === 0) {
        allCategories.push({ name: "Culture Generale", difficulty: "Intermédiaire" } as PlayerCategory);
      }

      const rawQuestions = await generateQuestions(allCategories, questionsPerCategory);

      if (!rawQuestions || rawQuestions.length === 0) {
        throw new Error('Aucune question générée');
      }

      await questionService.createQuestions(session.id, rawQuestions);
      await sessionService.startPlaying(session.id);
    } catch (error: any) {
      console.error('Erreur lors du setup du jeu:', error);
      // Remettre la session en état LOBBY en cas d'erreur
      await sessionService.updateSessionStatus(session.id, GameStatus.LOBBY);
      setStatus(GameStatus.LOBBY);

      // Afficher l'erreur à l'utilisateur
      const message = error?.message || 'Erreur lors de la génération des questions';
      alert(`Erreur: ${message}\n\nVeuillez réessayer dans quelques secondes.`);
    }
  };

  const handleBuzz = async (playerId: string) => {
    if (status !== GameStatus.PLAYING || !session) return;

    const buzzTimestampMs = Date.now();
    const result = await buzzService.createBuzz(session.id, playerId);

    if (result.alreadyBuzzed || !result.success) return;

    setBuzzedPlayers(prev => {
      if (prev.some(b => b.playerId === playerId)) return prev;
      const firstMs = prev.length > 0 ? (prev[0].timestampMs || prev[0].timestamp) : buzzTimestampMs;
      return [...prev, {
        playerId,
        timestamp: buzzTimestampMs,
        timestampMs: buzzTimestampMs,
        timeDiffMs: prev.length === 0 ? 0 : buzzTimestampMs - firstMs
      }];
    });
  };

  const validateAnswer = async (playerId: string | null, points: number, moveNext: boolean) => {
    if (!session) return;

    const currentQ = questions[session.current_question_index];

    const result = await rpcService.validateAnswer(
      session.id,
      playerId,
      points,
      currentQ?.category || '',
      moveNext,
      questions.length
    );

    if (!result?.success) return;

    if (playerId && points !== 0) {
      setPlayers(prev => prev.map(p =>
        p.id === playerId
          ? { ...p, score: result.playerNewScore, categoryScores: result.playerNewCategoryScores as Record<string, number> }
          : p
      ));
    }

    if (moveNext) {
      setBuzzedPlayers([]);
    } else if (playerId) {
      setBuzzedPlayers(prev => {
        const filtered = prev.filter(b => b.playerId !== playerId);
        if (filtered.length > 0) {
          const firstMs = filtered[0].timestampMs || filtered[0].timestamp;
          return filtered.map((b, i) => ({
            ...b,
            timeDiffMs: i === 0 ? 0 : (b.timestampMs || b.timestamp) - firstMs
          }));
        }
        return filtered;
      });
    }
  };

  const resetBuzzer = async () => {
    if (!session) return;
    await buzzService.deleteAllBuzzes(session.id);
    setBuzzedPlayers([]);
  };

  const skipQuestion = async () => {
    if (!session) return;
    await buzzService.deleteAllBuzzes(session.id);
    setBuzzedPlayers([]);
    const nextIndex = session.current_question_index + 1;
    const isGameOver = nextIndex >= questions.length;
    await sessionService.advanceToNextQuestion(session.id, nextIndex, isGameOver);
  };

  const rejoinSession = async (sessionId: string, _sessionCode: string): Promise<{ success: boolean; isPlaying?: boolean }> => {
    const storedPlayerId = localStorage.getItem('mdev_player_id') || '';
    const username = user?.username || '';

    const result = await rpcService.rejoinSession(sessionId, username, storedPlayerId);

    if (!result || !result.sessionId) {
      return { success: false };
    }

    if (result.foundPlayerId) {
      setCurrentPlayerId(result.foundPlayerId);
      localStorage.setItem('mdev_player_id', result.foundPlayerId);

      setSession({
        id: result.sessionId,
        code: result.sessionCode,
        status: result.sessionStatus as GameStatus,
        current_question_index: result.currentQuestionIndex,
        debt_amount: result.debtAmount,
        q_per_user: result.qPerUser
      });
      setStatus(result.sessionStatus as GameStatus);
      setPlayers(result.players);
      setQuestions(result.questions);
      setBuzzedPlayers(result.buzzes);

      return { success: true, isPlaying: true };
    }

    setSession({
      id: result.sessionId,
      code: result.sessionCode,
      status: result.sessionStatus as GameStatus,
      current_question_index: result.currentQuestionIndex
    });

    return { success: true, isPlaying: false };
  };

  const logout = () => {
    authService.logout();
    setUser(null);
    resetGame();
  };

  const resetGame = () => {
    setSession(null);
    setPlayers([]);
    setQuestions([]);
    setBuzzedPlayers([]);
    setCurrentPlayerId(null);
    setStatus(GameStatus.LOBBY);
  };

  const getRoomState = (): RoomState => ({
    players,
    questions,
    currentQuestionIndex: session?.current_question_index || 0,
    status,
    buzzedPlayers,
    debtAmount: session?.debt_amount || 20
  });

  return (
    <GameContext.Provider value={{
      user,
      setUser,
      logout,
      session,
      setSession,
      players,
      setPlayers,
      currentPlayerId,
      setCurrentPlayerId,
      questions,
      setQuestions,
      buzzedPlayers,
      setBuzzedPlayers,
      status,
      setStatus,
      setupGame,
      handleBuzz,
      validateAnswer,
      resetBuzzer,
      skipQuestion,
      rejoinSession,
      resetGame,
      fetchBuzzState,
      getRoomState
    }}>
      {children}
    </GameContext.Provider>
  );
};
