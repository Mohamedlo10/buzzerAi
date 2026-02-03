
import React from 'react';
import { RoomState } from '../types';

interface PlayerViewProps {
  state: RoomState;
  playerId: string;
  onBuzz: () => void;
}

const PlayerView: React.FC<PlayerViewProps> = ({ state, playerId, onBuzz }) => {
  const me = state.players.find(p => p.id === playerId);
  const currentQ = state.questions[state.currentQuestionIndex];
  const buzzIndex = state.buzzedPlayers.findIndex(b => b.playerId === playerId);
  const hasBuzzed = buzzIndex !== -1;
  const isMyTurn = buzzIndex === 0;
  const myBuzz = hasBuzzed ? state.buzzedPlayers[buzzIndex] : null;
  const queueSize = state.buzzedPlayers.length;

  return (
    <div className="flex flex-col items-center justify-center space-y-10 py-8">
      <div className="text-center group">
        <div className="text-mGreen uppercase tracking-[0.5em] text-xs font-black mb-2 group-hover:text-mYellow transition-colors">Votre Score Actuel</div>
        <div className="text-7xl md:text-8xl font-orbitron font-bold text-white tracking-tighter drop-shadow-[0_0_15px_rgba(233,196,106,0.3)]">{me?.score}</div>
      </div>

      <div className="relative">
        <button
          onClick={onBuzz}
          disabled={hasBuzzed}
          className={`
            h-56 w-56 md:h-72 md:w-72 rounded-full flex flex-col items-center justify-center
            transition-all duration-300 transform active:scale-90 border-8
            ${isMyTurn
              ? 'bg-mGreen border-mYellow text-white shadow-[0_0_60px_rgba(16,185,129,0.6)] scale-105'
              : hasBuzzed
                ? 'bg-mOrange border-mCard text-white opacity-90 cursor-default'
                : 'bg-gradient-to-br from-mSienna to-red-700 border-mCard text-white buzzer-active hover:shadow-[0_0_50px_rgba(239,68,68,0.6)]'
            }
          `}
        >
          <i className={`fas ${hasBuzzed ? (isMyTurn ? 'fa-microphone-alt' : 'fa-hourglass-half') : 'fa-bolt'} text-5xl md:text-7xl mb-3`}></i>
          <span className="font-orbitron font-black text-xl md:text-2xl text-center px-4 leading-tight tracking-widest uppercase">
            {isMyTurn ? 'PARLEZ !' : hasBuzzed ? `RANG ${buzzIndex + 1}` : 'BUZZ'}
          </span>
          {!hasBuzzed && queueSize > 0 && (
            <span className="text-[10px] mt-2 opacity-70">
              {queueSize} en attente
            </span>
          )}
        </button>

        {/* Badge position et timing */}
        {hasBuzzed && (
          <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 glass px-4 py-2 rounded-full border border-mOrange/50 bg-mTeal/90 shadow-lg">
            {isMyTurn ? (
              <span className="text-sm text-mGreen font-orbitron font-bold flex items-center gap-2">
                <i className="fas fa-bolt"></i>
                PREMIER !
              </span>
            ) : (
              <span className="text-sm text-mOrange font-orbitron font-bold">
                +{myBuzz?.timeDiffMs || 0}ms
              </span>
            )}
          </div>
        )}

        <div className="absolute -top-4 -right-4 md:-top-6 md:-right-6 glass px-4 py-2 md:px-6 md:py-3 rounded-2xl border-2 border-mYellow/50 shadow-xl bg-mTeal/90">
          <div className="text-[8px] md:text-[10px] text-mOrange uppercase font-black tracking-widest mb-0.5">Rubrique</div>
          <div className="font-bold text-sm md:text-lg text-mYellow uppercase tracking-tight">{currentQ?.category}</div>
        </div>
      </div>

      {/* Affichage de la file d'attente pour le joueur */}
      {state.buzzedPlayers.length > 0 && (
        <div className="glass p-4 rounded-2xl border-mGreen/20 w-full max-w-sm">
          <div className="text-[10px] text-mGreen uppercase font-bold tracking-widest mb-3 text-center">
            File d'attente ({state.buzzedPlayers.length} buzz{state.buzzedPlayers.length > 1 ? 'es' : ''})
          </div>
          <div className="space-y-2">
            {state.buzzedPlayers.slice(0, 5).map((b, i) => {
              const player = state.players.find(p => p.id === b.playerId);
              const isMe = b.playerId === playerId;
              return (
                <div
                  key={i}
                  className={`flex justify-between items-center px-3 py-2 rounded-lg text-sm ${
                    isMe ? 'bg-mOrange/20 border border-mOrange/50' : 'bg-mTeal/30'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`font-orbitron font-bold ${i === 0 ? 'text-mGreen' : 'text-mYellow'}`}>
                      #{i + 1}
                    </span>
                    <span className={`font-bold ${isMe ? 'text-mOrange' : 'text-slate-300'}`}>
                      {player?.name} {isMe && '(vous)'}
                    </span>
                  </div>
                  {b.timeDiffMs !== undefined && i > 0 && (
                    <span className="text-xs text-mSienna font-orbitron">
                      +{b.timeDiffMs}ms
                    </span>
                  )}
                  {i === 0 && (
                    <span className="text-xs text-mGreen font-bold">
                      <i className="fas fa-microphone-alt mr-1"></i>
                      EN COURS
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="max-w-md w-full">
        <div className="glass p-5 rounded-2xl border-mGreen/20 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-mGreen opacity-5 pointer-events-none"></div>
          <p className="text-mGreen font-bold text-xs uppercase tracking-widest mb-2">Instructions</p>
          <p className="text-base font-medium text-slate-200">
            {isMyTurn
              ? "C'est votre moment de gloire ! Repondez maintenant."
              : hasBuzzed
                ? `Vous etes en position ${buzzIndex + 1}. Restez pret !`
                : queueSize > 0
                  ? `${queueSize} joueur(s) dans la file. Buzzez pour rejoindre !`
                  : "Ecoutez la question et buzzez des que vous connaissez la reponse !"}
          </p>
        </div>
      </div>

      {/* Classement en temps réel */}
      <div className="w-full max-w-md">
        <div className="glass p-4 rounded-2xl border-mCyan/20">
          <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-mCyan mb-3 text-center flex items-center justify-center gap-2">
            <i className="fas fa-trophy"></i>
            Classement Live
          </h4>
          <div className="space-y-2">
            {[...state.players]
              .sort((a, b) => b.score - a.score)
              .map((p, i) => {
                const isMe = p.id === playerId;
                const medal = i === 0 ? 'text-mYellow' : i === 1 ? 'text-gray-300' : i === 2 ? 'text-amber-600' : 'text-slate-500';
                const bgClass = i === 0 ? 'bg-mYellow/10 border-mYellow/30' : isMe ? 'bg-mCyan/10 border-mCyan/30' : 'bg-mCard/50 border-mBorder/30';
                return (
                  <div
                    key={p.id}
                    className={`flex items-center justify-between px-3 py-2 rounded-xl border ${bgClass}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`font-orbitron font-bold text-sm ${medal}`}>
                        {i < 3 ? <i className="fas fa-trophy"></i> : `#${i + 1}`}
                      </span>
                      <span className={`font-bold text-sm ${isMe ? 'text-mCyan' : 'text-slate-300'}`}>
                        {p.name} {isMe && '(vous)'}
                      </span>
                    </div>
                    <span className="font-orbitron font-bold text-mYellow">{p.score}</span>
                  </div>
                );
              })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlayerView;
