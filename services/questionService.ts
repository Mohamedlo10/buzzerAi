import { supabase } from '../supabaseClient';
import { Question } from '../types';

export interface QuestionDbData {
  id: string;
  session_id: string;
  category: string;
  text: string;
  answer: string;
  difficulty: string;
  order_index: number;
}

export const questionService = {
  async getQuestionsBySession(sessionId: string): Promise<Question[]> {
    const { data, error } = await supabase
      .from('questions')
      .select('*')
      .eq('session_id', sessionId)
      .order('order_index', { ascending: true });

    if (error) {
      console.error('Error fetching questions:', error);
      return [];
    }

    return (data || []) as Question[];
  },

  async createQuestions(sessionId: string, questions: Omit<Question, 'id'>[]): Promise<boolean> {
    const dbQuestions = questions.map((q, index) => ({
      session_id: sessionId,
      category: q.category,
      text: q.text,
      answer: q.answer,
      difficulty: q.difficulty,
      order_index: index
    }));

    const { error } = await supabase
      .from('questions')
      .insert(dbQuestions);

    if (error) {
      console.error('Error creating questions:', error);
      return false;
    }

    return true;
  }
};
