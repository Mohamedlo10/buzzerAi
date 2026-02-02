import { supabase } from '../supabaseClient';
import { RealtimeChannel } from '@supabase/supabase-js';

export type RealtimeCallback = (payload: any) => void;

export const realtimeService = {
  subscribeToSession(sessionId: string, onUpdate: RealtimeCallback): RealtimeChannel {
    return supabase
      .channel('session_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sessions', filter: `id=eq.${sessionId}` },
        onUpdate
      )
      .subscribe();
  },

  subscribeToPlayers(sessionId: string, onUpdate: RealtimeCallback): RealtimeChannel {
    return supabase
      .channel('players_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'players', filter: `session_id=eq.${sessionId}` },
        onUpdate
      )
      .subscribe();
  },

  subscribeToBuzzes(sessionId: string, onUpdate: RealtimeCallback): RealtimeChannel {
    return supabase
      .channel('buzz_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'buzzes', filter: `session_id=eq.${sessionId}` },
        onUpdate
      )
      .subscribe();
  },

  subscribeToQuestions(sessionId: string, onUpdate: RealtimeCallback): RealtimeChannel {
    return supabase
      .channel('questions_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'questions', filter: `session_id=eq.${sessionId}` },
        onUpdate
      )
      .subscribe();
  },

  // Pour le lobby - subscriptions spécifiques
  subscribeToLobbyPlayers(sessionId: string, onUpdate: RealtimeCallback): RealtimeChannel {
    return supabase
      .channel('lobby_players')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'players', filter: `session_id=eq.${sessionId}` },
        onUpdate
      )
      .subscribe();
  },

  subscribeToLobbySession(sessionId: string, onUpdate: RealtimeCallback): RealtimeChannel {
    return supabase
      .channel('lobby_session')
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
