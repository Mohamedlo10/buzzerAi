
import React, { useState, useEffect } from 'react';
import { Player, PlayerCategory, User } from '../types';
import { supabase } from '../supabaseClient';

interface LobbyProps {
  onStart: (players: Player[], debt: number, qPerUser: number) => void;
  onJoin: (player: Player, session: any) => void;
  user?: User | null;
  onBack?: () => void;
}

const Lobby: React.FC<LobbyProps> = ({ onStart, onJoin, user, onBack }) => {
  const [view, setView] = useState<'CHOICE' | 'CREATE' | 'JOIN'>('CHOICE');
  const [session, setSession] = useState<any>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [managerName, setManagerName] = useState(user?.username || '');

  const [inputSessionCode, setInputSessionCode] = useState('');
  const [newPlayerName, setNewPlayerName] = useState(user?.username || '');
  const [tempCategories, setTempCategories] = useState<PlayerCategory[]>([]);
  const [catInput, setCatInput] = useState('');
  const [difficultyInput, setDifficultyInput] = useState<PlayerCategory['difficulty']>('Intermediaire');

  const [debt, setDebt] = useState(20);
  const [qPerUser, setQPerUser] = useState(3);
  const [myLocalId, setMyLocalId] = useState(localStorage.getItem('mdev_player_id') || "user-" + Math.random().toString(36).substr(2, 9));
  const [isJoining, setIsJoining] = useState(false);
  const [alreadyJoined, setAlreadyJoined] = useState(false);
  const [isRejoining, setIsRejoining] = useState(false);

  useEffect(() => {
    // Sauvegarder le local ID
    localStorage.setItem('mdev_player_id', myLocalId);
  }, [myLocalId]);

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
      status: 'LOBBY',
      user_id: user?.id || null
    }).select().single();

    if (sErr || !sess) return alert("Erreur creation session Supabase");

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
      categories: [],
      user_id: user?.id || null
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

    setIsJoining(true);

    try {
      const { data: sess, error } = await supabase.from('sessions').select('*').eq('code', inputSessionCode).single();
      if (error || !sess) {
        setIsJoining(false);
        return alert("Session introuvable");
      }

      // 1. Verifier si le joueur existe deja par local_id
      const { data: existingByLocalId } = await supabase
        .from('players')
        .select('*')
        .eq('session_id', sess.id)
        .eq('local_id', myLocalId)
        .single();

      if (existingByLocalId) {
        // Rejoin avec le meme local_id
        const p: Player = {
          id: existingByLocalId.local_id,
          name: existingByLocalId.name,
          categories: existingByLocalId.categories || [],
          score: existingByLocalId.score || 0,
          categoryScores: existingByLocalId.category_scores || {},
          isManager: existingByLocalId.is_manager
        };
        setIsJoining(false);
        setIsRejoining(true);
        setSession(sess);
        onJoin(p, sess);
        return;
      }

      // 2. Verifier si un joueur avec le meme username existe (pour les invites)
      const { data: existingByName } = await supabase
        .from('players')
        .select('*')
        .eq('session_id', sess.id)
        .eq('name', newPlayerName.trim())
        .single();

      if (existingByName) {
        // REJOIN INVITE: Utiliser les donnees existantes (categories deja sauvees)
        // Mettre a jour le local_id dans la base pour le nouveau navigateur
        await supabase
          .from('players')
          .update({ local_id: myLocalId, user_id: user?.id || null })
          .eq('id', existingByName.id);

        const p: Player = {
          id: myLocalId,
          name: existingByName.name,
          categories: existingByName.categories || [],
          score: existingByName.score || 0,
          categoryScores: existingByName.category_scores || {},
          isManager: existingByName.is_manager
        };

        localStorage.setItem('mdev_player_id', myLocalId);
        setIsJoining(false);
        setIsRejoining(true);
        setSession(sess);
        onJoin(p, sess);
        return;
      }

      // 3. Nouveau joueur - verifier les categories
      if (tempCategories.length === 0) {
        setIsJoining(false);
        return alert("Veuillez ajouter au moins une rubrique (tapez le nom puis cliquez sur +)");
      }

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
        categories: tempCategories,
        user_id: user?.id || null
      });

      setSession(sess);
      onJoin(p, sess);
    } catch (err) {
      console.error(err);
      setIsJoining(false);
      alert("Erreur lors de la connexion");
    }
  };

  const addCategoryToTemp = () => {
    if (!catInput.trim()) return;
    setTempCategories([...tempCategories, { name: catInput.trim(), difficulty: difficultyInput }]);
    setCatInput('');
  };

  const removeCategoryFromTemp = (index: number) => {
    setTempCategories(tempCategories.filter((_, i) => i !== index));
  };

  if (view === 'CHOICE') {
    return (
      <div className="flex flex-col items-center justify-center space-y-12 animate-fade-in py-12">
        <div className="text-center">
          <h2 className="text-4xl md:text-5xl font-orbitron text-mYellow font-bold mb-4">MDEV CLOUD BUZZ</h2>
          <p className="text-mGreen font-orbitron text-xs tracking-[0.4em] uppercase opacity-80">Sync via Supabase Realtime</p>
          {user && (
            <p className="text-mOrange text-sm mt-2">
              <i className="fas fa-user mr-2"></i>
              Connecte en tant que <span className="font-bold">{user.username}</span>
            </p>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl">
          <button onClick={() => setView('CREATE')} className="glass p-12 rounded-[3rem] border-mGreen/30 hover:border-mGreen transition-all group flex flex-col items-center space-y-6 shadow-2xl">
            <div className="bg-mGreen/20 p-6 rounded-full group-hover:scale-110 transition-transform"><i className="fas fa-server text-5xl text-mGreen"></i></div>
            <span className="font-orbitron font-black text-xl text-mGreen block uppercase tracking-widest">ADMIN SALLE</span>
            <span className="text-xs text-slate-500">Creer et gerer une partie</span>
          </button>
          <button onClick={() => setView('JOIN')} className="glass p-12 rounded-[3rem] border-mOrange/30 hover:border-mOrange transition-all group flex flex-col items-center space-y-6 shadow-2xl">
            <div className="bg-mOrange/20 p-6 rounded-full group-hover:scale-110 transition-transform"><i className="fas fa-network-wired text-5xl text-mOrange"></i></div>
            <span className="font-orbitron font-black text-xl text-mOrange block uppercase tracking-widest">REJOINDRE</span>
            <span className="text-xs text-slate-500">Entrer dans une partie existante</span>
          </button>
        </div>
        {onBack && (
          <button onClick={onBack} className="text-slate-500 uppercase font-bold text-sm tracking-widest hover:text-mYellow transition-colors">
            <i className="fas fa-arrow-left mr-2"></i>
            Retour au dashboard
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 animate-fade-in">
      <div className="glass p-8 md:p-10 rounded-[2.5rem] border-mYellow/20 flex flex-col shadow-2xl">
        {view === 'CREATE' ? (
          <div className="space-y-8">
            <h2 className="text-2xl md:text-3xl font-orbitron text-mYellow font-black uppercase tracking-tighter">CLOUD MANAGER</h2>
            {!session ? (
              <div className="space-y-6">
                <div>
                  <label className="block text-xs text-mGreen uppercase font-bold tracking-widest mb-2 ml-2">
                    Pseudo du gerant
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: QuizMaster"
                    className="w-full bg-mTeal/50 border border-mGreen/20 rounded-2xl px-6 py-4 outline-none focus:ring-2 focus:ring-mYellow text-lg"
                    value={managerName}
                    onChange={e => setManagerName(e.target.value)}
                  />
                </div>
                <button onClick={handleCreateRoom} className="w-full bg-mYellow text-mTeal py-5 rounded-2xl font-orbitron font-black text-xl uppercase shadow-xl hover:bg-mYellow/90 transition-all">
                  <i className="fas fa-bolt mr-2"></i>
                  Generer Session
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="bg-mTeal/60 p-6 rounded-2xl border border-mYellow/40 text-center">
                  <p className="text-mYellow font-black uppercase tracking-[0.4em] text-[10px] mb-3">CODE LIVE</p>
                  <p className="text-5xl font-orbitron font-black text-white tracking-[0.3em]">{session.code}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] text-slate-500 uppercase mb-1 ml-2">Dette (pts)</label>
                    <input type="number" className="w-full bg-mTeal/40 p-4 rounded-xl border border-mGreen/20 text-white font-orbitron" value={debt} onChange={e => setDebt(parseInt(e.target.value) || 0)} />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 uppercase mb-1 ml-2">Q/Rubrique</label>
                    <input type="number" className="w-full bg-mTeal/40 p-4 rounded-xl border border-mGreen/20 text-white font-orbitron" value={qPerUser} onChange={e => setQPerUser(parseInt(e.target.value) || 1)} />
                  </div>
                </div>
                <button disabled={players.length < 2} onClick={() => onStart(players, debt, qPerUser)} className="w-full bg-mGreen text-mTeal py-5 rounded-2xl font-orbitron font-black text-xl uppercase tracking-widest shadow-xl disabled:opacity-30 hover:bg-mGreen/90 transition-all">
                  <i className="fas fa-play mr-2"></i>
                  LANCER LE JEU
                </button>
                <p className="text-center text-xs text-slate-500">
                  {players.length < 2 ? 'Minimum 2 joueurs requis' : `${players.length} joueur(s) pret(s)`}
                </p>
              </div>
            )}
            <button onClick={() => setView('CHOICE')} className="w-full text-slate-500 uppercase font-bold text-[10px] tracking-widest hover:text-mYellow transition-colors">
              <i className="fas fa-arrow-left mr-1"></i> Retour
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <h2 className="text-2xl md:text-3xl font-orbitron text-mOrange font-black">ENTREE CLOUD</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-mOrange uppercase font-bold tracking-widest mb-2 ml-2">
                  Code de session
                </label>
                <input
                  type="text"
                  placeholder="000000"
                  className="w-full bg-[#1e3b46] border border-mOrange/30 rounded-2xl px-6 py-4 outline-none focus:ring-2 focus:ring-mOrange text-center font-orbitron text-2xl text-mOrange tracking-widest"
                  value={inputSessionCode}
                  onChange={e => setInputSessionCode(e.target.value)}
                  maxLength={6}
                />
              </div>

              <div>
                <label className="block text-xs text-mGreen uppercase font-bold tracking-widest mb-2 ml-2">
                  Votre pseudo
                </label>
                <input
                  type="text"
                  placeholder="Ex: Player1"
                  className="w-full bg-[#1e3b46] border border-mGreen/20 rounded-2xl px-6 py-4 outline-none focus:ring-2 focus:ring-mOrange text-lg"
                  value={newPlayerName}
                  onChange={e => setNewPlayerName(e.target.value)}
                />
                <p className="text-[10px] text-slate-500 mt-1 ml-2">
                  <i className="fas fa-info-circle mr-1"></i>
                  Si vous avez deja rejoint, utilisez le meme pseudo pour recuperer votre session
                </p>
              </div>

              <div className="p-5 bg-mTeal/20 border border-mOrange/30 rounded-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-mOrange uppercase font-bold">Vos rubriques</span>
                  <select
                    className="bg-mTeal/50 text-xs px-3 py-1.5 rounded-lg border border-mGreen/20"
                    value={difficultyInput}
                    onChange={e => setDifficultyInput(e.target.value as PlayerCategory['difficulty'])}
                  >
                    <option value="Facile">Facile</option>
                    <option value="Intermediaire">Intermediaire</option>
                    <option value="Expert">Expert</option>
                  </select>
                </div>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    placeholder="Nouvelle rubrique..."
                    className="flex-grow bg-mTeal/50 px-4 py-2.5 rounded-xl text-sm outline-none border border-mGreen/10 focus:border-mGreen/30"
                    value={catInput}
                    onChange={e => setCatInput(e.target.value)}
                    onKeyPress={e => e.key === 'Enter' && addCategoryToTemp()}
                  />
                  <button onClick={addCategoryToTemp} className="bg-mGreen text-mTeal px-4 py-2.5 rounded-xl hover:bg-mGreen/80 transition-all">
                    <i className="fas fa-plus"></i>
                  </button>
                </div>
                <div className="flex flex-wrap gap-2 min-h-[32px]">
                  {tempCategories.map((c, i) => (
                    <span
                      key={i}
                      className="bg-mTeal px-3 py-1.5 rounded-full text-[10px] border border-mGreen/20 flex items-center gap-2 group"
                    >
                      {c.name} <span className="text-mYellow">({c.difficulty})</span>
                      <button
                        onClick={() => removeCategoryFromTemp(i)}
                        className="text-slate-500 hover:text-mSienna transition-colors"
                      >
                        <i className="fas fa-times text-[8px]"></i>
                      </button>
                    </span>
                  ))}
                  {tempCategories.length === 0 && (
                    <span className="text-slate-500 text-xs italic">Ajoutez vos rubriques pour jouer</span>
                  )}
                </div>
              </div>

              <button
                onClick={handleJoinFinal}
                disabled={isJoining || alreadyJoined}
                className="w-full bg-mOrange text-mTeal py-5 rounded-2xl font-orbitron font-black text-xl uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 hover:bg-mOrange/90 transition-all"
              >
                {isJoining ? (
                  <>
                    <i className="fas fa-spinner fa-spin"></i>
                    CONNEXION...
                  </>
                ) : isRejoining ? (
                  <>
                    <i className="fas fa-check-circle"></i>
                    RECONNECTE !
                  </>
                ) : alreadyJoined ? (
                  <>
                    <i className="fas fa-check-circle"></i>
                    DEJA INSCRIT
                  </>
                ) : (
                  <>
                    <i className="fas fa-sign-in-alt"></i>
                    REJOINDRE
                  </>
                )}
              </button>
            </div>
            <button onClick={() => setView('CHOICE')} className="w-full text-slate-500 uppercase font-bold text-[10px] tracking-widest hover:text-mYellow transition-colors">
              <i className="fas fa-arrow-left mr-1"></i> Retour
            </button>
          </div>
        )}
      </div>

      <div className="glass p-8 md:p-10 rounded-[2.5rem] border-mGreen/20 shadow-2xl flex flex-col">
        <h2 className="text-xl md:text-2xl font-orbitron mb-8 text-mGreen flex justify-between items-center font-black">
          <span>PRESENCES CLOUD</span>
          <span className="text-xs bg-mGreen/10 px-4 py-1.5 rounded-full">{players.length} SYNC</span>
        </h2>
        <div className="space-y-3 overflow-y-auto max-h-[400px] pr-2 flex-grow">
          {players.map(p => (
            <div key={p.id} className="p-4 rounded-2xl border border-mGreen/20 bg-mTeal/30 flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="h-11 w-11 bg-mGreen/20 rounded-xl flex items-center justify-center text-mGreen font-black text-lg">{p.name.charAt(0).toUpperCase()}</div>
                <div>
                  <div className="font-bold text-white flex items-center gap-2">
                    {p.name}
                    {p.isManager && <i className="fas fa-crown text-[10px] text-mYellow"></i>}
                  </div>
                  <div className="text-[9px] text-slate-500 font-bold uppercase">
                    {p.categories.length > 0 ? p.categories.map(c => c.name).join(', ') : 'Admin'}
                  </div>
                </div>
              </div>
              <i className="fas fa-circle-check text-mGreen"></i>
            </div>
          ))}
          {players.length === 0 && (
            <div className="text-center py-16 text-slate-600">
              <i className="fas fa-satellite-dish text-4xl mb-4 opacity-30"></i>
              <p className="italic">En attente de connexion...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Lobby;
