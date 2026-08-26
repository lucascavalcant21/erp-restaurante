"use client";

import { useState, useEffect, useRef } from "react";
import {
  Sun, Moon, CheckCircle2, Check, ChevronDown, User, Printer,
  ChefHat, Wine, Armchair, ClipboardList, Plus, Settings, Loader2,
  Camera, X, Share2, BarChart3, Users, UserCheck, Clock3, Image as ImageIcon,
  ShieldCheck, ListChecks
} from "lucide-react";
import {
  PageHeader, PageBody, Card, SectionLabel, Field, TextInput, Btn, EmptyState,
} from "../../../components/ui";
import { useERP } from "../../../context/ERPContext";
import { fetchTemplates, salvarExecucao, fetchHistoricoExecucoes, fetchExecucoesMes, fetchExecucoesIntervalo } from "../../../lib/checklists";
import { fetchColaboradores } from "../../../lib/rh";
import { useTempoReal } from "../../../lib/realtime";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

// Área do colaborador pelo cargo (para mostrar só a equipe do setor).
// Salão é avaliado antes da cozinha para "chef de fila" não cair na cozinha.
function areaDoCargo(cargo) {
  const c = (cargo || "").toLowerCase();
  // Salão: garçom, chef/chefe de fila, atendimento, caixa, recepção
  if (/(gar[çc]|chefe? de fila|atendente|sal[aã]o|hostess|maitre|maître|caixa|comand|runner|recep)/.test(c)) return "salao";
  // Cozinha: cozinheiro, auxiliar de cozinha, chef de cozinha e afins
  if (/(cozinh|cozinheir|auxiliar de coz|chapeir|confeit|pizzai|sushi|salgad|padeir|churrasqueir|a[cç]ougue|copa|lou[çc]a)/.test(c)) return "cozinha";
  // Bar: barman/barmen, bartender, barista
  if (/(\bbar\b|barm|bartender|barista|copeir|garrafeir)/.test(c)) return "bar";
  if (/(gerente|supervisor|\bceo\b|coordenad|encarregad|gestor|propriet|s[oó]cio)/.test(c)) return "lideranca";
  return "outros";
}

// Comprime a foto de comprovação (máx. 800px, jpeg) para não pesar no banco
function comprimirFoto(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const MAX = 800;
      const escala = Math.min(1, MAX / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * escala);
      canvas.height = Math.round(img.height * escala);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.6).split(",")[1] || "");
    };
    img.onerror = reject;
    img.src = url;
  });
}

/* ─── Tema visual por departamento ─── */
const TEMAS = {
  cozinha: {
    nome: "Cozinha", Icon: ChefHat,
    cor: "#F59E0B", corClara: "#FFFBEB", corBorda: "#FDE68A", corTexto: "#92400E",
    corBg: "linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%)",
  },
  bar: {
    nome: "Bar", Icon: Wine,
    cor: "#8B5CF6", corClara: "#F5F3FF", corBorda: "#DDD6FE", corTexto: "#5B21B6",
    corBg: "linear-gradient(135deg, #EDE9FE 0%, #DDD6FE 100%)",
  },
  salao: {
    nome: "Salão", Icon: Armchair,
    cor: "#0EA5E9", corClara: "#F0F9FF", corBorda: "#BAE6FD", corTexto: "#0C4A6E",
    corBg: "linear-gradient(135deg, #E0F2FE 0%, #BAE6FD 100%)",
  },
};

const ROTULOS_TIPO = {
  abertura: "Abertura", fechamento: "Fechamento", mise_en_place: "Mise en Place",
  pre_preparos: "Pré-preparos p/ outro dia", limpeza_organizacao: "Limpeza e Organização", operacional: "Operacional", limpeza: "Limpeza",
};
// Ordem lógica do dia para agrupar os checklists na tela
const ORDEM_TIPOS = ["abertura", "mise_en_place", "pre_preparos", "operacional", "limpeza_organizacao", "limpeza", "fechamento"];

