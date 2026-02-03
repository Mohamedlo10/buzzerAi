import { supabase } from '../supabaseClient';
import { RealtimeChannel } from '@supabase/supabase-js';

export type RealtimeCallback = (payload: any) => void;

export const realtimeService = {
  // Noms de channels uniques avec sessionId pour éviter les conflits
  subscribeToSession(sessionId: string, onUpdate: RealtimeCallback): RealtimeChannel {
    return supabase
      .channel(`session_changes_${sessionId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'sessions', filter: `id=eq.${sessionId}` },
        onUpdate
      )
      .subscribe();
  },

  subscribeToPlayers(sessionId: string, onUpdate: RealtimeCallback): RealtimeChannel {
    return supabase
      .channel(`players_changes_${sessionId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'players', filter: `session_id=eq.${sessionId}` },
        onUpdate
      )
      .subscribe();
  },

  subscribeToBuzzes(sessionId: string, onUpdate: RealtimeCallback): RealtimeChannel {
    return supabase
      .channel(`buzz_changes_${sessionId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'buzzes', filter: `session_id=eq.${sessionId}` },
        onUpdate
      )
      .subscribe();
  },

  subscribeToQuestions(sessionId: string, onUpdate: RealtimeCallback): RealtimeChannel {
    return supabase
      .channel(`questions_changes_${sessionId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'questions', filter: `session_id=eq.${sessionId}` },
        onUpdate
      )
      .subscribe();
  },

  // Pour le lobby - subscriptions spécifiques avec noms uniques
  subscribeToLobbyPlayers(sessionId: string, onUpdate: RealtimeCallback): RealtimeChannel {
    return supabase
      .channel(`lobby_players_${sessionId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'players', filter: `session_id=eq.${sessionId}` },
        onUpdate
      )
      .subscribe();
  },

  subscribeToLobbySession(sessionId: string, onUpdate: RealtimeCallback): RealtimeChannel {
    return supabase
      .channel(`lobby_session_${sessionId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'sessions', filter: `id=eq.${sessionId}` },
        onUpdate
      )
      .subscribe();
  },

  unsubscribe(channel: RealtimeChannel): void {
    supabase.removeChannel(channel);
  }
};
