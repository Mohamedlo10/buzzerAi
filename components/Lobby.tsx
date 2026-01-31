
import React, { useState, useEffect } from 'react';
import { Player } from '../types';

interface LobbyProps {
  onStart: (players: Player[], debt: number, qPerUser: number) => void;
  onJoin: (player: Player) => void;
}

const Lobby: React.FC<LobbyProps> = ({ onStart, onJoin }) => {
  const [view, setView] = useState<'CHOICE' | 'CREATE' | 'JOIN'>('CHOICE');
  const [players, setPlayers] = useState<Player[]>([]);
  const [managerName, setManagerName] = useState('');
  const [sessionCode, setSessionCode] = useState('');
  
  const [inputSessionCode, setInputSessionCode] = useState('');
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [newCode, setNewCode] = useState('');
  
  const [debt, setDebt] = useState(20);
  const [qPerUser, setQPerUser] = useState(3);
  const [myId, setMyId] = useState<string | null>(null);

  // Générer un code de session unique à la création
  useEffect(() => {
    if (view === 'CREATE' && !sessionCode) {
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      setSessionCode(code);
    }
  }, [view, sessionCode]);

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
  };

  const handleAddPlayer = () => {
    if (!newPlayerName || !newCategory || !newCode || !inputSessionCode) {
      alert("Veuillez remplir tous les champs, y compris le code de session");
      return;
    }
    // Simulation : si le code n'est pas le même (en local c'est dur mais on simule le check)
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

  const addMockPlayer = () => {
    const mockCategories = ["Cinéma", "Sport", "Histoire", "Science", "Géographie"];
    const cat = mockCategories[Math.floor(Math.random() * mockCategories.length)];
    const id = "mock-" + Math.random().toString(36).substr(2, 5);
    const p: Player = {
      id,
      name: "Joueur_" + (players.length),
      category: cat,
      accessCode: "1234",
      score: 0,
      categoryScores: {},
      isManager: false
    };
    setPlayers(prev => [...prev, p]);
  };

  if (view === 'CHOICE') {
    return (
      <div className="flex flex-col items-center justify-center space-y-12 animate-fade-in py-12">
        <div className="text-center">
          <h2 className="text-4xl font-orbitron text-mYellow font-bold mb-2">BIENVENUE SUR BUZZMASTER</h2>
          <p className="text-mGreen font-medium">Système de jeu compétitif par Mdev</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-3xl">
          <button 
            onClick={() => setView('CREATE')}
            className="glass p-12 rounded-[40px] border-mGreen/30 hover:border-mGreen transition-all group flex flex-col items-center space-y-6 shadow-2xl hover:bg-mGreen/5"
          >
            <div className="bg-mGreen/20 p-6 rounded-full group-hover:scale-110 transition-transform shadow-inner">
              <i className="fas fa-crown text-6xl text-mGreen"></i>
            </div>
            <span className="font-orbitron font-bold text-2xl uppercase tracking-widest text-mGreen">CRÉER UNE SALLE</span>
            <p className="text-sm text-slate-400 text-center leading-relaxed">Devenez l'arbitre de la session et gérez le code d'accès.</p>
          </button>

          <button 
            onClick={() => setView('JOIN')}
            className="glass p-12 rounded-[40px] border-mOrange/30 hover:border-mOrange transition-all group flex flex-col items-center space-y-6 shadow-2xl hover:bg-mOrange/5"
          >
            <div className="bg-mOrange/20 p-6 rounded-full group-hover:scale-110 transition-transform shadow-inner">
              <i className="fas fa-users text-6xl text-mOrange"></i>
            </div>
            <span className="font-orbitron font-bold text-2xl uppercase tracking-widest text-mOrange">REJOINDRE</span>
            <p className="text-sm text-slate-400 text-center leading-relaxed">Entrez le code session pour participer et buzzer.</p>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 animate-fade-in">
      <div className="glass p-10 rounded-[3rem] border-mYellow/20 flex flex-col justify-between">
        {view === 'CREATE' ? (
          <div className="space-y-8">
            <h2 className="text-3xl font-orbitron text-mYellow flex items-center">
              <i className="fas fa-shield-alt mr-4 text-mOrange"></i> PANNEAU GÉRANT
            </h2>
            
            {myId?.startsWith('mgr-') ? (
              <div className="space-y-8">
                <div className="bg-mTeal/50 p-6 rounded-3xl border border-mYellow/30 text-center shadow-lg relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-mYellow to-mOrange"></div>
                  <p className="text-mYellow font-bold uppercase tracking-widest text-xs mb-2">CODE DE LA SESSION</p>
                  <p className="text-5xl font-orbitron font-black text-white tracking-[0.2em] py-2">{sessionCode}</p>
                  <p className="text-[10px] text-mGreen font-medium mt-2">Partagez ce code avec vos joueurs pour qu'ils rejoignent.</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-mTeal/30 p-4 rounded-2xl border border-mGreen/10">
                    <label className="block text-[10px] font-black mb-2 text-mOrange uppercase tracking-widest">Points de Dette (X)</label>
                    <input 
                      type="number" className="w-full bg-transparent border-b-2 border-mGreen/30 font-orbitron text-xl py-1 outline-none focus:border-mYellow transition-colors"
                      value={debt} onChange={(e) => setDebt(parseInt(e.target.value))}
                    />
                  </div>
                  <div className="bg-mTeal/30 p-4 rounded-2xl border border-mGreen/10">
                    <label className="block text-[10px] font-black mb-2 text-mOrange uppercase tracking-widest">Questions / Joueur</label>
                    <input 
                      type="number" className="w-full bg-transparent border-b-2 border-mGreen/30 font-orbitron text-xl py-1 outline-none focus:border-mYellow transition-colors"
                      value={qPerUser} onChange={(e) => setQPerUser(parseInt(e.target.value))}
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <button 
                    disabled={players.length < 2}
                    onClick={() => onStart(players, debt, qPerUser)}
                    className="w-full bg-mGreen hover:bg-mGreen/80 text-mTeal py-5 rounded-[2rem] font-orbitron font-black text-xl disabled:opacity-30 transition-all shadow-xl tracking-widest uppercase"
                  >
                    LANCER LE JEU
                  </button>
                  <button 
                    onClick={addMockPlayer}
                    className="w-full bg-mTeal border border-mYellow/30 text-mYellow py-3 rounded-2xl font-bold text-xs hover:bg-mYellow hover:text-mTeal transition-all uppercase tracking-widest"
                  >
                    <i className="fas fa-robot mr-2"></i> Ajouter un Joueur IA (Simulation)
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="bg-mTeal/30 p-6 rounded-3xl border border-mGreen/20">
                  <label className="block text-xs font-black text-mGreen uppercase tracking-widest mb-4">Nom de l'administrateur</label>
                  <input 
                    type="text" placeholder="Entrez votre nom..."
                    className="w-full bg-mTeal/50 border border-mGreen/20 rounded-2xl px-6 py-4 outline-none focus:ring-2 focus:ring-mYellow text-lg"
                    value={managerName} onChange={(e) => setManagerName(e.target.value)}
                  />
                </div>
                <button 
                  onClick={handleCreateRoom}
                  className="w-full bg-mYellow text-mTeal py-5 rounded-[2rem] font-orbitron font-black text-xl shadow-xl hover:scale-[1.02] transition-all uppercase"
                >
                  Générer la Salle
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-8">
            <h2 className="text-3xl font-orbitron text-mOrange flex items-center">
              <i className="fas fa-sign-in-alt mr-4 text-mYellow"></i> FORMULAIRE JOUEUR
            </h2>
            <div className="bg-mTeal/30 p-8 rounded-[2.5rem] border border-mOrange/30 space-y-5 shadow-inner">
              <div>
                <label className="text-[10px] font-black text-mOrange uppercase tracking-widest ml-2 mb-1 block">Code Session</label>
                <input 
                  type="text" placeholder="Code à 6 chiffres"
                  className="w-full bg-[#1e3b46] border-none rounded-2xl px-6 py-4 outline-none focus:ring-2 focus:ring-mOrange transition-all font-orbitron text-xl tracking-[0.3em] text-center"
                  value={inputSessionCode} onChange={(e) => setInputSessionCode(e.target.value)}
                />
              </div>
              <input 
                type="text" placeholder="Votre Pseudo"
                className="w-full bg-[#1e3b46] border-none rounded-2xl px-6 py-4 outline-none focus:ring-2 focus:ring-mOrange transition-all"
                value={newPlayerName} onChange={(e) => setNewPlayerName(e.target.value)}
              />
              <input 
                type="text" placeholder="Votre Rubrique d'expertise"
                className="w-full bg-[#1e3b46] border-none rounded-2xl px-6 py-4 outline-none focus:ring-2 focus:ring-mOrange transition-all"
                value={newCategory} onChange={(e) => setNewCategory(e.target.value)}
              />
              <input 
                type="password" placeholder="Code rubrique (pour valider le buzz)"
                className="w-full bg-[#1e3b46] border-none rounded-2xl px-6 py-4 outline-none focus:ring-2 focus:ring-mOrange transition-all"
                value={newCode} onChange={(e) => setNewCode(e.target.value)}
              />
              <button 
                onClick={handleAddPlayer}
                className="w-full bg-mOrange hover:bg-mOrange/80 py-5 rounded-[2rem] font-orbitron font-black text-xl shadow-xl transition-all uppercase tracking-widest text-mTeal"
              >
                S'INSCRIRE
              </button>
            </div>
            <button 
              onClick={() => setView('CHOICE')}
              className="w-full text-slate-500 hover:text-slate-300 text-[10px] font-black uppercase tracking-[0.3em] transition-colors"
            >
              <i className="fas fa-arrow-left mr-2"></i> Changer de rôle
            </button>
          </div>
        )}
      </div>

      <div className="glass p-10 rounded-[3rem] flex flex-col border-mGreen/20 shadow-2xl">
        <h2 className="text-3xl font-orbitron mb-8 text-mGreen flex justify-between items-center">
          <div className="flex items-center">
            <i className="fas fa-list-ul mr-4 text-mYellow"></i>
            <span>PRÉSENCES</span>
          </div>
          <span className="text-xs bg-mGreen/20 px-3 py-1 rounded-full text-mGreen font-bold border border-mGreen/30">{players.length} Joueurs</span>
        </h2>
        
        <div className="space-y-4 overflow-y-auto max-h-[500px] pr-3 custom-scrollbar">
          {players.length === 0 ? (
            <div className="text-center py-24 text-slate-500 italic flex flex-col items-center">
              <div className="bg-slate-800/50 p-6 rounded-full mb-6">
                <i className="fas fa-user-clock text-5xl opacity-20"></i>
              </div>
              <p className="font-medium">En attente de connexion...</p>
              <p className="text-[10px] uppercase tracking-widest mt-2 opacity-50">Aucun signal détecté</p>
            </div>
          ) : (
            players.map((p) => (
              <div key={p.id} className={`p-6 rounded-[2rem] flex justify-between items-center border transition-all hover:scale-[1.02] ${p.isManager ? 'bg-mGreen/10 border-mGreen/40 shadow-[0_10px_20px_rgba(42,157,143,0.1)]' : 'bg-mTeal/30 border-mGreen/10 hover:border-mYellow/40'}`}>
                <div className="flex items-center space-x-4">
                  <div className={`h-12 w-12 rounded-full flex items-center justify-center font-black font-orbitron text-xl ${p.isManager ? 'bg-mGreen text-mTeal' : 'bg-mTeal border border-mGreen/20 text-mYellow'}`}>
                    {p.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-black flex items-center space-x-2">
                      <span className={p.isManager ? 'text-mGreen' : 'text-white'}>{p.name}</span>
                      {p.id === myId && <span className="text-[8px] bg-white/10 px-2 py-0.5 rounded text-slate-400 uppercase font-bold tracking-tighter">MOI</span>}
                    </div>
                    <div className="text-[10px] text-mGreen font-bold uppercase tracking-wider opacity-60">
                      {p.isManager ? "Gérant de Session" : `Rubrique: ${p.category}`}
                    </div>
                  </div>
                </div>
                <div className="flex items-center">
                   {p.isManager ? (
                     <i className="fas fa-crown text-mYellow text-xl"></i>
                   ) : (
                     <div className="flex flex-col items-end">
                       <i className="fas fa-check-circle text-mGreen text-xl"></i>
                       <span className="text-[8px] text-slate-500 font-mono mt-1">ID: {p.id.split('-')[1]}</span>
                     </div>
                   )}
                </div>
              </div>
            ))
          )}
        </div>
        
        {players.length > 0 && !myId?.startsWith('mgr-') && (
          <div className="mt-8 p-4 bg-mOrange/5 rounded-2xl border border-mOrange/20 animate-pulse text-center">
            <p className="text-xs text-mOrange font-bold uppercase tracking-widest">Le gérant n'a pas encore lancé la session</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Lobby;