function dataHojeLocal() {
  const agora = new Date();
  const ano = agora.getFullYear();
  const mes = String(agora.getMonth() + 1).padStart(2, "0");
  const dia = String(agora.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

function horaCurta(data) {
  if (!data) return "--:--";
  const valor = new Date(data);
  if (Number.isNaN(valor.getTime())) return "--:--";
  return valor.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function VisualizadorFoto({ foto, onClose }) {
  if (!foto) return null;
  return (
    <div className="fixed inset-0 z-[80] bg-slate-950/90 backdrop-blur-sm p-3 sm:p-6 flex items-center justify-center" onClick={onClose}>
      <button type="button" onClick={onClose} aria-label="Fechar foto"
        className="absolute top-4 right-4 w-11 h-11 rounded-full bg-white/15 text-white flex items-center justify-center hover:bg-white/25 focus-visible:ring-2 focus-visible:ring-white">
        <X size={22} />
      </button>
      <img src={`data:image/jpeg;base64,${foto}`} alt="Foto de comprovação ampliada"
        className="max-w-full max-h-[calc(100dvh-2rem)] object-contain rounded-2xl shadow-2xl"
        onClick={e => e.stopPropagation()} />
    </div>
  );
}

function RotinaRunner() {
  const { unidadeAtiva, unidadeInfo } = useERP();
  const router = useRouter();
  const searchParams = useSearchParams();
  const deptUrl = searchParams.get("dept");
  const tipoUrl = searchParams.get("tipo");

  // Sem ?dept a tela caía calada na cozinha, e quem entrava pelo menu ficava
  // olhando os checklists do setor errado sem perceber. Agora escolhe.
  const deptValido = TEMAS[deptUrl] ? deptUrl : null;
  const [templates, setTemplates] = useState([]);
  const [historico, setHistorico] = useState([]);
  const [colaboradores, setColaboradores] = useState([]);
  const [loading, setLoading] = useState(true);
  // Banco recusando a leitura vira "nenhum checklist" na tela, e o setor passa
  // o dia sem executar achando que não tem nada para fazer.
  const [erroCarga, setErroCarga] = useState("");

  // Produtividade individual (tarefas feitas por pessoa no mês)
  const [modalProd, setModalProd] = useState(false);
  const [prodDados, setProdDados] = useState(null);
  const [prodLoading, setProdLoading] = useState(false);
  const [prodTipo, setProdTipo] = useState("mes"); // "dia" | "mes" | "ano"
  const [prodDia, setProdDia] = useState(() => dataHojeLocal());
  const [prodMes, setProdMes] = useState(() => dataHojeLocal().slice(0, 7));
  const [prodAno, setProdAno] = useState(() => dataHojeLocal().slice(0, 4));

  // Execução
  const [checklistAtual, setChecklistAtual] = useState(null);
  const [respostas, setRespostas] = useState({});
  const [colabSelecionado, setColabSelecionado] = useState("");
  const [modoAtribuicao, setModoAtribuicao] = useState("uma_pessoa");
  const [exp, setExp] = useState(null);
  const [historicoAberto, setHistoricoAberto] = useState(null);
  const [fotoAmpliada, setFotoAmpliada] = useState("");
  const [registrado, setRegistrado] = useState(false);
  const [salvando, setSalvando] = useState(false);
  // Estação travada guarda o próprio setor: sem ?dept na URL, ele vale como
  // escolha em vez de a tela cair na cozinha e mostrar a área errada.
  const [areaDaEstacao, setAreaDaEstacao] = useState(null);
  const [estacaoTravada, setEstacaoTravada] = useState(false);
  const dept = deptValido || areaDaEstacao || "cozinha";
  const precisaEscolherArea = !deptValido && !estacaoTravada && !areaDaEstacao;
  const cargaAtual = useRef(0);
  const registroConcluido = useRef(false);
  const salvamentoEmAndamento = useRef(false);

  const t = TEMAS[dept];
  const filtroTipo = tipoUrl === "limpeza" || tipoUrl === "operacional" ? tipoUrl : null;
  const templatesExibidos = templates.filter(template => {
    if (!filtroTipo) return true;
    const limpeza = template.tipo === "limpeza" || template.tipo === "limpeza_organizacao" || /(limp|higien|organiza)/i.test(template.titulo || "");
    return filtroTipo === "limpeza" ? limpeza : !limpeza;
  });

  const carregar = async (silencioso = false) => {
    const idCarga = ++cargaAtual.current;
    if (!silencioso) setLoading(true);
    const hoje = dataHojeLocal();
    const [resT, resC, resH] = await Promise.all([
      fetchTemplates(unidadeAtiva, dept),
      fetchColaboradores(unidadeAtiva),
      fetchHistoricoExecucoes(unidadeAtiva, hoje, dept),
    ]);
    if (idCarga !== cargaAtual.current) return;
    setErroCarga(resT.error ? `Não consegui carregar os checklists: ${resT.error}` : "");
    setTemplates(resT.data || []);
    setColaboradores((resC.data || []).filter(c => c.ativo !== false && String(c.status || "ativo").toLowerCase() !== "inativo"));
    setHistorico(resH.data || []);
    setLoading(false);
  };

  useEffect(() => {
    setChecklistAtual(null);
    setHistoricoAberto(null);
    if (unidadeAtiva && unidadeAtiva !== "todas") carregar();
  }, [unidadeAtiva, dept]);

  useEffect(() => {
    setChecklistAtual(null);
    setHistoricoAberto(null);
  }, [filtroTipo]);

  useEffect(() => {
    try {
      const area = localStorage.getItem("hefisto_modo_area");
      setEstacaoTravada(Boolean(area));
      setAreaDaEstacao(TEMAS[area] ? area : null);
    } catch { setEstacaoTravada(false); setAreaDaEstacao(null); }
  }, [dept]);

  // Tempo real: checklist marcado em outro aparelho atualiza aqui sozinho
  useTempoReal(["checklists_execucoes", "checklists_templates", "colaboradores"], () => {
    if (unidadeAtiva && unidadeAtiva !== "todas") carregar(true);
  });

  // Equipe do setor: aparece automaticamente conforme a área/cargo cadastrado.
  // - Se a pessoa tem área definida no cadastro (area_escala), vale essa área.
  // - Senão, classifica pelo cargo (garçom→salão, barman→bar, cozinheiro→cozinha).
  // A liderança (gerente/supervisor) aparece em todos para poder assinar.
  // Quem está em OUTRO setor — ou sem cargo reconhecido — não aparece aqui.
  const colaboradoresDoSetor = (() => {
    // Normaliza a área do cadastro para a chave usada nos temas (sem acento).
    const normArea = (s) => {
      const v = String(s || "").toLowerCase().trim();
      if (v === "salão" || v === "salao") return "salao";
      if (v === "cozinha") return "cozinha";
      if (v === "bar") return "bar";
      return v;
    };
    return colaboradores.filter(c => {
      const areaCadastro = normArea(c.area_escala);
      const a = TEMAS[areaCadastro] ? areaCadastro : areaDoCargo(c.cargo);
      return a === dept || a === "lideranca";
    });
  })();

  // Intervalo [inicio, fim) e um rótulo conforme o período escolhido.
  const intervaloProd = () => {
    if (prodTipo === "dia") {
      const d = new Date(`${prodDia}T00:00:00`);
      const prox = new Date(d); prox.setDate(prox.getDate() + 1);
      const fim = `${prox.getFullYear()}-${String(prox.getMonth() + 1).padStart(2, "0")}-${String(prox.getDate()).padStart(2, "0")}`;
      const rotulo = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
      return { inicio: prodDia, fim, rotulo };
    }
    if (prodTipo === "ano") {
      return { inicio: `${prodAno}-01-01`, fim: `${Number(prodAno) + 1}-01-01`, rotulo: `Ano de ${prodAno}` };
    }
    const [a, m] = prodMes.split("-").map(Number);
    const prox = new Date(a, m, 1);
    const fim = `${prox.getFullYear()}-${String(prox.getMonth() + 1).padStart(2, "0")}-01`;
    const rotulo = new Date(`${prodMes}-01T00:00:00`).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    return { inicio: `${prodMes}-01`, fim, rotulo };
  };

  // Produtividade individual — SOMENTE do setor atual (cada área vê só a sua).
  const carregarProdutividade = async () => {
    setProdLoading(true);
    const { inicio, fim } = intervaloProd();
    // Filtra pelo dept da tela: a produtividade de uma área não vaza para outra
    const { data: execs } = await fetchExecucoesIntervalo(unidadeAtiva, inicio, fim, dept);
    const porPessoa = {};
    (execs || []).forEach(e => {
      (Array.isArray(e.respostas) ? e.respostas : []).forEach(r => {
        if (!r.marcado) return;
        const id = r.feito_por || e.colaborador_id;
        const nome = r.feito_por_nome || e.colaboradores?.nome || "Sem identificação";
        const key = id || nome;
        porPessoa[key] = porPessoa[key] || { nome, tarefas: 0, checklists: new Set() };
        porPessoa[key].tarefas++;
        porPessoa[key].checklists.add(e.id);
      });
    });
    const lista = Object.values(porPessoa)
      .map(p => ({ nome: p.nome, tarefas: p.tarefas, checklists: p.checklists.size }))
      .sort((a, b) => b.tarefas - a.tarefas);
    setProdDados(lista);
    setProdLoading(false);
  };

  const abrirProdutividade = () => { setModalProd(true); carregarProdutividade(); };

  // Recarrega ao trocar período enquanto o painel está aberto
  useEffect(() => { if (modalProd) carregarProdutividade(); /* eslint-disable-next-line */ }, [prodTipo, prodDia, prodMes, prodAno]);

  // Impressão do relatório de produtividade (para levar à reunião)
  const imprimirProdutividade = () => {
    const { rotulo } = intervaloProd();
    const lista = prodDados || [];
    const linhas = lista.map((p, i) => `<tr><td class="pos">${i + 1}º</td><td>${p.nome}</td><td class="num">${p.tarefas}</td><td class="num">${p.checklists}</td></tr>`).join("");
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Produtividade — ${t.nome}</title>
      <style>
        @page { size: A4 portrait; margin: 14mm; }
        body { font-family: sans-serif; color: #0f172a; }
        h1 { font-size: 20px; margin: 0 0 2px; }
        .sub { color: #64748b; font-size: 12px; margin: 0 0 16px; }
        .selo { display:inline-block; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color:#fff; background:${t.cor}; padding: 3px 10px; border-radius: 6px; }
        table { width: 100%; border-collapse: collapse; margin-top: 12px; }
        th, td { border: 1px solid #cbd5e1; padding: 7px 10px; text-align: left; font-size: 12px; }
        th { background: #f1f5f9; text-transform: uppercase; font-size: 10px; color: #475569; }
        td.num, th.num { text-align: right; }
        td.pos { width: 36px; font-weight: 800; color:#64748b; }
        .rod { margin-top: 18px; font-size: 10px; color:#94a3b8; }
      </style></head><body>
      <span class="selo">${t.nome}</span>
      <h1>Produtividade da equipe</h1>
      <p class="sub">Tarefas de checklist concluídas por pessoa · ${rotulo} · ${unidadeInfo?.nome || ""}</p>
      ${lista.length ? `<table><thead><tr><th></th><th>Colaborador</th><th class="num">Tarefas</th><th class="num">Checklists</th></tr></thead><tbody>${linhas}</tbody></table>`
        : `<p style="color:#94a3b8;font-weight:bold;">Nenhum checklist registrado neste período.</p>`}
      <p class="rod">Gerado pelo Hefisto em ${new Date().toLocaleString("pt-BR")}.</p>
      </body></html>`;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(html); win.document.close();
    setTimeout(() => win.print(), 400);
  };

  const iniciar = (tmpl) => {
    setChecklistAtual(tmpl);
    const ini = {};
    (tmpl.itens || []).forEach(i => ini[i.id] = {
      marcado: false,
      status: undefined,
      temperatura_val: "",
      temp_alerta: false,
      plano_acao: "",
      obs: "",
      feito_por: "",
      atribuido_para: "",
      foto: "",
      concluido_em: null,
    });
    setRespostas(ini);
    setColabSelecionado("");
    setModoAtribuicao("uma_pessoa");
    setRegistrado(false);
    registroConcluido.current = false;
    salvamentoEmAndamento.current = false;
    setExp(null);
  };

  const mudaStatusItem = (id, status) => {
    if (registroConcluido.current || salvamentoEmAndamento.current) return;
    const atual = respostas[id] || {};
    // Sem responsável a tarefa é marcada assim mesmo: quem está com as mãos na
    // massa não pode ficar preso a um cadastro para registrar o que já fez.
    const responsavel = atual.feito_por || (modoAtribuicao === "uma_pessoa" ? colabSelecionado : "");
    setRespostas(r => ({
      ...r,
      [id]: {
        ...r[id],
        status,
        marcado: true,
        feito_por: r[id]?.feito_por || responsavel,
        atribuido_para: r[id]?.atribuido_para || responsavel,
        concluido_em: r[id]?.concluido_em || new Date().toISOString(),
      }
    }));
    if (status === "nao_conforme") setExp(id);
  };

  const mudaTemperatura = (id, valStr, minVal, maxVal) => {
    if (registroConcluido.current || salvamentoEmAndamento.current) return;
    const val = parseFloat(String(valStr).replace(",", "."));
    const ehNum = !isNaN(val);
    let fora = false;
    if (ehNum) {
      if (minVal !== undefined && minVal !== null && val < minVal) fora = true;
      if (maxVal !== undefined && maxVal !== null && val > maxVal) fora = true;
    }
    setRespostas(r => {
      const atual = r[id] || {};
      const statusFinal = fora ? "nao_conforme" : (atual.status || "conforme");
      return {
        ...r,
        [id]: {
          ...atual,
          temperatura_val: valStr,
          temp_alerta: fora,
          status: statusFinal,
          marcado: true,
          concluido_em: atual.concluido_em || new Date().toISOString(),
        }
      };
    });
    if (fora) setExp(id);
  };

  const mudaPlanoAcao = (id, plano) => {
    if (registroConcluido.current || salvamentoEmAndamento.current) return;
    setRespostas(r => ({
      ...r,
      [id]: { ...r[id], plano_acao: plano }
    }));
  };

  const atribuirTodos = (quem) => {
    if (registroConcluido.current || salvamentoEmAndamento.current) return;
    if (concluidas > 0 && String(quem) !== String(colabSelecionado)) {
      alert("Não é possível trocar o responsável das atividades que já foram concluídas.");
      return;
    }
    setColabSelecionado(quem);
    setRespostas(atuais => Object.fromEntries(
      Object.entries(atuais).map(([id, resposta]) => [id, {
        ...resposta,
        feito_por: resposta.marcado ? resposta.feito_por : quem,
        atribuido_para: resposta.marcado ? (resposta.atribuido_para || resposta.feito_por) : quem,
      }])
    ));
  };

  const trocarModoAtribuicao = (modo) => {
    if (registroConcluido.current || salvamentoEmAndamento.current || modo === modoAtribuicao) return;
    if (concluidas > 0) {
      alert("A forma de divisão não pode ser alterada depois que uma atividade foi concluída.");
      return;
    }
    setModoAtribuicao(modo);
    if (modo === "uma_pessoa" && colabSelecionado) atribuirTodos(colabSelecionado);
  };

  const atribuirCategoria = (categoria, quem) => {
    if (registroConcluido.current || salvamentoEmAndamento.current) return;
    const idsDaCategoria = new Set(
      (checklistAtual?.itens || [])
        .filter(item => (item.categoria || "Sem categoria").trim() === String(categoria).trim())
        .map(item => String(item.id))
    );
    setRespostas(atuais => Object.fromEntries(
      Object.entries(atuais).map(([id, resposta]) => [id, idsDaCategoria.has(String(id)) ? {
        ...resposta,
        feito_por: resposta.marcado ? resposta.feito_por : quem,
        atribuido_para: resposta.marcado ? (resposta.atribuido_para || resposta.feito_por) : quem,
      } : resposta])
    ));
  };

  const toggle = (id) => {
    if (registroConcluido.current || salvamentoEmAndamento.current) return;
    const atual = respostas[id] || {};
    const responsavel = atual.feito_por || (modoAtribuicao === "uma_pessoa" ? colabSelecionado : "");
    setRespostas(r => {
      const respostaAtual = r[id] || {};
      const marcado = !respostaAtual.marcado;
      return { ...r, [id]: {
        ...respostaAtual,
        marcado,
        feito_por: respostaAtual.feito_por || responsavel,
        atribuido_para: respostaAtual.atribuido_para || responsavel,
        concluido_em: marcado ? new Date().toISOString() : null,
      } };
    });
    if (!atual.marcado) setExp(id);
  };

  const mudaObs = (id, txt) => {
    if (registroConcluido.current || salvamentoEmAndamento.current) return;
    setRespostas(r => ({ ...r, [id]: { ...r[id], obs: txt } }));
  };

  const mudaFeitoPor = (id, quem) => {
    if (registroConcluido.current || salvamentoEmAndamento.current) return;
    if (respostas[id]?.marcado) {
      alert("Desmarque a atividade antes de trocar o funcionário responsável.");
      return;
    }
    setRespostas(r => ({ ...r, [id]: { ...r[id], feito_por: quem, atribuido_para: quem } }));
  };

  // Foto de comprovação da tarefa (comprimida)
  const anexarFotoTarefa = async (id, file) => {
    if (!file || registroConcluido.current || salvamentoEmAndamento.current) return;
    try {
      const base64 = await comprimirFoto(file);
      if (registroConcluido.current || salvamentoEmAndamento.current) return;
      setRespostas(r => ({ ...r, [id]: { ...r[id], foto: base64 } }));
    } catch { alert("Não consegui ler a foto."); }
  };
  const removerFotoTarefa = (id) => {
    if (registroConcluido.current || salvamentoEmAndamento.current) return;
    setRespostas(r => ({ ...r, [id]: { ...r[id], foto: "" } }));
  };

  const itens = checklistAtual?.itens || [];
  const concluidas = itens.filter(i => respostas[i.id]?.marcado).length;
  const pct = itens.length > 0 ? Math.round((concluidas / itens.length) * 100) : 0;
  const naoAtribuidas = itens.filter(i => !respostas[i.id]?.feito_por).length;
  const pessoasAtribuidas = new Set(
    itens.map(i => respostas[i.id]?.feito_por).filter(Boolean)
  ).size;

  // Envia a comprovação pro WhatsApp: abre o compartilhar do aparelho com o
  // resumo + as fotos das tarefas — você escolhe o grupo e envia.
  const compartilharWhatsApp = async () => {
    const nomeDe = (id) => colaboradores.find(c => c.id === id)?.nome;
    const agora = new Date();
    const linhas = itens.map(it => {
      const r = respostas[it.id] || {};
      const quem = nomeDe(r.feito_por || colabSelecionado);
      return `${r.marcado ? "[x]" : "[ ]"} ${it.texto}${quem ? ` — ${quem.split(" ")[0]}` : ""}${r.foto ? " (foto)" : ""}`;
    });
    const texto = `*${checklistAtual.titulo}* — ${t.nome} · ${unidadeInfo?.nome || ""}\n${agora.toLocaleDateString("pt-BR")} ${agora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} · Preenchido por: ${nomeDe(colabSelecionado) || "—"}\nConcluído: ${pct}%\n\n${linhas.join("\n")}`;

    // Fotos viram arquivos anexados no compartilhamento (celular/tablet)
    const files = [];
    try {
      itens.forEach((it, idx) => {
        const f = respostas[it.id]?.foto;
        if (!f) return;
        const bin = atob(f);
        const arr = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        files.push(new File([arr], `tarefa-${idx + 1}.jpg`, { type: "image/jpeg" }));
      });
    } catch { /* sem fotos, segue só o texto */ }

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        if (files.length && navigator.canShare && navigator.canShare({ files })) {
          await navigator.share({ text: texto, files });
        } else {
          await navigator.share({ text: texto });
        }
        return;
      } catch (e) { if (e && e.name === "AbortError") return; }
    }
    // Desktop sem compartilhar nativo: abre o WhatsApp Web com o texto
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, "_blank");
  };

  const finalizar = async () => {
    // Responsável deixou de ser obrigatório: exigir nome travava o registro de
    // um checklist que já foi feito, e a tarefa cumprida sem registro é pior
    // para a operação do que o registro sem o nome de quem fez.
    if (pct < 100) return;
    if (salvamentoEmAndamento.current) return;
    salvamentoEmAndamento.current = true;
    setSalvando(true);

    const nomeDe = (id) => colaboradores.find(c => c.id === id)?.nome || null;
    const arrRespostas = Object.keys(respostas).map(k => ({
      id_tarefa: k,
      texto_tarefa: itens.find(i => i.id.toString() === k.toString())?.texto,
      marcado: respostas[k].marcado,
      status: respostas[k].status || (respostas[k].marcado ? "conforme" : undefined),
      temperatura_val: respostas[k].temperatura_val || null,
      temp_alerta: !!respostas[k].temp_alerta,
      plano_acao: respostas[k].plano_acao || null,
      obs: respostas[k].obs,
      feito_por: respostas[k].feito_por || colabSelecionado,
      feito_por_nome: nomeDe(respostas[k].feito_por || colabSelecionado),
      atribuido_para: respostas[k].atribuido_para || respostas[k].feito_por || colabSelecionado,
      concluido_em: respostas[k].concluido_em || new Date().toISOString(),
      foto: respostas[k].foto || null,
    }));

    let resultado;
    try {
      resultado = await salvarExecucao({
        template_id: checklistAtual.id,
        unidade_id: unidadeAtiva,
        colaborador_id: colabSelecionado || null,
        data_referencia: dataHojeLocal(),
        respostas: arrRespostas,
      });
    } catch (erro) {
      resultado = { error: erro?.message || "Falha de conexão" };
    } finally {
      setSalvando(false);
      salvamentoEmAndamento.current = false;
    }
    if (resultado?.error) {
      alert(`Não foi possível registrar o checklist: ${resultado.error}`);
      return;
    }
    registroConcluido.current = true;
    setRegistrado(true);
    carregar(true);
  };

  /* ─── Impressão ─── */
  const imprimir = (tmpl, preenchido = null) => {
    const nomePor = (id) => colaboradores.find(c => c.id === id)?.nome || "";
    const horaDe = (iso) => {
      if (!iso) return "";
      const d = new Date(iso);
      return isNaN(d) ? "" : d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    };
    let catImpr = null;
    const itensHtml = (tmpl.itens || []).map((it, i) => {
      const cat = (it.categoria || "").trim();
      const header = cat && cat !== catImpr ? (catImpr = cat, `<tr class="cat"><td colspan="5">${cat}</td></tr>`) : "";
      const r = preenchido ? preenchido[it.id] : null;
      const feito = !!r?.marcado;
      const quem = r ? (nomePor(r.feito_por) || nomePor(colabSelecionado)) : "";
      return `${header}<tr>
        <td class="n">${i + 1}</td>
        <td class="tarefa">${it.texto || ""}</td>
        <td class="resp">${quem || it.responsavel || ""}</td>
        <td class="check">${feito ? `<span class="box feito">&#10003;</span>` : `<span class="box"></span>`}</td>
        <td class="visto">${horaDe(r?.concluido_em)}</td>
      </tr>`;
    }).join("");
    const extras = preenchido ? "" : Array.from({ length: 3 }).map((_, i) => `
      <tr>
        <td class="n">${(tmpl.itens?.length || 0) + i + 1}</td>
        <td class="tarefa"></td><td class="resp"></td>
        <td class="check"><span class="box"></span></td><td class="visto"></td>
      </tr>`).join("");

    const deptLabel = TEMAS[tmpl.departamento]?.nome || tmpl.departamento;
    const tipoLabel = ROTULOS_TIPO[tmpl.tipo] || tmpl.tipo;
    const corDept = TEMAS[tmpl.departamento]?.cor || "#10B981";

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${tmpl.titulo}</title>
      <style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:Arial,Helvetica,sans-serif;color:#111;padding:8mm}
        .head{border-bottom:4px solid ${corDept};padding-bottom:10px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:flex-end}
        .tag{font-size:10px;letter-spacing:3px;text-transform:uppercase;color:${corDept};font-weight:bold}
        h1{font-size:22px;margin-top:4px}
        .meta{font-size:12px;font-weight:bold;text-align:right}
        .meta span{display:block;font-size:10px;color:#555;font-weight:normal;margin-top:2px}
        .datas{display:flex;gap:24px;font-size:12px;margin:10px 0 12px;font-weight:bold}
        .datas b{border-bottom:1px solid #999;min-width:120px;display:inline-block}
        table{width:100%;border-collapse:collapse}
        th,td{border:1px solid #333;padding:8px 6px;font-size:12px;vertical-align:middle}
        th{background:${corDept}22;text-transform:uppercase;letter-spacing:.5px;font-size:9px;color:${corDept}}
        tr.cat td{background:${corDept}18;color:${corDept};font-weight:bold;text-transform:uppercase;letter-spacing:1px;font-size:10px;height:auto;padding:5px 6px}
        td{height:32px}
        td.n{width:5%;text-align:center;color:#666}
        td.tarefa{width:45%}
        td.resp{width:22%}
        td.check{width:8%;text-align:center}
        td.visto{width:20%}
        .box{display:inline-block;width:14px;height:14px;border:2px solid #333;border-radius:3px;line-height:12px;font-size:12px;font-weight:bold}
        .box.feito{background:#333;color:#fff}
        .assin{margin-top:24px;display:flex;justify-content:space-between;gap:40px}
        .assin div{flex:1;border-top:1px solid #333;padding-top:5px;font-size:10px;text-align:center;color:#444}
        @media print{@page{margin:0}}
      </style></head><body>
      <div class="head">
        <div>
          <div class="tag">${deptLabel} · ${tipoLabel} · ${unidadeInfo?.nome || ""}</div>
          <h1>${tmpl.titulo}</h1>
        </div>
        <div class="meta">${tmpl.itens?.length || 0} tarefas<span>${preenchido ? "registro do que foi feito" : "marque ao concluir e vista"}</span></div>
      </div>
      <div class="datas">Data: <b>${preenchido ? new Date().toLocaleDateString("pt-BR") : "&nbsp;"}</b> Turno/Horário: <b>&nbsp;</b> Responsável geral: <b>${preenchido ? (nomePor(colabSelecionado) || "&nbsp;") : "&nbsp;"}</b></div>
      <table>
        <thead><tr><th>#</th><th>Tarefa</th><th>Responsável</th><th>Feito</th><th>Visto / Hora</th></tr></thead>
        <tbody>${itensHtml}${extras}</tbody>
      </table>
      <div class="assin">
        <div>Responsável pelo ${deptLabel}</div>
        <div>Gerente / Conferência</div>
      </div>
      </body></html>`;

    const win = window.open("", "_blank");
    if (win) { win.document.write(html); win.document.close(); setTimeout(() => win.print(), 400); }
    else alert("O navegador bloqueou a impressão. Habilite os popups.");
  };

  /* ─── Imprime TODOS os checklists do setor, cada um numa folha ─── */
  const imprimirTodos = () => {
    if (!templatesExibidos.length) return alert("Nenhum checklist para imprimir.");
    const corDept = t.cor;
    const bloco = (tmpl) => {
      let catB = null;
      const linhas = (tmpl.itens || []).map((it, i) => {
        const cat = (it.categoria || "").trim();
        const header = cat && cat !== catB ? (catB = cat, `<tr class="cat"><td colspan="5">${cat}</td></tr>`) : "";
        return `${header}<tr><td class="n">${i + 1}</td><td class="tarefa">${it.texto || ""}</td><td class="resp">${it.responsavel || ""}</td><td class="check"><span class="box"></span></td><td class="visto"></td></tr>`;
      }).join("");
      const extras = Array.from({ length: 2 }).map((_, i) => `
        <tr><td class="n">${(tmpl.itens?.length || 0) + i + 1}</td><td class="tarefa"></td><td class="resp"></td><td class="check"><span class="box"></span></td><td class="visto"></td></tr>`).join("");
      return `<section>
        <div class="head">
          <div><div class="tag">${t.nome} · ${ROTULOS_TIPO[tmpl.tipo] || tmpl.tipo} · ${unidadeInfo?.nome || ""}</div><h1>${tmpl.titulo}</h1></div>
          <div class="meta">${tmpl.itens?.length || 0} tarefas<span>marque ao concluir e vista</span></div>
        </div>
        <div class="datas">Data: <b>&nbsp;</b> Turno/Horário: <b>&nbsp;</b> Responsável geral: <b>&nbsp;</b></div>
        <table><thead><tr><th>#</th><th>Tarefa</th><th>Responsável</th><th>Feito</th><th>Visto / Hora</th></tr></thead><tbody>${linhas}${extras}</tbody></table>
        <div class="assin"><div>Responsável pelo ${t.nome}</div><div>Gerente / Conferência</div></div>
      </section>`;
    };
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Checklists ${t.nome}</title>
      <style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:Arial,Helvetica,sans-serif;color:#111}
        section{padding:8mm;page-break-after:always}
        section:last-child{page-break-after:auto}
        .head{border-bottom:4px solid ${corDept};padding-bottom:10px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:flex-end}
        .tag{font-size:10px;letter-spacing:3px;text-transform:uppercase;color:${corDept};font-weight:bold}
        h1{font-size:22px;margin-top:4px}
        .meta{font-size:12px;font-weight:bold;text-align:right}.meta span{display:block;font-size:10px;color:#555;font-weight:normal;margin-top:2px}
        .datas{display:flex;gap:24px;font-size:12px;margin:10px 0 12px;font-weight:bold}.datas b{border-bottom:1px solid #999;min-width:120px;display:inline-block}
        table{width:100%;border-collapse:collapse}
        th,td{border:1px solid #333;padding:8px 6px;font-size:12px;vertical-align:middle}
        th{background:${corDept}22;text-transform:uppercase;letter-spacing:.5px;font-size:9px;color:${corDept}}
        tr.cat td{background:${corDept}18;color:${corDept};font-weight:bold;text-transform:uppercase;letter-spacing:1px;font-size:10px;height:auto;padding:5px 6px}
        td{height:32px}td.n{width:5%;text-align:center;color:#666}td.tarefa{width:45%}td.resp{width:22%}td.check{width:8%;text-align:center}td.visto{width:20%}
        .box{display:inline-block;width:14px;height:14px;border:2px solid #333;border-radius:3px;line-height:12px;font-size:12px;font-weight:bold}
        .box.feito{background:#333;color:#fff}
        .assin{margin-top:24px;display:flex;justify-content:space-between;gap:40px}.assin div{flex:1;border-top:1px solid #333;padding-top:5px;font-size:10px;text-align:center;color:#444}
        @media print{@page{margin:0}}
      </style></head><body>${templatesExibidos.map(bloco).join("")}</body></html>`;
    const win = window.open("", "_blank");
    if (win) { win.document.write(html); win.document.close(); setTimeout(() => win.print(), 400); }
    else alert("O navegador bloqueou a impressão. Habilite os popups.");
  };

  /* ─── ESCOLHA DA ÁREA ─── */
  // Mesma ideia do estoque: a área é uma decisão explícita, não um padrão
  // silencioso. Vem antes de qualquer carregamento porque escolher aqui muda
  // quais checklists a tela vai buscar.
  if (precisaEscolherArea) {
    return (
      <div className="min-h-screen pb-28">
        <PageHeader title="Checklists" subtitle={`Escolha a área · ${unidadeInfo?.nome || ""}`} icon={ClipboardList} back={false} />
        <PageBody>
          <div className="grid gap-4 sm:grid-cols-3">
            {["cozinha", "bar", "salao"].map((chave) => {
              const tema = TEMAS[chave];
              const AreaIcon = tema.Icon;
              return (
                <button key={chave} onClick={() => router.push(`/dashboard/operacao/rotina?dept=${chave}`)}
                  className="erp-card flex flex-col items-center gap-3 p-7 text-center transition-all active:scale-[0.98]"
                  style={{ border: `2px solid ${tema.corBorda}`, background: tema.corBg }}>
                  <span className="grid h-16 w-16 place-items-center rounded-2xl bg-white/70" style={{ color: tema.cor }}>
                    <AreaIcon size={30} />
                  </span>
                  <span className="text-lg font-black" style={{ color: tema.corTexto }}>{tema.nome}</span>
                  <span className="text-xs font-bold" style={{ color: tema.corTexto, opacity: .75 }}>
                    Abertura, fechamento e conferências
                  </span>
                </button>
              );
            })}
          </div>
          <button onClick={() => router.push("/dashboard/checklists/gerenciar")}
            className="erp-btn erp-btn-ghost mt-5 !h-12 text-xs">
            Montar e gerenciar checklists
          </button>
        </PageBody>
      </div>
    );
  }

  /* ─── EXECUÇÃO DE UM CHECKLIST ─── */
  if (checklistAtual) {
    const DIcon = t.Icon;
    const tipoLabel = ROTULOS_TIPO[checklistAtual.tipo] || checklistAtual.tipo;

    return (
      <div className="min-h-screen pb-28">
        <PageHeader title={checklistAtual.titulo} subtitle={`${t.nome} · ${tipoLabel} · ${unidadeInfo?.nome || ""}`} icon={DIcon} back={false}>
          <button onClick={() => setChecklistAtual(null)} className="erp-btn erp-btn-ghost !h-11 text-xs">← Voltar</button>
          <button onClick={() => imprimir(checklistAtual)} className="erp-btn erp-btn-ghost !h-11 text-xs" title="Folha em branco para marcar à mão"><Printer size={14} /> Imprimir lista</button>
        </PageHeader>
        <PageBody>
          {/* Progresso */}
          <div className="erp-card p-5 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-28 h-28 opacity-[0.05]">
              <DIcon size={112} style={{ position: "absolute", top: -16, right: -16, color: t.cor }} />
            </div>
            <div className="flex items-end justify-between mb-3 relative z-[1]">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: t.cor }}>{t.nome} · {tipoLabel}</p>
                <p className="text-5xl font-black leading-none" style={{ color: pct === 100 ? t.cor : "var(--fg)" }}>{pct}%</p>
              </div>
              <div className="text-right">
                <p className="text-[11px] font-bold" style={{ color: "var(--dim)" }}>{concluidas} de {itens.length}</p>
                <p className="text-[10px]" style={{ color: "var(--dim)" }}>tarefas concluídas</p>
              </div>
            </div>
            <div className="h-3 rounded-full overflow-hidden" style={{ background: "var(--elevated)" }}>
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${t.cor}CC, ${t.cor})` }} />
            </div>
            {pct === 100 && <p className="text-xs font-black mt-2 flex items-center gap-1" style={{ color: t.cor }}><CheckCircle2 size={14} /> Todas concluídas!</p>}
          </div>

          {/* Distribuição da equipe */}
          <Card>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${t.cor}15` }}>
                  <Users size={17} style={{ color: t.cor }} />
                </div>
                <div>
                  <p className="text-sm font-black" style={{ color: "var(--fg)" }}>Como as atividades serão divididas?</p>
                  <p className="text-[10px] font-medium" style={{ color: "var(--dim)" }}>Escolha antes de iniciar. Você pode alterar durante a execução.</p>
                </div>
              </div>
              <span className="self-start sm:self-auto px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider"
                style={{ background: `${t.cor}12`, color: t.corTexto }}>
                {naoAtribuidas === 0 ? `${pessoasAtribuidas} pessoa(s)` : `${naoAtribuidas} sem responsável`}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
              <button type="button" onClick={() => trocarModoAtribuicao("uma_pessoa")} disabled={registrado || salvando || concluidas > 0}
                aria-pressed={modoAtribuicao === "uma_pessoa"}
                className="text-left rounded-2xl p-4 transition-all active:scale-[0.99]"
                style={{
                  border: `2px solid ${modoAtribuicao === "uma_pessoa" ? t.cor : "var(--line)"}`,
                  background: modoAtribuicao === "uma_pessoa" ? `${t.cor}0D` : "var(--card-bg)",
                }}>
                <div className="flex items-center gap-2 mb-1">
                  <UserCheck size={18} style={{ color: modoAtribuicao === "uma_pessoa" ? t.cor : "var(--muted)" }} />
                  <span className="text-sm font-black" style={{ color: "var(--fg)" }}>Uma pessoa faz tudo</span>
                </div>
                <p className="text-[11px] font-medium" style={{ color: "var(--dim)" }}>Um funcionário fica responsável por todas as atividades.</p>
              </button>
              <button type="button" onClick={() => trocarModoAtribuicao("dividir")} disabled={registrado || salvando || concluidas > 0}
                aria-pressed={modoAtribuicao === "dividir"}
                className="text-left rounded-2xl p-4 transition-all active:scale-[0.99]"
                style={{
                  border: `2px solid ${modoAtribuicao === "dividir" ? t.cor : "var(--line)"}`,
                  background: modoAtribuicao === "dividir" ? `${t.cor}0D` : "var(--card-bg)",
                }}>
                <div className="flex items-center gap-2 mb-1">
                  <Users size={18} style={{ color: modoAtribuicao === "dividir" ? t.cor : "var(--muted)" }} />
                  <span className="text-sm font-black" style={{ color: "var(--fg)" }}>Dividir entre a equipe</span>
                </div>
                <p className="text-[11px] font-medium" style={{ color: "var(--dim)" }}>Cada atividade ou categoria pode ficar com uma pessoa.</p>
              </button>
            </div>

            {colaboradoresDoSetor.length === 0 ? (
              <div className="rounded-xl p-3 text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                Nenhum funcionário ativo foi encontrado para {t.nome}. Revise a área ou o cargo no cadastro de funcionários.
              </div>
            ) : modoAtribuicao === "uma_pessoa" ? (
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest" style={{ color: t.cor }}>Pessoa responsável por tudo</label>
                <select value={colabSelecionado} onChange={e => atribuirTodos(e.target.value)} disabled={registrado || salvando || concluidas > 0}
                  className="w-full p-3.5 mt-1 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none"
                  style={{ borderColor: colabSelecionado ? t.cor : undefined }}>
                  <option value="">-- Selecione o funcionário --</option>
                  {colaboradoresDoSetor.map(c => <option key={c.id} value={c.id}>{c.nome}{c.cargo ? ` (${c.cargo})` : ""}</option>)}
                </select>
              </div>
            ) : (
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest" style={{ color: t.cor }}>Quem confere e finaliza?</label>
                <select value={colabSelecionado} onChange={e => setColabSelecionado(e.target.value)} disabled={registrado || salvando}
                  className="w-full p-3.5 mt-1 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none"
                  style={{ borderColor: colabSelecionado ? t.cor : undefined }}>
                  <option value="">-- Selecione quem vai conferir --</option>
                  {colaboradoresDoSetor.map(c => <option key={c.id} value={c.id}>{c.nome}{c.cargo ? ` (${c.cargo})` : ""}</option>)}
                </select>
                <p className="text-[10px] font-medium mt-1.5" style={{ color: "var(--dim)" }}>O responsável de cada atividade é escolhido logo abaixo. Esta pessoa apenas confere e encerra o checklist.</p>
              </div>
            )}
          </Card>

          {/* Itens */}
          <div>
            <SectionLabel>Tarefas</SectionLabel>
            <div className="space-y-2">
              {itens.map((it, i) => {
                const rItem = respostas[it.id] || {};
                const ok = !!rItem.marcado;
                const aberto = exp === it.id;
                const cat = (it.categoria || "").trim();
                const catAnterior = i > 0 ? (itens[i - 1].categoria || "").trim() : null;
                const mostrarCat = cat && cat !== catAnterior;
                const responsavelAtual = rItem.feito_por || "";
                const nomeResponsavel = colaboradoresDoSetor.find(c => String(c.id) === String(responsavelAtual))?.nome || "";
                const itensDaCategoria = cat ? itens.filter(item => (item.categoria || "").trim() === cat) : [];
                const responsaveisCategoria = new Set(itensDaCategoria.map(item => respostas[item.id]?.feito_por).filter(Boolean));
                const responsavelCategoria = responsaveisCategoria.size === 1 ? [...responsaveisCategoria][0] : "";
                
                const textoLower = (it.texto || "").toLowerCase();
                const isTempItem = it.tipo_item === "temperatura" || /(temperatura|c[aâ]mara|freezer|geladeira|estufa|balc[aã]o|frio)/i.test(textoLower);
                let minTemp = it.temp_min;
                let maxTemp = it.temp_max;
                if (minTemp === undefined && maxTemp === undefined) {
                  if (/freezer|congelad/i.test(textoLower)) { minTemp = -25; maxTemp = -12; }
                  else if (/c[aâ]mara|geladeira|resfriad/i.test(textoLower)) { minTemp = 0; maxTemp = 5; }
                  else if (/estufa|quente|balc[aã]o quente/i.test(textoLower)) { minTemp = 60; maxTemp = 90; }
                }

                const statusItem = rItem.status || (rItem.temp_alerta ? "nao_conforme" : (ok ? "conforme" : undefined));

                return (
                  <div key={it.id}>
                  {mostrarCat && (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mt-5 mb-2 px-1">
                      <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: t.cor }}>{cat}</p>
                      {modoAtribuicao === "dividir" && (
                        <select value={responsavelCategoria} onChange={e => atribuirCategoria(cat, e.target.value)} disabled={registrado || salvando}
                          className="w-full sm:w-auto min-w-[220px] p-2.5 text-base font-bold rounded-lg outline-none focus-visible:ring-2"
                          style={{ background: `${t.cor}0D`, border: `1px solid ${t.cor}35`, color: t.corTexto }}>
                          <option value="">Atribuir categoria inteira...</option>
                          {colaboradoresDoSetor.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                        </select>
                      )}
                    </div>
                  )}
                  <div className="erp-card !p-0 overflow-hidden transition-all duration-200"
                    style={{
                      borderColor: statusItem === "nao_conforme" ? "#EF4444" : ok ? t.cor : undefined,
                      borderWidth: ok || statusItem ? 2 : undefined,
                      boxShadow: statusItem === "nao_conforme" ? "0 4px 20px rgba(239,68,68,0.2)" : ok ? `0 4px 20px ${t.cor}15` : undefined
                    }}>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3.5">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <button onClick={() => toggle(it.id)} disabled={registrado || salvando}
                          aria-label={ok ? `Desmarcar atividade ${i + 1}` : `Concluir atividade ${i + 1}`}
                          className="w-11 h-11 flex items-center justify-center flex-shrink-0 active:scale-90 transition-all duration-200 rounded-xl focus-visible:ring-2">
                          {statusItem === "nao_conforme" ? (
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-rose-600 text-white font-black">
                              <X size={18} />
                            </div>
                          ) : ok ? (
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: t.cor }}>
                              <Check size={18} color="#fff" />
                            </div>
                          ) : (
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center border-2" style={{ borderColor: "var(--faint)", color: "var(--dim)" }}>
                              <span className="text-xs font-black">{i + 1}</span>
                            </div>
                          )}
                        </button>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold leading-tight transition-all"
                            style={{ color: statusItem === "nao_conforme" ? "#DC2626" : ok ? t.cor : "var(--fg)", textDecoration: ok && statusItem !== "nao_conforme" ? "line-through" : "none", opacity: ok ? 0.85 : 1 }}>
                            {it.texto}
                          </p>
                          {it.responsavel && <p className="text-[11px] font-bold mt-0.5" style={{ color: "var(--dim)" }}>Responsável: {it.responsavel}</p>}
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                            <span className="text-[11px] font-bold flex items-center gap-1" style={{ color: nomeResponsavel ? t.corTexto : "var(--dim)" }}>
                              <User size={11} /> {nomeResponsavel || "Sem funcionário atribuído"}
                            </span>
                            {ok && (
                              <span className="text-[11px] font-bold flex items-center gap-1" style={{ color: t.cor }}>
                                <Clock3 size={11} /> {horaCurta(rItem.concluido_em)}
                              </span>
                            )}
                            {rItem.foto && <span className="text-[11px] font-bold flex items-center gap-1" style={{ color: t.cor }}><ImageIcon size={11} /> foto</span>}
                            {rItem.plano_acao && <span className="text-[10px] font-black uppercase text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md">Plano de Ação</span>}
                          </div>
                        </div>
                      </div>

                      {/* BOTOES DE STATUS TIPO KONCLUI */}
                      <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                        <button
                          type="button"
                          onClick={() => mudaStatusItem(it.id, "conforme")}
                          disabled={registrado || salvando}
                          className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1 ${
                            statusItem === "conforme"
                              ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/20 scale-105"
                              : "bg-slate-100 text-slate-600 hover:bg-emerald-100 hover:text-emerald-800"
                          }`}
                        >
                          <Check size={14} /> Conforme
                        </button>
                        <button
                          type="button"
                          onClick={() => mudaStatusItem(it.id, "nao_conforme")}
                          disabled={registrado || salvando}
                          className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1 ${
                            statusItem === "nao_conforme"
                              ? "bg-rose-600 text-white shadow-md shadow-rose-600/20 scale-105 animate-pulse"
                              : "bg-slate-100 text-slate-600 hover:bg-rose-100 hover:text-rose-800"
                          }`}
                        >
                          <X size={14} /> Não Conforme
                        </button>
                        <button
                          type="button"
                          onClick={() => mudaStatusItem(it.id, "na")}
                          disabled={registrado || salvando}
                          className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                            statusItem === "na"
                              ? "bg-slate-700 text-white"
                              : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                          }`}
                        >
                          N/A
                        </button>
                        <button onClick={() => setExp(aberto ? null : it.id)} aria-expanded={aberto}
                          className="w-9 h-9 flex items-center justify-center shrink-0 rounded-xl focus-visible:ring-2" title="Detalhes e fotos">
                          <ChevronDown size={16} style={{ color: "var(--dim)", transform: aberto ? "rotate(180deg)" : "none", transition: "transform 200ms" }} />
                        </button>
                      </div>
                    </div>

                    {/* MEDICAO DE TEMPERATURA SE FOR ITEM DE TEMPERATURA */}
                    {isTempItem && (
                      <div className="mx-4 mb-3 flex flex-wrap items-center gap-2 bg-amber-50/90 border border-amber-200 rounded-xl p-2.5 text-xs">
                        <span className="font-black text-amber-900 flex items-center gap-1">🌡️ Temperatura Medida:</span>
                        <input
                          type="number"
                          step="0.1"
                          placeholder="0.0"
                          value={rItem.temperatura_val || ""}
                          onChange={e => mudaTemperatura(it.id, e.target.value, minTemp, maxTemp)}
                          disabled={registrado || salvando}
                          className="w-24 p-2 bg-white border-2 border-amber-300 rounded-lg font-black text-center text-sm text-amber-950 outline-none focus:border-amber-500"
                        />
                        <span className="font-black text-amber-900">°C</span>
                        {(minTemp !== undefined || maxTemp !== undefined) && (
                          <span className="text-[10px] font-bold text-amber-800 ml-auto">
                            Faixa Ideal: {minTemp !== undefined ? minTemp + "°C" : ""} {maxTemp !== undefined ? "até " + maxTemp + "°C" : ""}
                          </span>
                        )}
                        {rItem.temp_alerta && (
                          <span className="w-full mt-1 font-black text-[10px] uppercase text-rose-700 bg-rose-100 border border-rose-200 rounded-md p-1 text-center">
                            ⚠️ Alerta Koncluí: Temperatura fora dos limites permitidos!
                          </span>
                        )}
                      </div>
                    )}

                    {/* PLANO DE ACAO SE NAO CONFORME */}
                    {(statusItem === "nao_conforme" || rItem.temp_alerta) && (
                      <div className="mx-4 mb-3 bg-rose-50 border-2 border-rose-200 rounded-2xl p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-rose-900 flex items-center gap-1">
                            ⚠️ Plano de Ação / Tratativa de Não Conformidade (Koncluí)
                          </span>
                          <span className="text-[10px] font-black uppercase text-rose-700 bg-rose-100 px-2 py-0.5 rounded-md">Obrigatório</span>
                        </div>
                        <textarea
                          rows={2}
                          placeholder="Descreva a ação corretiva imediata realizada (ex: Ajustado termostato, acionada manutenção e transferidos alimentos)..."
                          value={rItem.plano_acao || ""}
                          onChange={e => mudaPlanoAcao(it.id, e.target.value)}
                          disabled={registrado || salvando}
                          className="w-full p-2.5 bg-white border border-rose-300 rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-rose-500"
                        />
                      </div>
                    )}
                    {modoAtribuicao === "dividir" && (
                      <div className="px-4 pb-3">
                        <label className="block text-[11px] font-black uppercase tracking-wider mb-1" style={{ color: t.cor }}>Funcionário desta atividade</label>
                        <select value={responsavelAtual} onChange={e => mudaFeitoPor(it.id, e.target.value)} disabled={registrado || salvando || ok}
                          className="w-full p-3 text-base font-bold rounded-xl outline-none focus-visible:ring-2"
                          style={{ background: `${t.cor}08`, border: `1px solid ${responsavelAtual ? t.cor : `${t.cor}45`}`, color: t.corTexto }}>
                          <option value="">-- Escolha quem vai fazer --</option>
                          {colaboradoresDoSetor.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                        </select>
                      </div>
                    )}
                    {aberto && (
                      <div className="px-4 pb-3 pt-2 space-y-2" style={{ borderTop: "1px solid var(--line)" }}>
                        {/* Foto de comprovação */}
                        <div className="flex items-center gap-2">
                          {respostas[it.id]?.foto ? (
                            <div className="relative">
                              <button type="button" onClick={() => setFotoAmpliada(respostas[it.id].foto)} className="rounded-lg focus-visible:ring-2" title="Ampliar foto">
                                <img src={`data:image/jpeg;base64,${respostas[it.id].foto}`} alt="Comprovação" className="h-16 w-24 object-cover rounded-lg border" style={{ borderColor: `${t.cor}50` }} />
                              </button>
                              {!registrado && !salvando && <button onClick={() => removerFotoTarefa(it.id)} aria-label="Remover foto"
                                className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-rose-500 text-white flex items-center justify-center shadow focus-visible:ring-2"><X size={15} /></button>}
                            </div>
                          ) : registrado ? (
                            <span className="text-xs font-bold" style={{ color: "var(--dim)" }}>Atividade registrada sem foto.</span>
                          ) : (
                            <label className="min-h-11 flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm sm:text-xs font-bold cursor-pointer"
                              style={{ background: `${t.cor}12`, color: t.corTexto, border: `1px dashed ${t.cor}50` }}>
                              <Camera size={14} /> Foto de comprovação
                              <input type="file" accept="image/*" capture="environment" className="hidden" disabled={salvando}
                                onChange={e => { anexarFotoTarefa(it.id, e.target.files?.[0]); e.target.value = ""; }} />
                            </label>
                          )}
                        </div>
                        <input type="text" placeholder="Observação (opcional)"
                          value={respostas[it.id]?.obs || ""}
                          onChange={e => mudaObs(it.id, e.target.value)}
                          disabled={registrado || salvando}
                          className="w-full p-3 text-base font-medium rounded-lg outline-none focus-visible:ring-2"
                          style={{ background: `${t.cor}08`, border: `1px solid ${t.cor}30`, color: t.corTexto }}
                          onClick={e => e.stopPropagation()} />
                      </div>
                    )}
                  </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Finalizar */}
          {registrado ? (
            <div className="erp-card p-6 flex flex-col items-center text-center gap-2" style={{ border: `2px solid ${t.cor}`, background: t.corClara }}>
              <CheckCircle2 size={40} style={{ color: t.cor }} />
              <p className="text-lg font-black" style={{ color: t.corTexto }}>Checklist registrado!</p>
              <p className="text-xs font-medium" style={{ color: t.corTexto }}>
                {t.nome} · {tipoLabel} · {unidadeInfo?.nome}
                {colabSelecionado ? <> — {modoAtribuicao === "dividir" ? "conferido por" : "feito por"} <b>{colaboradores.find(c => c.id === colabSelecionado)?.nome || ""}</b></> : " — sem responsável informado"}
              </p>
              <button onClick={compartilharWhatsApp}
                className="mt-2 flex items-center gap-2 px-5 py-3 rounded-xl font-black text-sm text-white transition-all active:scale-95"
                style={{ background: "#25D366", boxShadow: "0 6px 20px rgba(37,211,102,0.35)" }}>
                <Share2 size={16} /> Enviar comprovação no WhatsApp
              </button>
              <button onClick={() => imprimir(checklistAtual, respostas)}
                className="mt-1 flex items-center gap-2 px-5 py-3 rounded-xl font-black text-sm border-2 transition-all active:scale-95"
                style={{ borderColor: t.cor, color: t.cor }}>
                <Printer size={16} /> Imprimir o que foi feito
              </button>
              <button onClick={() => setChecklistAtual(null)} className="mt-1 text-sm font-bold underline" style={{ color: t.cor }}>← Voltar aos checklists</button>
            </div>
          ) : (
            <button className="w-full py-4 rounded-2xl font-black text-base transition-all duration-200 active:scale-[0.98] flex items-center justify-center gap-2"
              disabled={pct < 100 || salvando}
              onClick={finalizar}
              style={{
                background: pct === 100 ? t.cor : "var(--elevated)",
                color: pct === 100 ? "#fff" : "var(--dim)",
                boxShadow: pct === 100 ? `0 8px 30px ${t.cor}40` : "none",
                cursor: pct < 100 ? "not-allowed" : "pointer",
              }}>
              {salvando ? <><Loader2 size={18} className="animate-spin" /> Salvando...</> :
                pct === 100 ? "Finalizar e registrar" : `Conclua as tarefas (${itens.length - concluidas} restantes)`}
            </button>
          )}
        </PageBody>
        <VisualizadorFoto foto={fotoAmpliada} onClose={() => setFotoAmpliada("")} />
      </div>
    );
  }

  /* ─── LISTA DE CHECKLISTS POR DEPARTAMENTO ─── */
  const DIcon = t.Icon;
  const idsExecutadosHoje = new Set(historico.map(h => String(h.template_id)));
  const templatesDoDia = templatesExibidos.filter(template =>
    (template.frequencia || "diario") === "diario" || idsExecutadosHoje.has(String(template.id))
  );
  const idsDoDia = new Set(templatesDoDia.map(template => String(template.id)));
  const feitosHoje = new Set(historico.filter(h => idsDoDia.has(String(h.template_id))).map(h => String(h.template_id))).size;
  const progressoHoje = templatesDoDia.length ? Math.round(Math.min(feitosHoje, templatesDoDia.length) / templatesDoDia.length * 100) : 0;
  const pendentesHoje = Math.max(0, templatesDoDia.length - feitosHoje);
  const tituloSetor = dept === "cozinha" ? "da Cozinha" : dept === "bar" ? "do Bar" : "do Salão";
  const escopoTipo = filtroTipo === "limpeza" ? "Limpeza" : filtroTipo === "operacional" ? "Operação" : null;

  return (
    <div className="min-h-screen pb-24">
      <PageHeader title={`Checklist ${tituloSetor}`} subtitle={`${t.nome}${escopoTipo ? ` · ${escopoTipo}` : ""} · ${unidadeInfo?.nome || ""} · área exclusiva`} icon={DIcon}
        onAction={estacaoTravada ? undefined : () => router.push(`/dashboard/checklists/gerenciar?dept=${dept}`)}
        actionLabel={estacaoTravada ? undefined : "Gerenciar"}>
        <button onClick={abrirProdutividade} className="erp-btn erp-btn-ghost !h-11 text-xs"><BarChart3 size={14} /> Produtividade</button>
        {templatesExibidos.length > 0 && (
          <button onClick={imprimirTodos} className="erp-btn erp-btn-ghost !h-11 text-xs"><Printer size={14} /> Imprimir todos</button>
        )}
      </PageHeader>
      <PageBody>
        {/* Trocar de área sem voltar ao menu, igual à fileira do estoque.
            Estação travada não vê: ela só pode operar o próprio setor. */}
        {!estacaoTravada && (
          <div className="mb-5 flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {["cozinha", "bar", "salao"].map((chave) => {
              const tema = TEMAS[chave];
              const AreaIcon = tema.Icon;
              const ativo = chave === dept;
              return (
                <button key={chave} type="button"
                  onClick={() => router.push(`/dashboard/operacao/rotina?dept=${chave}${filtroTipo ? `&tipo=${filtroTipo}` : ""}`)}
                  className="flex shrink-0 items-center gap-2.5 rounded-xl px-4 py-2.5 text-xs font-black transition-all"
                  style={ativo
                    ? { background: tema.cor, color: "#fff", boxShadow: `0 6px 18px ${tema.cor}40` }
                    : { border: "1px solid var(--border)", background: "var(--elevated)", color: "var(--dim)" }}>
                  <AreaIcon size={14} /> {tema.nome}
                </button>
              );
            })}
          </div>
        )}

        {/* Resumo exclusivo do setor */}
        <div className="relative overflow-hidden rounded-3xl p-5 sm:p-6 mb-2" style={{ background: t.corBg, border: `1px solid ${t.corBorda}` }}>
          <DIcon size={150} className="absolute -right-8 -bottom-10 opacity-[0.08]" style={{ color: t.corTexto }} />
          <div className="relative z-[1] flex flex-col lg:flex-row lg:items-center justify-between gap-5">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0" style={{ background: t.cor, boxShadow: `0 10px 30px ${t.cor}35` }}>
                <DIcon size={27} color="#fff" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: t.corTexto }}>Rotina do setor</p>
                <h2 className="text-xl sm:text-2xl font-black" style={{ color: t.corTexto }}>{t.nome}</h2>
                <p className="text-xs font-medium mt-0.5" style={{ color: t.corTexto, opacity: 0.8 }}>Checklists, equipe e histórico deste setor reunidos em um só lugar.</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:gap-3 min-w-0 lg:min-w-[390px]">
              <div className="rounded-2xl p-3 text-center" style={{ background: "rgba(255,255,255,.68)" }}>
                <p className="text-xl font-black" style={{ color: t.corTexto }}>{progressoHoje}%</p>
                <p className="text-[11px] font-black uppercase tracking-wide" style={{ color: t.corTexto, opacity: 0.7 }}>progresso</p>
              </div>
              <div className="rounded-2xl p-3 text-center" style={{ background: "rgba(255,255,255,.68)" }}>
                <p className="text-xl font-black" style={{ color: t.corTexto }}>{feitosHoje}</p>
                <p className="text-[11px] font-black uppercase tracking-wide" style={{ color: t.corTexto, opacity: 0.7 }}>feitos hoje</p>
              </div>
              <div className="rounded-2xl p-3 text-center" style={{ background: "rgba(255,255,255,.68)" }}>
                <p className="text-xl font-black" style={{ color: t.corTexto }}>{pendentesHoje}</p>
                <p className="text-[11px] font-black uppercase tracking-wide" style={{ color: t.corTexto, opacity: 0.7 }}>pendentes</p>
              </div>
            </div>
          </div>
          <div className="relative z-[1] h-2 rounded-full overflow-hidden mt-5" style={{ background: "rgba(255,255,255,.62)" }}>
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progressoHoje}%`, background: t.cor }} />
          </div>
        </div>

        {/* Lista de Templates */}
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-3" style={{ color: t.cor }}>
            <Loader2 size={24} className="animate-spin" />
            <span className="font-bold text-sm">Carregando checklists...</span>
          </div>
        ) : erroCarga ? (
          <EmptyState icon={ClipboardList} title="Não consegui carregar os checklists"
            hint={`${erroCarga} — não quer dizer que este setor não tenha checklist. Tente de novo daqui a pouco.`}
            actionLabel="Tentar de novo" onAction={() => carregar()} />
        ) : templatesExibidos.length === 0 ? (
          <EmptyState icon={ClipboardList} title={`Nenhum checklist de ${t.nome}`}
            hint={estacaoTravada ? "Peça a um gerente para criar os modelos deste setor." : "Crie modelos de abertura, fechamento, mise en place etc. pelo Gerenciar."}
            actionLabel={estacaoTravada ? undefined : "Criar checklists"}
            onAction={estacaoTravada ? undefined : () => router.push(`/dashboard/checklists/gerenciar?dept=${dept}`)} />
        ) : (
          <div className="space-y-6">
            {ORDEM_TIPOS.filter(tipo => templatesExibidos.some(x => x.tipo === tipo)).map(tipo => (
              <div key={tipo}>
                <SectionLabel>{ROTULOS_TIPO[tipo] || tipo}</SectionLabel>
                <div className="space-y-3">
                  {templatesExibidos.filter(x => x.tipo === tipo).sort((a, b) => (historico.some(h => h.template_id === a.id) ? 1 : 0) - (historico.some(h => h.template_id === b.id) ? 1 : 0)).map(tmpl => {
                    const execucoesHoje = historico
                      .filter(h => h.template_id === tmpl.id)
                      .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
                    const execHoje = execucoesHoje[0];
                    const detalhesAbertos = historicoAberto === tmpl.id;
                    return (
                    <div key={tmpl.id} className="erp-card !p-0 overflow-hidden hover:shadow-lg transition-all duration-200"
                      style={{ borderLeft: `4px solid ${execHoje ? t.cor : t.cor}` }}>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 sm:p-5">
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: execHoje ? t.cor : `${t.cor}15` }}>
                          {execHoje ? <CheckCircle2 size={22} color="#fff" /> : <DIcon size={22} style={{ color: t.cor }} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-base font-black leading-tight break-words sm:truncate" style={{ color: "var(--fg)" }}>{tmpl.titulo}</h3>
                          {execHoje ? (
                            <p className="text-[11px] font-bold mt-0.5" style={{ color: t.cor }}>
                              ✓ Feito hoje por {execHoje.colaboradores?.nome || "colaborador"} · {horaCurta(execHoje.created_at)}
                              {execucoesHoje.length > 1 ? ` · ${execucoesHoje.length} execuções` : ""}
                            </p>
                          ) : (
                            <p className="text-[11px] font-medium mt-0.5" style={{ color: "var(--dim)" }}>
                              {tmpl.itens?.length || 0} tarefas
                              {(tmpl.itens || []).some(i => i.responsavel) && <span style={{ color: t.cor }}> · responsáveis definidos</span>}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 sm:flex-shrink-0 w-full sm:w-auto">
                          <button onClick={() => imprimir(tmpl)} title="Imprimir"
                            className="w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-200"
                            style={{ background: "var(--elevated)", color: "var(--muted)" }}>
                            <Printer size={17} />
                          </button>
                          <button onClick={() => iniciar(tmpl)}
                            className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl font-black text-sm transition-all duration-200 active:scale-95"
                            style={{ background: execHoje ? "var(--elevated)" : t.cor, color: execHoje ? "var(--muted)" : "#fff", boxShadow: execHoje ? "none" : `0 4px 16px ${t.cor}30` }}>
                            {execHoje ? "Refazer" : "Preencher"}
                          </button>
                        </div>
                      </div>
                      {execHoje && (
                        <div style={{ borderTop: "1px solid var(--line)" }}>
                          <button type="button" onClick={() => setHistoricoAberto(detalhesAbertos ? null : tmpl.id)}
                            className="w-full px-4 sm:px-5 py-3 flex items-center justify-between text-xs font-black"
                            style={{ color: t.corTexto, background: `${t.cor}08` }}>
                            <span className="flex items-center gap-2"><Clock3 size={14} /> Histórico detalhado de hoje</span>
                            <ChevronDown size={15} style={{ transform: detalhesAbertos ? "rotate(180deg)" : "none", transition: "transform 200ms" }} />
                          </button>
                          {detalhesAbertos && (
                            <div className="p-4 sm:p-5 space-y-4" style={{ background: `${t.cor}04` }}>
                              {execucoesHoje.map((execucao, execIndex) => (
                                <div key={execucao.id || execIndex} className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${t.cor}25`, background: "var(--card-bg)" }}>
                                  <div className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-1" style={{ background: `${t.cor}0C` }}>
                                    <span className="text-xs font-black" style={{ color: t.corTexto }}>Execução {execucoesHoje.length - execIndex} · {horaCurta(execucao.created_at)}</span>
                                    <span className="text-[10px] font-bold" style={{ color: "var(--dim)" }}>Conferido por {execucao.colaboradores?.nome || "colaborador"}</span>
                                  </div>
                                  <div className="divide-y" style={{ borderColor: "var(--line)" }}>
                                    {(Array.isArray(execucao.respostas) ? execucao.respostas : []).filter(r => r.marcado).map((resposta, respostaIndex) => (
                                      <div key={resposta.id_tarefa || respostaIndex} className="p-3 sm:p-4 flex items-start gap-3">
                                        <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: t.cor }}><Check size={14} color="#fff" /></div>
                                        <div className="flex-1 min-w-0">
                                          <p className="text-xs font-bold" style={{ color: "var(--fg)" }}>{resposta.texto_tarefa || "Atividade concluída"}</p>
                                          <p className="text-[11px] font-bold mt-1 flex flex-wrap gap-x-3 gap-y-1" style={{ color: t.corTexto }}>
                                            <span className="flex items-center gap-1"><User size={10} /> {resposta.feito_por_nome || execucao.colaboradores?.nome || "Sem identificação"}</span>
                                            <span className="flex items-center gap-1"><Clock3 size={10} /> {horaCurta(resposta.concluido_em || execucao.created_at)}</span>
                                          </p>
                                          {resposta.obs && <p className="text-[11px] mt-1" style={{ color: "var(--dim)" }}>Observação: {resposta.obs}</p>}
                                        </div>
                                        {resposta.foto && (
                                          <button type="button" onClick={() => setFotoAmpliada(resposta.foto)} className="rounded-xl shrink-0 focus-visible:ring-2" title="Ampliar foto">
                                            <img src={`data:image/jpeg;base64,${resposta.foto}`} alt="Foto da atividade" className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl object-cover" style={{ border: `1px solid ${t.cor}35` }} />
                                          </button>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );})}
                </div>
              </div>
            ))}
          </div>
        )}

      </PageBody>

      {/* PRODUTIVIDADE INDIVIDUAL — só do setor atual, por dia/mês/ano */}
      {modalProd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4" onClick={() => setModalProd(false)}>
          <div className="bg-white rounded-[28px] w-full max-w-lg max-h-[calc(100dvh-2rem)] overflow-y-auto p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-xl font-black text-slate-800 flex items-center gap-2"><BarChart3 size={20} style={{ color: t.cor }} /> Produtividade · {t.nome}</h2>
              <button onClick={() => setModalProd(false)} className="w-9 h-9 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200"><X size={17} /></button>
            </div>
            <p className="text-xs font-medium text-slate-500 mb-3">Tarefas concluídas por pessoa, somente da equipe {t.nome}.</p>

            {/* Período: dia / mês / ano */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <div className="inline-flex gap-1 p-1 rounded-xl bg-slate-100">
                {[["dia", "Dia"], ["mes", "Mês"], ["ano", "Ano"]].map(([v, l]) => (
                  <button key={v} onClick={() => setProdTipo(v)}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                    style={prodTipo === v ? { background: "#fff", color: t.corTexto, boxShadow: "0 1px 2px rgba(0,0,0,.12)" } : { color: "#64748b" }}>
                    {l}
                  </button>
                ))}
              </div>
              {prodTipo === "dia" && (
                <input type="date" value={prodDia} onChange={e => setProdDia(e.target.value)}
                  className="h-9 rounded-lg border border-slate-200 px-2 text-sm font-bold text-slate-700" />
              )}
              {prodTipo === "mes" && (
                <input type="month" value={prodMes} onChange={e => setProdMes(e.target.value)}
                  className="h-9 rounded-lg border border-slate-200 px-2 text-sm font-bold text-slate-700" />
              )}
              {prodTipo === "ano" && (
                <input type="number" min="2020" max="2100" value={prodAno} onChange={e => setProdAno(e.target.value)}
                  className="h-9 w-24 rounded-lg border border-slate-200 px-2 text-sm font-bold text-slate-700" />
              )}
              <button onClick={imprimirProdutividade} disabled={!prodDados || prodDados.length === 0}
                className="ml-auto h-9 px-3 rounded-lg text-xs font-bold flex items-center gap-1.5 disabled:opacity-40"
                style={{ background: t.cor, color: "#fff" }}>
                <Printer size={14} /> Imprimir
              </button>
            </div>

            {prodLoading ? (
              <p className="text-center font-bold text-slate-400 py-8"><Loader2 size={20} className="animate-spin inline mr-2" />Calculando...</p>
            ) : !prodDados || prodDados.length === 0 ? (
              <p className="text-sm font-medium text-slate-400 text-center py-8">Nenhum checklist registrado neste período.</p>
            ) : (() => {
              const max = prodDados[0].tarefas || 1;
              return (
                <div className="space-y-2.5">
                  {prodDados.map((p, i) => (
                    <div key={i}>
                      <div className="flex justify-between items-baseline text-sm mb-1">
                        <span className="font-bold text-slate-700 truncate flex items-center gap-1.5">
                          {i === 0 && <span className="text-[9px] font-black uppercase tracking-widest rounded px-1.5 py-0.5" style={{ color: t.corTexto, background: t.corBg, border: `1px solid ${t.corBorda}` }}>top</span>}
                          {p.nome}
                        </span>
                        <span className="font-black text-slate-800 shrink-0 ml-2">{p.tarefas} <span className="text-[10px] font-bold text-slate-400">tarefa(s) · {p.checklists} check.</span></span>
                      </div>
                      <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.max(4, (p.tarefas / max) * 100)}%`, background: t.cor }} />
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </div>
      )}
      <VisualizadorFoto foto={fotoAmpliada} onClose={() => setFotoAmpliada("")} />
    </div>
  );
}

export default function RotinaPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center font-bold text-slate-500">Carregando checklists...</div>}>
      <RotinaRunner />
    </Suspense>
  );
}
