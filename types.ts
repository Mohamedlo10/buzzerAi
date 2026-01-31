
export enum GameStatus {
  LOBBY = 'LOBBY',
  GENERATING = 'GENERATING',
  PLAYING = 'PLAYING',
  RESULTS = 'RESULTS'
}

export interface Player {
  id: string;
  name: string;
  category: string;
  accessCode: string; // Code d'accès pour la rubrique
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
