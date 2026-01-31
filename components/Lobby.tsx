
import React, { useState, useEffect } from 'react';
import { Player, PlayerCategory } from '../types';
import { supabase } from '../supabaseClient';

interface LobbyProps {
  onStart: (players: Player[], debt: number, qPerUser: number) => void;
  onJoin: (player: Player, session: any) => void;
}

const Lobby: React.FC<LobbyProps> = ({ onStart, onJoin }) => {
  const [view, setView] = useState<'CHOICE' | 'CREATE' | 'JOIN'>('CHOICE');
  const [session, setSession] = useState<any>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [managerName, setManagerName] = useState('');
  
  const [inputSessionCode, setInputSessionCode] = useState('');
  const [newPlayerName, setNewPlayerName] = useState('');
  const [tempCategories, setTempCategories] = useState<PlayerCategory[]>([]);
  const [catInput, setCatInput] = useState('');
  const [difficultyInput, setDifficultyInput] = useState<PlayerCategory['difficulty']>('Intermédiaire');
  
  const [debt, setDebt] = useState(20);
  const [qPerUser, setQPerUser] = useState(3);
  const [myLocalId, setMyLocalId] = useState(localStorage.getItem('mdev_player_id') || "user-" + Math.random().toString(36).substr(2, 9));

  useEffect(() => {
    if (!session?.id) return;
    const playersSub = supabase
      .channel('lobby_players')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players', filter: `session_id=eq.${session.id}` }, 
        async () => {
          const { data } = await supabase.from('players').select('*').eq('session_id', session.id);
          if (data) setPlayers(data.map(p => ({
            id: p.local_id,
            name: p.name,
            categories: p.categories,
            score: p.score,
            categoryScores: p.category_scores,
            isManager: p.is_manager
          })));
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(playersSub); };
  }, [session?.id]);

  const handleCreateRoom = async () => {
    if (!managerName.trim()) return alert("Nom requis");
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    
    const { data: sess, error: sErr } = await supabase.from('sessions').insert({
      code,
      manager_id: myLocalId,
      status: 'LOBBY'
    }).select().single();

    if (sErr || !sess) return alert("Erreur création session Supabase");

    const p: Player = {
      id: myLocalId,
      name: managerName,
      categories: [],
      score: 0,
      categoryScores: {},
      isManager: true
    };

    await supabase.from('players').insert({
      local_id: myLocalId,
      session_id: sess.id,
      name: managerName,
      is_manager: true,
      categories: []
    });

    setSession(sess);
    onJoin(p, sess);
  };

  const handleJoinFinal = async () => {
    if (!inputSessionCode.trim()) {
      return alert("Veuillez entrer le code de session");
    }
    if (!newPlayerName.trim()) {
      return alert("Veuillez entrer votre pseudo");
    }
    if (tempCategories.length === 0) {
      return alert("Veuillez ajouter au moins une rubrique (tapez le nom puis cliquez sur +)");
    }

    const { data: sess, error } = await supabase.from('sessions').select('*').eq('code', inputSessionCode).single();
    if (error || !sess) return alert("Session introuvable");

    const p: Player = {
      id: myLocalId,
      name: newPlayerName,
      categories: tempCategories,
      score: 0,
      categoryScores: {},
      isManager: false
    };

    await supabase.from('players').insert({
      local_id: myLocalId,
      session_id: sess.id,
      name: newPlayerName,
      is_manager: false,
      categories: tempCategories
    });

    setSession(sess);
    onJoin(p, sess);
  };

  const addCategoryToTemp = () => {
    if (!catInput.trim()) return;
    setTempCategories([...tempCategories, { name: catInput.trim(), difficulty: difficultyInput }]);
    setCatInput('');
  };

  // UI components keep original aesthetic but updated with cloud labels
  if (view === 'CHOICE') {
    return (
      <div className="flex flex-col items-center justify-center space-y-12 animate-fade-in py-12">
        <div className="text-center">
          <h2 className="text-5xl font-orbitron text-mYellow font-bold mb-4">MDEV CLOUD BUZZ</h2>
          <p className="text-mGreen font-orbitron text-xs tracking-[0.4em] uppercase opacity-80">Sync via Supabase Realtime</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 w-full max-w-4xl">
          <button onClick={() => setView('CREATE')} className="glass p-14 rounded-[50px] border-mGreen/30 hover:border-mGreen transition-all group flex flex-col items-center space-y-8 shadow-2xl">
            <div className="bg-mGreen/20 p-8 rounded-full group-hover:scale-110 transition-transform"><i className="fas fa-server text-7xl text-mGreen"></i></div>
            <span className="font-orbitron font-black text-2xl text-mGreen block uppercase tracking-widest">ADMIN SALLE</span>
          </button>
          <button onClick={() => setView('JOIN')} className="glass p-14 rounded-[50px] border-mOrange/30 hover:border-mOrange transition-all group flex flex-col items-center space-y-8 shadow-2xl">
            <div className="bg-mOrange/20 p-8 rounded-full group-hover:scale-110 transition-transform"><i className="fas fa-network-wired text-7xl text-mOrange"></i></div>
            <span className="font-orbitron font-black text-2xl text-mOrange block uppercase tracking-widest">REJOINDRE</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 animate-fade-in">
      <div className="glass p-10 rounded-[3.5rem] border-mYellow/20 flex flex-col shadow-2xl">
        {view === 'CREATE' ? (
          <div className="space-y-10">
            <h2 className="text-3xl font-orbitron text-mYellow font-black uppercase tracking-tighter">CLOUD MANAGER</h2>
            {!session ? (
              <div className="space-y-6">
                <input type="text" placeholder="Pseudo Gérant..." className="w-full bg-mTeal/50 border-none rounded-2xl px-8 py-5 outline-none focus:ring-2 focus:ring-mYellow text-xl" value={managerName} onChange={e => setManagerName(e.target.value)} />
                <button onClick={handleCreateRoom} className="w-full bg-mYellow text-mTeal py-6 rounded-[2.5rem] font-orbitron font-black text-2xl uppercase shadow-xl">Générer Session</button>
              </div>
            ) : (
              <div className="space-y-8">
                 <div className="bg-mTeal/60 p-8 rounded-[2.5rem] border border-mYellow/40 text-center">
                    <p className="text-mYellow font-black uppercase tracking-[0.4em] text-[10px] mb-4">CODE LIVE</p>
                    <p className="text-6xl font-orbitron font-black text-white tracking-[0.3em]">{session.code}</p>
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <input type="number" className="bg-mTeal/40 p-5 rounded-3xl border border-mGreen/20 text-white font-orbitron" value={debt} onChange={e => setDebt(parseInt(e.target.value))} placeholder="Dette" />
                    <input type="number" className="bg-mTeal/40 p-5 rounded-3xl border border-mGreen/20 text-white font-orbitron" value={qPerUser} onChange={e => setQPerUser(parseInt(e.target.value))} placeholder="Q/Rubrique" />
                 </div>
                 <button disabled={players.length < 2} onClick={() => onStart(players, debt, qPerUser)} className="w-full bg-mGreen text-mTeal py-6 rounded-[2.5rem] font-orbitron font-black text-2xl uppercase tracking-widest shadow-xl disabled:opacity-30">LANCER LE JEU</button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-8">
            <h2 className="text-3xl font-orbitron text-mOrange font-black">ENTRÉE CLOUD</h2>
            <div className="space-y-4">
              <input type="text" placeholder="CODE SESSION" className="w-full bg-[#1e3b46] rounded-2xl px-8 py-5 outline-none focus:ring-2 focus:ring-mOrange text-center font-orbitron text-2xl text-mOrange" value={inputSessionCode} onChange={e => setInputSessionCode(e.target.value)} />
              <input type="text" placeholder="VOTRE PSEUDO" className="w-full bg-[#1e3b46] rounded-2xl px-8 py-5 outline-none focus:ring-2 focus:ring-mOrange text-lg" value={newPlayerName} onChange={e => setNewPlayerName(e.target.value)} />
              
              <div className="p-6 bg-mTeal/20 border border-mOrange/30 rounded-[2rem] space-y-4">
                <div className="flex space-x-2">
                  <input type="text" placeholder="Nouvelle rubrique..." className="flex-grow bg-mTeal/50 px-4 py-2 rounded-xl text-sm outline-none" value={catInput} onChange={e => setCatInput(e.target.value)} />
                  <button onClick={addCategoryToTemp} className="bg-mGreen text-mTeal p-2 rounded-xl"><i className="fas fa-plus"></i></button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {tempCategories.map((c, i) => <span key={i} className="bg-mTeal px-3 py-1 rounded-full text-[10px] border border-mGreen/20">{c.name} ({c.difficulty})</span>)}
                </div>
              </div>

              <button onClick={handleJoinFinal} className="w-full bg-mOrange text-mTeal py-6 rounded-[2.5rem] font-orbitron font-black text-2xl uppercase tracking-widest">VALIDER CLOUD</button>
            </div>
            <button onClick={() => setView('CHOICE')} className="w-full text-slate-500 uppercase font-black text-[10px] tracking-widest mt-4">Retour</button>
          </div>
        )}
      </div>

      <div className="glass p-10 rounded-[3.5rem] border-mGreen/20 shadow-2xl flex flex-col">
        <h2 className="text-2xl font-orbitron mb-10 text-mGreen flex justify-between items-center font-black">
          <span>PRESENCES CLOUD</span>
          <span className="text-xs bg-mGreen/10 px-4 py-1.5 rounded-full">{players.length} SYNC</span>
        </h2>
        <div className="space-y-4 overflow-y-auto max-h-[500px] pr-2">
          {players.map(p => (
            <div key={p.id} className="p-5 rounded-[2rem] border border-mGreen/20 bg-mTeal/30 flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="h-12 w-12 bg-mGreen/20 rounded-xl flex items-center justify-center text-mGreen font-black text-xl">{p.name.charAt(0)}</div>
                <div>
                  <div className="font-black text-white flex items-center gap-2">
                    {p.name} {p.isManager && <i className="fas fa-crown text-[10px] text-mYellow"></i>}
                  </div>
                  <div className="text-[9px] text-slate-500 font-bold uppercase">{p.categories.map(c => c.name).join(', ')}</div>
                </div>
              </div>
              <i className="fas fa-circle-check text-mGreen"></i>
            </div>
          ))}
          {players.length === 0 && <p className="text-center py-20 text-slate-600 italic">En attente de connexion au serveur MDEV...</p>}
        </div>
      </div>
    </div>
  );
};

export default Lobby;
