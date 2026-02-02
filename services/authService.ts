import { supabase } from '../supabaseClient';
import { User } from '../types';
import { rpcService } from './rpcService';

export interface AuthResult {
  success: boolean;
  user?: User;
  error?: string;
}

export interface ActiveSession {
  id: string;
  code: string;
  status: string;
  created_at: string;
  player_count: number;
  my_score?: number;
  is_manager?: boolean;
}

export interface GameHistory {
  id: string;
  code: string;
  status: string;
  created_at: string;
  player_count: number;
  my_score: number;
  my_rank: number;
  is_manager: boolean;
  winner_name?: string;
  winner_score?: number;
}

const USER_STORAGE_KEY = 'mdev_user';

// Hash simple pour le mot de passe (en production, utiliser bcrypt via Edge Function)
const simpleHash = (str: string): string => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return 'hash_' + Math.abs(hash).toString(36) + '_' + str.length;
};

export const authService = {
  async signup(username: string, password: string): Promise<AuthResult> {
    const trimmedUsername = username.trim().toLowerCase();

    if (trimmedUsername.length < 3) {
      return { success: false, error: 'Le nom d\'utilisateur doit contenir au moins 3 caracteres' };
    }

    if (password.length < 6) {
      return { success: false, error: 'Le mot de passe doit contenir au moins 6 caracteres' };
    }

    // Verifier si le username existe deja
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('username', trimmedUsername)
      .single();

    if (existing) {
      return { success: false, error: 'Ce nom d\'utilisateur est deja pris' };
    }

    // Creer le compte
    const { data, error } = await supabase
      .from('users')
      .insert({
        username: trimmedUsername,
        password_hash: simpleHash(password)
      })
      .select()
      .single();

    if (error) {
      console.error('Signup error:', error);
      return { success: false, error: 'Erreur lors de la creation du compte' };
    }

    const user: User = {
      id: data.id,
      username: data.username,
      created_at: data.created_at
    };

    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
    return { success: true, user };
  },

  async login(username: string, password: string): Promise<AuthResult> {
    const trimmedUsername = username.trim().toLowerCase();

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', trimmedUsername)
      .single();

    if (error || !data) {
      return { success: false, error: 'Nom d\'utilisateur ou mot de passe incorrect' };
    }

    // Verifier le mot de passe
    if (data.password_hash !== simpleHash(password)) {
      return { success: false, error: 'Nom d\'utilisateur ou mot de passe incorrect' };
    }

    const user: User = {
      id: data.id,
      username: data.username,
      created_at: data.created_at
    };

    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
    return { success: true, user };
  },

  logout(): void {
    localStorage.removeItem(USER_STORAGE_KEY);
  },

  getCurrentUser(): User | null {
    const stored = localStorage.getItem(USER_STORAGE_KEY);
    if (!stored) return null;

    try {
      return JSON.parse(stored) as User;
    } catch {
      return null;
    }
  },

  /**
   * Utilise RPC pour récupérer les sessions actives - élimine N+1 queries
   */
  async getUserActiveSessions(userId: string): Promise<ActiveSession[]> {
    const dashboard = await rpcService.getUserDashboard(userId);
    return dashboard.activeSessions;
  },

  async checkUsernameAvailable(username: string): Promise<boolean> {
    const { data } = await supabase
      .from('users')
      .select('id')
      .eq('username', username.trim().toLowerCase())
      .single();

    return !data;
  },

  /**
   * Utilise RPC pour récupérer l'historique - élimine N+1 queries
   */
  async getUserGameHistory(userId: string): Promise<GameHistory[]> {
    const dashboard = await rpcService.getUserDashboard(userId);
    return dashboard.gameHistory;
  },

  /**
   * Nouvelle méthode optimisée: récupère activeSessions + gameHistory en un seul appel
   */
  async getUserDashboard(userId: string): Promise<{ activeSessions: ActiveSession[]; gameHistory: GameHistory[] }> {
    return rpcService.getUserDashboard(userId);
  },

  async getSessionsByUsername(username: string): Promise<ActiveSession[]> {
    // Trouver toutes les sessions ou ce username est joueur
    const { data, error } = await supabase
      .from('players')
      .select(`
        local_id,
        score,
        is_manager,
        sessions (
          id,
          code,
          status,
          created_at
        )
      `)
      .eq('name', username.trim());

    if (error || !data) return [];

    const sessions: ActiveSession[] = [];
    for (const p of data) {
      const sess = p.sessions as any;
      if (!sess) continue;

      const { count } = await supabase
        .from('players')
        .select('*', { count: 'exact', head: true })
        .eq('session_id', sess.id);

      sessions.push({
        id: sess.id,
        code: sess.code,
        status: sess.status,
        created_at: sess.created_at,
        player_count: count || 0,
        my_score: p.score,
        is_manager: p.is_manager
      });
    }

    return sessions;
  }
};
