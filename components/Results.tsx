
import React from 'react';
import { RoomState } from '../types';

interface ResultsProps {
  state: RoomState;
  onReset: () => void;
}

const Results: React.FC<ResultsProps> = ({ state, onReset }) => {
  const calculateDebts = () => {
    const finalReports: { debtor: string, creditor: string, amount: number, category: string }[] = [];

    state.players.forEach(p => {
      const myCategory = p.category;
      const myPerformance = p.categoryScores[myCategory] || 0;
      
      state.players.forEach(other => {
        if (other.id === p.id) return;
        const otherPerformance = other.categoryScores[myCategory] || 0;
        
        if (otherPerformance > myPerformance) {
          finalReports.push({
            debtor: p.name,
            creditor: other.name,
            amount: state.debtAmount,
            category: myCategory
          });
        }
      });
    });

    return finalReports;
  };

  const debts = calculateDebts();
  const sortedPlayers = [...state.players].sort((a, b) => b.score - a.score);

  return (
    <div className="max-w-5xl mx-auto space-y-12 py-8">
      <div className="text-center relative">
        <div className="inline-block p-4 mb-4">
           <i className="fas fa-crown text-6xl text-mYellow animate-bounce"></i>
        </div>
        <h2 className="text-6xl font-orbitron font-black mb-2 text-transparent bg-gradient-to-r from-mYellow via-mOrange to-mSienna bg-clip-text">
          PODIUM FINAL
        </h2>
        <p className="text-mGreen font-bold tracking-widest uppercase text-sm">Verdict de l'algorithme Mdev</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
        <div className="glass p-8 rounded-3xl shadow-2xl border-mYellow/30 bg-mTeal/20">
          <h3 className="text-xl font-orbitron mb-8 text-mYellow flex items-center border-b border-mYellow/20 pb-4">
            <i className="fas fa-award mr-3"></i> Top Joueurs
          </h3>
          <div className="space-y-6">
            {sortedPlayers.map((p, idx) => (
              <div key={p.id} className={`flex items-center justify-between p-5 rounded-2xl transition-all ${idx === 0 ? 'bg-mYellow/20 border-2 border-mYellow scale-105' : 'bg-mTeal/40 border border-mGreen/10'}`}>
                <div className="flex items-center space-x-5">
                  <span className={`h-10 w-10 flex items-center justify-center rounded-full font-black font-orbitron ${idx === 0 ? 'bg-mYellow text-mTeal shadow-[0_0_15px_#e9c46a]' : 'bg-slate-700 text-white'}`}>
                    {idx + 1}
                  </span>
                  <div>
                    <div className={`font-black text-lg ${idx === 0 ? 'text-mYellow' : 'text-white'}`}>{p.name}</div>
                    <div className="text-[10px] text-mGreen uppercase font-bold tracking-tighter">Domaine : {p.category}</div>
                  </div>
                </div>
                <div className={`text-3xl font-orbitron font-black ${idx === 0 ? 'text-mYellow' : 'text-slate-300'}`}>{p.score}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="glass p-8 rounded-3xl border-mSienna/30 shadow-2xl bg-mTeal/20">
          <h3 className="text-xl font-orbitron mb-8 text-mSienna flex items-center border-b border-mSienna/20 pb-4">
            <i className="fas fa-receipt mr-3"></i> Bilan des Rubriques
          </h3>
          <div className="space-y-4">
            {debts.length === 0 ? (
              <div className="text-center py-20 text-slate-500 italic bg-mTeal/30 rounded-2xl border border-mGreen/10">
                <i className="fas fa-shield-alt text-4xl mb-4 opacity-10"></i>
                <p>Aucune faille détectée.<br/>Les experts ont tenu leur rang !</p>
              </div>
            ) : (
              debts.map((d, i) => (
                <div key={i} className="bg-mSienna/5 border border-mSienna/30 p-5 rounded-2xl space-y-3 relative overflow-hidden group hover:bg-mSienna/10 transition-colors">
                  <div className="absolute top-0 right-0 p-2 bg-mSienna text-mTeal text-[9px] font-black uppercase tracking-tighter rounded-bl-lg">
                    Dette de Rang
                  </div>
                  <div className="text-xs font-bold text-mGreen uppercase tracking-widest">
                    Rubrique: <span className="text-mYellow font-black">{d.category}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-black text-mSienna text-lg uppercase tracking-tight">{d.debtor}</span>
                    <i className="fas fa-hand-holding-heart text-slate-600 group-hover:text-mSienna transition-colors"></i>
                    <span className="font-black text-mGreen text-lg uppercase tracking-tight">{d.creditor}</span>
                  </div>
                  <div className="text-right font-orbitron font-black text-2xl text-mSienna border-t border-mSienna/10 pt-2">
                    -{d.amount} PTS
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col items-center space-y-4 pt-10">
        <button 
          onClick={onReset}
          className="bg-mGreen hover:bg-mGreen/80 text-mTeal px-16 py-5 rounded-2xl font-orbitron font-black text-xl hover:scale-105 transition-all shadow-[0_15px_30px_rgba(42,157,143,0.3)] uppercase tracking-widest"
        >
          Nouvelle Session Mdev
        </button>
        <p className="text-[10px] text-mGreen font-bold uppercase tracking-[0.5em] opacity-40">System Engine by Mouha_Dev v1.0</p>
      </div>
    </div>
  );
};

export default Results;
