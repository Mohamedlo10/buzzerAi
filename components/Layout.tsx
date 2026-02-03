import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import AuthPage from './AuthPage';
import GameHistoryPanel from './GameHistoryPanel';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user, setUser, logout, session, currentPlayerId } = useGame();
  const navigate = useNavigate();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);

  const handleRejoinSession = async (sessionId: string, sessionCode: string) => {
    setShowHistoryPanel(false);
    navigate(`/game/${sessionId}`);
  };

  return (
    <div className="min-h-screen p-3 sm:p-4 md:p-8 max-w-6xl mx-auto flex flex-col">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 sm:mb-12 gap-4">
        <Link to={user ? '/' : '/lobby'} className="group cursor-pointer">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-orbitron font-black bg-gradient-to-r from-mYellow via-mOrange to-mSienna bg-clip-text text-transparent drop-shadow-lg">
            BUZZMASTER PRO
          </h1>
          <p className="text-[8px] sm:text-[10px] font-black tracking-[0.2em] sm:tracking-[0.4em] uppercase">
            <span className="text-mCyan">Live Platform</span> <span className="text-mYellow">by Mouha_Dev</span>
          </p>
        </Link>
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
                onClick={() => { logout(); navigate('/lobby'); }}
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
        {children}
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
                navigate('/');
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

export default Layout;
