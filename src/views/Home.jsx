import { useState, useEffect } from 'react';
import { loginWithGoogle, logoutFromGoogle } from '../services/auth/googleAuth';
import CommandInput from '../components/CommandInput';

function Home({ isAuthenticated: initialAuthState }) {
  const [isAuthenticated, setIsAuthenticated] = useState(initialAuthState);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    setLoading(true);
    setError('');
    
    try {
      await loginWithGoogle();
      setIsAuthenticated(true);
    } catch (error) {
      console.error('Errore durante il login:', error);
      setError('Errore durante l\'autenticazione. Per favore riprova.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setLoading(true);
    
    try {
      await logoutFromGoogle();
      setIsAuthenticated(false);
    } catch (error) {
      console.error('Errore durante il logout:', error);
    } finally {
      setLoading(false);
    }
  };

  // Verifica lo stato di autenticazione al caricamento
  useEffect(() => {
    setIsAuthenticated(initialAuthState);
  }, [initialAuthState]);

  return (
    <div className="container">
      <header>
        <h1>Calendar AI</h1>
        <p>Il tuo assistente intelligente per la gestione del calendario</p>
      </header>

      <main>
        {isAuthenticated ? (
          <div className="dashboard">
            <div className="welcome-section">
              <h2>Bentornato!</h2>
              <p>Gestisci i tuoi appuntamenti usando comandi testuali.</p>
              <button onClick={handleLogout} className="logout-button">
                {loading ? 'Uscita in corso...' : 'Disconnetti'}
              </button>
            </div>
            
            <CommandInput />
          </div>
        ) : (
          <div className="login-container">
            <p>Per iniziare, effettua l'accesso con il tuo account Google</p>
            {error && <div className="feedback error">{error}</div>}
            <button 
              onClick={handleLogin} 
              disabled={loading}
              className="google-login-button"
            >
              {loading ? 'Caricamento...' : 'Accedi con Google'}
            </button>
          </div>
        )}
      </main>

      <footer>
        <p>Calendar AI v{import.meta.env.VITE_APP_VERSION}</p>
      </footer>
    </div>
  );
}

export default Home;