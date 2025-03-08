import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import Home from './views/Home';
import AuthCallback from './views/AuthCallback';
import { initGoogleAuth } from './services/auth/googleAuth';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      try {
        const authResult = await initGoogleAuth();
        setIsAuthenticated(authResult);
      } catch (error) {
        console.error('Errore durante l\'inizializzazione dell\'autenticazione:', error);
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  if (loading) {
    return <div className="loading">Caricamento...</div>;
  }

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home isAuthenticated={isAuthenticated} />} />
        <Route path="/auth-callback" element={<AuthCallback />} />
      </Routes>
    </Router>
  );
}

export default App;