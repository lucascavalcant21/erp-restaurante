import fs from "fs";

async function test() {
  const baseUrl = "https://erp-restaurante-18fmkud7n-lucas-cavalcante.vercel.app/api/channels/whatsapp/webhook";

  console.log("=== TESTE 1: GET SIMPLES SEM PARAMETROS ===");
  const res1 = await fetch(baseUrl);
  console.log("Status HTTP GET simples:", res1.status);
  const json1 = await res1.json().catch(() => null);
  console.log("Body JSON:", json1);

  let verifyToken = "hefisto_verify_token";
  try {
    const envFile = fs.readFileSync(".vercel/.env.preview.local", "utf8");
    const match = envFile.match(/WHATSAPP_VERIFY_TOKEN="([^"]*)"/);
    if (match && match[1] && match[1].trim().length > 0) {
      verifyToken = match[1].trim();
    }
  } catch (e) {}

  console.log("\n=== TESTE 2: GET CHALLENGE COM TOKEN DO AMBIENTE ===");
  const challengeUrl = `${baseUrl}?hub.mode=subscribe&hub.verify_token=${encodeURIComponent(verifyToken)}&hub.challenge=HEFISTO_TESTE_123`;
  const res2 = await fetch(challengeUrl);
  console.log("Status HTTP Challenge:", res2.status);
  const text2 = await res2.text();
  console.log("Body Challenge:", text2);
}

test();
