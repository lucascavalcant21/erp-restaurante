// FOLHA DA FICHA — "como faz a caipirinha?" responde como os cartazes de drink
// da casa: título, ingredientes com quantidade, COPO · GELO · MÉTODO · GUARNIÇÃO
// (ou RENDE · PORÇÃO · TEMPO · SERVIR na cozinha), preparo e montagem passo a
// passo e a dica. Tudo sai do que está cadastrado — ficha técnica, etapas,
// passos de montagem e a tela de Montagem. Campo vazio NÃO é preenchido com
// palpite: vai para "Falta cadastrar" para alguém completar a ficha.
//
// Funções puras (sem banco): testadas em __tests__/folha-ficha.test.mjs.

const limpo = (v) => String(v ?? "").replace(/\s+/g, " ").trim();
const semAcento = (v) => String(v || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

const NUMERADO = /^\s*(\d{1,2})\s*[.):º°-]+\s*/; // "1." "1:" "2)" "3 -"
const DETALHE = /^\s*[•·*-]\s*/;               // "   • Panela de fundo grosso · Fogo médio"

/**
 * Texto livre do modo de preparo → passos numerados. Respeita a numeração de
 * quem escreveu; linhas com "•" viram detalhe do passo anterior; texto corrido
 * sem numeração é dividido por frase. Não reescreve nem corrige o texto.
 * @returns {{ texto: string, detalhe: string|null }[]}
 */
export function passosDoTexto(texto) {
  const linhas = String(texto || "").split(/\r?\n/).map((l) => l.trimEnd()).filter((l) => l.trim());
  if (!linhas.length) return [];
  const temNumero = linhas.some((l) => NUMERADO.test(l));
  if (!temNumero && linhas.length === 1) {
    return limpo(linhas[0]).split(/(?<=[.!])\s+(?=[A-ZÁÉÍÓÚÂÊÔÃÕÇ])/).map((t) => t.trim()).filter((t) => t.length > 1).map((t) => ({ texto: t, detalhe: null }));
  }
  const passos = [];
  for (const l of linhas) {
    if (DETALHE.test(l) && passos.length) {
      const d = limpo(l.replace(DETALHE, ""));
      const p = passos[passos.length - 1];
      if (d) p.detalhe = p.detalhe ? `${p.detalhe} · ${d}` : d;
      continue;
    }
    const t = limpo(l.replace(NUMERADO, "").replace(DETALHE, ""));
    if (!t) continue; // "3. " sem texto: passo vazio não aparece
    passos.push({ texto: t, detalhe: null });
  }
  return passos;
}

/**
 * Descritivo da tela de Montagem → passos. Ali o texto mistura a lista
 * "Ingredientes:\n• Gin: 30 ml" (já está na ficha) com o passo a passo de
 * montar o prato ("350g arroz paraense\n8 camarões em volta"). Fica só o passo
 * a passo; a primeira linha some quando é só o nome do prato.
 */
