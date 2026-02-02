
import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { authService, ActiveSession, GameHistory } from '../services/authService';

interface GameHistoryPanelProps {
  user: User;
  onRejoinSession: (sessionId: string, sessionCode: string) => void | Promise<void>;
  onClose: () => void;
}

const GameHistoryPanel: React.FC<GameHistoryPanelProps> = ({ user, onRejoinSession, onClose }) => {
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
  const [activeSessions, setActiveSessions] = useState<ActiveSession[]>([]);
  const [gameHistory, setGameHistory] = useState<GameHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [joiningSessionId, setJoiningSessionId] = useState<string | null>(null);

  const handleRejoin = async (sessionId: string, sessionCode: string) => {
    setJoiningSessionId(sessionId);
    await onRejoinSession(sessionId, sessionCode);
    onClose();
  };

  useEffect(() => {
    loadData();
  }, [user.id]);

  const loadData = async () => {
    setLoading(true);
    const [active, history] = await Promise.all([
      authService.getUserActiveSessions(user.id),
      authService.getUserGameHistory(user.id)
    ]);
    setActiveSessions(active);
    setGameHistory(history);
    setLoading(false);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'LOBBY':
        return { text: 'En attente', color: 'text-mYellow', bg: 'bg-mYellow/20' };
      case 'GENERATING':
        return { text: 'Generation...', color: 'text-mOrange', bg: 'bg-mOrange/20' };
      case 'PLAYING':
        return { text: 'En cours', color: 'text-mGreen', bg: 'bg-mGreen/20' };
      case 'RESULTS':
        return { text: 'Terminee', color: 'text-slate-400', bg: 'bg-slate-400/20' };
      default:
        return { text: status, color: 'text-slate-400', bg: 'bg-slate-400/20' };
    }
  };

  const getRankBadge = (rank: number) => {
    if (rank === 1) return { icon: 'fa-trophy', color: 'text-yellow-400' };
    if (rank === 2) return { icon: 'fa-medal', color: 'text-slate-300' };
    if (rank === 3) return { icon: 'fa-medal', color: 'text-orange-400' };
    return { icon: 'fa-hashtag', color: 'text-slate-500' };
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="glass rounded-[1.5rem] sm:rounded-[2rem] border-mYellow/20 w-full max-w-2xl max-h-[90vh] sm:max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-mGreen/20 flex justify-between items-center">
          <div>
            <h2 className="text-lg sm:text-2xl font-orbitron text-mYellow font-bold">MES PARTIES</h2>
            <p className="text-[10px] sm:text-xs text-slate-500 uppercase tracking-widest truncate max-w-[150px] sm:max-w-none">{user.username}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-lg sm:text-xl p-2">
            <i className="fas fa-times"></i>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-mGreen/20">
          <button
            onClick={() => setActiveTab('active')}
            className={`flex-1 py-2 sm:py-3 text-[10px] sm:text-sm font-bold uppercase tracking-wider sm:tracking-widest transition-all ${
              activeTab === 'active'
                ? 'text-mGreen border-b-2 border-mGreen bg-mGreen/5'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <i className="fas fa-play-circle mr-1 sm:mr-2"></i>
            <span className="hidden xs:inline">En cours</span> ({activeSessions.length})
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-2 sm:py-3 text-[10px] sm:text-sm font-bold uppercase tracking-wider sm:tracking-widest transition-all ${
              activeTab === 'history'
                ? 'text-mOrange border-b-2 border-mOrange bg-mOrange/5'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <i className="fas fa-history mr-1 sm:mr-2"></i>
            <span className="hidden xs:inline">Historique</span> ({gameHistory.length})
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="text-center py-12">
              <i className="fas fa-spinner fa-spin text-3xl text-mGreen mb-4"></i>
              <p className="text-slate-500">Chargement...</p>
            </div>
          ) : activeTab === 'active' ? (
            activeSessions.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <i className="fas fa-gamepad text-4xl mb-4 opacity-30"></i>
                <p>Aucune partie en cours</p>
                <p className="text-xs mt-2">Creez ou rejoignez une partie pour commencer</p>
              </div>
            ) : (
              <div className="space-y-3">
                {activeSessions.map(session => {
                  const status = getStatusBadge(session.status);
                  return (
                    <div
                      key={session.id}
                      className="bg-mTeal/40 p-3 sm:p-4 rounded-xl border border-mGreen/20 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 hover:bg-mTeal/50 transition-all"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-orbitron text-lg sm:text-xl text-white tracking-widest">
                            {session.code}
                          </span>
                          <span className={`text-[9px] sm:text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${status.bg} ${status.color}`}>
                            {status.text}
                          </span>
                          {session.is_manager && (
                            <span className="text-[9px] sm:text-[10px] text-mYellow">
                              <i className="fas fa-crown mr-1"></i>Admin
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] sm:text-xs text-slate-400 mt-1 flex items-center gap-3">
                          <span><i className="fas fa-users mr-1"></i>{session.player_count} joueur(s)</span>
                          {session.my_score !== undefined && (
                            <span><i className="fas fa-star mr-1 text-mYellow"></i>{session.my_score} pts</span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => handleRejoin(session.id, session.code)}
                        disabled={joiningSessionId !== null}
                        className="bg-mGreen text-mTeal px-4 py-2 rounded-xl font-bold hover:bg-mGreen/90 transition-all text-sm w-full sm:w-auto disabled:opacity-70 disabled:cursor-not-allowed"
                      >
                        {joiningSessionId === session.id ? (
                          <>
                            <i className="fas fa-spinner fa-spin mr-2"></i>
                            Chargement...
                          </>
                        ) : (
                          <>
                            <i className="fas fa-play mr-2"></i>
                            Rejoindre
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            gameHistory.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <i className="fas fa-trophy text-4xl mb-4 opacity-30"></i>
                <p>Aucune partie terminee</p>
                <p className="text-xs mt-2">Vos resultats apparaitront ici</p>
              </div>
            ) : (
              <div className="space-y-3">
                {gameHistory.map(game => {
                  const rank = getRankBadge(game.my_rank);
                  return (
                    <div
                      key={game.id}
                      className="bg-mTeal/40 p-4 rounded-xl border border-slate-700/50"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-3">
                            <span className="font-orbitron text-lg text-slate-300">
                              {game.code}
                            </span>
                            <span className={`${rank.color}`}>
                              <i className={`fas ${rank.icon} mr-1`}></i>
                              #{game.my_rank}
                            </span>
                            {game.is_manager && (
                              <span className="text-[10px] text-mYellow">
                                <i className="fas fa-crown"></i>
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-500 mt-1">
                            {new Date(game.created_at).toLocaleDateString('fr-FR', {
                              day: 'numeric',
                              month: 'long',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-orbitron font-bold text-mYellow">
                            {game.my_score}
                            <span className="text-xs text-slate-500 ml-1">pts</span>
                          </div>
                          <div className="text-[10px] text-slate-500">
                            {game.player_count} joueurs
                          </div>
                        </div>
                      </div>
                      {game.winner_name && game.my_rank !== 1 && (
                        <div className="mt-3 pt-3 border-t border-slate-700/50 text-xs text-slate-400">
                          <i className="fas fa-trophy text-yellow-400 mr-2"></i>
                          Gagnant: <span className="text-white font-bold">{game.winner_name}</span> ({game.winner_score} pts)
                        </div>
                      )}
                      {game.my_rank === 1 && (
                        <div className="mt-3 pt-3 border-t border-slate-700/50 text-xs text-mGreen font-bold">
                          <i className="fas fa-crown text-yellow-400 mr-2"></i>
                          VICTOIRE !
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-mGreen/20 text-center">
          <button onClick={loadData} disabled={loading} className="text-mGreen hover:text-mYellow text-sm transition-colors">
            <i className={`fas fa-sync-alt mr-2 ${loading ? 'fa-spin' : ''}`}></i>
            Actualiser
          </button>
        </div>
      </div>
    </div>
  );
};

export default GameHistoryPanel;
