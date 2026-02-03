import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import AuthPageComponent from '../components/AuthPage';

const AuthPage: React.FC = () => {
  const { setUser } = useGame();
  const navigate = useNavigate();

  return (
    <div className="max-w-md mx-auto py-8">
      <AuthPageComponent
        onAuthenticated={(user) => {
          setUser(user);
          navigate('/');
        }}
        onSkipAuth={() => navigate('/lobby')}
        initialMode="login"
      />
    </div>
  );
};

export default AuthPage;
