
import React, { useState, useEffect, useRef } from 'react';
import { RoomState } from '../types';

interface ManagerViewProps {
  state: RoomState;
  onValidate: (playerId: string | null, points: number, moveNext: boolean) => void;
  onSkip: () => void;
  onResetBuzzer: () => Promise<void>;
}

const ManagerView: React.FC<ManagerViewProps> = ({ state, onValidate, onSkip, onResetBuzzer }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingAction, setProcessingAction] = useState<string | null>(null);
  const [showStopAlert, setShowStopAlert] = useState(false);
  const prevBuzzCountRef = useRef(state.buzzedPlayers.length);

  const currentQ = state.questions[state.currentQuestionIndex];
  const activeBuzzer = state.buzzedPlayers[0];
  const playerOnTurn = activeBuzzer ? state.players.find(p => p.id === activeBuzzer.playerId) : null;

  // Détecter quand quelqu'un buzze pour afficher l'alerte STOP
  useEffect(() => {
    if (state.buzzedPlayers.length > prevBuzzCountRef.current && state.buzzedPlayers.length === 1) {
      setShowStopAlert(true);
      // Vibration si disponible
      if (navigator.vibrate) {
        navigator.vibrate([200, 100, 200]);
      }
    }
    prevBuzzCountRef.current = state.buzzedPlayers.length;
  }, [state.buzzedPlayers.length]);

  // Fermer l'alerte après 3 secondes ou quand on clique
  useEffect(() => {
    if (showStopAlert) {
      const timer = setTimeout(() => setShowStopAlert(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [showStopAlert]);

  const handleValidate = async (playerId: string, points: number, moveNext: boolean) => {
    setIsProcessing(true);
    setProcessingAction(moveNext ? 'correct' : 'incorrect');
    await onValidate(playerId, points, moveNext);
    setIsProcessing(false);
    setProcessingAction(null);
  };

  const handleResetBuzzer = async () => {
    setIsProcessing(true);
    setProcessingAction('reset');
    await onResetBuzzer();
    setIsProcessing(false);
    setProcessingAction(null);
  };
  
  return (
    <div className="space-y-4 md:space-y-8 animate-fade-in">
      {/* Alerte STOP plein écran quand quelqu'un buzze */}
      {showStopAlert && playerOnTurn && (
        <div
          className="fixed inset-0 z-50 bg-gradient-to-br from-mSienna via-red-600 to-mOrange flex items-center justify-center cursor-pointer"
          onClick={() => setShowStopAlert(false)}
        >
          <div className="text-center animate-pulse">
            <div className="text-[120px] md:text-[200px] font-orbitron font-black text-white drop-shadow-[0_0_30px_rgba(255,255,255,0.5)]">
              STOP
            </div>
            <div className="text-2xl md:text-4xl font-bold text-white mt-4">
              <i className="fas fa-hand-paper mr-3 animate-bounce"></i>
              {playerOnTurn.name} a buzzé !
            </div>
            <p className="text-white/70 mt-6 text-sm bg-black/20 px-4 py-2 rounded-full inline-block">
              <i className="fas fa-touch mr-2"></i>Appuyez pour fermer
            </p>
          </div>
        </div>
      )}

      {/* Sur mobile: Buzzer en premier, puis question */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-8">

        {/* Panel Buzzer - En premier sur mobile */}
        <div className="order-1 lg:order-2 glass p-4 md:p-6 rounded-3xl flex flex-col bg-mTeal/40 border-mOrange/30">
          <h4 className="text-xl font-orbitron mb-6 text-mOrange flex items-center justify-between">
            <div className="flex items-center">
              <i className="fas fa-bolt mr-3"></i>
              <span>FILE D'ATTENTE</span>
            </div>
            <span className="text-[10px] text-slate-500 font-inter">V1.0 by Mdev</span>
          </h4>
          
          {playerOnTurn ? (
            <div className="space-y-6">
              <div className="bg-mTeal p-6 rounded-2xl border-2 border-mGreen shadow-lg">
                <div className="text-[10px] text-mGreen uppercase font-black mb-1 tracking-widest">Buzz en cours par :</div>
                <div className="text-2xl font-bold text-white uppercase">{playerOnTurn.name}</div>
                <div className="text-sm text-mYellow font-medium">{currentQ?.category}</div>
                {activeBuzzer?.timeDiffMs === 0 && (
                  <div className="mt-2 flex items-center gap-2">
                    <i className="fas fa-bolt text-mGreen text-xs"></i>
                    <span className="text-xs text-mGreen font-orbitron font-bold">PREMIER !</span>
                  </div>
                )}
              </div>

              <div className="flex flex-col space-y-3">
                <button
                  onClick={() => handleValidate(playerOnTurn.id, 5, true)}
                  disabled={isProcessing}
                  className="w-full bg-mGreen hover:bg-mGreen/80 py-4 rounded-xl font-bold text-mTeal shadow-md transform hover:-translate-y-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                >
                  {processingAction === 'correct' ? (
                    <><i className="fas fa-spinner fa-spin mr-2"></i> VALIDATION...</>
                  ) : (
                    <><i className="fas fa-check mr-2"></i> CORRECT (+5 pts)</>
                  )}
                </button>
                <button
                  onClick={() => handleValidate(playerOnTurn.id, -5, false)}
                  disabled={isProcessing}
                  className="w-full bg-mSienna/20 hover:bg-mSienna/40 text-mSienna py-4 rounded-xl font-bold border border-mSienna/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {processingAction === 'incorrect' ? (
                    <><i className="fas fa-spinner fa-spin mr-2"></i> PASSAGE AU SUIVANT...</>
                  ) : (
                    <><i className="fas fa-times mr-2"></i> FAUX (-5 pts)</>
                  )}
                </button>
                <button
                  onClick={() => handleValidate(playerOnTurn.id, 0, false)}
                  disabled={isProcessing}
                  className="w-full bg-slate-700/50 hover:bg-slate-600 text-slate-300 py-4 rounded-xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {processingAction === 'incorrect' ? (
                    <><i className="fas fa-spinner fa-spin mr-2"></i> PASSAGE AU SUIVANT...</>
                  ) : (
                    <><i className="fas fa-minus mr-2"></i> FAUX (Aucun point)</>
                  )}
                </button>
                <button
                  onClick={handleResetBuzzer}
                  disabled={isProcessing}
                  className="w-full bg-mOrange/20 hover:bg-mOrange/40 text-mOrange py-3 rounded-xl font-bold border border-mOrange/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                >
                  {processingAction === 'reset' ? (
                    <><i className="fas fa-spinner fa-spin mr-2"></i> RESET...</>
                  ) : (
                    <><i className="fas fa-redo mr-2"></i> RESET BUZZER</>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-mGreen/40 italic flex flex-col items-center">
              <div className="mb-4 text-5xl opacity-10"><i className="fas fa-satellite-dish"></i></div>
              <p className="mb-6">Signal prêt... en attente d'un signal buzz.</p>
              <button
                onClick={handleResetBuzzer}
                disabled={isProcessing}
                className="bg-mOrange/20 hover:bg-mOrange/40 text-mOrange px-6 py-3 rounded-xl font-bold border border-mOrange/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {processingAction === 'reset' ? (
                  <><i className="fas fa-spinner fa-spin mr-2"></i> RESET...</>
                ) : (
                  <><i className="fas fa-redo mr-2"></i> RESET BUZZER</>
                )}
              </button>
            </div>
          )}

          {state.buzzedPlayers.length > 1 && (
            <div className="mt-4 md:mt-8 pt-4 md:pt-6 border-t border-mGreen/10">
              <div className="text-[10px] text-mOrange uppercase font-bold mb-3 tracking-widest">File d'attente avec delais :</div>
              <div className="space-y-2">
                {state.buzzedPlayers.slice(1).map((b, i) => {
                  const p = state.players.find(pl => pl.id === b.playerId);
                  return (
                    <div key={i} className="bg-mTeal/50 px-4 py-3 rounded-xl text-sm flex justify-between items-center border border-mGreen/10">
                      <span className="font-bold text-slate-300">{p?.name}</span>
                      <div className="flex items-center gap-3">
                        {b.timeDiffMs !== undefined && (
                          <span className="text-mSienna font-orbitron text-xs font-bold">
                            +{b.timeDiffMs}ms
                          </span>
                        )}
                        <span className="text-mYellow font-orbitron font-bold">POS #{i + 2}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Panel Question - En second sur mobile */}
        <div className="order-2 lg:order-1 lg:col-span-2 space-y-4 md:space-y-6">
          <div className="glass p-4 md:p-8 rounded-3xl border-t-4 border-mYellow shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10 text-4xl md:text-6xl">
              <i className="fas fa-quote-right text-mYellow"></i>
            </div>
            <div className="flex flex-col sm:flex-row justify-between items-start gap-2 mb-4 md:mb-6 relative z-10">
              <span className="bg-mTeal text-mYellow border border-mYellow/30 px-3 md:px-4 py-1 rounded-full text-[10px] md:text-xs font-bold uppercase tracking-widest">
                Question {state.currentQuestionIndex + 1} / {state.questions.length}
              </span>
              <span className="text-mGreen font-bold font-orbitron text-xs md:text-sm uppercase">RUBRIQUE: {currentQ?.category}</span>
            </div>

            <h3 className="text-xl md:text-3xl font-bold mb-4 md:mb-8 leading-tight text-white relative z-10">
              {currentQ?.text}
            </h3>

            <div className="bg-mTeal/80 p-4 md:p-6 rounded-2xl border border-mGreen/40 relative z-10">
              <label className="text-[10px] text-mOrange uppercase font-black tracking-[0.2em] mb-2 block">Solution Mdev</label>
              <p className="text-lg md:text-2xl font-orbitron text-mGreen font-bold">{currentQ?.answer}</p>
            </div>
          </div>

          <div className="flex justify-center">
             <button
               onClick={onSkip}
               className="bg-mTeal hover:bg-slate-700 text-mYellow border border-mYellow/20 px-6 md:px-8 py-2 md:py-3 rounded-xl font-bold transition-all flex items-center space-x-2 text-sm md:text-base"
             >
               <i className="fas fa-forward"></i>
               <span>Passer cette question</span>
             </button>
          </div>
        </div>
      </div>

      <div className="glass p-4 md:p-6 rounded-3xl overflow-x-auto border-mCyan/20">
         <h4 className="text-xs font-black uppercase tracking-[0.3em] text-mCyan mb-4 flex items-center gap-2">
           <i className="fas fa-trophy text-mYellow"></i>
           Live Scoreboard
         </h4>
         <div className="flex space-x-3 md:space-x-4">
            {[...state.players].sort((a, b) => b.score - a.score).map((p, i) => (
              <div key={p.id} className={`flex flex-col items-center min-w-[100px] md:min-w-[130px] p-3 md:p-4 rounded-2xl border shadow-lg ${
                i === 0 ? 'bg-mYellow/10 border-mYellow/40' : 'bg-mCard/60 border-mBorder/30'
              }`}>
                {i === 0 && <i className="fas fa-crown text-mYellow text-xs mb-1"></i>}
                <span className="text-[10px] text-mCyan font-bold mb-1 truncate w-full text-center uppercase">{p.name}</span>
                <span className="text-xl md:text-2xl font-orbitron font-bold text-mYellow">{p.score}</span>
              </div>
            ))}
         </div>
      </div>
    </div>
  );
};

export default ManagerView;
