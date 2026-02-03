import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { GameProvider, useGame } from './context/GameContext';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import AuthPage from './pages/AuthPage';
import LobbyPage from './pages/LobbyPage';
import GamePage from './pages/GamePage';
import ResultsPage from './pages/ResultsPage';

// Component to handle root redirect based on auth status
const RootRedirect: React.FC = () => {
  const { user } = useGame();
  return user ? <HomePage /> : <Navigate to="/lobby" replace />;
};

const AppRoutes: React.FC = () => {
  return (
    <Layout>
      <Routes>
        {/* Home - redirects based on auth */}
        <Route path="/" element={<RootRedirect />} />

        {/* Auth page */}
        <Route path="/auth" element={<AuthPage />} />

        {/* Lobby routes */}
        <Route path="/lobby" element={<LobbyPage />} />
        <Route path="/lobby/create" element={<LobbyPage />} />
        <Route path="/lobby/join" element={<LobbyPage />} />
        <Route path="/lobby/:code" element={<LobbyPage />} />

        {/* Game route */}
        <Route path="/game/:sessionId" element={<GamePage />} />

        {/* Results route */}
        <Route path="/results/:sessionId" element={<ResultsPage />} />

        {/* Catch all - redirect to lobby */}
        <Route path="*" element={<Navigate to="/lobby" replace />} />
      </Routes>
    </Layout>
  );
};

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <GameProvider>
        <AppRoutes />
      </GameProvider>
    </BrowserRouter>
  );
};

export default App;
