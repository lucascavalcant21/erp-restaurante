// "Jhon, vamos organizar a nossa tela" (dono, 17/11/2026): o Jhon diz como
// está a vitrine de cada app no Organizador de plataforma (o que falta: foto,
// descrição, preço) e explica como mandar os prints da tela do app. Só leitura;
// gravar é a ação platform.screen (prévia e confirmação).

import { NIVEL } from "../core/niveis.mjs";
import { ler } from "../context/db-escopado.mjs";
import { MAX_PRINTS } from "../../marmitaria/concorrentes.mjs";
import { CHAVE_PARAMS, normalizarOrganizador, resumoDaVitrine, rotuloPlataforma } from "../../marmitaria/organizador.mjs";
import { ROTA_ORGANIZADOR } from "../actions/organizar-vitrine.mjs";

const r = (texto, blocos = [], acoes = []) => ({ texto, blocos, acoes, natureza: "REAL", nivel: NIVEL.OBSERVAR, agentes: ["operacoes"] });

export const TEXTO_COMO_MONTAR = `Para eu montar, toque no + ao lado do campo de mensagem, escolha "Tela da plataforma" e mande os prints da tela do app (até ${MAX_PRINTS} de cada vez). Eu leio categoria, nome, descrição, preço e preço com cupom, te mostro e, quando você confirmar, ponho no Organizador. Lá você põe as fotos e copia cada campo para a plataforma.`;

export const HANDLERS_ORGANIZADOR = {
  async "marmitaria.organizador"({ motor }) {
    const amb = motor.ambiente;
    if (!(await amb.verificador.pode("organizador_ver"))) return r("Você não tem acesso ao Organizador de plataforma desta unidade.");
    const linhas = await ler(amb.dbe.from("config_sistema").select("params").limit(1), "config_sistema").catch((e) => { if (e?.name === "ErroDeIsolamento") throw e; return null; });
    const org = normalizarOrganizador(linhas?.[0]?.params?.[CHAVE_PARAMS]);
    const apps = Object.entries(org.plataformas).filter(([, v]) => v.categorias.length);
    const podeGravar = await amb.verificador.pode("organizador_gravar");
    const acoes = [{ rotulo: "Abrir o organizador", rota: ROTA_ORGANIZADOR }];
    if (!apps.length) {
      return { ...r(`Vamos lá. A vitrine ainda está vazia. ${podeGravar ? TEXTO_COMO_MONTAR : "Peça ao dono para montar a vitrine."} Se preferir, abra o Organizador e toque em "Puxar nossas marmitas".`, [], acoes), sugestoes: [] };
    }
    const itens = apps.map(([id, v]) => {
      const res = resumoDaVitrine(v);
      return { rotulo: rotuloPlataforma(id), valor: res.texto };
    });
    const faltando = apps.flatMap(([id, v]) => {
      const res = resumoDaVitrine(v);
      return [...res.semPreco.map((i) => `${i.nome} (${rotuloPlataforma(id)}): sem preço`), ...res.semFoto.map((i) => `${i.nome} (${rotuloPlataforma(id)}): sem foto`)];
    });
    const blocos = [{ tipo: "lista", titulo: "Vitrines", itens }];
    if (faltando.length) blocos.push({ tipo: "lista", titulo: "O que falta", itens: faltando.slice(0, 12).map((t) => ({ rotulo: t })) });
    return {
      ...r(`Assim está a nossa vitrine. ${podeGravar ? TEXTO_COMO_MONTAR : ""}`.trim(), blocos, acoes),
      sugestoes: [],
    };
  },
};
