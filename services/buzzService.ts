import { supabase } from '../supabaseClient';
import { Buzz } from '../types';
import { rpcService } from './rpcService';

export interface BuzzDbData {
  id: string;
  session_id: string;
  player_local_id: string;
  buzz_timestamp_ms: number;
  created_at: string;
}

export const buzzService = {
  /**
   * Utilise RPC pour récupérer les buzzes - timeDiffMs pré-calculé côté serveur
   * Élimine le calcul client-side et retourne directement au format Buzz
   */
  async getBuzzesBySession(sessionId: string): Promise<Buzz[]> {
    return rpcService.getBuzzState(sessionId);
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
