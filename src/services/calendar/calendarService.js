// Servizio per interagire con l'API di Google Calendar
import { gapi } from 'gapi-script';
import { isTokenValid } from '../auth/googleAuth';

// Funzione per ottenere eventi dal calendario
export const getEvents = async (timeMin, timeMax, maxResults = 10) => {
  if (!isTokenValid()) {
    throw new Error('Utente non autenticato o token scaduto');
  }

  try {
    const response = await gapi.client.calendar.events.list({
      'calendarId': 'primary',
      'timeMin': timeMin || new Date().toISOString(),
      'timeMax': timeMax || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      'showDeleted': false,
      'singleEvents': true,
      'maxResults': maxResults,
      'orderBy': 'startTime'
    });

    return response.result.items;
  } catch (error) {
    console.error('Errore durante il recupero degli eventi:', error);
    throw error;
  }
};

// Funzione per creare un nuovo evento
export const createEvent = async (eventData) => {
  if (!isTokenValid()) {
    throw new Error('Utente non autenticato o token scaduto');
  }

  try {
    const response = await gapi.client.calendar.events.insert({
      'calendarId': 'primary',
      'resource': eventData
    });

    return response.result;
  } catch (error) {
    console.error('Errore durante la creazione dell\'evento:', error);
    throw error;
  }
};

// Funzione per aggiornare un evento esistente
export const updateEvent = async (eventId, eventData) => {
  if (!isTokenValid()) {
    throw new Error('Utente non autenticato o token scaduto');
  }

  try {
    const response = await gapi.client.calendar.events.update({
      'calendarId': 'primary',
      'eventId': eventId,
      'resource': eventData
    });

    return response.result;
  } catch (error) {
    console.error('Errore durante l\'aggiornamento dell\'evento:', error);
    throw error;
  }
};

// Funzione per eliminare un evento
export const deleteEvent = async (eventId) => {
  if (!isTokenValid()) {
    throw new Error('Utente non autenticato o token scaduto');
  }

  try {
    await gapi.client.calendar.events.delete({
      'calendarId': 'primary',
      'eventId': eventId
    });

    return true;
  } catch (error) {
    console.error('Errore durante l\'eliminazione dell\'evento:', error);
    throw error;
  }
};