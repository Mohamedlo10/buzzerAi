import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { authService, ActiveSession } from '../services/authService';

interface HomePageProps {
  user: User;
  onLogout: () => void;
  onCreateSession: () => void;
  onJoinSession: () => void;
  onRejoinSession: (sessionId: string, sessionCode: string) => void;
  onNavigateToLobby?: (initialView: 'CREATE' | 'JOIN') => void;
}

const HomePage: React.FC<HomePageProps> = ({
  user,
  onLogout,
  onCreateSession,
  onJoinSession,
  onRejoinSession,
  onNavigateToLobby
}) => {
  const [activeSessions, setActiveSessions] = useState<ActiveSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSessions();
  }, [user.id]);

  const loadSessions = async () => {
    setLoading(true);
    const sessions = await authService.getUserActiveSessions(user.id);
    setActiveSessions(sessions);
    setLoading(false);
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'LOBBY':
        return { text: 'En attente', color: 'text-mYellow', bg: 'bg-mYellow/20' };
      case 'GENERATING':
        return { text: 'Generation...', color: 'text-mOrange', bg: 'bg-mOrange/20' };
      case 'PLAYING':
        return { text: 'En cours', color: 'text-mGreen', bg: 'bg-mGreen/20' };
      default:
        return { text: status, color: 'text-slate-400', bg: 'bg-slate-400/20' };
    }
  };

  return (
    <div className="space-y-10 animate-fade-in py-4">
      {/* Header avec user info */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl md:text-xl font-orbitron text-mYellow font-bold">
            Bienvenue, {user.username}
          </h2>
          <p className="text-mGreen text-xs uppercase tracking-widest mt-1">
            <i className="fas fa-cloud mr-2"></i>
            BuzzMaster Cloud Dashboard
          </p>
        </div>
        <button
          onClick={onLogout}
          className="bg-mSienna/20 text-mSienna px-5 py-3 rounded-xl font-bold border border-mSienna/50 hover:bg-mSienna/30 transition-all text-sm"
        >
          <i className="fas fa-sign-out-alt mr-2"></i>
          Deconnexion
        </button>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <button
          onClick={() => onNavigateToLobby ? onNavigateToLobby('CREATE') : onCreateSession()}
          className="glass p-8 rounded-[2rem] border-mGreen/30 hover:border-mGreen hover:bg-mGreen/5 transition-all group flex flex-col items-center space-y-4 shadow-xl"
        >
          <div className="bg-mGreen/20 p-5 rounded-full group-hover:scale-110 transition-transform">
            <i className="fas fa-plus text-4xl text-mGreen"></i>
          </div>
          <span className="font-orbitron font-black text-lg text-mGreen uppercase tracking-widest">
            Nouvelle Session
          </span>
          <span className="text-xs text-slate-500">
            Creez une partie et invitez des joueurs
          </span>
        </button>

        <button
          onClick={() => onNavigateToLobby ? onNavigateToLobby('JOIN') : onJoinSession()}
          className="glass p-8 rounded-[2rem] border-mOrange/30 hover:border-mOrange hover:bg-mOrange/5 transition-all group flex flex-col items-center space-y-4 shadow-xl"
        >
          <div className="bg-mOrange/20 p-5 rounded-full group-hover:scale-110 transition-transform">
            <i className="fas fa-link text-4xl text-mOrange"></i>
          </div>
          <span className="font-orbitron font-black text-lg text-mOrange uppercase tracking-widest">
            Rejoindre
          </span>
          <span className="text-xs text-slate-500">
            Entrez un code pour rejoindre une partie
          </span>
        </button>
      </div>

      {/* Active Sessions List */}
      <div className="glass p-6 md:p-8 rounded-[2rem] border-mYellow/20 shadow-xl">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-orbitron text-mYellow font-bold flex items-center">
            <i className="fas fa-broadcast-tower mr-3"></i>
            Vos Sessions Actives
          </h3>
          <button
            onClick={loadSessions}
            disabled={loading}
            className="text-mGreen hover:text-mYellow transition-colors p-2"
          >
            <i className={`fas fa-sync-alt ${loading ? 'fa-spin' : ''}`}></i>
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <i className="fas fa-spinner fa-spin text-4xl text-mGreen mb-4"></i>
            <p className="text-slate-500">Chargement des sessions...</p>
          </div>
        ) : activeSessions.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <i className="fas fa-folder-open text-4xl mb-4 opacity-30"></i>
            <p className="text-lg">Aucune session active</p>
            <p className="text-sm mt-2">Creez ou rejoignez une session pour commencer</p>
          </div>
        ) : (
          <div className="space-y-3">
            {activeSessions.map((session) => {
              const statusInfo = getStatusLabel(session.status);
              return (
                <div
                  key={session.id}
                  className="bg-mTeal/40 p-5 rounded-xl border border-mGreen/20 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:bg-mTeal/50 transition-all"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <span className="font-orbitron text-2xl text-white tracking-widest">
                        {session.code}
                      </span>
                      <span className={`text-xs px-3 py-1 rounded-full font-bold uppercase ${statusInfo.bg} ${statusInfo.color}`}>
                        {statusInfo.text}
                      </span>
                    </div>
                    <div className="text-sm text-slate-400 mt-1 flex items-center gap-4">
                      <span>
                        <i className="fas fa-users mr-1"></i>
                        {session.player_count} joueur(s)
                      </span>
                      <span>
                        <i className="fas fa-clock mr-1"></i>
                        {new Date(session.created_at).toLocaleDateString('fr-FR', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => onRejoinSession(session.id, session.code)}
                    className="bg-mGreen text-mTeal px-6 py-3 rounded-xl font-bold hover:bg-mGreen/90 transition-all flex items-center gap-2"
                  >
                    <i className="fas fa-play"></i>
                    Rejoindre
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Stats rapides */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass p-4 rounded-xl border-mGreen/10 text-center">
          <div className="text-2xl font-orbitron font-bold text-mGreen">
            {activeSessions.length}
          </div>
          <div className="text-[10px] text-slate-500 uppercase tracking-widest">
            Sessions actives
          </div>
        </div>
        <div className="glass p-4 rounded-xl border-mYellow/10 text-center">
          <div className="text-2xl font-orbitron font-bold text-mYellow">
            {activeSessions.filter(s => s.status === 'PLAYING').length}
          </div>
          <div className="text-[10px] text-slate-500 uppercase tracking-widest">
            En cours
          </div>
        </div>
        <div className="glass p-4 rounded-xl border-mOrange/10 text-center">
          <div className="text-2xl font-orbitron font-bold text-mOrange">
            {activeSessions.filter(s => s.status === 'LOBBY').length}
          </div>
          <div className="text-[10px] text-slate-500 uppercase tracking-widest">
            En attente
          </div>
        </div>
        <div className="glass p-4 rounded-xl border-mSienna/10 text-center">
          <div className="text-2xl font-orbitron font-bold text-mSienna">
            {activeSessions.reduce((sum, s) => sum + s.player_count, 0)}
          </div>
          <div className="text-[10px] text-slate-500 uppercase tracking-widest">
            Joueurs total
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
