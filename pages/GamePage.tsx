import React, { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import { GameStatus } from '../types';
import ManagerView from '../components/ManagerView';
import PlayerView from '../components/PlayerView';
import { sessionService } from '../services/sessionService';
import { questionService } from '../services/questionService';
import { playerService } from '../services/playerService';

const GamePage: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const {
    session,
    status,
    setStatus,
    setSession,
    players,
    setPlayers,
    setQuestions,
    currentPlayerId,
    getRoomState,
    validateAnswer,
    skipQuestion,
    resetBuzzer,
    handleBuzz,
    rejoinSession,
    fetchBuzzState
  } = useGame();

  // Flag pour éviter les appels multiples de rejoin
  const [hasTriedRejoin, setHasTriedRejoin] = React.useState(false);

  useEffect(() => {
    // If no session, try to rejoin (une seule fois)
    if (!session && sessionId && !hasTriedRejoin) {
      setHasTriedRejoin(true);
      const tryRejoin = async () => {
        const result = await rejoinSession(sessionId, '');
        if (!result.success) {
          navigate('/lobby');
        } else if (!result.isPlaying) {
          navigate('/lobby');
        }
      };
      tryRejoin();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, hasTriedRejoin]); // Dépendances minimales

  // Polling pour détecter la fin de la génération (GENERATING -> PLAYING)
  useEffect(() => {
    if (status !== GameStatus.GENERATING || !session?.id) return;

    const pollInterval = setInterval(async () => {
      const updatedSession = await sessionService.getSessionById(session.id);
      if (updatedSession && updatedSession.status === 'PLAYING') {
        clearInterval(pollInterval);

        // Charger les données du jeu
        const questionsData = await questionService.getQuestionsBySession(session.id);
        const playersData = await playerService.getPlayersBySession(session.id);

        setQuestions(questionsData);
        setPlayers(playersData);
        setSession({ ...session, ...updatedSession, status: GameStatus.PLAYING });
        setStatus(GameStatus.PLAYING);
        await fetchBuzzState(session.id);
      }
    }, 500); // Vérifie toutes les 500ms

    return () => clearInterval(pollInterval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, session?.id]);

  useEffect(() => {
    // Redirect to results if game is over
    if (status === GameStatus.RESULTS && session?.id) {
      navigate(`/results/${session.id}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, session?.id]); // navigate est stable

  // Loading state
  if (!session || !currentPlayerId) {
    return (
      <div className="flex flex-col items-center justify-center h-64 sm:h-96 space-y-4 sm:space-y-6 px-4">
        <div className="relative h-16 w-16 sm:h-24 sm:w-24">
          <div className="absolute inset-0 border-4 sm:border-8 border-mGreen/20 rounded-full"></div>
          <div className="absolute inset-0 border-4 sm:border-8 border-t-mYellow rounded-full animate-spin"></div>
        </div>
        <p className="text-base sm:text-xl font-orbitron font-bold text-mYellow tracking-wide sm:tracking-widest animate-pulse text-center">
          CHARGEMENT...
        </p>
      </div>
    );
  }

  // Generating state
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

  const state = getRoomState();
  const me = players.find(p => p.id === currentPlayerId);

  if (me?.isManager) {
    return <ManagerView state={state} onValidate={validateAnswer} onSkip={skipQuestion} onResetBuzzer={resetBuzzer} />;
  }

  return <PlayerView state={state} playerId={currentPlayerId} onBuzz={() => handleBuzz(currentPlayerId)} />;
};

export default GamePage;
