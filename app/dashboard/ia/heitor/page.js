"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Brain, Send, Cpu, Sparkles, Mic, MicOff, Volume2, VolumeX, CheckCircle2, XCircle } from "lucide-react";
import { useERP } from "../../../context/ERPContext";
import { salvarInsumo } from "../../../lib/operacao";
import { registrarMovimentoEstoque } from "../../../lib/estoque";

function fmtBRL(v) { return Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }

const SUGESTOES = [
  "Abra a página de estoque",
  "Cadastrar ingrediente tomate, unidade kg, setor cozinha",
  "Adicionar 5 kg de tomate no estoque",
  "Tem algum estoque crítico?",
  "Quais são as prioridades de hoje?",
];

const DESTINOS = [
  { termos: ["painel", "dashboard", "inicio", "início"], rota: "/dashboard", nome: "Painel" },
  { termos: ["vendas", "pdv", "caixa"], rota: "/dashboard/vendas", nome: "Vendas" },
  { termos: ["mesas", "salao", "salão"], rota: "/dashboard/mesas", nome: "Mesas" },
  { termos: ["estoque"], rota: "/dashboard/operacao/estoque", nome: "Estoque" },
  { termos: ["ingredientes", "ingrediente"], rota: "/dashboard/operacao/ingredientes", nome: "Ingredientes" },
  { termos: ["cardapio", "cardápio", "catalogo", "catálogo"], rota: "/dashboard/operacao/cardapio", nome: "Cardápio" },
  { termos: ["fichas tecnicas", "fichas técnicas", "fichas"], rota: "/dashboard/operacao/fichas", nome: "Fichas Técnicas" },
  { termos: ["fornecedores", "fornecedor"], rota: "/dashboard/operacao/fornecedores", nome: "Fornecedores" },
  { termos: ["compras", "lista de compras"], rota: "/dashboard/operacao/compras", nome: "Compras" },
  { termos: ["producao", "produção"], rota: "/dashboard/operacao/producao", nome: "Produção" },
  { termos: ["financeiro", "financas", "finanças"], rota: "/dashboard/modulo/financeiro", nome: "Financeiro" },
  { termos: ["dre"], rota: "/dashboard/financeiro/dre", nome: "DRE" },
  { termos: ["fluxo de caixa", "fluxo"], rota: "/dashboard/financeiro/fluxo", nome: "Fluxo de Caixa" },
  { termos: ["rh", "recursos humanos"], rota: "/dashboard/modulo/rh", nome: "RH" },
  { termos: ["banco de talentos", "recrutamento", "candidatos"], rota: "/dashboard/rh/recrutamento", nome: "Banco de Talentos" },
  { termos: ["funcionarios", "funcionários", "equipe"], rota: "/dashboard/rh/gestao", nome: "Gestão de Equipe" },
  { termos: ["notificacoes", "notificações", "alertas"], rota: "/dashboard/notificacoes", nome: "Notificações" },
  { termos: ["configuracoes", "configurações"], rota: "/dashboard/configuracoes", nome: "Configurações" },
];

