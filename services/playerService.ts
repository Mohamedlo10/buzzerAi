import { supabase } from '../supabaseClient';
import { Player, PlayerCategory } from '../types';
import { rpcService } from './rpcService';

export interface PlayerDbData {
  id: string;
  local_id: string;
  session_id: string;
  name: string;
  is_manager: boolean;
  score: number;
  categories: PlayerCategory[];
  category_scores: Record<string, number>;
  user_id?: string;
}

export const playerService = {
  /**
   * Utilise RPC pour récupérer les joueurs - pas de mapping frontend
   * Les données sont retournées directement au format Player (camelCase)
   */
  async getPlayersBySession(sessionId: string): Promise<Player[]> {
    return rpcService.getSessionPlayers(sessionId);
  },

  async getPlayerByLocalId(sessionId: string, localId: string): Promise<PlayerDbData | null> {
    const { data, error } = await supabase
      .from('players')
      .select('*')
      .eq('session_id', sessionId)
      .eq('local_id', localId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching player by local_id:', error);
    }

    return data;
  },

  async getPlayerByName(sessionId: string, name: string): Promise<PlayerDbData | null> {
    const { data, error } = await supabase
      .from('players')
      .select('*')
      .eq('session_id', sessionId)
      .eq('name', name.trim())
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching player by name:', error);
    }

    return data;
  },

  async getPlayerByUsername(sessionId: string, username: string): Promise<PlayerDbData | null> {
    const { data, error } = await supabase
      .from('players')
      .select('*')
      .eq('session_id', sessionId)
      .eq('name', username)
      .maybeSingle();

    if (error) {
      console.error('Error fetching player by username:', error);
    }

    return data;
  },

  async createPlayer(
    sessionId: string,
    localId: string,
    name: string,
    isManager: boolean,
    categories: PlayerCategory[] = [],
    userId?: string
  ): Promise<boolean> {
    const { error } = await supabase
      .from('players')
      .insert({
        local_id: localId,
        session_id: sessionId,
        name,
        is_manager: isManager,
        categories,
        user_id: userId || null
      });

    if (error) {
      console.error('Error creating player:', error);
      return false;
    }

    return true;
  },

  async updatePlayerLocalId(playerId: string, newLocalId: string, userId?: string): Promise<boolean> {
    const { error } = await supabase
      .from('players')
      .update({ local_id: newLocalId, user_id: userId || null })
      .eq('id', playerId);

    if (error) {
      console.error('Error updating player local_id:', error);
      return false;
    }

    return true;
  },

  async updatePlayerScore(
    sessionId: string,
    localId: string,
    newScore: number,
    categoryScores: Record<string, number>
  ): Promise<boolean> {
    const { error } = await supabase
      .from('players')
      .update({ score: newScore, category_scores: categoryScores })
      .eq('session_id', sessionId)
      .eq('local_id', localId);

    if (error) {
      console.error('Error updating player score:', error);
      return false;
    }

    return true;
  },

  generateLocalId(): string {
    return 'user-' + Math.random().toString(36).substr(2, 9);
  }
};
