// Test della connessione all'API Gemini
// Salva questo file nella cartella principale e eseguilo con Node.js
// $ node gemini-test.js

const apiKey = process.env.VITE_GEMINI_API_KEY || "YOUR_API_KEY_HERE"; // Sostituisci con la tua API key
const endpoint = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

async function testGeminiAPI() {
  console.log("🚀 Avvio test API Gemini...");
  console.log(`🔑 API Key: ${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}`);
  
  const prompt = `Analizza il comando in italiano: "Aggiungi una riunione domani dalle 11 alle 13"
  Rispondi solo con un JSON semplice { "intent": "create", "title": "riunione", "date": "2025-03-10" }`;
  
  try {
    console.log("📡 Invio richiesta all'API Gemini...");
    const response = await fetch(`${endpoint}?key=${apiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 1024
        }
      })
    });
    
    console.log(`📥 Risposta ricevuta: Status ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error("❌ Errore API:", errorData);
      console.error("Dettagli errore:", JSON.stringify(errorData, null, 2));
      return;
    }
    
    const data = await response.json();
    console.log("✅ Risposta valida!");
    console.log("📄 Contenuto risposta:", JSON.stringify(data, null, 2));
    
    const text = data.candidates[0]?.content?.parts[0]?.text;
    console.log("\n📝 Testo estratto:");
    console.log(text);
    
  } catch (error) {
    console.error("❌ Errore durante la chiamata API:", error);
  }
}

testGeminiAPI();