function normalizar(texto) {
  return String(texto || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function numeroDoTexto(texto) {
  const match = String(texto || "").match(/(\d+(?:[.,]\d+)?)/);
  return match ? Number(match[1].replace(",", ".")) : null;
}

function unidadeDoTexto(texto) {
  const t = normalizar(texto);
  if (/\b(kg|quilo|quilos|quilograma)\b/.test(t)) return "kg";
  if (/\b(l|litro|litros)\b/.test(t)) return "l";
  if (/\b(ml|mililitro|mililitros)\b/.test(t)) return "ml";
  if (/\b(g|grama|gramas)\b/.test(t)) return "g";
  if (/\b(cx|caixa|caixas)\b/.test(t)) return "cx";
  return "un";
}

function nomeDoMovimento(texto) {
  const t = normalizar(texto);
  const porDe = t.match(/\b(?:de|do|da)\s+(.+?)(?:\s+(?:no|na|do|da|para o|para a)\s+estoque|\s+em estoque|$)/);
  if (porDe?.[1]) return porDe[1].trim();
  return t
    .replace(/\b(adicionar|adiciona|colocar|coloque|dar entrada|entrada|repor|retirar|retire|remover|remova|dar baixa|baixa|sair|saida)\b/g, "")
    .replace(/\b(no|na|do|da|para o|para a|em)\s+estoque\b/g, "")
    .replace(/\d+(?:[.,]\d+)?/g, "")
    .replace(/\b(kg|quilo|quilos|l|litro|litros|ml|g|grama|gramas|unidade|unidades|caixa|caixas|cx)\b/g, "")
    .trim();
}

function analisarComando(texto) {
  const t = normalizar(texto);
  const destino = DESTINOS.find(item => item.termos.some(termo => t.includes(normalizar(termo))));
  if (destino && /\b(abra|abrir|va|vai|ir|mostre|mostrar|acesse|entrar|navegue)\b/.test(t)) {
    return { tipo: "navegar", ...destino };
  }

  const ehSaida = /\b(retirar|retire|remover|remova|dar baixa|baixa|saida|sair)\b/.test(t);
  const ehEntrada = /\b(adicionar|adicione|colocar|coloque|dar entrada|entrada|repor|inclua)\b/.test(t);
  if (t.includes("estoque") && (ehEntrada || ehSaida)) {
    return {
      tipo: "movimento",
      movimento: ehSaida ? "saida" : "entrada",
      quantidade: numeroDoTexto(t),
      unidade: unidadeDoTexto(t),
      nome: nomeDoMovimento(t),
    };
  }

  if (/\b(cadastrar|cadastre|criar|crie|novo|adicionar)\b/.test(t) && /\b(ingrediente|insumo|produto|item)\b/.test(t)) {
    const match = t.match(/\b(?:ingrediente|insumo|produto|item)\s+(.+?)(?=\s+(?:com|no setor|na unidade|unidade|setor|custo|preco|valor)\b|$)/);
    return {
      tipo: "ingrediente",
      nome: match?.[1]?.trim() || "",
      unidade: unidadeDoTexto(t),
      departamento: t.includes("bar") ? "bar" : "cozinha",
      custo: Number((t.match(/\b(?:custo|preco|valor)(?:\s+de)?\s*(\d+(?:[.,]\d+)?)/)?.[1] || "0").replace(",", ".")),
    };
  }

  return { tipo: "pergunta" };
}

function acharItem(estoque, nome) {
  const busca = normalizar(nome);
  if (!busca) return null;
  return estoque.find(item => normalizar(item.nome) === busca)
    || estoque.find(item => normalizar(item.nome).includes(busca))
    || estoque.find(item => busca.includes(normalizar(item.nome)));
}

// Resposta dirigida por dados REAIS do ERP (sem números inventados)
function gerarResposta(texto, erp) {
  const t = texto.toLowerCase();
  const criticosNomes = erp.criticos.map((i) => i.nome);
  const termoNormalizado = normalizar(texto);
  const itemPerguntado = (erp.itens || [])
    .slice()
    .sort((a, b) => String(b.nome || "").length - String(a.nome || "").length)
    .find(item => termoNormalizado.includes(normalizar(item.nome)));

  if (itemPerguntado && /\b(quanto|quantidade|saldo|tem|tenho|custo|preco|preço|valor)\b/.test(termoNormalizado)) {
    const quantidade = Number(itemPerguntado.quantidade_atual ?? itemPerguntado.quantidade ?? 0);
    const unidade = itemPerguntado.unidade_medida || itemPerguntado.unidade || "un";
    const custo = Number(itemPerguntado.custo_unitario || itemPerguntado.custo_compra || 0);
    return `**${itemPerguntado.nome}** possui ${quantidade.toLocaleString("pt-BR")} ${unidade} em estoque${custo > 0 ? `, com custo registrado de ${fmtBRL(custo)}` : ""}.`;
  }

  if (t.includes("estoque") || t.includes("ingrediente") || t.includes("crític")) {
    if (erp.totalEstoque === 0) return `Ainda não há itens cadastrados no estoque de **${erp.unidade}**. Cadastre em Operação → Estoque para eu acompanhar os níveis.`;
    if (erp.criticos.length === 0) return `Tudo certo no estoque de **${erp.unidade}**: nenhum dos ${erp.totalEstoque} itens está abaixo do mínimo. `;
    return `Atenção: **${erp.criticos.length} item(ns) em estoque crítico** em ${erp.unidade} — ${criticosNomes.slice(0, 4).join(", ")}. Recomendo emitir pedido de compra hoje para não parar a produção.`;
  }
  if (t.includes("notificaç") || t.includes("alerta") || t.includes("pendente")) {
    return erp.naoLidas > 0
      ? `Você tem **${erp.naoLidas} notificação(ões) não lida(s)**. Veja em Notificações.`
      : `Você está em dia — nenhuma notificação não lida. `;
  }
  if (t.includes("cmv") || t.includes("margem") || t.includes("lucro")) {
    return `O CMV e a margem são calculados a partir dos preços e custos do **Cardápio** desta unidade. Cadastre/atualize os pratos e veja os números em Financeiro → CMV e Lucro.`;
  }
  if (t.includes("faturamento") || t.includes("receita") || t.includes("dre") || t.includes("caixa")) {
    return `O faturamento vem dos lançamentos do **Fluxo de Caixa** (e do PDV, quando integrado). Registre entradas/saídas e o DRE é gerado automaticamente.`;
  }
  if (t.includes("prioridade") || t.includes("o que fazer") || t.includes("recomend") || t.includes("hoje")) {
    const linhas = [];
    linhas.push(erp.criticos.length > 0
      ? `Repor estoque crítico (${criticosNomes.slice(0, 2).join(", ")})`
      : `Estoque sob controle`);
    linhas.push(erp.naoLidas > 0 ? `Revisar ${erp.naoLidas} notificação(ões)` : `Sem notificações pendentes`);
    linhas.push(`Manter cardápio e fichas atualizados para CMV correto`);
    return `Prioridades para **${erp.unidade}** hoje:\n${linhas.map((l, i) => `${i + 1}. ${l}`).join("\n")}`;
  }
  if (t.includes("oi") || t.includes("olá") || t.includes("bom dia") || t.includes("boa")) {
    return `Olá! Sou a **Hefisto AI**, inteligência baseada nos dados da rede.${erp.criticos.length > 0 ? ` Atenção: ${erp.criticos.length} item(ns) em estoque crítico em ${erp.unidade}.` : ` Tudo tranquilo no estoque de ${erp.unidade}.`} Como posso ajudar?`;
  }
  return `Posso te ajudar com base nos dados reais do ERP da unidade **${erp.unidade}**: estoque, notificações, CMV/margem (Cardápio) e faturamento (Fluxo de Caixa). Pergunte algo específico desses temas.`;
}

export default function HeitorPage() {
  const router = useRouter();
  const { estoque, setEstoque, naoLidas, unidadeInfo, unidadeAtiva, sessao } = useERP();
  const criticos = estoque.filter((i) => Number(i.quantidade_atual ?? i.quantidade ?? 0) <= Number(i.estoque_minimo ?? i.minimo ?? 0));
  const erp = { criticos, itens: estoque, totalEstoque: estoque.length, naoLidas, unidade: unidadeInfo?.nome || "unidade selecionada" };

  const [msgs, setMsgs] = useState([
    { role: "bot", text: "Saudações. Sou a **Hefisto AI**. Estou conectada ao banco de dados do restaurante. Pergunte-me sobre seu estoque, notificações, CMV ou faturamento em tempo real." },
  ]);
  const [input, setInput] = useState("");
  const [escutando, setEscutando] = useState(false);
  const [suporteVoz, setSuporteVoz] = useState(true);
  const [lerRespostas, setLerRespostas] = useState(true);
  const [acaoPendente, setAcaoPendente] = useState(null);
  const reconhecimentoRef = useRef(null);
  const processarRef = useRef(null);
  const fimRef = useRef(null);
  useEffect(() => { fimRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  useEffect(() => {
    const Recognition = typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);
    setSuporteVoz(Boolean(Recognition));
    if (!Recognition) return;
    const reconhecimento = new Recognition();
    reconhecimento.lang = "pt-BR";
    reconhecimento.interimResults = false;
    reconhecimento.continuous = false;
    reconhecimento.onresult = event => {
      const texto = event.results?.[0]?.[0]?.transcript || "";
      setInput(texto);
      processarRef.current?.(texto, true);
    };
    reconhecimento.onerror = () => {
      setEscutando(false);
      adicionarBot("Não consegui entender. Tente novamente ou digite o comando.");
    };
    reconhecimento.onend = () => setEscutando(false);
    reconhecimentoRef.current = reconhecimento;
    return () => reconhecimento.abort();
  }, []);

  function falar(texto) {
    if (!lerRespostas || typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const voz = new SpeechSynthesisUtterance(String(texto).replace(/\*\*/g, ""));
    voz.lang = "pt-BR";
    voz.rate = 1;
    window.speechSynthesis.speak(voz);
  }

  function adicionarBot(texto, falarAgora = true) {
    setMsgs(m => [...m, { role: "bot", text: texto }]);
    if (falarAgora) falar(texto);
  }

  function iniciarVoz() {
    if (!reconhecimentoRef.current) return;
    if (escutando) {
      reconhecimentoRef.current.stop();
      return;
    }
    try {
      setEscutando(true);
      reconhecimentoRef.current.start();
    } catch {
      setEscutando(false);
    }
  }

  async function processar(texto, veioDaVoz = false) {
    const t = (texto ?? input).trim();
    if (!t) return;
    setMsgs(m => [...m, { role: "user", text: t }]);
    setInput("");
    const comando = analisarComando(t);

    if (comando.tipo === "navegar") {
      const resposta = `Abrindo **${comando.nome}**.`;
      adicionarBot(resposta, veioDaVoz);
      setTimeout(() => router.push(comando.rota), 450);
      return;
    }

    if (comando.tipo === "movimento") {
      const item = acharItem(estoque, comando.nome);
      if (!comando.quantidade || comando.quantidade <= 0) {
        adicionarBot("Informe a quantidade. Exemplo: **adicione 5 kg de tomate no estoque**.", veioDaVoz);
        return;
      }
      if (!item) {
        adicionarBot(`Não encontrei **${comando.nome || "esse item"}** no estoque de ${unidadeInfo.nome}. Você pode cadastrá-lo primeiro.`, veioDaVoz);
        return;
      }
      const verbo = comando.movimento === "entrada" ? "adicionar" : "retirar";
      const pendente = { ...comando, item };
      setAcaoPendente(pendente);
      adicionarBot(`Confirme antes de alterar o estoque: deseja **${verbo} ${comando.quantidade} ${comando.unidade} de ${item.nome}**?`, veioDaVoz);
      return;
    }

    if (comando.tipo === "ingrediente") {
      if (!comando.nome) {
        adicionarBot("Diga o nome do ingrediente. Exemplo: **cadastre ingrediente tomate, unidade kg, setor cozinha**.", veioDaVoz);
        return;
      }
      setAcaoPendente(comando);
      adicionarBot(`Confirme o cadastro: **${comando.nome}**, unidade ${comando.unidade}, setor ${comando.departamento}${comando.custo ? `, custo ${fmtBRL(comando.custo)}` : ""}.`, veioDaVoz);
      return;
    }

    adicionarBot(gerarResposta(t, erp), veioDaVoz);
  }
  processarRef.current = processar;

  async function confirmarAcao() {
    const comando = acaoPendente;
    if (!comando) return;
    setAcaoPendente(null);
    if (!unidadeAtiva || unidadeAtiva === "todas" || unidadeAtiva === "matriz") {
      adicionarBot("Selecione uma unidade específica antes de alterar dados.");
      return;
    }

    if (comando.tipo === "ingrediente") {
      const resultado = await salvarInsumo({
        unidade_id: unidadeAtiva,
        nome: comando.nome.charAt(0).toUpperCase() + comando.nome.slice(1),
        nome_original: comando.nome,
        departamento: comando.departamento,
        unidade_medida: comando.unidade,
        tamanho_embalagem: 1,
        categoria: "Sem categoria",
        custo_compra: comando.custo || 0,
        custo_unitario: comando.custo || 0,
        tipo: "ingrediente",
      }, { origem: "Comando de voz do Hefisto" });
      if (resultado.error) {
        adicionarBot(`Não consegui cadastrar: ${resultado.error}`);
        return;
      }
      setEstoque(atual => [...atual, {
        id: resultado.id,
        insumo_id: resultado.id,
        nome: comando.nome.charAt(0).toUpperCase() + comando.nome.slice(1),
        departamento: comando.departamento,
        unidade_medida: comando.unidade,
        tamanho_embalagem: 1,
        custo_unitario: comando.custo || 0,
        estoque_minimo: null,
        quantidade_atual: 0,
      }]);
      adicionarBot(`Ingrediente **${comando.nome}** cadastrado com sucesso no setor ${comando.departamento}.`);
      return;
    }

    if (comando.tipo === "movimento") {
      const resultado = await registrarMovimentoEstoque({
        unidadeId: unidadeAtiva,
        insumoId: comando.item.id,
        departamento: comando.item.departamento,
        tipo: comando.movimento,
        quantidadeUnidades: comando.quantidade,
        responsavel: sessao?.nome || sessao?.email || "Hefisto",
        motivo: "Movimentação confirmada por comando de voz",
      });
      if (resultado.error) {
        adicionarBot(`Não consegui alterar o estoque: ${resultado.error}`);
        return;
      }
      const conteudo = Number(comando.item.tamanho_embalagem) || 1;
      setEstoque(atual => atual.map(item => item.id === comando.item.id ? {
        ...item,
        quantidade_atual: Math.max(0, Number(item.quantidade_atual || 0) + (comando.movimento === "entrada" ? 1 : -1) * comando.quantidade * conteudo),
      } : item));
      adicionarBot(`${comando.movimento === "entrada" ? "Entrada" : "Saída"} de **${comando.quantidade} ${comando.unidade} de ${comando.item.nome}** registrada com sucesso.`);
    }
  }

  function render(txt) {
    return txt.split("\n").map((linha, i) => (
      <p key={i} style={{ margin: i ? "8px 0 0" : 0 }}
        dangerouslySetInnerHTML={{ __html: linha.replace(/\*\*(.+?)\*\*/g, '<b class="font-black">$1</b>') }} />
    ));
  }

  return (
    <div className="min-h-[100dvh] flex flex-col bg-slate-50">
      {/* HEADER COCKPIT IA PREMIUM */}
      <div className="px-3 sm:px-4 py-3 sm:py-6 bg-slate-900 sticky top-0 z-30 shadow-2xl shadow-slate-900/20 border-b border-slate-800">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/30 flex-shrink-0">
              <Brain size={24} color="#fff" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl md:text-2xl font-black text-white tracking-tight">Hefisto AI</h1>
                <span className="px-2 py-0.5 rounded-full bg-slate-800 text-emerald-400 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1 border border-slate-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> Online
                </span>
              </div>
              <p className="text-[11px] sm:text-xs font-medium text-slate-500 flex items-start sm:items-center gap-1 mt-0.5 min-w-0 leading-snug">
                <Cpu size={12}/> Analisando dados da unidade <span className="text-white font-bold">{unidadeInfo.nome}</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ÁREA DO CHAT */}
      <div className="flex-1 w-full max-w-4xl mx-auto px-3 sm:px-4 pt-4 sm:pt-8 pb-44 sm:pb-40 space-y-4 sm:space-y-6 overflow-y-auto">
        {msgs.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            {m.role === "bot" && (
              <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center flex-shrink-0 mr-3 mt-1">
                <Brain size={14} className="text-slate-500" />
              </div>
            )}
            
            <div className={`max-w-[calc(100%-2.75rem)] sm:max-w-[85%] md:max-w-[75%] px-4 sm:px-5 py-3 sm:py-4 text-sm shadow-sm break-words ${
                m.role === "user"
                  ? "bg-slate-800 text-white rounded-2xl rounded-tr-sm"
                  : "bg-white text-slate-700 border border-slate-200 rounded-2xl rounded-tl-sm"
              }`}
            >
              {render(m.text)}
            </div>
            
            {m.role === "user" && (
              <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0 ml-3 mt-1">
                <span className="text-[10px] font-black text-slate-500">VC</span>
              </div>
            )}
          </div>
        ))}
        {acaoPendente && (
          <div className="ml-0 sm:ml-11 rounded-2xl border-2 border-amber-200 bg-amber-50 p-4 sm:p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-widest text-amber-700">Confirmação necessária</p>
            <p className="mt-1.5 text-sm font-bold text-slate-700">
              {acaoPendente.tipo === "ingrediente"
                ? `Cadastrar ${acaoPendente.nome} no setor ${acaoPendente.departamento}`
                : `${acaoPendente.movimento === "entrada" ? "Adicionar" : "Retirar"} ${acaoPendente.quantidade} ${acaoPendente.unidade} de ${acaoPendente.item?.nome}`}
            </p>
            <div className="flex flex-col sm:flex-row gap-2 mt-4">
              <button type="button" onClick={confirmarAcao} className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-black text-white hover:bg-emerald-700">
                <CheckCircle2 size={17} /> Confirmar
              </button>
              <button type="button" onClick={() => { setAcaoPendente(null); adicionarBot("Operação cancelada.", false); }} className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-600 hover:bg-slate-50">
                <XCircle size={17} /> Cancelar
              </button>
            </div>
          </div>
        )}
        <div ref={fimRef} />
      </div>

      {/* ÁREA DE INPUT (FIXA NO RODAPÉ) */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
        <div className="max-w-4xl mx-auto px-3 sm:px-4 pb-3 sm:pb-6 pt-2 sm:pt-3">
          
          {/* Sugestões Rápidas */}
          <div className="flex gap-2 overflow-x-auto pb-3 custom-scrollbar">
            {SUGESTOES.map((s) => (
              <button key={s} onClick={() => processar(s)} 
                className="flex-shrink-0 flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-full bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-emerald-700 hover:border-slate-200 transition-colors"
              >
                <Sparkles size={12}/> {s}
              </button>
            ))}
          </div>
          
          {/* Caixa de Texto Premium */}
          <div className="flex items-end gap-2 sm:gap-3 bg-slate-50 p-2 border border-slate-200 rounded-2xl sm:rounded-3xl focus-within:ring-2 focus-within:ring-purple-500 focus-within:border-emerald-500 transition-all">
            <textarea 
              value={input} 
              onChange={(e) => setInput(e.target.value)} 
              onKeyDown={(e) => {
                if(e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  processar();
                }
              }}
              placeholder="Pergunte ao seu ERP..." 
              className="w-full min-w-0 bg-transparent border-none focus:ring-0 resize-none px-2 sm:px-4 py-3 text-sm text-slate-800 placeholder-slate-400 max-h-32 min-h-[48px]"
              rows={1}
            />
            {suporteVoz && (
              <button
                type="button"
                onClick={iniciarVoz}
                title={escutando ? "Parar de ouvir" : "Falar com o Hefisto"}
                aria-label={escutando ? "Parar de ouvir" : "Falar com o Hefisto"}
                className={`w-11 h-11 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center flex-shrink-0 transition-colors ${escutando ? "bg-rose-600 text-white animate-pulse" : "bg-white border border-slate-200 text-slate-600 hover:text-purple-600"}`}
              >
                {escutando ? <MicOff size={19} /> : <Mic size={19} />}
              </button>
            )}
            <button
              type="button"
              onClick={() => setLerRespostas(valor => !valor)}
              title={lerRespostas ? "Desativar respostas faladas" : "Ativar respostas faladas"}
              aria-label={lerRespostas ? "Desativar respostas faladas" : "Ativar respostas faladas"}
              className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-white border border-slate-200 text-slate-600 hover:text-purple-600 flex items-center justify-center flex-shrink-0"
            >
              {lerRespostas ? <Volume2 size={19} /> : <VolumeX size={19} />}
            </button>
            <button 
              onClick={() => processar()} 
              className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-slate-800 hover:bg-slate-900 flex items-center justify-center flex-shrink-0 shadow-md transition-colors"
            >
              <Send size={18} color="#fff" className="ml-1" />
            </button>
          </div>
          {escutando && <p className="text-center text-xs font-black text-rose-600 mt-2 animate-pulse">Ouvindo… diga seu comando</p>}
          <p className="hidden sm:block text-center text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-3">
            Hefisto AI processa os dados em tempo real.
          </p>
        </div>
      </div>
    </div>
  );
}
