
import React from 'react';
import { RoomState } from '../types';

interface ResultsProps { state: RoomState; onReset: () => void; }

const Results: React.FC<ResultsProps> = ({ state, onReset }) => {
  const calculateDebts = () => {
    const finalReports: { debtor: string, creditor: string, amount: number, category: string }[] = [];

    state.players.forEach(p => {
      // Pour chaque rubrique du joueur
      p.categories.forEach(pCat => {
        const myCatName = pCat.name;
        const myPerformance = p.categoryScores[myCatName] || 0;
        
        state.players.forEach(other => {
          if (other.id === p.id) return;
          const otherPerformance = other.categoryScores[myCatName] || 0;
          
          if (otherPerformance > myPerformance) {
            finalReports.push({
              debtor: p.name,
              creditor: other.name,
              amount: state.debtAmount,
              category: myCatName
            });
          }
        });
      });
    });

    return finalReports;
  };

  const debts = calculateDebts();
  const sortedPlayers = [...state.players].sort((a, b) => b.score - a.score);

  return (
    <div className="max-w-5xl mx-auto space-y-12 py-8">
      <div className="text-center">
        <div className="mb-4"><i className="fas fa-crown text-6xl text-mYellow animate-bounce"></i></div>
        <h2 className="text-6xl font-orbitron font-black mb-2 text-transparent bg-gradient-to-r from-mYellow via-mOrange to-mSienna bg-clip-text uppercase">PODIUM FINAL</h2>
        <p className="text-mGreen font-bold tracking-widest uppercase text-sm">Système Mdev v1.0</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
        <div className="glass p-8 rounded-3xl border-mYellow/30 bg-mTeal/20 shadow-2xl">
          <h3 className="text-xl font-orbitron mb-8 text-mYellow flex items-center border-b border-mYellow/20 pb-4"><i className="fas fa-award mr-3"></i> Top Joueurs</h3>
          <div className="space-y-6">
            {sortedPlayers.map((p, idx) => (
              <div key={p.id} className={`flex items-center justify-between p-5 rounded-2xl ${idx === 0 ? 'bg-mYellow/10 border-2 border-mYellow' : 'bg-mTeal/40 border border-mGreen/10'}`}>
                <div className="flex items-center space-x-5">
                  <span className={`h-10 w-10 flex items-center justify-center rounded-full font-black font-orbitron ${idx === 0 ? 'bg-mYellow text-mTeal' : 'bg-slate-700'}`}>{idx + 1}</span>
                  <div>
                    <div className="font-black text-lg text-white">{p.name}</div>
                    <div className="text-[10px] text-mGreen font-bold uppercase">{p.categories.map(c => c.name).join(', ')}</div>
                  </div>
                </div>
                <div className="text-3xl font-orbitron font-black text-mYellow">{p.score}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="glass p-8 rounded-3xl border-mSienna/30 bg-mTeal/20 shadow-2xl">
          <h3 className="text-xl font-orbitron mb-8 text-mSienna flex items-center border-b border-mSienna/20 pb-4"><i className="fas fa-receipt mr-3"></i> Dettes Rubriques</h3>
          <div className="space-y-4">
            {debts.length === 0 ? (
              <div className="text-center py-20 opacity-20"><i className="fas fa-shield-alt text-4xl mb-4"></i><p>Aucune faille.</p></div>
            ) : (
              debts.map((d, i) => (
                <div key={i} className="bg-mSienna/5 border border-mSienna/30 p-5 rounded-2xl space-y-2 relative group">
                  <div className="text-[10px] font-black text-mOrange uppercase tracking-widest">Rubrique: {d.category}</div>
                  <div className="flex items-center justify-between text-white font-bold">
                    <span>{d.debtor}</span>
                    <i className="fas fa-arrow-right text-mSienna"></i>
                    <span>{d.creditor}</span>
                  </div>
                  <div className="text-right font-orbitron font-black text-xl text-mSienna">-{d.amount} PTS</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col items-center pt-10">
        <button onClick={onReset} className="bg-mGreen hover:bg-mGreen/80 text-mTeal px-16 py-5 rounded-2xl font-orbitron font-black text-xl uppercase tracking-widest shadow-2xl transform hover:scale-105 transition-all">Nouvelle Session Mdev</button>
      </div>
    </div>
  );
};

export default Results;
