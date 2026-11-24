// RH PELA CONVERSA (dono, 23/11/2026: "passar tudo isso para o Jhon"): lê do
// texto QUEM (nome de funcionário da unidade) e QUANDO (hoje, amanhã, sábado,
// dia 25, 25/11, de 25 a 27, por 3 dias). Puro e determinístico: o que não dá
// para ler com certeza fica vazio, e a ação pergunta.

const sem = (v) => String(v ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const p2 = (n) => String(n).padStart(2, "0");
const iso = (d) => `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())}`;
const dia = (s) => new Date(`${s}T12:00:00Z`);
export const somar = (s, n) => { const d = dia(s); d.setUTCDate(d.getUTCDate() + n); return iso(d); };

const PALAVRAS_COMUNS = new Set(["folga", "hoje", "amanha", "ontem", "dia", "dias", "para", "pra", "de", "da", "do", "a", "o", "e", "no", "na", "que", "esta", "doente", "atestado", "ponto", "feriado", "jhon", "nico", "sabado", "domingo", "segunda", "terca", "quarta", "quinta", "sexta"]);

/**
 * Funcionários citados pelo nome. Primeiro nome único basta; dois "Ana" → ambíguo.
 * @returns {{ ids: string[], ambiguos: {termo:string, opcoes:object[]}[] }}
 */
export function pessoasDoTexto(texto, colaboradores = []) {
  const palavras = sem(texto).replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter((w) => w.length >= 3 && !PALAVRAS_COMUNS.has(w));
  const ativos = colaboradores.filter((c) => (c.status || "ativo") === "ativo" && c.nome);
  const ids = [];
  const ambiguos = [];
  const usados = new Set();
  for (let i = 0; i < palavras.length; i++) {
    if (usados.has(i)) continue;
    const w = palavras[i];
    let achados = ativos.filter((c) => sem(c.nome).split(/\s+/)[0] === w);
    if (achados.length > 1 && palavras[i + 1]) {
      const dois = achados.filter((c) => sem(c.nome).split(/\s+/).slice(1).includes(palavras[i + 1]));
      if (dois.length) { achados = dois; usados.add(i + 1); }
    }
    if (!achados.length) achados = ativos.filter((c) => sem(c.nome).split(/\s+/).slice(1).includes(w) && w.length >= 4);
    if (achados.length === 1) { if (!ids.includes(achados[0].id)) ids.push(achados[0].id); }
    else if (achados.length > 1) ambiguos.push({ termo: w, opcoes: achados.map((c) => ({ id: c.id, nome: c.nome })) });
  }
  return { ids, ambiguos };
}

const SEMANA = { domingo: 0, segunda: 1, terca: 2, quarta: 3, quinta: 4, sexta: 5, sabado: 6 };
const NUM = { um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10, quinze: 15, vinte: 20, trinta: 30 };

function dataDoDia(n, hoje, mes = null, ano = null) {
  const [a, m] = hoje.split("-").map(Number);
  let alvoMes = mes || m;
  let alvoAno = ano || a;
  const tentar = (aa, mm) => { const d = new Date(Date.UTC(aa, mm - 1, n, 12)); return d.getUTCMonth() === mm - 1 ? iso(d) : null; };
  let r = tentar(alvoAno, alvoMes);
  // "dia 3" sem mês, já passado neste mês → próximo mês
  if (!mes && r && r < hoje) { alvoMes += 1; if (alvoMes > 12) { alvoMes = 1; alvoAno += 1; } r = tentar(alvoAno, alvoMes); }
  return r;
}

/**
 * Período citado. Sem data → { inicio: null }.
 * @returns {{ inicio: string|null, fim: string|null, dias: number|null }}
 */
export function periodoDoTexto(texto, hoje) {
  const t = ` ${sem(texto).replace(/[^a-z0-9/ ]+/g, " ").replace(/\s+/g, " ")} `;
  let inicio = null;
  let fim = null;
  let dias = null;

  const md = t.match(/\b(?:por|de|com)?\s*(\d{1,2}|um|uma|dois|duas|tres|quatro|cinco|seis|sete|oito|nove|dez|quinze|vinte|trinta)\s+dias?\b/);
  if (md) dias = Number(md[1]) || NUM[md[1]] || null;

  const intervalo = t.match(/\b(?:de|do dia|dia)\s+(\d{1,2})(?:\/(\d{1,2}))?\s+(?:a|ao|ate)\s+(?:dia\s+)?(\d{1,2})(?:\/(\d{1,2}))?\b/);
  if (intervalo) {
    const m2 = intervalo[4] ? Number(intervalo[4]) : intervalo[2] ? Number(intervalo[2]) : null;
    inicio = dataDoDia(Number(intervalo[1]), hoje, intervalo[2] ? Number(intervalo[2]) : m2);
    fim = dataDoDia(Number(intervalo[3]), hoje, m2 || (inicio ? Number(inicio.slice(5, 7)) : null));
    if (inicio && fim && fim < inicio) fim = null;
    return { inicio, fim: fim || inicio, dias: inicio && fim ? Math.round((dia(fim) - dia(inicio)) / 864e5) + 1 : dias };
  }

  // "de hoje a sexta", "de amanhã até domingo", "de segunda a quarta"
  const PONTO = "(hoje|amanha|segunda|terca|quarta|quinta|sexta|sabado|domingo)";
  const faixa = t.match(new RegExp(`\\b(?:de|desde)\\s+${PONTO}\\s+(?:a|ao|ate)\\s+(?:a\\s+|o\\s+)?${PONTO}\\b`));
  if (faixa) {
    const ponto = (w, desde) => {
      if (w === "hoje") return hoje;
      if (w === "amanha") return somar(hoje, 1);
      const delta = (SEMANA[w] - dia(desde).getUTCDay() + 7) % 7;
      return somar(desde, delta);
    };
    const ini = ponto(faixa[1], hoje);
    const f = ponto(faixa[2], ini);
    if (f >= ini) return { inicio: ini, fim: f, dias: Math.round((dia(f) - dia(ini)) / 864e5) + 1 };
  }

  // "dia 25 de dezembro", "8 de dezembro"
  const MESES_TXT = ["janeiro", "fevereiro", "marco", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  const comMes = t.match(new RegExp(`\\b(\\d{1,2})\\s+de\\s+(${MESES_TXT.join("|")})\\b`));
  if (comMes) inicio = dataDoDia(Number(comMes[1]), hoje, MESES_TXT.indexOf(comMes[2]) + 1);

  if (inicio) { /* dia com mês já lido */ } else if (/\bdepois de amanha\b/.test(t)) inicio = somar(hoje, 2);
  else if (/\bamanha\b/.test(t)) inicio = somar(hoje, 1);
  else if (/\banteontem\b/.test(t)) inicio = somar(hoje, -2);
  else if (/\bontem\b/.test(t)) inicio = somar(hoje, -1);
  else if (/\bhoje\b/.test(t)) inicio = hoje;
  if (!inicio) {
    const barra = t.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
    if (barra) {
      const ano = barra[3] ? (barra[3].length === 2 ? 2000 + Number(barra[3]) : Number(barra[3])) : null;
      inicio = dataDoDia(Number(barra[1]), hoje, Number(barra[2]), ano);
    }
  }
  if (!inicio) {
    const d = t.match(/\bdia\s+(\d{1,2})\b/);
    if (d) inicio = dataDoDia(Number(d[1]), hoje);
  }
  if (!inicio) {
    const w = t.match(/\b(domingo|segunda|terca|quarta|quinta|sexta|sabado)\b/);
    if (w) {
      const alvo = SEMANA[w[1]];
      const atual = dia(hoje).getUTCDay();
      let delta = (alvo - atual + 7) % 7;
      if (delta === 0 && /\b(proximo|proxima|que vem)\b/.test(t)) delta = 7;
      inicio = somar(hoje, delta);
    }
  }
  if (inicio && dias) fim = somar(inicio, dias - 1);
  return { inicio, fim: inicio ? fim || inicio : null, dias: inicio && fim ? dias : (inicio ? 1 : dias) };
}

/** "feriado da padroeira dia 8" → "Padroeira"; sem nome → null. */
export function nomeDoFeriado(texto) {
  const m = String(texto || "").match(/feriado\s+(?:de|do|da|dos|das)\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ ]{2,60}?)(?=\s+(?:no|na|dia|em|amanh|hoje|\d)|[.,!?]|$)/i);
  if (!m) return null;
  const nome = m[1].trim().replace(/\s+/g, " ");
  return nome.charAt(0).toUpperCase() + nome.slice(1);
}

export const dataCurtaBR = (s) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}` : "");
export const diaDaSemanaBR = (s) => dia(s).toLocaleDateString("pt-BR", { weekday: "long", timeZone: "UTC" });
export const hojeEmSP = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
