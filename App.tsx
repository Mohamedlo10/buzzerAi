
import React, { useState, useEffect } from 'react';
import { GameStatus, RoomState, Player, Question, PlayerCategory } from './types';
import { generateQuestions } from './geminiService';
import { supabase } from './supabaseClient';
import Lobby from './components/Lobby';
import ManagerView from './components/ManagerView';
import PlayerView from './components/PlayerView';
import Results from './components/Results';

const App: React.FC = () => {
  const [session, setSession] = useState<any>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [buzzedPlayers, setBuzzedPlayers] = useState<any[]>([]);
  const [currentPlayerId, setCurrentPlayerId] = useState<string | null>(localStorage.getItem('mdev_player_id'));
  const [status, setStatus] = useState<GameStatus>(GameStatus.LOBBY);

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
          const { data } = await supabase.from('buzzes').select('*').eq('session_id', session.id).order('created_at', { ascending: true });
          if (data) setBuzzedPlayers(data.map(b => ({ playerId: b.player_local_id, timestamp: b.created_at })));
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
    
    if (allCategories.length === 0) allCategories.push({ name: "Culture Générale", difficulty: "Intermédiaire" });

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
    if (status !== GameStatus.PLAYING) return;
    // Check if already buzzed to avoid duplicates
    const { data: existing } = await supabase.from('buzzes').select('*').eq('session_id', session.id).eq('player_local_id', playerId);
    if (existing && existing.length > 0) return;

    await supabase.from('buzzes').insert({
      session_id: session.id,
      player_local_id: playerId
    });
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
      // Bonne réponse: reset tous les buzzes et passer à la question suivante
      await supabase.from('buzzes').delete().eq('session_id', session.id);
      const nextIndex = session.current_question_index + 1;
      const isGameOver = nextIndex >= questions.length;
      await supabase.from('sessions').update({
        current_question_index: nextIndex,
        status: isGameOver ? GameStatus.RESULTS : GameStatus.PLAYING
      }).eq('id', session.id);
    } else if (playerId) {
      // Mauvaise réponse: retirer seulement ce joueur de la file d'attente
      await supabase.from('buzzes').delete().eq('session_id', session.id).eq('player_local_id', playerId);
    }
  };

  const resetBuzzer = async () => {
    if (!session) return;
    await supabase.from('buzzes').delete().eq('session_id', session.id);
  };

  const skipQuestion = async () => {
    if (!session) return;
    await supabase.from('buzzes').delete().eq('session_id', session.id);
    const nextIndex = session.current_question_index + 1;
    const isGameOver = nextIndex >= questions.length;
    await supabase.from('sessions').update({ 
      current_question_index: nextIndex, 
      status: isGameOver ? GameStatus.RESULTS : GameStatus.PLAYING 
    }).eq('id', session.id);
  };

  const renderContent = () => {
    const me = players.find(p => p.id === currentPlayerId);

    if (status === GameStatus.LOBBY) {
      return (
        <Lobby 
          onStart={setupGame} 
          onJoin={(p, sess) => {
            setCurrentPlayerId(p.id);
            localStorage.setItem('mdev_player_id', p.id);
            setSession(sess);
          }} 
        />
      );
    }

    if (status === GameStatus.GENERATING) {
      return (
        <div className="flex flex-col items-center justify-center h-96 space-y-6">
          <div className="relative h-24 w-24">
            <div className="absolute inset-0 border-8 border-mGreen/20 rounded-full"></div>
            <div className="absolute inset-0 border-8 border-t-mYellow rounded-full animate-spin"></div>
          </div>
          <p className="text-xl font-orbitron font-bold text-mYellow tracking-widest animate-pulse">SUPABASE & GEMINI SYNC...</p>
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

    if (status === GameStatus.RESULTS) {
      return <Results state={stateObj} onReset={() => window.location.reload()} />;
    }

    if (me?.isManager) {
      return <ManagerView state={stateObj} onValidate={validateAnswer} onSkip={skipQuestion} onResetBuzzer={resetBuzzer} />;
    }

    return <PlayerView state={stateObj} playerId={currentPlayerId!} onBuzz={() => handleBuzz(currentPlayerId!)} />;
  };

  return (
    <div className="min-h-screen p-4 md:p-8 max-w-6xl mx-auto flex flex-col">
      <header className="flex justify-between items-center mb-12">
        <div className="group cursor-default">
          <h1 className="text-4xl font-orbitron font-black bg-gradient-to-r from-mYellow via-mOrange to-mSienna bg-clip-text text-transparent">
            BUZZMASTER PRO
          </h1>
          <p className="text-mGreen text-[10px] font-black tracking-[0.4em] uppercase">
            Live Platform <span className="text-mYellow">by Mouha_Dev</span>
          </p>
        </div>
        {currentPlayerId && session && (
          <div className="flex flex-col items-end">
            <div className="glass px-4 py-2 rounded-full flex items-center space-x-3 border-mGreen/30 bg-mGreen/5">
              <div className="h-2 w-2 rounded-full bg-mGreen animate-pulse"></div>
              <span className="text-[10px] font-black text-mGreen font-orbitron uppercase tracking-widest">Session: {session.code}</span>
            </div>
            <span className="text-[8px] text-slate-500 mt-1 uppercase font-bold tracking-tighter">Syncing via Supabase Realtime</span>
          </div>
        )}
      </header>
      
      <main className="flex-grow">
        {renderContent()}
      </main>

      <footer className="mt-20 py-6 border-t border-mGreen/20 text-center text-[8px] text-slate-600 font-bold uppercase tracking-[0.5em]">
        <p>BUZZMASTER CLOUD &copy; 2025 | MDEV GLOBAL INFRA | POWERED BY SUPABASE</p>
      </footer>
    </div>
  );
};

export default App;
