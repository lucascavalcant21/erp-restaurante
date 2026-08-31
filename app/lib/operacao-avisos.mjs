// O que precisa de cobrança agora, e a mensagem pronta para cobrar.
//
// O QUE ISTO É E O QUE NÃO É
// Não envia nada sozinho. O WhatsApp aqui é `wa.me` com o texto montado — o
// mesmo caminho dos outros módulos, porque a casa não tem API do WhatsApp
// Business. A automação é a DETECÇÃO e o TEXTO: o sistema diz quem cobrar, por
// quê, e já escreve; quem aperta é uma pessoa.
//
// Chamar isso de "envio automático" seria mentira, e mentira em cobrança de
// equipe custa caro: o gerente confiaria que o aviso saiu e ninguém receberia.
import { statusDaExecucao } from "./operacao-agenda.mjs";

// Rotina crítica que ainda não começou e vence logo: vale o empurrão antes de
// virar atraso. Menos que isso vira alarme falso o dia inteiro.
export const MINUTOS_PARA_AVISAR_ANTES = 30;

const hhmm = (iso) => (iso
  ? new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
  : "--:--");

/** Link do WhatsApp com a mensagem pronta. null quando não há telefone. */
export function linkWhatsApp(telefone, mensagem) {
  const dig = String(telefone || "").replace(/\D/g, "");
  if (!dig) return null;
  // Número já com DDI passa direto; sem DDI recebe o 55 do Brasil.
  const num = dig.length >= 12 ? dig : `55${dig}`;
  return `https://wa.me/${num}?text=${encodeURIComponent(mensagem)}`;
}

function pessoaDaExecucao(execucao, porId) {
  if (!execucao?.responsavel_id) return null;
  const c = porId.get(execucao.responsavel_id);
  return {
    id: execucao.responsavel_id,
    nome: c?.nome || execucao.responsavel_nome || "Responsável",
    telefone: c?.telefone || "",
  };
}

/**
 * Avisos da operação agora.
 *
 * A ordem é por gravidade e depois por horário: quem olha isso está com pressa
 * e resolve de cima para baixo.
 */
export function avisosDaOperacao({ execucoes = [], ncs = [], colaboradores = [], agora = new Date() } = {}) {
  const porId = new Map((colaboradores || []).filter(Boolean).map(c => [c.id, c]));
  const avisos = [];

  for (const bruta of execucoes || []) {
    if (!bruta) continue;
    const e = { ...bruta, status: statusDaExecucao(bruta, agora) };
    const nome = e.processo?.nome || "Rotina";
    const critica = String(e.processo?.criticidade || "").toUpperCase() === "ALTA";
    const pessoa = pessoaDaExecucao(e, porId);

    if (e.status === "ATRASADA") {
      // Duas situações bem diferentes com o mesmo status: quem começou e parou
      // no meio tem a quem cobrar; o que ninguém tocou é problema de escala.
      if (pessoa) {
        avisos.push({
          chave: `atraso:${e.id}`,
          gravidade: critica ? "critico" : "atencao",
          titulo: `${nome} está atrasada`,
          detalhe: `Começou com ${pessoa.nome} e não foi concluída. Prazo era ${hhmm(e.prazo_ate)}.`,
          pessoa,
          mensagem: `Oi, ${pessoa.nome}. A rotina "${nome}" venceu às ${hhmm(e.prazo_ate)} e ainda está aberta. Consegue fechar agora?`,
        });
      } else {
        avisos.push({
          chave: `orfa:${e.id}`,
          gravidade: critica ? "critico" : "atencao",
          titulo: `${nome} venceu e ninguém iniciou`,
          detalhe: `Prazo era ${hhmm(e.prazo_ate)}. Sem responsável, não há a quem cobrar — é escala.`,
          pessoa: null,
          mensagem: `A rotina "${nome}" venceu às ${hhmm(e.prazo_ate)} e ninguém iniciou. Quem consegue assumir?`,
        });
      }
      continue;
    }

    // Aviso preventivo: só para rotina crítica, só quando ainda dá tempo.
    if (critica && (e.status === "AGENDADA" || e.status === "DISPONIVEL")) {
      const prazo = e.prazo_ate ? new Date(e.prazo_ate).getTime() : null;
      if (prazo) {
        const faltam = Math.round((prazo - agora.getTime()) / 60000);
        if (faltam > 0 && faltam <= MINUTOS_PARA_AVISAR_ANTES) {
          avisos.push({
            chave: `vencendo:${e.id}`,
            gravidade: "atencao",
            titulo: `${nome} vence em ${faltam} min`,
            detalhe: `Rotina crítica, ainda não concluída. Prazo ${hhmm(e.prazo_ate)}.`,
            pessoa,
            mensagem: pessoa
              ? `Oi, ${pessoa.nome}. A rotina "${nome}" vence às ${hhmm(e.prazo_ate)}, faltam ${faltam} min.`
              : `A rotina "${nome}" vence às ${hhmm(e.prazo_ate)}, faltam ${faltam} min, e ninguém iniciou.`,
          });
        }
      }
    }
  }

  for (const nc of ncs || []) {
    if (!nc) continue;
    const grave = String(nc.gravidade || nc.criticidade || "").toUpperCase();
    const critica = grave === "ALTA" || grave === "CRITICA" || nc.critica === true;
    const responsavel = nc.responsavel_id ? porId.get(nc.responsavel_id) : null;
    avisos.push({
      chave: `nc:${nc.id}`,
      gravidade: critica ? "critico" : "atencao",
      titulo: critica ? "Não conformidade crítica aberta" : "Não conformidade aberta",
      detalhe: nc.titulo || nc.descricao || "Sem descrição.",
      pessoa: responsavel
        ? { id: responsavel.id, nome: responsavel.nome, telefone: responsavel.telefone || "" }
        : null,
      mensagem: `Não conformidade aberta: ${nc.titulo || nc.descricao || "sem descrição"}. Precisa de ação corretiva.`,
    });
  }

  const peso = { critico: 0, atencao: 1 };
  return avisos.sort((a, b) =>
    (peso[a.gravidade] ?? 9) - (peso[b.gravidade] ?? 9)
    || String(a.titulo).localeCompare(String(b.titulo), "pt-BR"));
}
