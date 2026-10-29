// Previsão do tempo para o Green Dot Assist (pedido do dono, 29/10/2026:
// "eu pergunto até previsão do tempo"). Fonte: Open-Meteo (grátis, sem chave).
// Aqui só o que é puro (testável): entender a pergunta e montar o texto.

const CODIGOS = [
  [[0], "céu limpo"], [[1, 2], "poucas nuvens"], [[3], "nublado"], [[45, 48], "neblina"],
  [[51, 53, 55, 56, 57], "garoa"], [[61, 63, 65, 66, 67, 80, 81, 82], "chuva"],
  [[71, 73, 75, 77, 85, 86], "neve"], [[95, 96, 99], "tempestade"],
];
export function descricaoDoTempo(codigo) {
  const c = Number(codigo);
  return (CODIGOS.find(([l]) => l.includes(c)) || [null, "tempo variável"])[1];
}

const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
export function ehPerguntaDoTempo(texto) {
  const t = norm(texto);
  return /previsao do tempo|\bclima\b|vai chover|chover|chuva|temperatura (de )?(hoje|amanha|la fora|na rua)|vai fazer (sol|frio|calor)|tempo (hoje|amanha)|como (esta|vai estar) o tempo/.test(t);
}
export function diaDaPergunta(texto) {
  const t = norm(texto);
  if (/depois de amanha/.test(t)) return 2;
  if (/amanha/.test(t)) return 1;
  return 0;
}

const NOME_DIA = ["Hoje", "Amanhã", "Depois de amanhã"];
const n0 = (v) => (v == null || !Number.isFinite(Number(v)) ? null : Math.round(Number(v)));

// previsao: resposta do Open-Meteo (daily + current). Sem dado: DADOS INSUFICIENTES.
export function textoDaPrevisao({ cidade, previsao, dia = 0 }) {
  const d = previsao?.daily;
  if (!d?.time?.length || d.time[dia] == null) return `DADOS INSUFICIENTES: não consegui a previsão${cidade ? ` de ${cidade}` : ""}.`;
  const max = n0(d.temperature_2m_max?.[dia]); const min = n0(d.temperature_2m_min?.[dia]);
  const chuva = n0(d.precipitation_probability_max?.[dia]);
  const partes = [`${NOME_DIA[dia] || d.time[dia]} em ${cidade}: ${descricaoDoTempo(d.weathercode?.[dia] ?? d.weather_code?.[dia])}`];
  if (max != null && min != null) partes.push(`entre ${min}°C e ${max}°C`);
  if (chuva != null) partes.push(`${chuva}% de chance de chuva`);
  const agora = dia === 0 ? n0(previsao?.current?.temperature_2m) : null;
  let texto = partes.join(", ") + ".";
  if (agora != null) texto += ` Agora faz ${agora}°C.`;
  if (chuva != null && chuva >= 60) texto += " Bom dia para reforçar o delivery e ter atenção à entrada molhada.";
  return texto + " (Fonte: Open-Meteo.)";
}
