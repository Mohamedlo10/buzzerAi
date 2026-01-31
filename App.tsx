
import React, { useState } from 'react';
import { GameStatus, RoomState, Player, Question } from './types';
import { generateQuestions } from './geminiService';
import Lobby from './components/Lobby';
import ManagerView from './components/ManagerView';
import PlayerView from './components/PlayerView';
import Results from './components/Results';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<RoomState>({
    players: [],
    questions: [],
    currentQuestionIndex: -1,
    status: GameStatus.LOBBY,
    buzzedPlayers: [],
    debtAmount: 20,
  });

  const [currentPlayerId, setCurrentPlayerId] = useState<string | null>(null);

  const setupGame = async (players: Player[], debt: number, questionsPerUser: number) => {
    setGameState(prev => ({ 
      ...prev, 
      players, 
      debtAmount: debt, 
      status: GameStatus.GENERATING 
    }));

    // On ne génère des questions que pour les joueurs qui ne sont pas gérants (ou toutes les catégories si désiré)
    // Ici on prend toutes les catégories définies par les joueurs
    const categories = players.filter(p => !p.isManager).map(p => p.category);
    
    // Si pas de catégories joueurs, on met une catégorie par défaut pour le fun
    if (categories.length === 0) categories.push("Culture Générale");

    const rawQuestions = await generateQuestions(categories, questionsPerUser);
    
    const formattedQuestions: Question[] = rawQuestions.map((q: any, index: number) => ({
      ...q,
      id: `q-${index}`,
      isUsed: false
    }));

    setGameState(prev => ({
      ...prev,
      questions: formattedQuestions,
      status: GameStatus.PLAYING,
      currentQuestionIndex: 0
    }));
  };

  const handleBuzz = (playerId: string) => {
    if (gameState.status !== GameStatus.PLAYING) return;
    setGameState(prev => {
      if (prev.buzzedPlayers.some(b => b.playerId === playerId)) return prev;
      return {
        ...prev,
        buzzedPlayers: [...prev.buzzedPlayers, { playerId, timestamp: Date.now() }]
      };
    });
  };

  const validateAnswer = (playerId: string | null, points: number, moveNext: boolean) => {
    setGameState(prev => {
      const updatedPlayers = [...prev.players];
      const currentQ = prev.questions[prev.currentQuestionIndex];
      
      if (playerId) {
        const pIndex = updatedPlayers.findIndex(p => p.id === playerId);
        if (pIndex !== -1) {
          updatedPlayers[pIndex].score += points;
          if (points > 0) {
            const cat = currentQ.category;
            updatedPlayers[pIndex].categoryScores[cat] = (updatedPlayers[pIndex].categoryScores[cat] || 0) + 1;
          }
        }
      }

      if (moveNext) {
        const nextIndex = prev.currentQuestionIndex + 1;
        const isGameOver = nextIndex >= prev.questions.length;
        return {
          ...prev,
          players: updatedPlayers,
          buzzedPlayers: [],
          currentQuestionIndex: nextIndex,
          status: isGameOver ? GameStatus.RESULTS : prev.status
        };
      } else {
        return {
          ...prev,
          players: updatedPlayers,
          buzzedPlayers: prev.buzzedPlayers.slice(1)
        };
      }
    });
  };

  const skipQuestion = () => {
    setGameState(prev => {
      const nextIndex = prev.currentQuestionIndex + 1;
      const isGameOver = nextIndex >= prev.questions.length;
      return {
        ...prev,
        buzzedPlayers: [],
        currentQuestionIndex: nextIndex,
        status: isGameOver ? GameStatus.RESULTS : prev.status
      };
    });
  };

  const renderContent = () => {
    const me = gameState.players.find(p => p.id === currentPlayerId);

    if (gameState.status === GameStatus.LOBBY) {
      return <Lobby onStart={setupGame} onJoin={(p) => setCurrentPlayerId(p.id)} />;
    }

    if (gameState.status === GameStatus.GENERATING) {
      return (
        <div className="flex flex-col items-center justify-center h-96 space-y-4">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-mYellow"></div>
          <p className="text-xl font-semibold text-mYellow font-orbitron uppercase tracking-widest">Génération MDEV en cours...</p>
        </div>
      );
    }

    if (gameState.status === GameStatus.RESULTS) {
      return <Results state={gameState} onReset={() => window.location.reload()} />;
    }

    if (me?.isManager) {
      return (
        <ManagerView 
          state={gameState} 
          onValidate={validateAnswer}
          onSkip={skipQuestion}
        />
      );
    }

    return (
      <PlayerView 
        state={gameState} 
        playerId={currentPlayerId!} 
        onBuzz={() => handleBuzz(currentPlayerId!)} 
      />
    );
  };

  return (
    <div className="min-h-screen p-4 md:p-8 max-w-6xl mx-auto flex flex-col">
      <header className="flex justify-between items-center mb-12">
        <div className="group cursor-default">
          <h1 className="text-4xl font-orbitron font-bold bg-gradient-to-r from-mYellow via-mOrange to-mSienna bg-clip-text text-transparent">
            BUZZMASTER AI
          </h1>
          <p className="text-mGreen text-sm italic font-medium">
            Réalisé avec <i className="fas fa-bolt text-mSienna"></i> par <span className="text-mYellow font-bold">Mouha_Dev</span>
          </p>
        </div>
        {currentPlayerId && (
          <div className="glass px-4 py-2 rounded-full flex items-center space-x-3 border-mGreen/30 bg-mGreen/5 shadow-lg shadow-mTeal/50">
            <div className="h-2 w-2 rounded-full bg-mGreen animate-pulse"></div>
            <span className="text-sm font-medium text-mGreen font-orbitron uppercase tracking-tighter">Session Active</span>
          </div>
        )}
      </header>
      
      <main className="flex-grow">
        {renderContent()}
      </main>

      <footer className="mt-20 py-6 border-t border-mGreen/20 text-center text-[10px] text-slate-500 font-bold uppercase tracking-[0.3em]">
        <p>PLATEFORME BUZZER AI &copy; 2025 | DESIGN PAR <span className="text-mOrange">MDEV</span> | AUTEUR: <span className="text-mYellow">MOUHA_DEV</span></p>
      </footer>
    </div>
  );
};

export default App;
