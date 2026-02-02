
import React, { useState, useEffect } from 'react';
import { GameStatus, AppView, RoomState, Player, Question, PlayerCategory, User, Buzz } from './types';
import { generateQuestions } from './geminiService';
import { authService } from './services/authService';
import { sessionService } from './services/sessionService';
import { playerService } from './services/playerService';
import { questionService } from './services/questionService';
import { buzzService } from './services/buzzService';
import { realtimeService } from './services/realtimeService';
import { rpcService } from './services/rpcService';
import Lobby from './components/Lobby';
import ManagerView from './components/ManagerView';
import PlayerView from './components/PlayerView';
import Results from './components/Results';
import AuthPage from './components/AuthPage';
import HomePage from './components/HomePage';
import GameHistoryPanel from './components/GameHistoryPanel';

const App: React.FC = () => {
  // Auth state
  const [user, setUser] = useState<User | null>(authService.getCurrentUser());
  const [appView, setAppView] = useState<AppView>(AppView.LOBBY);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);

  // Game state
  const [session, setSession] = useState<any>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [buzzedPlayers, setBuzzedPlayers] = useState<Buzz[]>([]);
  const [currentPlayerId, setCurrentPlayerId] = useState<string | null>(localStorage.getItem('mdev_player_id'));
  const [status, setStatus] = useState<GameStatus>(GameStatus.LOBBY);

  // Fonction pour recuperer l'etat des buzzes - utilise RPC via buzzService
  const fetchBuzzState = async (sessionId?: string) => {
    const sid = sessionId || session?.id;
    if (!sid) return;

    const buzzes = await buzzService.getBuzzesBySession(sid);
    setBuzzedPlayers(buzzes);
  };

  // Polling pour synchroniser l'etat du buzzer toutes les secondes
  useEffect(() => {
    if (!session?.id || status !== GameStatus.PLAYING) return;

    const pollInterval = setInterval(fetchBuzzState, 1000);
    return () => clearInterval(pollInterval);
  }, [session?.id, status]);

  // Sync Session State
  useEffect(() => {
    if (!session?.id) return;

    const sessionSub = realtimeService.subscribeToSession(session.id, (payload) => {
      const updated = payload.new as any;
      setSession(updated);
      setStatus(updated.status as GameStatus);
    });

    const playersSub = realtimeService.subscribeToPlayers(session.id, async () => {
      const playersData = await playerService.getPlayersBySession(session.id);
      setPlayers(playersData);
    });

    const buzzSub = realtimeService.subscribeToBuzzes(session.id, async () => {
      await fetchBuzzState();
    });

    const questionsSub = realtimeService.subscribeToQuestions(session.id, async () => {
      const questionsData = await questionService.getQuestionsBySession(session.id);
      setQuestions(questionsData);
    });

    return () => {
      realtimeService.unsubscribe(sessionSub);
      realtimeService.unsubscribe(playersSub);
      realtimeService.unsubscribe(buzzSub);
      realtimeService.unsubscribe(questionsSub);
    };
  }, [session?.id]);

  const setupGame = async (allPlayers: Player[], debt: number, questionsPerCategory: number) => {
    if (!session) return;

    await sessionService.startGenerating(session.id, debt, questionsPerCategory);

    const allCategories: PlayerCategory[] = [];
    allPlayers.forEach(p => {
      p.categories.forEach(cat => {
        if (!allCategories.find(c => c.name.toLowerCase() === cat.name.toLowerCase())) {
          allCategories.push(cat);
        }
      });
    });

    if (allCategories.length === 0) allCategories.push({ name: "Culture Generale", difficulty: "Intermédiaire" });

    const rawQuestions = await generateQuestions(allCategories, questionsPerCategory);

    await questionService.createQuestions(session.id, rawQuestions);
    await sessionService.startPlaying(session.id);
  };

  const handleBuzz = async (playerId: string) => {
    if (status !== GameStatus.PLAYING || !session) return;

    const buzzTimestampMs = Date.now();

    const result = await buzzService.createBuzz(session.id, playerId);

    if (result.alreadyBuzzed) {
      console.log('Player already buzzed');
      return;
    }

    if (!result.success) {
      return;
    }

    // Mise a jour optimiste locale
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

  /**
   * Utilise RPC validate_answer pour une transaction atomique
   * Combine: update score + delete buzz + advance question
   */
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

    if (!result?.success) {
      console.error('validateAnswer RPC failed');
      return;
    }

    // Mise a jour optimiste du score local
    if (playerId && points !== 0) {
      setPlayers(prev => prev.map(p =>
        p.id === playerId
          ? { ...p, score: result.playerNewScore, categoryScores: result.playerNewCategoryScores as Record<string, number> }
          : p
      ));
    }

    if (moveNext) {
      // Bonne reponse: reset local des buzzes
      setBuzzedPlayers([]);
    } else if (playerId) {
      // Mauvaise reponse: retirer seulement ce joueur localement
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

  /**
   * Utilise RPC rejoin_session pour charger l'état complet en un seul appel
   * Remplace 5 requêtes séquentielles par 1 RPC
   */
  const handleRejoinSession = async (sessionId: string, _sessionCode: string) => {
    const storedPlayerId = localStorage.getItem('mdev_player_id') || '';
    const username = user?.username || '';

    const result = await rpcService.rejoinSession(sessionId, username, storedPlayerId);

    if (!result || !result.sessionId) {
      alert('Session introuvable');
      return;
    }

    if (result.foundPlayerId) {
      // Joueur trouvé - charger tout l'état depuis le RPC
      setCurrentPlayerId(result.foundPlayerId);
      localStorage.setItem('mdev_player_id', result.foundPlayerId);

      setSession({
        id: result.sessionId,
        code: result.sessionCode,
        status: result.sessionStatus,
        current_question_index: result.currentQuestionIndex,
        debt_amount: result.debtAmount,
        q_per_user: result.qPerUser
      });
      setStatus(result.sessionStatus as GameStatus);
      setPlayers(result.players);
      setQuestions(result.questions);
      setBuzzedPlayers(result.buzzes);

      setAppView(AppView.GAME);
      return;
    }

    // Joueur non trouvé - aller au lobby pour rejoindre
    setSession({
      id: result.sessionId,
      code: result.sessionCode,
      status: result.sessionStatus,
      current_question_index: result.currentQuestionIndex
    });
    setAppView(AppView.LOBBY);
  };

  // Handler logout
  const handleLogout = () => {
    authService.logout();
    setUser(null);
    setSession(null);
    setPlayers([]);
    setQuestions([]);
    setBuzzedPlayers([]);
    setCurrentPlayerId(null);
    setStatus(GameStatus.LOBBY);
    setAppView(AppView.AUTH);
  };

  // Handler auth
  const handleAuthenticated = (authenticatedUser: User) => {
    setUser(authenticatedUser);
    setAppView(AppView.HOME);
  };

  // Handler skip auth (guest)
  const handleSkipAuth = () => {
    setAppView(AppView.LOBBY);
  };

  // Reset pour nouvelle partie
  const handleReset = () => {
    setSession(null);
    setPlayers([]);
    setQuestions([]);
    setBuzzedPlayers([]);
    setStatus(GameStatus.LOBBY);
    if (user) {
      setAppView(AppView.HOME);
    } else {
      setAppView(AppView.LOBBY);
    }
  };

  const renderContent = () => {
    // Home page for logged in users
    if (appView === AppView.HOME && user) {
      return (
        <HomePage
          user={user}
          onLogout={handleLogout}
          onCreateSession={() => setAppView(AppView.LOBBY)}
          onJoinSession={() => setAppView(AppView.LOBBY)}
          onRejoinSession={handleRejoinSession}
        />
      );
    }

    // Lobby
    if (appView === AppView.LOBBY || status === GameStatus.LOBBY) {
      return (
        <Lobby
          user={user}
          onStart={setupGame}
          onJoin={async (p, sess) => {
            setCurrentPlayerId(p.id);
            localStorage.setItem('mdev_player_id', p.id);
            setSession(sess);
            setStatus(sess.status as GameStatus);

            // Si la session est deja en cours, charger les donnees
            if (sess.status === GameStatus.PLAYING || sess.status === GameStatus.GENERATING) {
              const playersData = await playerService.getPlayersBySession(sess.id);
              setPlayers(playersData);

              const questionsData = await questionService.getQuestionsBySession(sess.id);
              setQuestions(questionsData);

              await fetchBuzzState(sess.id);
            }

            setAppView(AppView.GAME);
          }}
          onBack={user ? () => setAppView(AppView.HOME) : undefined}
        />
      );
    }

    // Generating
    if (status === GameStatus.GENERATING) {
      return (
        <div className="flex flex-col items-center justify-center h-64 sm:h-96 space-y-4 sm:space-y-6 px-4">
          <div className="relative h-16 w-16 sm:h-24 sm:w-24">
            <div className="absolute inset-0 border-4 sm:border-8 border-mGreen/20 rounded-full"></div>
            <div className="absolute inset-0 border-4 sm:border-8 border-t-mYellow rounded-full animate-spin"></div>
          </div>
          <p className="text-base sm:text-xl font-orbitron font-bold text-mYellow tracking-wide sm:tracking-widest animate-pulse text-center">
            PREPARATION DE LA PARTIE...
          </p>
        </div>
      );
    }

    const stateObj: RoomState = {
      players,
      questions,
      currentQuestionIndex: session?.current_question_index || 0,
      status,
      buzzedPlayers,
      debtAmount: session?.debt_amount || 20
    };

    // Results
    if (status === GameStatus.RESULTS) {
      return <Results state={stateObj} onReset={handleReset} />;
    }

    // Manager or Player view
    const me = players.find(p => p.id === currentPlayerId);

    if (me?.isManager) {
      return <ManagerView state={stateObj} onValidate={validateAnswer} onSkip={skipQuestion} onResetBuzzer={resetBuzzer} />;
    }

    return <PlayerView state={stateObj} playerId={currentPlayerId!} onBuzz={() => handleBuzz(currentPlayerId!)} />;
  };

  return (
    <div className="min-h-screen p-3 sm:p-4 md:p-8 max-w-6xl mx-auto flex flex-col">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 sm:mb-12 gap-4">
        <div className="group cursor-default">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-orbitron font-black bg-gradient-to-r from-mYellow via-mOrange to-mSienna bg-clip-text text-transparent">
            BUZZMASTER PRO
          </h1>
          <p className="text-mGreen text-[8px] sm:text-[10px] font-black tracking-[0.2em] sm:tracking-[0.4em] uppercase">
            Live Platform <span className="text-mYellow">by Mouha_Dev</span>
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
          {/* Boutons connexion/inscription si non connecte */}
          {!user && !session && (
            <div className="flex gap-2 w-full sm:w-auto">
              <button
                onClick={() => { setAuthMode('login'); setShowAuthModal(true); }}
                className="glass px-3 sm:px-4 py-2 rounded-xl text-xs font-bold text-mGreen border border-mGreen/30 hover:bg-mGreen/10 transition-all flex-1 sm:flex-none"
              >
                <i className="fas fa-sign-in-alt mr-1 sm:mr-2"></i>
                <span className="hidden xs:inline">Connexion</span>
                <span className="xs:hidden">Login</span>
              </button>
              <button
                onClick={() => { setAuthMode('signup'); setShowAuthModal(true); }}
                className="bg-mYellow text-mTeal px-3 sm:px-4 py-2 rounded-xl text-xs font-bold hover:bg-mYellow/90 transition-all flex-1 sm:flex-none"
              >
                <i className="fas fa-user-plus mr-1 sm:mr-2"></i>
                <span className="hidden xs:inline">Inscription</span>
                <span className="xs:hidden">Sign up</span>
              </button>
            </div>
          )}
          {/* User connecte */}
          {user && (
            <div className="flex items-center justify-between sm:justify-start gap-2 w-full sm:w-auto">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowHistoryPanel(true)}
                  className="glass px-2 py-1.5 rounded-full text-xs font-bold text-mGreen border border-mGreen/30 hover:bg-mGreen/10 transition-all"
                  title="Mes parties"
                >
                  <i className="fas fa-history"></i>
                  <span className="hidden sm:inline ml-1">Mes parties</span>
                </button>
                <div className="glass px-2 py-1.5 rounded-full flex items-center space-x-1 border-mYellow/30 bg-mYellow/5">
                  <i className="fas fa-user text-mYellow text-xs"></i>
                  <span className="text-[9px] sm:text-[10px] font-bold text-mYellow uppercase tracking-wide truncate max-w-[80px] sm:max-w-none">{user.username}</span>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="glass px-2 py-1.5 rounded-full text-slate-500 hover:text-mSienna transition-colors border border-slate-500/20 hover:border-mSienna/30"
                title="Deconnexion"
              >
                <i className="fas fa-sign-out-alt text-xs"></i>
              </button>
            </div>
          )}
          {/* Session active */}
          {currentPlayerId && session && (
            <div className="flex flex-col items-start sm:items-end w-full sm:w-auto sm:ml-2">
              <div className="glass px-2 sm:px-3 py-1.5 rounded-full flex items-center space-x-1 sm:space-x-2 border-mGreen/30 bg-mGreen/5">
                <div className="h-2 w-2 rounded-full bg-mGreen animate-pulse"></div>
                <span className="text-[9px] sm:text-[10px] font-black text-mGreen font-orbitron uppercase tracking-wide sm:tracking-widest">Session: {session.code}</span>
              </div>
            </div>
          )}
        </div>
      </header>

      <main className="flex-grow">
        {renderContent()}
      </main>

      {/* Modal d'authentification */}
      {showAuthModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="relative max-w-md w-full max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowAuthModal(false)}
              className="absolute -top-8 sm:-top-10 right-0 text-slate-400 hover:text-white text-lg sm:text-xl z-10"
            >
              <i className="fas fa-times"></i>
            </button>
            <AuthPage
              onAuthenticated={(u) => {
                setUser(u);
                setShowAuthModal(false);
              }}
              onSkipAuth={() => setShowAuthModal(false)}
              initialMode={authMode}
            />
          </div>
        </div>
      )}

      {/* Panel historique des parties */}
      {showHistoryPanel && user && (
        <GameHistoryPanel
          user={user}
          onRejoinSession={handleRejoinSession}
          onClose={() => setShowHistoryPanel(false)}
        />
      )}

      <footer className="mt-16 sm:mt-20 py-4 sm:py-6 border-t border-mGreen/20 text-center text-[7px] sm:text-[8px] text-slate-600 font-bold uppercase tracking-[0.3em] sm:tracking-[0.5em] px-2">
        <p className="break-words">BUZZMASTER CLOUD &copy; 2025 | MDEV GLOBAL INFRA | POWERED BY SUPABASE</p>
      </footer>
    </div>
  );
};

export default App;
