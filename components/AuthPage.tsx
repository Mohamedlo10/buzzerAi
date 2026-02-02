import React, { useState } from 'react';
import { authService } from '../services/authService';
import { User } from '../types';

interface AuthPageProps {
  onAuthenticated: (user: User) => void;
  onSkipAuth: () => void;
}

const AuthPage: React.FC<AuthPageProps> = ({ onAuthenticated, onSkipAuth }) => {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError('');

    if (!username.trim()) {
      setError('Veuillez entrer un nom d\'utilisateur');
      return;
    }

    if (!password.trim()) {
      setError('Veuillez entrer un mot de passe');
      return;
    }

    if (mode === 'signup') {
      if (password !== confirmPassword) {
        setError('Les mots de passe ne correspondent pas');
        return;
      }
      if (password.length < 6) {
        setError('Le mot de passe doit contenir au moins 6 caracteres');
        return;
      }
      if (username.trim().length < 3) {
        setError('Le nom d\'utilisateur doit contenir au moins 3 caracteres');
        return;
      }
    }

    setLoading(true);

    const result = mode === 'login'
      ? await authService.login(username, password)
      : await authService.signup(username, password);

    setLoading(false);

    if (result.success && result.user) {
      onAuthenticated(result.user);
    } else {
      setError(result.error || 'Une erreur est survenue');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !loading) {
      handleSubmit();
    }
  };

  return (
    <div className="flex flex-col items-center justify-center space-y-12 animate-fade-in py-8">
      <div className="text-center">
        <h2 className="text-4xl md:text-5xl font-orbitron text-mYellow font-bold mb-4">
          {mode === 'login' ? 'CONNEXION' : 'INSCRIPTION'}
        </h2>
        <p className="text-mGreen font-orbitron text-xs tracking-[0.3em] uppercase opacity-80">
          BuzzMaster Cloud Account
        </p>
      </div>

      <div className="glass p-8 md:p-10 rounded-[2.5rem] border-mYellow/20 w-full max-w-md shadow-2xl">
        <div className="space-y-5">
          <div>
            <label className="block text-xs text-mGreen uppercase font-bold tracking-widest mb-2 ml-4">
              Nom d'utilisateur
            </label>
            <input
              type="text"
              placeholder="ex: player123"
              className="w-full bg-mTeal/50 border border-mGreen/20 rounded-2xl px-6 py-4 outline-none focus:ring-2 focus:ring-mYellow focus:border-transparent text-lg placeholder:text-slate-500"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={loading}
              autoComplete="username"
            />
          </div>

          <div>
            <label className="block text-xs text-mGreen uppercase font-bold tracking-widest mb-2 ml-4">
              Mot de passe
            </label>
            <input
              type="password"
              placeholder="Min. 6 caracteres"
              className="w-full bg-mTeal/50 border border-mGreen/20 rounded-2xl px-6 py-4 outline-none focus:ring-2 focus:ring-mYellow focus:border-transparent text-lg placeholder:text-slate-500"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={loading}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
          </div>

          {mode === 'signup' && (
            <div>
              <label className="block text-xs text-mGreen uppercase font-bold tracking-widest mb-2 ml-4">
                Confirmer le mot de passe
              </label>
              <input
                type="password"
                placeholder="Retapez le mot de passe"
                className="w-full bg-mTeal/50 border border-mGreen/20 rounded-2xl px-6 py-4 outline-none focus:ring-2 focus:ring-mYellow focus:border-transparent text-lg placeholder:text-slate-500"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={loading}
                autoComplete="new-password"
              />
            </div>
          )}

          {error && (
            <div className="bg-mSienna/20 border border-mSienna/50 rounded-xl p-4 text-mSienna text-center text-sm">
              <i className="fas fa-exclamation-triangle mr-2"></i>
              {error}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full bg-mYellow text-mTeal py-5 rounded-2xl font-orbitron font-black text-xl uppercase shadow-xl hover:bg-mYellow/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <><i className="fas fa-spinner fa-spin mr-2"></i> CHARGEMENT...</>
            ) : mode === 'login' ? (
              <><i className="fas fa-sign-in-alt mr-2"></i> SE CONNECTER</>
            ) : (
              <><i className="fas fa-user-plus mr-2"></i> CREER LE COMPTE</>
            )}
          </button>

          <button
            onClick={() => {
              setMode(mode === 'login' ? 'signup' : 'login');
              setError('');
              setConfirmPassword('');
            }}
            disabled={loading}
            className="w-full text-mGreen uppercase font-bold text-sm tracking-widest py-2 hover:text-mYellow transition-colors"
          >
            {mode === 'login'
              ? 'Pas de compte ? Inscrivez-vous'
              : 'Deja un compte ? Connectez-vous'}
          </button>

          <div className="border-t border-mGreen/20 pt-5 mt-2">
            <button
              onClick={onSkipAuth}
              disabled={loading}
              className="w-full bg-mTeal/50 text-slate-400 py-4 rounded-xl font-bold text-sm uppercase tracking-widest border border-mGreen/20 hover:bg-mTeal/70 hover:text-slate-300 transition-all disabled:opacity-50"
            >
              <i className="fas fa-user-secret mr-2"></i>
              Continuer en tant qu'invite
            </button>
            <p className="text-center text-[10px] text-slate-500 mt-3">
              Les invites peuvent jouer mais ne retrouveront pas leurs sessions
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
