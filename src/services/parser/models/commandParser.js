// Parser di comandi testuali per il calendario
import { format, parse, isValid, addDays } from 'date-fns';
import { it } from 'date-fns/locale';

// Espressioni regolari per riconoscere i comandi
const PATTERNS = {
  CREATE: /crea|aggiungi|nuovo|pianifica|programma/i,
  READ: /mostra|visualizza|vedi|dammi|elenca/i,
  UPDATE: /modifica|aggiorna|cambia|sposta/i,
  DELETE: /elimina|cancella|rimuovi/i,
  DATE: /oggi|domani|dopodomani|lunedì|martedì|mercoledì|giovedì|venerdì|sabato|domenica|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?/i,
  TIME: /(?:alle|ore|alle ore)?\s*\d{1,2}(?::\d{2})?\s*(?:am|pm)?/i
};

// Funzione principale per analizzare il comando
export const parseCommand = (text) => {
  // Struttura base del risultato
  const result = {
    action: null,
    date: null,
    time: null,
    title: null,
    description: null,
    valid: false
  };

  // Determina l'azione richiesta
  if (PATTERNS.CREATE.test(text)) {
    result.action = 'create';
  } else if (PATTERNS.READ.test(text)) {
    result.action = 'read';
  } else if (PATTERNS.UPDATE.test(text)) {
    result.action = 'update';
  } else if (PATTERNS.DELETE.test(text)) {
    result.action = 'delete';
  }

  // Estrai la data
  const dateMatch = text.match(PATTERNS.DATE);
  if (dateMatch) {
    result.date = parseDateString(dateMatch[0]);
  }

  // Estrai l'ora
  const timeMatch = text.match(PATTERNS.TIME);
  if (timeMatch) {
    result.time = parseTimeString(timeMatch[0]);
  }

  // Estrai il titolo (testo rimanente dopo la rimozione dei pattern riconosciuti)
  let titleText = text
    .replace(PATTERNS.CREATE, '')
    .replace(PATTERNS.READ, '')
    .replace(PATTERNS.UPDATE, '')
    .replace(PATTERNS.DELETE, '')
    .replace(PATTERNS.DATE, '')
    .replace(PATTERNS.TIME, '')
    .trim();

  // Cerca parole chiave come "intitolato", "chiamato", "denominato" ecc.
  const titlePatterns = /(?:intitolato|chiamato|denominato|dal titolo|con titolo)\s+["']?([^"']+)["']?/i;
  const titleMatch = titleText.match(titlePatterns);
  
  if (titleMatch) {
    result.title = titleMatch[1].trim();
    // Rimuovi il pattern dal testo rimanente
    titleText = titleText.replace(titleMatch[0], '').trim();
  } else if (titleText) {
    // Se non c'è un pattern specifico ma c'è del testo, usalo come titolo
    result.title = titleText;
  }

  // Determina se il comando è valido
  result.valid = result.action !== null && 
                 (result.action === 'read' || 
                  (result.title !== null && 
                   (result.date !== null || result.action === 'delete')));

  return result;
};

// Funzione per convertire stringhe di data in oggetti Date
const parseDateString = (dateStr) => {
  const today = new Date();
  
  // Gestisci casi speciali
  if (/oggi/i.test(dateStr)) {
    return today;
  } else if (/domani/i.test(dateStr)) {
    return addDays(today, 1);
  } else if (/dopodomani/i.test(dateStr)) {
    return addDays(today, 2);
  } else if (/lunedì|lunedi/i.test(dateStr)) {
    return getNextDayOfWeek(today, 1);
  } else if (/martedì|martedi/i.test(dateStr)) {
    return getNextDayOfWeek(today, 2);
  } else if (/mercoledì|mercoledi/i.test(dateStr)) {
    return getNextDayOfWeek(today, 3);
  } else if (/giovedì|giovedi/i.test(dateStr)) {
    return getNextDayOfWeek(today, 4);
  } else if (/venerdì|venerdi/i.test(dateStr)) {
    return getNextDayOfWeek(today, 5);
  } else if (/sabato/i.test(dateStr)) {
    return getNextDayOfWeek(today, 6);
  } else if (/domenica/i.test(dateStr)) {
    return getNextDayOfWeek(today, 0);
  }
  
  // Prova a interpretare un formato di data
  let date;
  
  // Prova formato dd/mm/yyyy
  date = parse(dateStr, 'dd/MM/yyyy', new Date(), { locale: it });
  if (isValid(date)) return date;
  
  // Prova formato dd/mm
  date = parse(dateStr, 'dd/MM', new Date(), { locale: it });
  if (isValid(date)) return date;
  
  // In caso di fallimento, restituisci la data odierna
  return today;
};

// Funzione per convertire stringhe di orario in oggetti Date
const parseTimeString = (timeStr) => {
  // Rimuovi parole chiave e spazi
  const cleanTime = timeStr.replace(/alle|ore|alle ore/i, '').trim();
  
  // Prova formati diversi
  let time;
  
  // Prova formato HH:mm
  time = parse(cleanTime, 'HH:mm', new Date(), { locale: it });
  if (isValid(time)) return time;
  
  // Prova formato H
  time = parse(cleanTime, 'H', new Date(), { locale: it });
  if (isValid(time)) return time;
  
  // In caso di fallimento, restituisci mezzogiorno come default
  const defaultTime = new Date();
  defaultTime.setHours(12, 0, 0, 0);
  return defaultTime;
};

// Funzione per ottenere il prossimo giorno della settimana
const getNextDayOfWeek = (date, dayOfWeek) => {
  const resultDate = new Date(date.getTime());
  resultDate.setDate(date.getDate() + (7 + dayOfWeek - date.getDay()) % 7);
  
  // Se la data risultante è oggi, aggiungi 7 giorni per ottenere la prossima settimana
  if (resultDate.toDateString() === date.toDateString()) {
    resultDate.setDate(resultDate.getDate() + 7);
  }
  
  return resultDate;
};