export function passosDaMontagem(descritivo, nome = "") {
  const linhas = String(descritivo || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const out = [];
  let naLista = false;
  for (const [i, l] of linhas.entries()) {
    if (/^ingredientes\s*:?$/i.test(l)) { naLista = true; continue; }
    if (naLista && DETALHE.test(l)) continue;
    naLista = false;
    if (i === 0 && semAcento(l) === semAcento(nome)) continue;
    const t = limpo(l.replace(NUMERADO, "").replace(DETALHE, ""));
    if (t) out.push({ texto: t, detalhe: null });
  }
  return out;
}

/** Passos de montagem gravados na ficha (tabela de passos ou a lista da própria ficha). */
export function passosGravados(tabela = [], sequencia = null) {
  const daTabela = [...(tabela || [])].sort((a, b) => Number(a.ordem) - Number(b.ordem)).map((p) => limpo(p.descricao));
  let lista = sequencia;
  if (typeof lista === "string") { try { lista = JSON.parse(lista); } catch { lista = []; } }
  const daFicha = Array.isArray(lista) ? lista.map((p) => limpo(typeof p === "string" ? p : p?.descricao || p?.texto || "")) : [];
  return (daTabela.filter(Boolean).length ? daTabela : daFicha).filter(Boolean).map((t) => ({ texto: t, detalhe: null }));
}

/** Copo e gelo que a equipe salvou na tela de Montagem (camadas do copo). */
export function servicoDaMontagem(estrutura) {
  let e = estrutura;
  if (typeof e === "string") { try { e = JSON.parse(e); } catch { e = null; } }
  if (!Array.isArray(e)) return { copo: null, gelo: null };
  const copo = e.find((x) => x?.tipo === "copo" && limpo(x.nome));
  const gelo = e.find((x) => /\bgelo\b/i.test(String(x?.nome || "")));
  return { copo: copo ? limpo(copo.nome) : null, gelo: gelo ? limpo(gelo.nome) : null };
}

const MAX_FOTO_EMBUTIDA = 700_000; // ~500 KB de imagem: foto de ficha salva direto no banco
const ASSINATURA = { "/9j/": "image/jpeg", iVBORw0KGgo: "image/png", UklGR: "image/webp" };

/**
 * Só foto que o navegador abre com segurança: endereço https, ou JPEG/PNG/WebP
 * salvo em base64 na ficha (vira data:image/...). Nunca javascript:, SVG ou http.
 */
export function fotoSegura(...urls) {
  for (const u of urls) {
    const s = String(u || "").trim();
    if (/^https:\/\/[^\s"'<>]+$/i.test(s)) return s;
    const m = s.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
    const corpo = m ? m[2] : s;
    const tipo = m ? m[1] : Object.entries(ASSINATURA).find(([k]) => s.startsWith(k))?.[1];
    if (tipo && corpo.length <= MAX_FOTO_EMBUTIDA && /^[A-Za-z0-9+/]+={0,2}$/.test(corpo)) return `data:${tipo};base64,${corpo}`;
  }
  return null;
}

const minutos = (n) => (Number(n) > 0 ? `${Number(n)} min` : null);

/**
 * Monta a folha. `ficha` já traz os campos da ficha técnica; `montagem` é a
 * linha da tela de Montagem com o mesmo nome (ou null).
 * @returns {object} folha — nada inventado; faltando[] diz o que completar
 */
export function montarFolha({ ficha, ingredientes = [], etapas = [], passosMontagem = [], montagem = null, fotoCardapio = null }) {
  const tipo = ficha.departamento === "bar" ? "drink" : ficha.eh_base ? "base" : "prato";
  const preparo = etapas.length
    ? etapas.map((e) => ({ texto: limpo(e.instrucao || e.titulo), detalhe: [e.tempoMin ? `${e.tempoMin} min` : null, e.temperatura, e.equipamento].filter(Boolean).join(" · ") || null })).filter((p) => p.texto)
    : passosDoTexto(ficha.modo_preparo);
  const montar = passosMontagem.length ? passosMontagem : passosDaMontagem(montagem?.descritivo, ficha.nome);
  const daMontagem = servicoDaMontagem(montagem?.estrutura_ia);
  const faltando = [];
  if (!ingredientes.length) faltando.push("ingredientes");
  if (!preparo.length && !(tipo === "drink" && montar.length)) faltando.push("modo de preparo");
  if (tipo !== "base" && !montar.length) faltando.push("montagem");

  let servico;
  if (tipo === "drink") {
    servico = [
      { id: "copo", rotulo: "Copo", valor: limpo(ficha.copo) || daMontagem.copo },
      { id: "gelo", rotulo: "Gelo", valor: limpo(ficha.tipo_gelo) || daMontagem.gelo },
      { id: "metodo", rotulo: "Método", valor: limpo(ficha.metodo_bar) || null },
      { id: "guarnicao", rotulo: "Guarnição", valor: limpo(ficha.guarnicao) || null },
    ];
    for (const s of servico) if (!s.valor) faltando.push(s.rotulo.toLowerCase());
  } else {
    const rende = Number(ficha.rendimento_porcoes) > 0 ? `${String(ficha.rendimento_porcoes).replace(".", ",")} ${ficha.rendimento_unidade || "porções"}` : limpo(montagem?.rendimento) || null;
    servico = [
      { id: "rende", rotulo: "Rende", valor: rende },
      { id: "porcao", rotulo: "Porção", valor: Number(ficha.peso_porcao_g) > 0 ? `${ficha.peso_porcao_g} g` : null },
      { id: "tempo", rotulo: "Tempo", valor: [minutos(ficha.tempo_preparo) || minutos(montagem?.tempo_preparo), ficha.tempo_coccao_min ? `+ ${ficha.tempo_coccao_min} min de cocção` : null].filter(Boolean).join(" ") || null },
      tipo === "base"
        ? { id: "validade", rotulo: "Validade", valor: ficha.validade_dias ? `${ficha.validade_dias} dia(s)` : null }
        : { id: "servir", rotulo: "Servir", valor: limpo(ficha.temperatura_servico) || null },
    ];
    if (!servico[0].valor) faltando.push("rendimento");
  }
  const obsMontagem = limpo(montagem?.observacoes);
  const dica = [limpo(ficha.observacoes), /criado automaticamente/i.test(obsMontagem) ? "" : obsMontagem].filter(Boolean).join(" ") || null;

  return {
    fichaId: ficha.id,
    nome: limpo(ficha.nome_comercial) || limpo(ficha.nome_receita),
    tipo,
    descricao: limpo(ficha.descricao_comercial) || null,
    foto: fotoSegura(ficha.imagem, ficha.montagem_foto, montagem?.foto_url, fotoCardapio),
    ingredientes: ingredientes.map((i) => ({ nome: i.nome, quantidade: i.quantidade })),
    servico,
    preparo,
    montagem: montar,
    alergenicos: limpo(ficha.alergenicos_pode_conter) || null,
    dica,
    faltando: [...new Set(faltando)],
  };
}
