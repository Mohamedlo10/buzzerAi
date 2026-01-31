
export enum GameStatus {
  LOBBY = 'LOBBY',
  GENERATING = 'GENERATING',
  PLAYING = 'PLAYING',
  RESULTS = 'RESULTS'
}

export interface PlayerCategory {
  name: string;
  difficulty: 'Facile' | 'Intermédiaire' | 'Expert';
}

export interface Player {
  id: string;
  name: string;
  categories: PlayerCategory[];
  score: number;
  categoryScores: Record<string, number>;
  isManager: boolean;
}

export interface Question {
  id: string;
  category: string;
  text: string;
  answer: string;
  isUsed: boolean;
  winnerId?: string;
  difficulty: string;
}

export interface Buzz {
  playerId: string;
  timestamp: number;
}

export interface RoomState {
  players: Player[];
  questions: Question[];
  currentQuestionIndex: number;
  status: GameStatus;
  buzzedPlayers: Buzz[];
  debtAmount: number;
}
