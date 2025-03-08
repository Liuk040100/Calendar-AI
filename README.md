# Calendar AI

Calendar AI è un assistente intelligente per la gestione degli appuntamenti che si integra con Google Calendar. L'applicazione permette di inserire e visualizzare appuntamenti tramite comandi testuali in linguaggio naturale.

## Caratteristiche

- Interfaccia PWA (Progressive Web App) per l'utilizzo su qualsiasi dispositivo
- Autenticazione tramite Google OAuth 2.0
- Integrazione con Google Calendar API
- Parser di comandi in linguaggio naturale
- Architettura modulare per future espansioni

## Prerequisiti

- Node.js (versione 16 o superiore)
- npm (incluso con Node.js)
- Un account Google e un progetto nella Google Cloud Console con Calendar API abilitata

## Configurazione

1. Clona il repository
2. Esegui `npm install` per installare le dipendenze
3. Crea un progetto nella [Google Cloud Console](https://console.cloud.google.com/)
4. Abilita l'API di Google Calendar
5. Configura le credenziali OAuth 2.0
6. Copia il Client ID e l'API Key nel file `.env`

## Sviluppo

```bash
# Avvia il server di sviluppo
npm run dev
```

## Build per la produzione

```bash
# Compila il progetto per la produzione
npm run build

# Prova la build di produzione localmente
npm run preview
```

## Struttura del progetto

```
calendar-ai/
├── public/                 # File statici pubblici
│   ├── icons/              # Icone per PWA
│   └── manifest.json       # Manifest per PWA
├── src/                    # Codice sorgente
│   ├── assets/             # Risorse (immagini, font, ecc.)
│   ├── components/         # Componenti React riutilizzabili
│   ├── services/           # Servizi per logica di business
│   │   ├── auth/           # Gestione autenticazione
│   │   ├── calendar/       # Operazioni su Google Calendar
│   │   └── parser/         # Parser dei comandi testuali
│   ├── views/              # Pagine/viste dell'applicazione
│   ├── App.jsx             # Componente principale
│   ├── App.css             # Stili per App.jsx
│   ├── main.jsx            # Punto di ingresso
│   └── index.css           # Stili globali
├── .env                    # Variabili d'ambiente
├── package.json            # Dipendenze e script npm
├── vite.config.js          # Configurazione di Vite
└── README.md               # Documentazione
```

## Licenza

MIT