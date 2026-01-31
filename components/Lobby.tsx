
import React, { useState } from 'react';
import { Player } from '../types';

interface LobbyProps {
  onStart: (players: Player[], debt: number, qPerUser: number) => void;
  onJoin: (player: Player) => void;
}

const Lobby: React.FC<LobbyProps> = ({ onStart, onJoin }) => {
  const [view, setView] = useState<'CHOICE' | 'CREATE' | 'JOIN'>('CHOICE');
  const [players, setPlayers] = useState<Player[]>([]);
  const [managerName, setManagerName] = useState('');
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [newCode, setNewCode] = useState('');
  const [debt, setDebt] = useState(20);
  const [qPerUser, setQPerUser] = useState(3);
  const [myId, setMyId] = useState<string | null>(null);

  const handleCreateRoom = () => {
    if (!managerName) return alert("Nom du gérant requis");
    const id = "mgr-" + Math.random().toString(36).substr(2, 5);
    const mgr: Player = {
      id,
      name: managerName,
      category: "Gestion",
      accessCode: "ADMIN",
      score: 0,
      categoryScores: {},
      isManager: true
    };
    setPlayers([mgr]);
    setMyId(id);
    onJoin(mgr);
    setView('CREATE'); // Reste sur l'écran de création pour voir la liste des inscrits
  };

  const handleAddPlayer = () => {
    if (!newPlayerName || !newCategory || !newCode) {
      alert("Veuillez remplir tous les champs");
      return;
    }
    const id = "ply-" + Math.random().toString(36).substr(2, 5);
    const p: Player = {
      id,
      name: newPlayerName,
      category: newCategory,
      accessCode: newCode,
      score: 0,
      categoryScores: {},
      isManager: false
    };
    setPlayers(prev => [...prev, p]);
    setNewPlayerName('');
    setNewCategory('');
    setNewCode('');
    
    if (!myId) {
      setMyId(id);
      onJoin(p);
    }
    alert("Inscription réussie ! Attendez que le gérant lance la partie.");
  };

  if (view === 'CHOICE') {
    return (
      <div className="flex flex-col items-center justify-center space-y-8 animate-fade-in py-12">
        <h2 className="text-3xl font-orbitron text-mYellow text-center">Bienvenue sur BuzzMaster</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl">
          <button 
            onClick={() => setView('CREATE')}
            className="glass p-10 rounded-3xl border-mGreen/30 hover:border-mGreen transition-all group flex flex-col items-center space-y-4"
          >
            <i className="fas fa-crown text-5xl text-mGreen group-hover:scale-110 transition-transform"></i>
            <span className="font-orbitron font-bold text-xl uppercase tracking-widest">Créer une Salle</span>
            <p className="text-xs text-slate-400 text-center">Vous serez le gérant et contrôlerez les questions.</p>
          </button>
          <button 
            onClick={() => setView('JOIN')}
            className="glass p-10 rounded-3xl border-mOrange/30 hover:border-mOrange transition-all group flex flex-col items-center space-y-4"
          >
            <i className="fas fa-user-plus text-5xl text-mOrange group-hover:scale-110 transition-transform"></i>
            <span className="font-orbitron font-bold text-xl uppercase tracking-widest">Rejoindre une Salle</span>
            <p className="text-xs text-slate-400 text-center">Inscrivez-vous dans une rubrique pour buzzer.</p>
          </button>
        </div>
        <p className="text-[10px] text-mGreen/40 font-bold uppercase tracking-[0.4em]">Engine by Mdev</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-fade-in">
      {/* Colonne de Gauche : Formulaires */}
      <div className="glass p-8 rounded-3xl border-mYellow/20">
        {view === 'CREATE' ? (
          <div className="space-y-6">
            <h2 className="text-2xl font-orbitron text-mYellow flex items-center">
              <i className="fas fa-cog mr-3"></i> Paramètres du Gérant
            </h2>
            {myId?.startsWith('mgr-') ? (
              <div className="space-y-6">
                <div className="bg-mGreen/10 p-4 rounded-xl border border-mGreen/20">
                  <p className="text-sm text-mGreen font-bold">Vous êtes le Gérant : <span className="text-white">{managerName}</span></p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold mb-2 text-mOrange uppercase">Dette de rubrique (X)</label>
                    <input 
                      type="number" className="w-full bg-mTeal/50 border border-mGreen/20 rounded-xl px-4 py-3 outline-none"
                      value={debt} onChange={(e) => setDebt(parseInt(e.target.value))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold mb-2 text-mOrange uppercase">Questions / Joueur</label>
                    <input 
                      type="number" className="w-full bg-mTeal/50 border border-mGreen/20 rounded-xl px-4 py-3 outline-none"
                      value={qPerUser} onChange={(e) => setQPerUser(parseInt(e.target.value))}
                    />
                  </div>
                </div>
                <button 
                  disabled={players.length < 2}
                  onClick={() => onStart(players, debt, qPerUser)}
                  className="w-full bg-mSienna hover:bg-mSienna/90 py-4 rounded-xl font-orbitron font-bold text-lg disabled:opacity-30 transition-all shadow-xl text-white tracking-widest"
                >
                  DÉMARRER LA SESSION
                </button>
                {players.length < 2 && (
                  <p className="text-[10px] text-mSienna text-center animate-pulse">En attente d'au moins un joueur...</p>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <input 
                  type="text" placeholder="Votre Nom de Gérant"
                  className="w-full bg-mTeal/50 border border-mGreen/20 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-mGreen"
                  value={managerName} onChange={(e) => setManagerName(e.target.value)}
                />
                <button 
                  onClick={handleCreateRoom}
                  className="w-full bg-mGreen hover:bg-mGreen/80 py-4 rounded-xl font-bold uppercase tracking-widest shadow-lg"
                >
                  Valider et Créer
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            <h2 className="text-2xl font-orbitron text-mOrange flex items-center">
              <i className="fas fa-sign-in-alt mr-3"></i> Inscription Joueur
            </h2>
            <div className="bg-mTeal/50 p-6 rounded-2xl border border-mOrange/30 space-y-4">
              <input 
                type="text" placeholder="Votre Nom"
                className="w-full bg-[#2a4d5a] border-none rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-mOrange transition-all"
                value={newPlayerName} onChange={(e) => setNewPlayerName(e.target.value)}
              />
              <input 
                type="text" placeholder="Rubrique d'expertise (ex: Histoire)"
                className="w-full bg-[#2a4d5a] border-none rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-mOrange transition-all"
                value={newCategory} onChange={(e) => setNewCategory(e.target.value)}
              />
              <input 
                type="password" placeholder="Code secret de votre rubrique"
                className="w-full bg-[#2a4d5a] border-none rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-mOrange transition-all"
                value={newCode} onChange={(e) => setNewCode(e.target.value)}
              />
              <button 
                onClick={handleAddPlayer}
                className="w-full bg-mOrange hover:bg-mOrange/80 py-4 rounded-xl font-bold uppercase tracking-widest shadow-lg transition-all"
              >
                S'enregistrer
              </button>
            </div>
            <button 
              onClick={() => setView('CHOICE')}
              className="w-full text-slate-500 hover:text-slate-300 text-xs font-bold uppercase"
            >
              Retour au menu
            </button>
          </div>
        )}
      </div>

      {/* Colonne de Droite : Liste des Joueurs */}
      <div className="glass p-8 rounded-3xl flex flex-col border-mGreen/20">
        <h2 className="text-2xl font-orbitron mb-6 text-mGreen flex justify-between items-center">
          <span>Liste d'Appel</span>
          <span className="text-xs bg-mGreen/20 px-2 py-1 rounded text-mGreen font-inter">{players.length} connectés</span>
        </h2>
        <div className="space-y-4 overflow-y-auto max-h-[400px] pr-2 custom-scrollbar">
          {players.length === 0 ? (
            <div className="text-center py-12 text-slate-500 italic flex flex-col items-center">
              <i className="fas fa-user-secret text-4xl mb-4 opacity-10"></i>
              En attente d'identification...
            </div>
          ) : (
            players.map((p) => (
              <div key={p.id} className={`p-4 rounded-2xl flex justify-between items-center border transition-all ${p.isManager ? 'bg-mGreen/10 border-mGreen/40' : 'bg-mTeal/30 border-mGreen/10 hover:border-mYellow/30'}`}>
                <div>
                  <div className="font-bold flex items-center space-x-2">
                    <span className={p.isManager ? 'text-mGreen' : 'text-mYellow'}>{p.name}</span>
                    {p.isManager && <span className="text-[8px] bg-mGreen text-mTeal px-2 py-0.5 rounded-full font-black uppercase">GÉRANT</span>}
                    {p.id === myId && <span className="text-[8px] border border-slate-500 px-2 py-0.5 rounded-full text-slate-400 uppercase">MOI</span>}
                  </div>
                  <div className="text-[10px] text-slate-400 italic">Rubrique : {p.category}</div>
                </div>
                <div className="flex items-center space-x-3">
                   {p.isManager ? <i className="fas fa-shield-alt text-mGreen text-sm"></i> : <i className="fas fa-check-circle text-mGreen"></i>}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default Lobby;
