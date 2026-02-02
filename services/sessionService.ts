import { supabase } from '../supabaseClient';
import { GameStatus } from '../types';

export interface SessionData {
  id: string;
  code: string;
  status: string;
  created_at: string;
  user_id?: string;
  manager_id?: string;
  debt_amount?: number;
  q_per_user?: number;
  current_question_index?: number;
}

export const sessionService = {
  async createSession(code: string, managerId: string, userId?: string): Promise<SessionData | null> {
    const { data, error } = await supabase
      .from('sessions')
      .insert({
        code,
        manager_id: managerId,
        status: 'LOBBY',
        user_id: userId || null
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating session:', error);
      return null;
    }

    return data;
  },

  async getSessionByCode(code: string): Promise<SessionData | null> {
    const { data, error } = await supabase
      .from('sessions')
      .select('*')
      .eq('code', code)
      .single();

    if (error) {
      console.error('Error fetching session by code:', error);
      return null;
    }

    return data;
  },

  async getSessionById(id: string): Promise<SessionData | null> {
    const { data, error } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('Error fetching session by id:', error);
      return null;
    }

    return data;
  },

  async updateSessionStatus(sessionId: string, status: GameStatus, extraData?: Partial<SessionData>): Promise<boolean> {
    const updateData: any = { status, ...extraData };

    const { error } = await supabase
      .from('sessions')
      .update(updateData)
      .eq('id', sessionId);

    if (error) {
      console.error('Error updating session status:', error);
      return false;
    }

    return true;
  },

  async updateSessionGameSettings(sessionId: string, debtAmount: number, qPerUser: number): Promise<boolean> {
    const { error } = await supabase
      .from('sessions')
      .update({ debt_amount: debtAmount, q_per_user: qPerUser })
      .eq('id', sessionId);

    if (error) {
      console.error('Error updating session settings:', error);
      return false;
    }

    return true;
  },

  async advanceToNextQuestion(sessionId: string, nextIndex: number, isGameOver: boolean): Promise<boolean> {
    const { error } = await supabase
      .from('sessions')
      .update({
        current_question_index: nextIndex,
        status: isGameOver ? GameStatus.RESULTS : GameStatus.PLAYING
      })
      .eq('id', sessionId);

    if (error) {
      console.error('Error advancing question:', error);
      return false;
    }

    return true;
  },

  async startGenerating(sessionId: string, debtAmount: number, qPerUser: number): Promise<boolean> {
    const { error } = await supabase
      .from('sessions')
      .update({
        status: GameStatus.GENERATING,
        debt_amount: debtAmount,
        q_per_user: qPerUser
      })
      .eq('id', sessionId);

    if (error) {
      console.error('Error starting generation:', error);
      return false;
    }

    return true;
  },

  async startPlaying(sessionId: string): Promise<boolean> {
    const { error } = await supabase
      .from('sessions')
      .update({
        status: GameStatus.PLAYING,
        current_question_index: 0
      })
      .eq('id', sessionId);

    if (error) {
      console.error('Error starting game:', error);
      return false;
    }

    return true;
  },

  generateSessionCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }
};
