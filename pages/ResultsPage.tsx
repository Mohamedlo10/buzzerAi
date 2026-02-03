import React, { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import { GameStatus } from '../types';
import Results from '../components/Results';

const ResultsPage: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const {
    user,
    session,
    status,
    getRoomState,
    resetGame,
    rejoinSession
  } = useGame();

  // Flag pour éviter les appels multiples de rejoin
  const [hasTriedRejoin, setHasTriedRejoin] = React.useState(false);

  useEffect(() => {
    // If no session data, try to rejoin (une seule fois)
    if (!session && sessionId && !hasTriedRejoin) {
      setHasTriedRejoin(true);
      const tryRejoin = async () => {
        const result = await rejoinSession(sessionId, '');
        if (!result.success) {
          navigate('/lobby');
        }
      };
      tryRejoin();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, hasTriedRejoin]); // Dépendances minimales

  // If not in results status, redirect
  useEffect(() => {
    if (session && status !== GameStatus.RESULTS) {
      if (status === GameStatus.PLAYING || status === GameStatus.GENERATING) {
        navigate(`/game/${session.id}`);
      } else {
        navigate('/lobby');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id, status]); // navigate est stable

  const handleReset = () => {
    resetGame();
    if (user) {
      navigate('/');
    } else {
      navigate('/lobby');
    }
  };

  // Loading state
  if (!session || status !== GameStatus.RESULTS) {
    return (
      <div className="flex flex-col items-center justify-center h-64 sm:h-96 space-y-4 sm:space-y-6 px-4">
        <div className="relative h-16 w-16 sm:h-24 sm:w-24">
          <div className="absolute inset-0 border-4 sm:border-8 border-mGreen/20 rounded-full"></div>
          <div className="absolute inset-0 border-4 sm:border-8 border-t-mYellow rounded-full animate-spin"></div>
        </div>
        <p className="text-base sm:text-xl font-orbitron font-bold text-mYellow tracking-wide sm:tracking-widest animate-pulse text-center">
          CHARGEMENT DES RESULTATS...
        </p>
      </div>
    );
  }

  const state = getRoomState();

  return <Results state={state} onReset={handleReset} />;
};

export default ResultsPage;
