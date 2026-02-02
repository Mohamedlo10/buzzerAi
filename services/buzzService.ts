import { supabase } from '../supabaseClient';
import { Buzz } from '../types';

export interface BuzzDbData {
  id: string;
  session_id: string;
  player_local_id: string;
  buzz_timestamp_ms: number;
  created_at: string;
}

export const buzzService = {
  async getBuzzesBySession(sessionId: string): Promise<Buzz[]> {
    const { data, error } = await supabase
      .from('buzzes')
      .select('*')
      .eq('session_id', sessionId)
      .order('buzz_timestamp_ms', { ascending: true, nullsFirst: false });

    if (error) {
      console.error('Error fetching buzzes:', error);
      return [];
    }

    if (!data || data.length === 0) {
      return [];
    }

    const firstBuzzMs = data[0].buzz_timestamp_ms || new Date(data[0].created_at).getTime();

    return data.map((b, index) => {
      const buzzMs = b.buzz_timestamp_ms || new Date(b.created_at).getTime();
      return {
        playerId: b.player_local_id,
        timestamp: new Date(b.created_at).getTime(),
        timestampMs: buzzMs,
        timeDiffMs: index === 0 ? 0 : buzzMs - firstBuzzMs
      };
    });
  },

  async createBuzz(sessionId: string, playerLocalId: string): Promise<{ success: boolean; alreadyBuzzed?: boolean }> {
    const buzzTimestampMs = Date.now();

    const { error } = await supabase
      .from('buzzes')
      .insert({
        session_id: sessionId,
        player_local_id: playerLocalId,
        buzz_timestamp_ms: buzzTimestampMs
      });

    // Erreur 23505 = violation de contrainte unique = déjà buzzé
    if (error?.code === '23505') {
      return { success: false, alreadyBuzzed: true };
    }

    if (error) {
      console.error('Buzz error:', error);
      return { success: false };
    }

    return { success: true };
  },

  async deleteAllBuzzes(sessionId: string): Promise<boolean> {
    const { error } = await supabase
      .from('buzzes')
      .delete()
      .eq('session_id', sessionId);

    if (error) {
      console.error('Error deleting buzzes:', error);
      return false;
    }

    return true;
  },

  async deletePlayerBuzz(sessionId: string, playerLocalId: string): Promise<boolean> {
    const { error } = await supabase
      .from('buzzes')
      .delete()
      .eq('session_id', sessionId)
      .eq('player_local_id', playerLocalId);

    if (error) {
      console.error('Error deleting player buzz:', error);
      return false;
    }

    return true;
  }
};
