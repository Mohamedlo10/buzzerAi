import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import { Player, PlayerCategory, GameStatus } from '../types';
import { sessionService } from '../services/sessionService';
import { playerService } from '../services/playerService';
import { realtimeService } from '../services/realtimeService';
import { questionService } from '../services/questionService';

type LobbyView = 'CHOICE' | 'CREATE' | 'JOIN' | 'WAITING';

const LobbyPage: React.FC = () => {
  const { code } = useParams<{ code?: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const {
    user,
    session,
    setSession,
    players,
    setPlayers,
    setCurrentPlayerId,
    setStatus,
    setQuestions,
    setupGame,
    fetchBuzzState
  } = useGame();

  // Determine initial view based on route
  const getInitialView = (): LobbyView => {
    if (code) return 'JOIN';
    if (location.pathname === '/lobby/create') return 'CREATE';
    if (location.pathname === '/lobby/join') return 'JOIN';
    return user ? 'CREATE' : 'CHOICE';
  };

  const [view, setView] = useState<LobbyView>(getInitialView());
  const [localSession, setLocalSession] = useState<any>(session);
  const [localPlayers, setLocalPlayers] = useState<Player[]>(players);
  const [managerName, setManagerName] = useState(user?.username || '');
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);

  const [inputSessionCode, setInputSessionCode] = useState(code || '');
  const [newPlayerName, setNewPlayerName] = useState(user?.username || '');
  const isUsernameFixed = !!user;
  const [tempCategories, setTempCategories] = useState<PlayerCategory[]>([]);
  const [catInput, setCatInput] = useState('');
  const [difficultyInput, setDifficultyInput] = useState<PlayerCategory['difficulty']>('Intermédiaire');

  const [debt, setDebt] = useState(20);
  const [isStartingGame, setIsStartingGame] = useState(false);
  const [startingStep, setStartingStep] = useState('');
  const [qPerUser, setQPerUser] = useState(3);
  const [myLocalId, setMyLocalId] = useState(localStorage.getItem('mdev_player_id') || playerService.generateLocalId());
  const [isJoining, setIsJoining] = useState(false);

  useEffect(() => {
    localStorage.setItem('mdev_player_id', myLocalId);
  }, [myLocalId]);

  useEffect(() => {
    if (user?.username) {
      setManagerName(user.username);
      setNewPlayerName(user.username);
    }
  }, [user?.username]);

  useEffect(() => {
    if (code) {
      setInputSessionCode(code);
      setView('JOIN');
    }
  }, [code]);

  // Refs pour accéder aux valeurs actuelles dans les callbacks sans re-créer les subscriptions
  const currentPlayerRef = React.useRef(currentPlayer);
  const localPlayersRef = React.useRef(localPlayers);

  useEffect(() => {
    currentPlayerRef.current = currentPlayer;
  }, [currentPlayer]);

  useEffect(() => {
    localPlayersRef.current = localPlayers;
  }, [localPlayers]);

  useEffect(() => {
    const sessionId = localSession?.id;
    if (!sessionId) return;

    const loadPlayers = async () => {
      const playersData = await playerService.getPlayersBySession(sessionId);
      setLocalPlayers(playersData);
    };
    loadPlayers();

    const playersSub = realtimeService.subscribeToLobbyPlayers(sessionId, async () => {
      const playersData = await playerService.getPlayersBySession(sessionId);
      setLocalPlayers(playersData);
    });

    const sessionSub = realtimeService.subscribeToLobbySession(sessionId, async (payload) => {
      const updated = payload.new as any;
      const currentPlayerValue = currentPlayerRef.current;

      if (updated.status !== 'LOBBY' && currentPlayerValue) {
        // Session started, navigate to game
        setSession(updated);
        setStatus(updated.status as GameStatus);
        setPlayers(localPlayersRef.current);
        setCurrentPlayerId(currentPlayerValue.id);

        // Load questions if playing
        if (updated.status === GameStatus.PLAYING || updated.status === GameStatus.GENERATING) {
          const questionsData = await questionService.getQuestionsBySession(sessionId);
          setQuestions(questionsData);
          await fetchBuzzState(sessionId);
        }

        navigate(`/game/${sessionId}`);
      }
    });

    return () => {
      realtimeService.unsubscribe(playersSub);
      realtimeService.unsubscribe(sessionSub);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localSession?.id]); // Dépendance uniquement sur l'ID de session

  const handleCreateRoom = async () => {
    if (!managerName.trim()) return alert("Nom requis");
    const sessionCode = sessionService.generateSessionCode();

    const sess = await sessionService.createSession(sessionCode, myLocalId, user?.id);
    if (!sess) return alert("Erreur creation session Supabase");

    const p: Player = {
      id: myLocalId,
      name: managerName,
      categories: [],
      score: 0,
      categoryScores: {},
      isManager: true
    };

    await playerService.createPlayer(sess.id, myLocalId, managerName, true, [], user?.id);

    setLocalSession(sess);
    setSession(sess);
    setCurrentPlayer(p);
    setCurrentPlayerId(myLocalId);
    localStorage.setItem('mdev_player_id', myLocalId);
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
      const sess = await sessionService.getSessionByCode(inputSessionCode);
      if (!sess) {
        setIsJoining(false);
        return alert("Session introuvable");
      }

      if (sess.status !== 'LOBBY') {
        const existingByName = await playerService.getPlayerByName(sess.id, newPlayerName.trim());

        if (existingByName) {
          await playerService.updatePlayerLocalId(existingByName.id, myLocalId, user?.id);

          const p: Player = {
            id: myLocalId,
            name: existingByName.name,
            categories: existingByName.categories || [],
            score: existingByName.score || 0,
            categoryScores: existingByName.category_scores || {},
            isManager: existingByName.is_manager
          };

          localStorage.setItem('mdev_player_id', myLocalId);
          setSession(sess);
          setStatus(sess.status as GameStatus);
          setCurrentPlayerId(myLocalId);

          // Load game data
          const playersData = await playerService.getPlayersBySession(sess.id);
          setPlayers(playersData);
          const questionsData = await questionService.getQuestionsBySession(sess.id);
          setQuestions(questionsData);
          await fetchBuzzState(sess.id);

          setIsJoining(false);
          navigate(`/game/${sess.id}`);
          return;
        }
        setIsJoining(false);
        return alert("La partie est deja en cours et vous n'etes pas inscrit");
      }

      const existingByLocalId = await playerService.getPlayerByLocalId(sess.id, myLocalId);

      if (existingByLocalId) {
        const p: Player = {
          id: existingByLocalId.local_id,
          name: existingByLocalId.name,
          categories: existingByLocalId.categories || [],
          score: existingByLocalId.score || 0,
          categoryScores: existingByLocalId.category_scores || {},
          isManager: existingByLocalId.is_manager
        };
        setIsJoining(false);

        if (existingByLocalId.is_manager) {
          setLocalSession(sess);
          setSession(sess);
          setCurrentPlayer(p);
          setCurrentPlayerId(p.id);
          navigate(`/game/${sess.id}`);
        } else {
          setLocalSession(sess);
          setCurrentPlayer(p);
          setView('WAITING');
        }
        return;
      }

      const existingByName = await playerService.getPlayerByName(sess.id, newPlayerName.trim());

      if (existingByName) {
        await playerService.updatePlayerLocalId(existingByName.id, myLocalId, user?.id);

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

        if (existingByName.is_manager) {
          setLocalSession(sess);
          setSession(sess);
          setCurrentPlayer(p);
          setCurrentPlayerId(p.id);
          navigate(`/game/${sess.id}`);
        } else {
          setLocalSession(sess);
          setCurrentPlayer(p);
          setView('WAITING');
        }
        return;
      }

      const p: Player = {
        id: myLocalId,
        name: newPlayerName,
        categories: tempCategories,
        score: 0,
        categoryScores: {},
        isManager: false
      };

      await playerService.createPlayer(sess.id, myLocalId, newPlayerName, false, tempCategories, user?.id);

      setLocalSession(sess);
      setCurrentPlayer(p);
      setView('WAITING');
      setIsJoining(false);
    } catch (err) {
      console.error(err);
      setIsJoining(false);
      alert("Erreur lors de la connexion");
    }
  };

  const handleStartGame = async () => {
    if (!localSession) return;

    setIsStartingGame(true);
    setStartingStep('Initialisation...');

    try {
      setSession(localSession);
      setPlayers(localPlayers);

      setStartingStep('Génération des questions avec l\'IA...');
      await setupGame(localPlayers, debt, qPerUser);

      setStartingStep('Lancement de la partie...');
    } catch (error) {
      console.error('Erreur:', error);
    } finally {
      setIsStartingGame(false);
      setStartingStep('');
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

  const handleBack = () => {
    if (user) {
      navigate('/');
    } else {
      setView('CHOICE');
    }
  };

  // Vue d'attente pour les joueurs qui ont rejoint
  if (view === 'WAITING' && localSession && currentPlayer) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 animate-fade-in">
        <div className="glass p-8 md:p-10 rounded-[2.5rem] border-mYellow/20 flex flex-col shadow-2xl">
          <div className="text-center space-y-6">
            <div className="bg-mGreen/20 w-24 h-24 rounded-full mx-auto flex items-center justify-center">
              <i className="fas fa-check text-4xl text-mGreen"></i>
            </div>
            <div>
              <h2 className="text-2xl font-orbitron text-mGreen font-bold">VOUS AVEZ REJOINT !</h2>
              <p className="text-slate-400 mt-2">Session: <span className="text-mYellow font-orbitron font-bold">{localSession.code}</span></p>
            </div>
            <div className="bg-mTeal/50 p-6 rounded-2xl border border-mGreen/20">
              <div className="text-xs text-mOrange uppercase font-bold tracking-widest mb-2">Votre pseudo</div>
              <div className="text-2xl font-bold text-white">{currentPlayer.name}</div>
              {currentPlayer.categories.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2 justify-center">
                  {currentPlayer.categories.map((c, i) => (
                    <span key={i} className="bg-mTeal px-3 py-1 rounded-full text-[10px] border border-mGreen/20">
                      {c.name} ({c.difficulty})
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="animate-pulse">
              <i className="fas fa-spinner fa-spin text-mYellow text-2xl mb-3"></i>
              <p className="text-mYellow font-bold uppercase tracking-widest text-sm">
                En attente que l'admin demarre la partie...
              </p>
            </div>
          </div>
        </div>

        <div className="glass p-8 md:p-10 rounded-[2.5rem] border-mGreen/20 shadow-2xl flex flex-col">
          <h2 className="text-lg md:text-xl font-orbitron mb-6 text-mGreen font-black">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
              <span className="text-sm sm:text-base">JOUEURS CONNECTES</span>
              <span className="text-xs bg-mGreen/10 px-3 py-1 rounded-full self-start sm:self-auto">{localPlayers.length} SYNC</span>
            </div>
          </h2>
          <div className="space-y-3 overflow-y-auto max-h-[400px] pr-2 flex-grow">
            {localPlayers.map(p => (
              <div key={p.id} className={`p-3 sm:p-4 rounded-2xl border ${p.id === currentPlayer.id ? 'border-mYellow/50 bg-mYellow/10' : 'border-mGreen/20 bg-mTeal/30'} flex items-center justify-between`}>
                <div className="flex items-center space-x-3 sm:space-x-4 min-w-0 flex-1">
                  <div className={`h-10 w-10 sm:h-11 sm:w-11 ${p.id === currentPlayer.id ? 'bg-mYellow/20' : 'bg-mGreen/20'} rounded-xl flex items-center justify-center ${p.id === currentPlayer.id ? 'text-mYellow' : 'text-mGreen'} font-black text-base sm:text-lg flex-shrink-0`}>
                    {p.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-white flex items-center gap-2 text-sm sm:text-base">
                      <span className="truncate">{p.name}</span>
                      {p.isManager && <i className="fas fa-crown text-[10px] text-mYellow flex-shrink-0"></i>}
                      {p.id === currentPlayer.id && <span className="text-[10px] text-mYellow flex-shrink-0">(vous)</span>}
                    </div>
                    <div className="text-[9px] text-slate-500 font-bold uppercase truncate">
                      {p.categories.length > 0 ? p.categories.map(c => c.name).join(', ') : p.isManager ? 'Admin' : 'Pas de rubrique'}
                    </div>
                  </div>
                </div>
                <i className="fas fa-circle-check text-mGreen flex-shrink-0"></i>
              </div>
            ))}
            {localPlayers.length === 0 && (
              <div className="text-center py-16 text-slate-600">
                <i className="fas fa-satellite-dish text-4xl mb-4 opacity-30"></i>
                <p className="italic">Chargement...</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Vue de choix pour les guests
  if (view === 'CHOICE') {
    return (
      <div className="max-w-2xl mx-auto animate-fade-in">
        <div className="glass p-8 md:p-12 rounded-[2.5rem] border-mYellow/20 shadow-2xl">
          <div className="text-center mb-10">
            <h1 className="text-3xl md:text-4xl font-orbitron text-mYellow font-black uppercase tracking-wider">
              BuzzMaster
            </h1>
            <p className="text-slate-400 mt-2 text-sm">Mode Invite</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <button
              onClick={() => { setView('CREATE'); navigate('/lobby/create'); }}
              className="glass p-8 rounded-[2rem] border-mGreen/30 hover:border-mGreen hover:bg-mGreen/5 transition-all group flex flex-col items-center space-y-4"
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
              onClick={() => { setView('JOIN'); navigate('/lobby/join'); }}
              className="glass p-8 rounded-[2rem] border-mOrange/30 hover:border-mOrange hover:bg-mOrange/5 transition-all group flex flex-col items-center space-y-4"
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
        </div>
      </div>
    );
  }

  // Overlay de chargement lors du lancement
  if (isStartingGame) {
    return (
      <div className="fixed inset-0 bg-mTeal/95 z-50 flex items-center justify-center">
        <div className="text-center space-y-8 p-8 max-w-md">
          {/* Animation du loader */}
          <div className="relative mx-auto w-32 h-32">
            {/* Cercle externe */}
            <div className="absolute inset-0 border-4 border-mGreen/20 rounded-full"></div>
            {/* Cercle animé */}
            <div className="absolute inset-0 border-4 border-t-mYellow border-r-mOrange border-b-transparent border-l-transparent rounded-full animate-spin"></div>
            {/* Icône centrale */}
            <div className="absolute inset-0 flex items-center justify-center">
              <i className="fas fa-brain text-4xl text-mYellow animate-pulse"></i>
            </div>
          </div>

          {/* Titre */}
          <div>
            <h2 className="text-2xl font-orbitron font-black text-mYellow uppercase tracking-widest mb-2">
              Préparation
            </h2>
            <p className="text-mGreen text-sm font-bold uppercase tracking-wider">
              {startingStep}
            </p>
          </div>

          {/* Barre de progression animée */}
          <div className="w-full bg-mTeal/50 rounded-full h-2 overflow-hidden border border-mGreen/20">
            <div className="h-full bg-gradient-to-r from-mGreen via-mYellow to-mOrange rounded-full animate-pulse"
                 style={{ width: '100%', animation: 'loading-bar 2s ease-in-out infinite' }}>
            </div>
          </div>

          {/* Message d'attente */}
          <p className="text-slate-500 text-xs">
            <i className="fas fa-info-circle mr-2"></i>
            L'IA génère des questions personnalisées pour votre partie...
          </p>

          {/* Points animés */}
          <div className="flex justify-center space-x-2">
            <div className="w-2 h-2 bg-mYellow rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="w-2 h-2 bg-mOrange rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
            <div className="w-2 h-2 bg-mGreen rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
          </div>
        </div>

        {/* Style pour l'animation de la barre */}
        <style>{`
          @keyframes loading-bar {
            0% { transform: translateX(-100%); }
            50% { transform: translateX(0%); }
            100% { transform: translateX(100%); }
          }
        `}</style>
      </div>
    );
  }

  // Vue de creation/join
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 animate-fade-in">
      <div className="glass p-8 md:p-10 rounded-[2.5rem] border-mYellow/20 flex flex-col shadow-2xl">
        {view === 'CREATE' ? (
          <div className="space-y-8">
            <h2 className="text-2xl md:text-3xl font-orbitron text-mYellow font-black uppercase tracking-tighter">CLOUD MANAGER</h2>
            {!localSession ? (
              <div className="space-y-6">
                <div>
                  <label className="block text-xs text-mGreen uppercase font-bold tracking-widest mb-2 ml-2">
                    Pseudo du gerant
                    {isUsernameFixed && <span className="text-mYellow ml-2">(compte connecte)</span>}
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: QuizMaster"
                    className={`w-full bg-mTeal/50 border border-mGreen/20 rounded-2xl px-6 py-4 outline-none focus:ring-2 focus:ring-mYellow text-lg ${isUsernameFixed ? 'opacity-70 cursor-not-allowed' : ''}`}
                    value={managerName}
                    onChange={e => !isUsernameFixed && setManagerName(e.target.value)}
                    disabled={isUsernameFixed}
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
                  <p className="text-3xl sm:text-5xl font-orbitron font-black text-white tracking-[0.3em]">{localSession.code}</p>
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
                <button
                  disabled={localPlayers.length < 2 || isStartingGame}
                  onClick={handleStartGame}
                  className="w-full bg-mGreen text-mTeal py-5 rounded-2xl font-orbitron font-black text-xl uppercase tracking-widest shadow-xl disabled:opacity-30 hover:bg-mGreen/90 transition-all"
                >
                  {isStartingGame ? (
                    <>
                      <i className="fas fa-spinner fa-spin mr-2"></i>
                      PREPARATION...
                    </>
                  ) : (
                    <>
                      <i className="fas fa-play mr-2"></i>
                      LANCER LE JEU
                    </>
                  )}
                </button>
                <p className="text-center text-xs text-slate-500">
                  {localPlayers.length < 2 ? 'Minimum 2 joueurs requis' : `${localPlayers.length} joueur(s) pret(s)`}
                </p>
              </div>
            )}
            <button
              onClick={handleBack}
              className="w-full text-slate-500 uppercase font-bold text-[10px] tracking-widest hover:text-mYellow transition-colors"
            >
              <i className="fas fa-arrow-left mr-1"></i> Retour
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <h2 className="text-2xl md:text-3xl font-orbitron text-mOrange font-black">REJOINDRE</h2>
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
                  {isUsernameFixed && <span className="text-mYellow ml-2">(compte connecte)</span>}
                </label>
                <input
                  type="text"
                  placeholder="Ex: Player1"
                  className={`w-full bg-[#1e3b46] border border-mGreen/20 rounded-2xl px-6 py-4 outline-none focus:ring-2 focus:ring-mOrange text-lg ${isUsernameFixed ? 'opacity-70 cursor-not-allowed' : ''}`}
                  value={newPlayerName}
                  onChange={e => !isUsernameFixed && setNewPlayerName(e.target.value)}
                  disabled={isUsernameFixed}
                />
                {!isUsernameFixed && (
                  <p className="text-[10px] text-slate-500 mt-1 ml-2">
                    <i className="fas fa-info-circle mr-1"></i>
                    Si vous avez deja rejoint, utilisez le meme pseudo pour recuperer votre session
                  </p>
                )}
                {isUsernameFixed && (
                  <p className="text-[10px] text-mGreen mt-1 ml-2">
                    <i className="fas fa-check-circle mr-1"></i>
                    Votre pseudo de compte sera utilise automatiquement
                  </p>
                )}
              </div>

              <div className="p-5 bg-mTeal/20 border border-mOrange/30 rounded-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs text-mOrange uppercase font-bold">Vos rubriques</span>
                    <span className="text-[10px] text-slate-500 ml-2">(optionnel)</span>
                  </div>
                  <select
                    className="bg-mTeal/50 text-xs px-3 py-1.5 rounded-lg border border-mGreen/20"
                    value={difficultyInput}
                    onChange={e => setDifficultyInput(e.target.value as PlayerCategory['difficulty'])}
                  >
                    <option value="Facile">Facile</option>
                    <option value="Intermédiaire">Intermediaire</option>
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
                    <span className="text-slate-500 text-xs italic">
                      <i className="fas fa-lightbulb mr-1 text-mYellow"></i>
                      Ajoutez des rubriques pour personnaliser les questions (facultatif)
                    </span>
                  )}
                </div>
              </div>

              <button
                onClick={handleJoinFinal}
                disabled={isJoining}
                className="w-full bg-mOrange text-mTeal py-5 rounded-2xl font-orbitron font-black text-xl uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 hover:bg-mOrange/90 transition-all"
              >
                {isJoining ? (
                  <>
                    <i className="fas fa-spinner fa-spin"></i>
                    CONNEXION...
                  </>
                ) : (
                  <>
                    <i className="fas fa-sign-in-alt"></i>
                    REJOINDRE
                  </>
                )}
              </button>
            </div>
            <button
              onClick={handleBack}
              className="w-full text-slate-500 uppercase font-bold text-[10px] tracking-widest hover:text-mYellow transition-colors"
            >
              <i className="fas fa-arrow-left mr-1"></i> Retour
            </button>
          </div>
        )}
      </div>

      {/* Liste des joueurs */}
      <div className="glass p-8 md:p-10 rounded-[2.5rem] border-mGreen/20 shadow-2xl flex flex-col">
        <h2 className="text-lg md:text-xl font-orbitron mb-6 text-mGreen font-black">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
            <span className="text-sm sm:text-base">JOUEURS CONNECTES</span>
            <span className="text-xs bg-mGreen/10 px-3 py-1 rounded-full self-start sm:self-auto">{localPlayers.length} SYNC</span>
          </div>
        </h2>
        <div className="space-y-3 overflow-y-auto max-h-[400px] pr-2 flex-grow">
          {localPlayers.map(p => (
            <div key={p.id} className="p-4 rounded-2xl border border-mGreen/20 bg-mTeal/30 flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="h-11 w-11 bg-mGreen/20 rounded-xl flex items-center justify-center text-mGreen font-black text-lg">{p.name.charAt(0).toUpperCase()}</div>
                <div>
                  <div className="font-bold text-white flex items-center gap-2">
                    {p.name}
                    {p.isManager && <i className="fas fa-crown text-[10px] text-mYellow"></i>}
                  </div>
                  <div className="text-[9px] text-slate-500 font-bold uppercase">
                    {p.categories.length > 0 ? p.categories.map(c => c.name).join(', ') : p.isManager ? 'Admin' : 'Pas de rubrique'}
                  </div>
                </div>
              </div>
              <i className="fas fa-circle-check text-mGreen"></i>
            </div>
          ))}
          {localPlayers.length === 0 && (
            <div className="text-center py-16 text-slate-600">
              <i className="fas fa-satellite-dish text-4xl mb-4 opacity-30"></i>
              <p className="italic">En attente de connexion...</p>
              {view === 'JOIN' && (
                <p className="text-xs mt-2 text-slate-500">Les joueurs apparaitront ici apres avoir rejoint</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LobbyPage;
