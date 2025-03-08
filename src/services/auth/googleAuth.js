// Gestione dell'autenticazione Google OAuth 2.0
import { gapi } from 'gapi-script';

// Costanti per l'autenticazione
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_API_KEY;
const SCOPES = 'https://www.googleapis.com/auth/calendar';

// Determina dinamicamente il redirect URI basato sull'URL corrente
const getRedirectUri = () => {
  const baseUrl = window.location.origin;
  return `${baseUrl}/auth-callback`;
};

// Inizializza l'autenticazione Google
export const initGoogleAuth = () => {
  return new Promise((resolve, reject) => {
    try {
      gapi.load('client:auth2', async () => {
        try {
          await gapi.client.init({
            apiKey: GOOGLE_API_KEY,
            clientId: GOOGLE_CLIENT_ID,
            scope: SCOPES,
            discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest']
          });

          // Controlla se l'utente è già autenticato
          const isSignedIn = gapi.auth2.getAuthInstance().isSignedIn.get();
          resolve(isSignedIn);
        } catch (error) {
          console.error('Errore durante l\'inizializzazione del client Google:', error);
          reject(error);
        }
      });
    } catch (error) {
      console.error('Errore durante il caricamento di GAPI:', error);
      reject(error);
    }
  });
};

// Effettua il login con Google
export const loginWithGoogle = async () => {
  try {
    const authInstance = gapi.auth2.getAuthInstance();
    
    if (!authInstance) {
      throw new Error('Istanza di autenticazione non inizializzata');
    }
    
    // Usa impostazioni di base per l'autenticazione
    const user = await authInstance.signIn();
    const authResponse = user.getAuthResponse();
    
    // Salva il token in localStorage per uso futuro
    localStorage.setItem('googleAuthToken', authResponse.access_token);
    localStorage.setItem('googleAuthTokenExpiry', authResponse.expires_at);
    
    return authResponse;
  } catch (error) {
    console.error('Errore durante il login con Google:', error);
    throw error;
  }
};

// Effettua il logout
export const logoutFromGoogle = async () => {
  try {
    const authInstance = gapi.auth2.getAuthInstance();
    await authInstance.signOut();
    
    // Rimuovi i token salvati
    localStorage.removeItem('googleAuthToken');
    localStorage.removeItem('googleAuthTokenExpiry');
    
    return true;
  } catch (error) {
    console.error('Errore durante il logout da Google:', error);
    throw error;
  }
};

// Verifica se il token è ancora valido
export const isTokenValid = () => {
  const expiry = localStorage.getItem('googleAuthTokenExpiry');
  if (!expiry) return false;
  
  // Converti a numero e confronta con il timestamp attuale
  return parseInt(expiry, 10) > Date.now();
};