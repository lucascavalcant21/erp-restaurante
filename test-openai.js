const fs = require('fs');

async function testOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY || "SUA_API_KEY_AQUI";
  
  console.log("Iniciando requisição para a OpenAI...");
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [{ role: "user", content: "Responda apenas 'OK' se estiver funcionando." }],
        max_tokens: 10
      })
    });
    
    const data = await res.json();
    console.log("Status:", res.status);
    console.log("Resposta:", JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Erro fatal:", err);
  }
}

testOpenAI();
