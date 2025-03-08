import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const AuthCallback = () => {
  const [status, setStatus] = useState('Elaborazione autenticazione...');
  const navigate = useNavigate();

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Ottieni i parametri dell'URL
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        
        if (code) {
          // Se l'autenticazione è andata a buon fine, memorizziamo il successo nel localStorage
          localStorage.setItem('authSuccess', 'true');
          setStatus('Autenticazione completata con successo! Reindirizzamento...');
          
          // Reindirizza alla home page dopo un breve ritardo
          setTimeout(() => {
            navigate('/');
          }, 1500);
        } else {
          // Se c'è un errore nell'autenticazione
          const error = urlParams.get('error');
          setStatus(`Errore di autenticazione: ${error || 'Errore sconosciuto'}`);
          
          // Reindirizza alla home page dopo un breve ritardo
          setTimeout(() => {
            navigate('/');
          }, 3000);
        }
      } catch (error) {
        console.error('Errore nella gestione del callback:', error);
        setStatus('Si è verificato un errore durante l\'elaborazione dell\'autenticazione.');
        
        // Reindirizza alla home page dopo un breve ritardo
        setTimeout(() => {
          navigate('/');
        }, 3000);
      }
    };

    handleAuthCallback();
  }, [navigate]);

  return (
    <div className="auth-callback-container">
      <div className="auth-callback-card">
        <h2>Autenticazione Google</h2>
        <p>{status}</p>
        <div className="loading-spinner"></div>
      </div>
    </div>
  );
};

export default AuthCallback;