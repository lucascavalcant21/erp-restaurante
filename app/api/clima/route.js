// POST /api/clima — previsão do tempo da cidade da unidade (Open-Meteo, sem chave).
// Corpo: { cidade, uf?, dia? }. Só com sessão; nada do banco sai daqui.
import { NextResponse } from "next/server";
import { sessaoOuNegar } from "../../lib/server/sessao-rota.mjs";
import { textoDaPrevisao } from "../../lib/clima.mjs";

export const dynamic = "force-dynamic";

export async function POST(request) {
  const sessao = await sessaoOuNegar(request);
  if (sessao.resposta) return sessao.resposta;
  let corpo = {};
  try { corpo = await request.json(); } catch { /* corpo vazio */ }
  const cidade = String(corpo?.cidade || "").trim().slice(0, 80);
  const dia = Math.min(2, Math.max(0, Number(corpo?.dia) || 0));
  if (!cidade) return NextResponse.json({ texto: "DADOS INSUFICIENTES: a cidade da unidade não está cadastrada (Configurações → Dados da loja)." });
  try {
    const geo = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cidade)}&count=1&language=pt&countryCode=BR`, { cache: "no-store", signal: AbortSignal.timeout(6000) }).then((r) => r.json());
    const lugar = geo?.results?.[0];
    if (!lugar) return NextResponse.json({ texto: `DADOS INSUFICIENTES: não achei a cidade "${cidade}".` });
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lugar.latitude}&longitude=${lugar.longitude}&current=temperature_2m&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=America%2FSao_Paulo&forecast_days=3`;
    const previsao = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(6000) }).then((r) => r.json());
    return NextResponse.json({ texto: textoDaPrevisao({ cidade: lugar.name || cidade, previsao, dia }) });
  } catch {
    return NextResponse.json({ texto: "DADOS INSUFICIENTES: o serviço de previsão não respondeu agora. Tente de novo em instantes." });
  }
}
