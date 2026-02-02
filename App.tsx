
import React, { useState, useEffect } from 'react';
import { GameStatus, AppView, RoomState, Player, Question, PlayerCategory, User, Buzz } from './types';
import { generateQuestions } from './geminiService';
import { supabase } from './supabaseClient';
import { authService } from './services/authService';
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

  // Fonction pour recuperer l'etat des buzzes avec timing en millisecondes
  const fetchBuzzState = async (sessionId?: string) => {
    const sid = sessionId || session?.id;
    if (!sid) return;
    const { data } = await supabase
      .from('buzzes')
      .select('*')
      .eq('session_id', sid)
      .order('buzz_timestamp_ms', { ascending: true, nullsFirst: false });

    if (data && data.length > 0) {
      const firstBuzzMs = data[0].buzz_timestamp_ms || new Date(data[0].created_at).getTime();
      const buzzesWithTiming: Buzz[] = data.map((b, index) => {
        const buzzMs = b.buzz_timestamp_ms || new Date(b.created_at).getTime();
        return {
          playerId: b.player_local_id,
          timestamp: new Date(b.created_at).getTime(),
          timestampMs: buzzMs,
          timeDiffMs: index === 0 ? 0 : buzzMs - firstBuzzMs
        };
      });
      setBuzzedPlayers(buzzesWithTiming);
    } else {
      setBuzzedPlayers([]);
    }
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

    const sessionSub = supabase
      .channel('session_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions', filter: `id=eq.${session.id}` },
        (payload) => {
          const updated = payload.new as any;
          setSession(updated);
          setStatus(updated.status as GameStatus);
        }
      )
      .subscribe();

    const playersSub = supabase
      .channel('players_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players', filter: `session_id=eq.${session.id}` },
        async () => {
          const { data } = await supabase.from('players').select('*').eq('session_id', session.id);
          if (data) setPlayers(data.map(p => ({
            id: p.local_id,
            name: p.name,
            categories: p.categories,
            score: p.score,
            categoryScores: p.category_scores,
            isManager: p.is_manager
          })));
        }
      )
      .subscribe();

    const buzzSub = supabase
      .channel('buzz_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'buzzes', filter: `session_id=eq.${session.id}` },
        async () => {
          await fetchBuzzState();
        }
      )
      .subscribe();

    const questionsSub = supabase
      .channel('questions_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'questions', filter: `session_id=eq.${session.id}` },
        async () => {
          const { data } = await supabase.from('questions').select('*').eq('session_id', session.id).order('order_index', { ascending: true });
          if (data) setQuestions(data as any);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(sessionSub);
      supabase.removeChannel(playersSub);
      supabase.removeChannel(buzzSub);
      supabase.removeChannel(questionsSub);
    };
  }, [session?.id]);

  const setupGame = async (allPlayers: Player[], debt: number, questionsPerCategory: number) => {
    if (!session) return;

    await supabase.from('sessions').update({ status: GameStatus.GENERATING, debt_amount: debt, q_per_user: questionsPerCategory }).eq('id', session.id);

    const allCategories: PlayerCategory[] = [];
    allPlayers.forEach(p => {
      p.categories.forEach(cat => {
        if (!allCategories.find(c => c.name.toLowerCase() === cat.name.toLowerCase())) {
          allCategories.push(cat);
        }
      });
    });

    if (allCategories.length === 0) allCategories.push({ name: "Culture Generale", difficulty: "Intermediaire" });

    const rawQuestions = await generateQuestions(allCategories, questionsPerCategory);

    const dbQuestions = rawQuestions.map((q: any, index: number) => ({
      session_id: session.id,
      category: q.category,
      text: q.text,
      answer: q.answer,
      difficulty: q.difficulty,
      order_index: index
    }));

    await supabase.from('questions').insert(dbQuestions);
    await supabase.from('sessions').update({ status: GameStatus.PLAYING, current_question_index: 0 }).eq('id', session.id);
  };

  const handleBuzz = async (playerId: string) => {
    if (status !== GameStatus.PLAYING || !session) return;

    const buzzTimestampMs = Date.now();

    try {
      const { error } = await supabase.from('buzzes').insert({
        session_id: session.id,
        player_local_id: playerId,
        buzz_timestamp_ms: buzzTimestampMs
      });

      // Erreur 23505 = violation de contrainte unique = deja buzze
      if (error?.code === '23505') {
        console.log('Player already buzzed');
        return;
      }

      if (error) {
        console.error('Buzz error:', error);
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
    } catch (err) {
      console.error('Buzz exception:', err);
    }
  };

  const validateAnswer = async (playerId: string | null, points: number, moveNext: boolean) => {
    if (!session) return;

    if (playerId) {
      const p = players.find(pl => pl.id === playerId);
      if (p) {
        const newScore = p.score + points;
        const currentQ = questions[session.current_question_index];
        const newCatScores = { ...p.categoryScores };
        if (points > 0) {
          newCatScores[currentQ.category] = (newCatScores[currentQ.category] || 0) + 1;
        }
        await supabase.from('players').update({ score: newScore, category_scores: newCatScores }).eq('session_id', session.id).eq('local_id', playerId);
      }
    }

    if (moveNext) {
      // Bonne reponse: reset tous les buzzes et passer a la question suivante
      await supabase.from('buzzes').delete().eq('session_id', session.id);
      setBuzzedPlayers([]);
      const nextIndex = session.current_question_index + 1;
      const isGameOver = nextIndex >= questions.length;
      await supabase.from('sessions').update({
        current_question_index: nextIndex,
        status: isGameOver ? GameStatus.RESULTS : GameStatus.PLAYING
      }).eq('id', session.id);
    } else if (playerId) {
      // Mauvaise reponse: retirer seulement ce joueur - passage AUTOMATIQUE au suivant
      await supabase.from('buzzes').delete().eq('session_id', session.id).eq('player_local_id', playerId);
      setBuzzedPlayers(prev => {
        const filtered = prev.filter(b => b.playerId !== playerId);
        // Recalculer les timeDiffMs avec le nouveau premier
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
    await supabase.from('buzzes').delete().eq('session_id', session.id);
    setBuzzedPlayers([]);
  };

  const skipQuestion = async () => {
    if (!session) return;
    await supabase.from('buzzes').delete().eq('session_id', session.id);
    setBuzzedPlayers([]);
    const nextIndex = session.current_question_index + 1;
    const isGameOver = nextIndex >= questions.length;
    await supabase.from('sessions').update({
      current_question_index: nextIndex,
      status: isGameOver ? GameStatus.RESULTS : GameStatus.PLAYING
    }).eq('id', session.id);
  };

  // Handler pour rejoindre une session depuis HomePage
  const handleRejoinSession = async (sessionId: string, sessionCode: string) => {
    const { data: sess } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (!sess) {
      alert('Session introuvable');
      return;
    }

    // Chercher si on est deja joueur
    const storedPlayerId = localStorage.getItem('mdev_player_id');
    if (storedPlayerId) {
      const { data: existingPlayer } = await supabase
        .from('players')
        .select('*')
        .eq('session_id', sessionId)
        .eq('local_id', storedPlayerId)
        .single();

      if (existingPlayer) {
        setCurrentPlayerId(existingPlayer.local_id);
        setSession(sess);
        setStatus(sess.status as GameStatus);

        // Charger les joueurs et questions
        const { data: playersData } = await supabase.from('players').select('*').eq('session_id', sessionId);
        if (playersData) {
          setPlayers(playersData.map(p => ({
            id: p.local_id,
            name: p.name,
            categories: p.categories,
            score: p.score,
            categoryScores: p.category_scores,
            isManager: p.is_manager
          })));
        }

        const { data: questionsData } = await supabase.from('questions').select('*').eq('session_id', sessionId).order('order_index', { ascending: true });
        if (questionsData) setQuestions(questionsData as any);

        setAppView(AppView.GAME);
        return;
      }
    }

    // Sinon, aller au lobby pour rejoindre
    setSession(sess);
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
              const { data: playersData } = await supabase.from('players').select('*').eq('session_id', sess.id);
              if (playersData) {
                setPlayers(playersData.map((pl: any) => ({
                  id: pl.local_id,
                  name: pl.name,
                  categories: pl.categories,
                  score: pl.score,
                  categoryScores: pl.category_scores,
                  isManager: pl.is_manager
                })));
              }

              const { data: questionsData } = await supabase.from('questions').select('*').eq('session_id', sess.id).order('order_index', { ascending: true });
              if (questionsData) setQuestions(questionsData as any);

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
        <div className="flex flex-col items-center justify-center h-96 space-y-6">
          <div className="relative h-24 w-24">
            <div className="absolute inset-0 border-8 border-mGreen/20 rounded-full"></div>
            <div className="absolute inset-0 border-8 border-t-mYellow rounded-full animate-spin"></div>
          </div>
          <p className="text-xl font-orbitron font-bold text-mYellow tracking-widest animate-pulse">PREPARATION DE LA PARTIE...</p>
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
    <div className="min-h-screen p-4 md:p-8 max-w-6xl mx-auto flex flex-col">
      <header className="flex justify-between items-center mb-12">
        <div className="group cursor-default">
          <h1 className="text-3xl md:text-4xl font-orbitron font-black bg-gradient-to-r from-mYellow via-mOrange to-mSienna bg-clip-text text-transparent">
            BUZZMASTER PRO
          </h1>
          <p className="text-mGreen text-[10px] font-black tracking-[0.4em] uppercase">
            Live Platform <span className="text-mYellow">by Mouha_Dev</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Boutons connexion/inscription si non connecte */}
          {!user && !session && (
            <div className="flex gap-2">
              <button
                onClick={() => { setAuthMode('login'); setShowAuthModal(true); }}
                className="glass px-4 py-2 rounded-xl text-xs font-bold text-mGreen border border-mGreen/30 hover:bg-mGreen/10 transition-all"
              >
                <i className="fas fa-sign-in-alt mr-2"></i>
                Connexion
              </button>
              <button
                onClick={() => { setAuthMode('signup'); setShowAuthModal(true); }}
                className="bg-mYellow text-mTeal px-4 py-2 rounded-xl text-xs font-bold hover:bg-mYellow/90 transition-all"
              >
                <i className="fas fa-user-plus mr-2"></i>
                Inscription
              </button>
            </div>
          )}
          {/* User connecte */}
          {user && (
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowHistoryPanel(true)}
                className="glass px-3 py-1.5 rounded-full text-xs font-bold text-mGreen border border-mGreen/30 hover:bg-mGreen/10 transition-all"
                title="Mes parties"
              >
                <i className="fas fa-history mr-1"></i>
                Mes parties
              </button>
              <div className="glass px-3 py-1.5 rounded-full flex items-center space-x-2 border-mYellow/30 bg-mYellow/5">
                <i className="fas fa-user text-mYellow text-xs"></i>
                <span className="text-[10px] font-bold text-mYellow uppercase tracking-wider">{user.username}</span>
              </div>
              <button
                onClick={handleLogout}
                className="text-slate-500 hover:text-mSienna text-xs transition-colors"
                title="Deconnexion"
              >
                <i className="fas fa-sign-out-alt"></i>
              </button>
            </div>
          )}
          {/* Session active */}
          {currentPlayerId && session && (
            <div className="flex flex-col items-end ml-2">
              <div className="glass px-3 py-1.5 rounded-full flex items-center space-x-2 border-mGreen/30 bg-mGreen/5">
                <div className="h-2 w-2 rounded-full bg-mGreen animate-pulse"></div>
                <span className="text-[10px] font-black text-mGreen font-orbitron uppercase tracking-widest">Session: {session.code}</span>
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
          <div className="relative max-w-md w-full">
            <button
              onClick={() => setShowAuthModal(false)}
              className="absolute -top-10 right-0 text-slate-400 hover:text-white text-xl"
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

      <footer className="mt-20 py-6 border-t border-mGreen/20 text-center text-[8px] text-slate-600 font-bold uppercase tracking-[0.5em]">
        <p>BUZZMASTER CLOUD &copy; 2025 | MDEV GLOBAL INFRA | POWERED BY SUPABASE</p>
      </footer>
    </div>
  );
};

export default App;
