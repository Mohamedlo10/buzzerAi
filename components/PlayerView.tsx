
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
  const someoneElseBuzzedFirst = state.buzzedPlayers.length > 0 && !hasBuzzed;
  
  return (
    <div className="flex flex-col items-center justify-center space-y-12 py-12">
      <div className="text-center group">
        <div className="text-mGreen uppercase tracking-[0.5em] text-xs font-black mb-2 group-hover:text-mYellow transition-colors">Votre Score Actuel</div>
        <div className="text-8xl font-orbitron font-bold text-white tracking-tighter drop-shadow-[0_0_15px_rgba(233,196,106,0.3)]">{me?.score}</div>
      </div>

      <div className="relative">
        <button 
          onClick={onBuzz}
          disabled={hasBuzzed || someoneElseBuzzedFirst}
          className={`
            h-64 w-64 md:h-80 md:w-80 rounded-full flex flex-col items-center justify-center
            transition-all duration-300 transform active:scale-90 border-8
            ${isMyTurn 
              ? 'bg-mGreen border-mYellow text-mTeal shadow-[0_0_50px_rgba(42,157,143,0.6)] scale-105' 
              : hasBuzzed
                ? 'bg-mOrange border-mTeal text-mTeal opacity-90 cursor-default'
                : someoneElseBuzzedFirst
                  ? 'bg-slate-800 border-slate-700 opacity-20 cursor-not-allowed grayscale'
                  : 'bg-mSienna border-mTeal text-white buzzer-active hover:shadow-[0_0_40px_rgba(231,111,81,0.5)]'
            }
          `}
        >
          <i className={`fas ${hasBuzzed ? (isMyTurn ? 'fa-microphone-alt' : 'fa-hourglass-half') : 'fa-bolt'} text-6xl md:text-8xl mb-4`}></i>
          <span className="font-orbitron font-black text-2xl md:text-3xl text-center px-6 leading-tight tracking-widest uppercase">
            {isMyTurn ? 'PARLEZ !' : hasBuzzed ? `RANG ${buzzIndex + 1}` : 'BUZZ'}
          </span>
        </button>

        <div className="absolute -top-6 -right-6 glass px-6 py-3 rounded-2xl border-2 border-mYellow/50 shadow-xl bg-mTeal/90">
          <div className="text-[10px] text-mOrange uppercase font-black tracking-widest mb-1">Rubrique Active</div>
          <div className="font-bold text-lg text-mYellow uppercase tracking-tight">{currentQ?.category}</div>
        </div>
      </div>

      <div className="max-w-md w-full">
        <div className="glass p-6 rounded-3xl border-mGreen/20 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-mGreen opacity-5 pointer-events-none"></div>
          <p className="text-mGreen font-bold text-xs uppercase tracking-widest mb-2">Instructions Mdev</p>
          <p className="text-lg font-medium text-slate-200">
            {isMyTurn 
              ? "C'est votre moment de gloire ! Répondez maintenant." 
              : someoneElseBuzzedFirst 
                ? "Restez concentré, la main peut revenir..." 
                : "Écoutez attentivement la question du gérant."}
          </p>
        </div>
      </div>
    </div>
  );
};

export default PlayerView;
