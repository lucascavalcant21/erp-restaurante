// "Jhon, minha lista de compras para hoje é…" e "Jhon, comprei tudo, faltou
// isso" (dono, 14/11/2026). Só leitura aqui: o servidor monta e confere; quem
// salva a lista e abre o WhatsApp é a tela, depois do toque do dono. Preço,
// estoque e conta a pagar entram pela foto da nota (purchase.fromInvoice).
import { NIVEL } from "../core/niveis.mjs";
import { temValor } from "../core/contratos.mjs";
import { ler } from "../context/db-escopado.mjs";
import { CAMPOS_INSUMO, candidatosDoTermo, normalizar } from "../metrics/produtos.mjs";
import { interpretarLista, casarComCadastro, sugestoesDoMinimo, aplicarCompra, proximaLista } from "../../lista-compras.mjs";

const r = (texto, blocos = [], acoes = []) => ({ texto, blocos, acoes, nivel: NIVEL.OBSERVAR });
const COMANDO_NOTA = "Vou mandar a foto da danfe";

async function listaSalva(dbe) {
  try {
    const cfg = await Promise.resolve(dbe.from("config_sistema").select("params").limit(1));
    return cfg?.data?.[0]?.params?.lista_compras || null;
  } catch (e) {
    if (e?.name === "ErroDeIsolamento") throw e;
    return null;
  }
}

/** O produto do cadastro que é o item da lista, só quando não há dúvida. */
export function casarNoCadastro(insumos, nome) {
  const c = candidatosDoTermo(insumos, nome, 3);
  if (c.length === 1) return c[0];
  const alvo = normalizar(nome).replace(/s\b/g, "");
  return c.find((i) => normalizar(i.nome).replace(/s\b/g, "").startsWith(alvo)) || null;
}

export const HANDLERS_LISTA_COMPRAS = {
  async "compras.lista_montar"({ motor, params }) {
    const itens = interpretarLista(params.texto);
    if (!itens.length) {
      return { ...r("Qual é a lista?"), pergunta: { campo: "lista", livre: true, texto: "Me diga o que comprar, separado por vírgula. Ex.: 10 kg de arroz, 5 kg de feijão, alface.", comandoBase: "Lista de compras: {valor}" } };
    }
    const dbe = motor.ambiente.dbe;
    const [insumos, anterior, minimo] = await Promise.all([
      ler(dbe.from("insumos").select(CAMPOS_INSUMO).limit(3000), "insumos").catch(() => []),
      listaSalva(dbe),
      motor.getLowStock().catch(() => null),
    ]);
    const lista = casarComCadastro(itens, (n) => casarNoCadastro(insumos || [], n));
    // o que faltou na última compra volta, se não foi repetido agora
    const nomes = new Set(lista.map((i) => normalizar(i.nomeCadastro || i.nome)));
    const voltaram = proximaLista(anterior?.itens).filter((i) => !nomes.has(normalizar(i.nomeCadastro || i.nome)))
      .map((i, k) => ({ ...i, id: `v${k + 1}` }));
    const todos = [...lista, ...voltaram];
    const abaixo = temValor(minimo) ? minimo.detalhes.lista : [];
    const sugestoes = sugestoesDoMinimo(todos, abaixo);
    const semCadastro = todos.filter((i) => !i.insumoId).length;
    const texto = [
      `Montei a lista com ${todos.length} ${todos.length === 1 ? "item" : "itens"}.`,
      voltaram.length ? `Voltaram da última compra (faltaram): ${voltaram.map((i) => i.nomeCadastro || i.nome).join(", ")}.` : null,
      sugestoes.length ? `Também está abaixo do mínimo no estoque: ${sugestoes.map((s) => s.produto).join(", ")}.` : null,
      semCadastro ? `${semCadastro} ${semCadastro === 1 ? "item não está" : "itens não estão"} no cadastro de ingredientes: entram na lista como você escreveu.` : null,
      "Confira e toque em Salvar e mandar no WhatsApp.",
    ].filter(Boolean).join(" ");
    return r(texto, [{
      tipo: "lista_compras", data: motor.ambiente.hoje, itens: todos, sugestoes,
      comprador: anterior?.comprador || null,
    }]);
  },

  async "compras.lista_comprei"({ motor, params }) {
    const salva = await listaSalva(motor.ambiente.dbe);
    const pendentes = (salva?.itens || []).filter((i) => i.status === "pendente");
    if (!pendentes.length) {
      return {
        ...r("Não tenho uma lista de compras em aberto para conferir. Para lançar a compra com preço, estoque e conta a pagar, mande a foto da nota."),
        pergunta: { campo: "proximo", texto: "O que você quer fazer?", opcoes: [
          { id: "nota", rotulo: "Mandar a foto da nota", comando: COMANDO_NOTA },
          { id: "lista", rotulo: "Montar uma lista", comando: "Lista de compras" },
        ] },
      };
    }
    const c = aplicarCompra(salva.itens, params.texto);
    const nome = (i) => i.nomeCadastro || i.nome;
    const texto = [
      c.vieram.length ? `Veio: ${c.vieram.map(nome).join(", ")}.` : "Nada da lista foi comprado.",
      c.faltaram.length ? `Faltou: ${c.faltaram.map(nome).join(", ")}. Isso volta na próxima lista.` : null,
      c.naoAchou ? `"${c.naoAchou}" não está na lista; considerei que o resto veio.` : null,
      c.vieram.length ? "Para dar entrada no estoque com o preço e gerar a conta a pagar, mande a foto da nota ou do cupom." : null,
    ].filter(Boolean).join(" ");
    return {
      ...r(texto, [{ tipo: "lista_compras_conferencia", data: salva.data, lista: c.lista, vieram: c.vieram, faltaram: c.faltaram, comprador: salva.comprador || null }]),
      pergunta: c.vieram.length ? { campo: "proximo", texto: "Lançar a compra agora?", opcoes: [{ id: "nota", rotulo: "Mandar a foto da nota", comando: COMANDO_NOTA }] } : undefined,
    };
  },
};
