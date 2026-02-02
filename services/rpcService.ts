import { supabase } from '../supabaseClient';
import { Player, Buzz, Question } from '../types';
import { ActiveSession, GameHistory } from './authService';

// Types de retour des RPC
export interface ValidateAnswerResult {
  success: boolean;
  newQuestionIndex: number;
  isGameOver: boolean;
  newStatus: string;
  playerNewScore: number;
  playerNewCategoryScores: Record<string, number>;
}

export interface RejoinSessionResult {
  sessionId: string;
  sessionCode: string;
  sessionStatus: string;
  currentQuestionIndex: number;
  debtAmount: number;
  qPerUser: number;
  foundPlayerId: string | null;
  foundPlayerName: string | null;
  isManager: boolean;
  players: Player[];
  questions: Question[];
  buzzes: Buzz[];
}

export interface UserDashboardResult {
  activeSessions: ActiveSession[];
  gameHistory: GameHistory[];
}

export const rpcService = {
  /**
   * RPC 1: get_session_players
   * Retourne les joueurs avec format camelCase - pas de mapping frontend
   */
  async getSessionPlayers(sessionId: string): Promise<Player[]> {
    const { data, error } = await supabase.rpc('get_session_players', {
      p_session_id: sessionId
    });

    if (error) {
      console.error('RPC get_session_players error:', error);
      return [];
    }

    return data || [];
  },

  /**
   * RPC 2: get_buzz_state
   * Retourne les buzzes avec timeDiffMs pré-calculé côté serveur
   */
  async getBuzzState(sessionId: string): Promise<Buzz[]> {
    const { data, error } = await supabase.rpc('get_buzz_state', {
      p_session_id: sessionId
    });

    if (error) {
      console.error('RPC get_buzz_state error:', error);
      return [];
    }

    return data || [];
  },

  /**
   * RPC 3: validate_answer
   * Transaction atomique: update score + delete buzz + advance question
   */
  async validateAnswer(
    sessionId: string,
    playerId: string | null,
    points: number,
    category: string,
    moveNext: boolean,
    questionsCount: number
  ): Promise<ValidateAnswerResult | null> {
    const { data, error } = await supabase.rpc('validate_answer', {
      p_session_id: sessionId,
      p_player_id: playerId,
      p_points: points,
      p_category: category,
      p_move_next: moveNext,
      p_questions_count: questionsCount
    });

    if (error) {
      console.error('RPC validate_answer error:', error);
      return null;
    }

    return data?.[0] || null;
  },

  /**
   * RPC 4: rejoin_session
   * Récupère l'état complet du jeu en un seul appel (remplace 5 requêtes)
   */
  async rejoinSession(
    sessionId: string,
    username: string | null,
    localId: string | null
  ): Promise<RejoinSessionResult | null> {
    const { data, error } = await supabase.rpc('rejoin_session', {
      p_session_id: sessionId,
      p_username: username || '',
      p_local_id: localId || ''
    });

    if (error) {
      console.error('RPC rejoin_session error:', error);
      return null;
    }

    const row = data?.[0];
    if (!row || !row.sessionId) return null;

    return {
      sessionId: row.sessionId,
      sessionCode: row.sessionCode,
      sessionStatus: row.sessionStatus,
      currentQuestionIndex: row.currentQuestionIndex,
      debtAmount: row.debtAmount,
      qPerUser: row.qPerUser,
      foundPlayerId: row.foundPlayerId,
      foundPlayerName: row.foundPlayerName,
      isManager: row.isManager,
      players: row.players || [],
      questions: row.questions || [],
      buzzes: row.buzzes || []
    };
  },

  /**
   * RPC 5: get_user_dashboard
   * Remplace N+1 queries par un seul appel optimisé
   */
  async getUserDashboard(userId: string): Promise<UserDashboardResult> {
    const { data, error } = await supabase.rpc('get_user_dashboard', {
      p_user_id: userId
    });

    if (error) {
      console.error('RPC get_user_dashboard error:', error);
      return { activeSessions: [], gameHistory: [] };
    }

    const row = data?.[0];
    return {
      activeSessions: row?.activeSessions || [],
      gameHistory: row?.gameHistory || []
    };
  }
};
