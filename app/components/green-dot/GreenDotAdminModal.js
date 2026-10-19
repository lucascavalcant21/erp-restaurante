"use client";

import React, { useState } from "react";
import {
  X,
  Plus,
  Trash2,
  Upload,
  UtensilsCrossed,
  Wrench,
  CheckCircle2,
  Sparkles,
  PlayCircle,
  Zap,
  Scale,
} from "lucide-react";
import {
  salvarReceitaCustom,
  removerReceitaCustom,
  salvarEquipamentoCustom,
  removerEquipamentoCustom,
} from "../../lib/green-dot-data";
import { salvarGuia, TIPOS_GUIA } from "../../lib/guias";

function lerArquivoComoDataUrl(file) {
  return new Promise((resolve) => {
    if (!file) return resolve("");
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => resolve("");
    reader.readAsDataURL(file);
  });
}

export default function GreenDotAdminModal({
  aberto,
  onFechar,
  unidadeId,
  fichasReais = [],
  estoqueReal = [],
  receitasCustom = [],
  equipamentosCustom = [],
  onAtualizarDados,
  abaInicial = "receitas",
}) {
  const [aba, setAba] = useState(abaInicial || "receitas"); // "receitas" | "equipamentos"
  const [msgSucesso, setMsgSucesso] = useState("");

  useEffect(() => {
    if (abaInicial) setAba(abaInicial);
  }, [abaInicial]);

  // ── ESTADO DO FORMULÁRIO DE RECEITA / FICHA TÉCNICA ────────────────────────
  const [fichaImportarId, setFichaImportarId] = useState("");
  const [recNome, setRecNome] = useState("");
  const [recSetor, setRecSetor] = useState("Cozinha Quente");
  const [recPorcoes, setRecPorcoes] = useState("10");
  const [recPeso, setRecPeso] = useState("2,5 kg");
  const [recDescricao, setRecDescricao] = useState("");
  const [recFoto, setRecFoto] = useState("");
  const [recVideo, setRecVideo] = useState("");
  const [recIngredientes, setRecIngredientes] = useState([
    { id: "ing-1", nome: "Leite de coco", quantidade: 3, unidade: "L" },
    { id: "ing-2", nome: "Camarão seco", quantidade: 1.5, unidade: "kg" },
  ]);
  const [recPassos, setRecPassos] = useState([
    {
      ordem: 1,
      titulo: "Preparar mise en place e hidratar base",
      detalhe: "Separe e pese todos os insumos na bancada antes de iniciar o fogo.",
      imagem: "",
    },
  ]);

  // ── ESTADO DO FORMULÁRIO DE EQUIPAMENTO (110V/220V + ENCAIXE + USO + LIMPEZA) ─
  const [eqNome, setEqNome] = useState("");
  const [eqCategoria, setEqCategoria] = useState("liquidificador");
  const [eqSetor, setEqSetor] = useState("Cozinha");
  const [eqVoltagem, setEqVoltagem] = useState("220V");
  const [eqTomada, setEqTomada] = useState("Tomada Vermelha 20A (Bancada)");
  const [eqAlerta, setEqAlerta] = useState("");
  const [eqFoto, setEqFoto] = useState("");
  const [eqVideo, setEqVideo] = useState("");

  const [encaixeTexto, setEncaixeTexto] = useState(
    "1. Alinhe a base do copo no pino de arraste com o motor desligado.\n2. Gire levemente até assentar nos apoios de borracha.\n3. Trave a tampa e a sobretampa central antes de ligar."
  );
  const [encaixeFoto, setEncaixeFoto] = useState("");
  const [encaixeVideo, setEncaixeVideo] = useState("");

  const [usoTexto, setUsoTexto] = useState(
    "1. Coloque sempre os líquidos primeiro e depois os sólidos.\n2. Use o botão PULSAR 3 vezes antes da velocidade contínua.\n3. Respeite o limite máximo do copo para líquidos quentes."
  );
  const [usoFoto, setUsoFoto] = useState("");
  const [usoVideo, setUsoVideo] = useState("");

  const [limpezaTexto, setLimpezaTexto] = useState(
    "1. Bata água morna com detergente neutro por 15 segundos.\n2. Desmonte a borracha de vedação da tampa e lave em água corrente.\n3. Sanitize com álcool 70% e seque emborcado."
  );
  const [limpezaFoto, setLimpezaFoto] = useState("");
  const [limpezaVideo, setLimpezaVideo] = useState("");

  if (!aberto) return null;

  // Importar dados de uma Ficha Técnica existente do ERP (Cozinha ou Bar)
  const importarDaFichaERP = (idFicha) => {
    setFichaImportarId(idFicha);
    const f = fichasReais.find((x) => String(x.id) === String(idFicha));
    if (!f) return;
    setRecNome(f.nome || "");
    setRecSetor(f.departamento === "bar" ? "Bar & Coquetelaria" : "Cozinha Quente");
    setRecPorcoes(String(f.rendimento_porcoes || f.porcoes || 10));
    setRecPeso(f.rendimento_peso ? `${f.rendimento_peso} g` : "1,5 kg");
    setRecDescricao(f.modo_preparo || f.observacoes || `Receita oficial sincronizada da ficha ${f.nome}.`);
    if (f.foto_url) setRecFoto(f.foto_url);

    const ings = Array.isArray(f.fichas_ingredientes) ? f.fichas_ingredientes : [];
    if (ings.length > 0) {
      setRecIngredientes(
        ings.map((item, idx) => ({
          id: `ing-erp-${idx}`,
          nome: item.insumos?.nome || item.nome || `Ingrediente ${idx + 1}`,
          quantidade: Number(item.quantidade || 1),
          unidade: item.unidade_medida || item.insumos?.unidade_medida || "g",
        }))
      );
    }
  };

  const salvarNovaReceita = (e) => {
    e.preventDefault();
    if (!recNome.trim()) return;

    const ingsLimpos = recIngredientes
      .filter((i) => i.nome && Number(i.quantidade) > 0)
      .map((i, idx) => ({
        id: i.id || `ing-${idx}`,
        nome: i.nome.trim(),
        quantidade: Number(String(i.quantidade).replace(",", ".")),
        unidade: i.unidade || "g",
        sinonimos: [i.nome.trim().toLowerCase()],
      }));

    const fotoPadrao =
      recFoto ||
      "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=1000&q=80";

    const novaReceita = {
      id: `custom-rec-${Date.now()}`,
      codigo: `FT-${Math.floor(100 + Math.random() * 899)}`,
      nome: recNome.trim(),
      subtituloNota: `*Ficha Cadastrada na Loja — Rende ${recPorcoes} porções (${recPeso})`,
      setor: recSetor,
      tempoPreparo: "20 min",
      rendimentoPorcoes: Number(recPorcoes) || 10,
      rendimentoPeso: recPeso,
      imagem: fotoPadrao,
      videoUrl: recVideo.trim() || "",
      descricao:
        recDescricao.trim() ||
        `Receita oficial da casa para ${recNome.trim()}. Todos os ingredientes estão conectados ao motor de recálculo proporcional.`,
      perfilSensorial: {
        sabor: "Padrão autoral equilibrado",
        aroma: "Aromático e fresco",
        textura: "Ponto padrão de serviço",
      },
      basePrincipal: ingsLimpos.slice(0, 2).map((i) => i.nome).join(" + ") || "Base da Ficha Técnica",
      colunasTamanho: ["P", "M", "G", "TOTAL"],
      legendaTamanhos: `P = Meia · M = Individual · G = Duplo · TOTAL = Receita Base (${recPorcoes} porções)`,
      ingredientesBase: ingsLimpos,
      majorSteps: ingsLimpos.slice(0, 4).map((ing, idx) => ({
        id: idx + 1,
        etapa: `${ing.nome} (${ing.unidade})`,
        valores: [
          String(Math.round(ing.quantidade * 0.1 * 10) / 10),
          String(Math.round(ing.quantidade * 0.2 * 10) / 10),
          String(Math.round(ing.quantidade * 0.4 * 10) / 10),
          String(ing.quantidade),
        ],
      })),
      videoSteps: recPassos.map((p, idx) => ({
        ordem: idx + 1,
        titulo: p.titulo || `Etapa ${idx + 1}`,
        detalhe: p.detalhe || "",
        imagem: p.imagem || fotoPadrao,
      })),
      customizacoes: [
        {
          id: "adap-custom",
          label: "Adaptações de bancada e restrições",
          opcoes: [
            { id: "sem-lactose", label: "Versão sem lactose / restritiva" },
            { id: "delivery", label: "Embalagem selada para viagem" },
          ],
        },
      ],
      dicasCategorias: {
        customizacao: "Mantenha sempre o porcionamento pesado na balança para preservar o CMV.",
        sabor: "Siga a ordem das etapas e temperatura de serviço.",
        substituicoes: "Use o botão 'Recalcular por Ingrediente' se tiver menos insumo na bancada.",
      },
      harmonizacoes: [],
    };

    const lista = salvarReceitaCustom(novaReceita, unidadeId);
    onAtualizarDados?.({ receitas: lista });
    setMsgSucesso(`Receita "${novaReceita.nome}" salva! Já pode perguntar sobre ela ou recalcular ingredientes.`);
    setTimeout(() => setMsgSucesso(""), 4000);
  };

  const salvarNovoEquipamento = async (e) => {
    e.preventDefault();
    if (!eqNome.trim()) return;

    const fotoPrincipal =
      eqFoto ||
      "https://images.unsplash.com/photo-1570222094114-d054a817e56b?auto=format&fit=crop&w=800&q=80";

    const separarLinhas = (txt) =>
      String(txt || "")
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);

    const novoEq = {
      id: `custom-eq-${Date.now()}`,
      categoriaTipo: eqCategoria,
      nome: eqNome.trim(),
      nomeCurto: eqNome.trim(),
      codigoSerie: `SN-${Math.floor(1000 + Math.random() * 8999)}`,
      setor: eqSetor,
      voltagem: eqVoltagem,
      corTomada: eqTomada,
      alertaVoltagem:
        eqAlerta.trim() ||
        `ATENÇÃO: Equipamento ${eqVoltagem}. Conecte exclusivamente na ${eqTomada} do setor ${eqSetor}.`,
      falhaPrincipal: "Verificação de encaixe, alimentação elétrica e limpeza",
      imagem: fotoPrincipal,
      videoUrl: eqVideo.trim() || "",
      guiaEncaixe: {
        titulo: `Como Encaixar Copo, Tampa e Peças — ${eqNome.trim()}`,
        resumo: "Siga a ordem de encaixe com o equipamento desligado da tomada.",
        foto: encaixeFoto || fotoPrincipal,
        videoUrl: encaixeVideo.trim() || eqVideo.trim() || "",
        passos: separarLinhas(encaixeTexto),
      },
      guiaUso: {
        titulo: `Como Usar / Operar — ${eqNome.trim()}`,
        resumo: "Operação padronizada para Cozinha e Bar.",
        foto: usoFoto || fotoPrincipal,
        videoUrl: usoVideo.trim() || eqVideo.trim() || "",
        passos: separarLinhas(usoTexto),
      },
      guiaLimpeza: {
        titulo: `Como Limpar e Higienizar — ${eqNome.trim()}`,
        resumo: "Procedimento de higienização segura pós-uso.",
        foto: limpezaFoto || fotoPrincipal,
        videoUrl: limpezaVideo.trim() || eqVideo.trim() || "",
        passos: separarLinhas(limpezaTexto),
      },
      hotspots: [
        { id: "h1", label: `Alimentação ${eqVoltagem}`, x: "25%", y: "30%" },
        { id: "h2", label: "Trava & Encaixe Principal", x: "75%", y: "45%" },
        { id: "h3", label: "Painel de Comando", x: "25%", y: "70%" },
      ],
      pecasReposicao: [],
      passosTroubleshooting: separarLinhas(encaixeTexto).map((inst, idx, arr) => ({
        passo: idx + 1,
        total: arr.length,
        instrucao: inst,
        detalhe: `Confirme que está ligado em ${eqVoltagem} (${eqTomada}).`,
      })),
      checklistPreChamado: [
        {
          titulo: "Verificar alimentação elétrica e encaixe de segurança",
          passos: separarLinhas(encaixeTexto),
        },
      ],
    };

    const lista = salvarEquipamentoCustom(novoEq, unidadeId);
    onAtualizarDados?.({ equipamentos: lista });

    // Salva também em guias_operacionais do Supabase se houver unidade ativa
    if (unidadeId) {
      salvarGuia({
        unidade_id: unidadeId,
        tipo: TIPOS_GUIA.EQUIPAMENTO,
        titulo: `${novoEq.nome} (${novoEq.voltagem})`,
        setor: eqSetor.toLowerCase(),
        imagem_url: fotoPrincipal,
        observacoes: `${novoEq.voltagem} · ${novoEq.corTomada}`,
        conteudo: [
          { secao: "Voltagem", texto: novoEq.alertaVoltagem },
          { secao: "Como Encaixar", passos: novoEq.guiaEncaixe.passos },
          { secao: "Como Usar", passos: novoEq.guiaUso.passos },
          { secao: "Como Limpar", passos: novoEq.guiaLimpeza.passos },
        ],
      }).catch(() => {});
    }

    setMsgSucesso(
      `Equipamento "${novoEq.nome} (${novoEq.voltagem})" cadastrado com sucesso! Já aparece nas buscas por foto.`
    );
    setTimeout(() => setMsgSucesso(""), 4000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-[#FAF9F6] border-2 border-[#1E4D3B] rounded-3xl max-w-4xl w-full max-h-[92dvh] flex flex-col overflow-hidden shadow-2xl text-[#1C2826]">
        {/* Header do Modal */}
        <div className="bg-[#1E4D3B] text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Sparkles size={20} className="text-emerald-300" />
            <div>
              <h2 className="text-base sm:text-lg font-black">
                Central de Alimentação do Green Dot Assist (Cozinha &amp; Bar)
              </h2>
              <p className="text-xs text-emerald-200 font-medium">
                Cadastre Receitas (com ingredientes para recálculo), Fotos, Vídeos e Equipamentos (110V/220V, encaixe, uso e limpeza)
              </p>
            </div>
          </div>
          <button
            onClick={onFechar}
            className="w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center text-white"
          >
            <X size={18} />
          </button>
        </div>

        {/* Abas Superiores */}
        <div className="px-5 pt-3 bg-[#EAE8E1] border-b border-[#D6D4CA] flex gap-2">
          <button
            onClick={() => setAba("receitas")}
            className={`px-4 py-2.5 rounded-t-xl text-xs sm:text-sm font-extrabold flex items-center gap-2 transition ${
              aba === "receitas"
                ? "bg-[#FAF9F6] text-[#1E4D3B] border-t-2 border-x border-[#1E4D3B]"
                : "text-[#4F5853] hover:bg-white/50"
            }`}
          >
            <UtensilsCrossed size={16} />
            1. Receitas, Fichas Técnicas &amp; Ingredientes
          </button>
          <button
            onClick={() => setAba("equipamentos")}
            className={`px-4 py-2.5 rounded-t-xl text-xs sm:text-sm font-extrabold flex items-center gap-2 transition ${
              aba === "equipamentos"
                ? "bg-[#FAF9F6] text-[#1E4D3B] border-t-2 border-x border-[#1E4D3B]"
                : "text-[#4F5853] hover:bg-white/50"
            }`}
          >
            <Wrench size={16} />
            2. Equipamentos (110V/220V, Encaixe, Uso e Limpeza)
          </button>
        </div>

        {msgSucesso && (
          <div className="mx-5 mt-4 p-3.5 rounded-xl bg-emerald-100 border border-emerald-400 text-emerald-950 text-xs sm:text-sm font-extrabold flex items-center gap-2">
            <CheckCircle2 size={18} className="text-emerald-700 shrink-0" />
            <span>{msgSucesso}</span>
          </div>
        )}

        {/* Corpo Rolável */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {aba === "receitas" ? (
            <form onSubmit={salvarNovaReceita} className="space-y-5">
              {/* Importar de Ficha Técnica Real do ERP */}
              {fichasReais.length > 0 && (
                <div className="p-4 rounded-2xl bg-[#EFF7F2] border border-[#B8D8C5] space-y-2">
                  <label className="block text-xs font-black text-[#1E4D3B]">
                    🔗 Importar Ingredientes de uma Ficha Técnica já Cadastrada no ERP (Cozinha ou Bar):
                  </label>
                  <select
                    value={fichaImportarId}
                    onChange={(e) => importarDaFichaERP(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#2E6F4E] bg-white text-xs sm:text-sm font-bold"
                  >
                    <option value="">-- Selecionar Ficha Técnica do ERP para preencher --</option>
                    {fichasReais.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.nome} ({f.departamento || "Cozinha/Bar"})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-5">
                  <label className="block text-xs font-extrabold text-[#2B332E] mb-1">
                    Nome do Prato ou Drink *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Vatapá Baiano, Moqueca, Gin Tônica..."
                    value={recNome}
                    onChange={(e) => setRecNome(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#C8C6BC] bg-white text-xs sm:text-sm font-bold"
                  />
                </div>
                <div className="sm:col-span-3">
                  <label className="block text-xs font-extrabold text-[#2B332E] mb-1">Setor</label>
                  <select
                    value={recSetor}
                    onChange={(e) => setRecSetor(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-[#C8C6BC] bg-white text-xs sm:text-sm font-bold"
                  >
                    <option value="Cozinha Quente">Cozinha Quente</option>
                    <option value="Garde Manger / Frios">Garde Manger / Frios</option>
                    <option value="Bar & Coquetelaria">Bar &amp; Coquetelaria</option>
                    <option value="Confeitaria & Sobremesas">Confeitaria &amp; Sobremesas</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-extrabold text-[#2B332E] mb-1">
                    Rende (Porções)
                  </label>
                  <input
                    type="number"
                    value={recPorcoes}
                    onChange={(e) => setRecPorcoes(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-[#C8C6BC] bg-white text-xs sm:text-sm font-bold"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-extrabold text-[#2B332E] mb-1">
                    Peso/Volume Total
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: 6,5 kg"
                    value={recPeso}
                    onChange={(e) => setRecPeso(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-[#C8C6BC] bg-white text-xs sm:text-sm font-bold"
                  />
                </div>
              </div>

              {/* Foto e Vídeo da Receita */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-2xl bg-white border border-[#E2E0D8]">
                <div className="space-y-1.5">
                  <label className="block text-xs font-extrabold text-[#2B332E]">
                    📸 Foto do Prato / Drink (Enviar Arquivo ou Link)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Cole o link da foto ou envie ao lado ->"
                      value={recFoto}
                      onChange={(e) => setRecFoto(e.target.value)}
                      className="flex-1 px-3 py-2 rounded-xl border border-[#C8C6BC] text-xs font-semibold"
                    />
                    <label className="px-3 py-2 rounded-xl bg-[#2E6F4E] text-white text-xs font-bold cursor-pointer flex items-center gap-1 shrink-0">
                      <Upload size={14} /> Foto
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const url = await lerArquivoComoDataUrl(e.target.files?.[0]);
                          if (url) setRecFoto(url);
                        }}
                      />
                    </label>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-extrabold text-[#2B332E]">
                    🎥 Vídeo do Modo de Preparo (Link YouTube ou MP4)
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: https://www.youtube.com/watch?v=..."
                    value={recVideo}
                    onChange={(e) => setRecVideo(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#C8C6BC] text-xs font-semibold"
                  />
                </div>
              </div>

              {/* Ingredientes para o Motor de Recálculo Proporcional */}
              <div className="p-4 rounded-2xl bg-white border border-[#E2E0D8] space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs sm:text-sm font-black text-[#1E4D3B] flex items-center gap-1.5">
                      <Scale size={16} /> Ingredientes Base da Receita (Para Recálculo Automático)
                    </h4>
                    <p className="text-[11px] text-[#55605A]">
                      Quando o funcionário disser &ldquo;só tenho X de tal ingrediente&rdquo;, o sistema recalculará toda esta lista proporcionalmente!
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setRecIngredientes((prev) => [
                        ...prev,
                        { id: `ing-${Date.now()}`, nome: "", quantidade: 1, unidade: "kg" },
                      ])
                    }
                    className="px-3 py-1.5 rounded-lg bg-[#EFF7F2] border border-[#2E6F4E] text-[#1E4D3B] text-xs font-extrabold flex items-center gap-1"
                  >
                    <Plus size={14} /> + Ingrediente
                  </button>
                </div>

                <datalist id="lista-insumos-estoque">
                  {estoqueReal.map((item) => (
                    <option key={item.id} value={item.nome} />
                  ))}
                </datalist>

                <div className="space-y-2">
                  {recIngredientes.map((ing, idx) => (
                    <div key={ing.id} className="grid grid-cols-12 gap-2 items-center">
                      <input
                        type="text"
                        list="lista-insumos-estoque"
                        placeholder="Nome do ingrediente (ex: Leite de coco)"
                        value={ing.nome}
                        onChange={(e) => {
                          const v = e.target.value;
                          setRecIngredientes((prev) =>
                            prev.map((x, i) => (i === idx ? { ...x, nome: v } : x))
                          );
                        }}
                        className="col-span-6 px-3 py-2 rounded-lg border border-[#C8C6BC] text-xs font-bold"
                      />
                      <input
                        type="number"
                        step="any"
                        placeholder="Qtd"
                        value={ing.quantidade}
                        onChange={(e) => {
                          const v = e.target.value;
                          setRecIngredientes((prev) =>
                            prev.map((x, i) => (i === idx ? { ...x, quantidade: v } : x))
                          );
                        }}
                        className="col-span-3 px-3 py-2 rounded-lg border border-[#C8C6BC] text-xs font-bold"
                      />
                      <select
                        value={ing.unidade}
                        onChange={(e) => {
                          const v = e.target.value;
                          setRecIngredientes((prev) =>
                            prev.map((x, i) => (i === idx ? { ...x, unidade: v } : x))
                          );
                        }}
                        className="col-span-2 px-2 py-2 rounded-lg border border-[#C8C6BC] text-xs font-bold bg-white"
                      >
                        <option value="L">L</option>
                        <option value="ml">ml</option>
                        <option value="kg">kg</option>
                        <option value="g">g</option>
                        <option value="un">un</option>
                        <option value="maço">maço</option>
                      </select>
                      <button
                        type="button"
                        onClick={() =>
                          setRecIngredientes((prev) => prev.filter((_, i) => i !== idx))
                        }
                        className="col-span-1 text-red-600 hover:bg-red-50 p-2 rounded-lg flex justify-center"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Passo a Passo com Foto de Cada Etapa */}
              <div className="p-4 rounded-2xl bg-white border border-[#E2E0D8] space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs sm:text-sm font-black text-[#1E4D3B]">
                    📋 Passo a Passo Visual do Modo de Preparo
                  </h4>
                  <button
                    type="button"
                    onClick={() =>
                      setRecPassos((prev) => [
                        ...prev,
                        { ordem: prev.length + 1, titulo: "", detalhe: "", imagem: "" },
                      ])
                    }
                    className="px-3 py-1.5 rounded-lg bg-[#EFF7F2] border border-[#2E6F4E] text-[#1E4D3B] text-xs font-extrabold flex items-center gap-1"
                  >
                    <Plus size={14} /> + Etapa
                  </button>
                </div>

                {recPassos.map((p, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-[#FAF9F6] border border-[#E2E0D8] space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <input
                        type="text"
                        placeholder={`Título do Passo ${idx + 1} (ex: Bater no liquidificador com leite de coco)`}
                        value={p.titulo}
                        onChange={(e) => {
                          const v = e.target.value;
                          setRecPassos((prev) =>
                            prev.map((x, i) => (i === idx ? { ...x, titulo: v } : x))
                          );
                        }}
                        className="flex-1 px-3 py-1.5 rounded-lg border border-[#C8C6BC] bg-white text-xs font-bold"
                      />
                      <label className="px-2.5 py-1.5 rounded-lg bg-white border border-[#2E6F4E] text-[#1E4D3B] text-[11px] font-bold cursor-pointer flex items-center gap-1">
                        <Upload size={12} /> Foto do Passo
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={async (e) => {
                            const url = await lerArquivoComoDataUrl(e.target.files?.[0]);
                            if (url) {
                              setRecPassos((prev) =>
                                prev.map((x, i) => (i === idx ? { ...x, imagem: url } : x))
                              );
                            }
                          }}
                        />
                      </label>
                    </div>
                    <textarea
                      rows={2}
                      placeholder="Explicação detalhada deste passo..."
                      value={p.detalhe}
                      onChange={(e) => {
                        const v = e.target.value;
                        setRecPassos((prev) =>
                          prev.map((x, i) => (i === idx ? { ...x, detalhe: v } : x))
                        );
                      }}
                      className="w-full px-3 py-1.5 rounded-lg border border-[#C8C6BC] bg-white text-xs"
                    />
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="submit"
                  className="px-6 py-3 rounded-xl bg-[#1E4D3B] hover:bg-[#15382A] text-white font-black text-xs sm:text-sm shadow-md transition"
                >
                  ✓ Salvar Receita no Green Dot Assist
                </button>
              </div>

              {/* Lista de receitas custom já salvas */}
              {receitasCustom.length > 0 && (
                <div className="pt-3 border-t border-[#E2E0D8] space-y-2">
                  <p className="text-xs font-extrabold text-[#55605A]">
                    Receitas personalizadas cadastradas nesta loja:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {receitasCustom.map((r) => (
                      <div
                        key={r.id}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-[#C8C6BC] text-xs font-bold"
                      >
                        <span>{r.nome}</span>
                        <button
                          type="button"
                          onClick={() => {
                            const nova = removerReceitaCustom(r.id, unidadeId);
                            onAtualizarDados?.({ receitas: nova });
                          }}
                          className="text-red-600 hover:text-red-800"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </form>
          ) : (
            /* ABA 2: CADASTRAR EQUIPAMENTO (110V/220V + COMO ENCAIXAR + COMO USAR + COMO LIMPAR) */
            <form onSubmit={salvarNovoEquipamento} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-5">
                  <label className="block text-xs font-extrabold text-[#2B332E] mb-1">
                    Nome / Modelo do Equipamento *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Liquidificador Industrial Skymsen 4L"
                    value={eqNome}
                    onChange={(e) => setEqNome(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#C8C6BC] bg-white text-xs sm:text-sm font-bold"
                  />
                </div>
                <div className="sm:col-span-3">
                  <label className="block text-xs font-extrabold text-[#2B332E] mb-1">
                    Categoria
                  </label>
                  <select
                    value={eqCategoria}
                    onChange={(e) => setEqCategoria(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-[#C8C6BC] bg-white text-xs sm:text-sm font-bold"
                  >
                    <option value="liquidificador">Liquidificador / Triturador</option>
                    <option value="forno">Forno / Salamandra</option>
                    <option value="fritadeira">Fritadeira / Fogão / Chapa</option>
                    <option value="chopeira">Chopeira / Cafeteira / Bar</option>
                    <option value="refrigeracao">Câmara Fria / Freezer / Gelo</option>
                    <option value="outro">Outro Equipamento</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-extrabold text-[#2B332E] mb-1">Setor</label>
                  <select
                    value={eqSetor}
                    onChange={(e) => setEqSetor(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-[#C8C6BC] bg-white text-xs sm:text-sm font-bold"
                  >
                    <option value="Cozinha">Cozinha</option>
                    <option value="Bar">Bar</option>
                    <option value="Salão / Caixa">Salão / Caixa</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-extrabold text-[#2B332E] mb-1">
                    Voltagem ⚡
                  </label>
                  <select
                    value={eqVoltagem}
                    onChange={(e) => setEqVoltagem(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border-2 border-[#2E6F4E] bg-[#EFF7F2] text-xs sm:text-sm font-black text-[#1E4D3B]"
                  >
                    <option value="220V">220V</option>
                    <option value="110V (127V)">110V (127V)</option>
                    <option value="Bivolt">Bivolt</option>
                    <option value="380V Trifásico">380V Trifásico</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-extrabold text-[#2B332E] mb-1">
                    Identificação da Tomada / Local na Bancada
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Tomada Vermelha 20A ao lado do fogão"
                    value={eqTomada}
                    onChange={(e) => setEqTomada(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-[#C8C6BC] bg-white text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-extrabold text-[#2B332E] mb-1">
                    Alerta Elétrico para o Funcionário
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Nunca ligue na tomada preta 110V do bar!"
                    value={eqAlerta}
                    onChange={(e) => setEqAlerta(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-[#C8C6BC] bg-white text-xs font-bold"
                  />
                </div>
              </div>

              {/* Foto Principal e Vídeo do Equipamento */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-2xl bg-white border border-[#E2E0D8]">
                <div className="space-y-1.5">
                  <label className="block text-xs font-extrabold text-[#2B332E]">
                    📸 Foto do Equipamento (Aparece para o funcionário clicar!)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Link da foto ou envie do aparelho ->"
                      value={eqFoto}
                      onChange={(e) => setEqFoto(e.target.value)}
                      className="flex-1 px-3 py-2 rounded-xl border border-[#C8C6BC] text-xs font-semibold"
                    />
                    <label className="px-3 py-2 rounded-xl bg-[#2E6F4E] text-white text-xs font-bold cursor-pointer flex items-center gap-1 shrink-0">
                      <Upload size={14} /> Enviar Foto
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const url = await lerArquivoComoDataUrl(e.target.files?.[0]);
                          if (url) setEqFoto(url);
                        }}
                      />
                    </label>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-extrabold text-[#2B332E]">
                    🎥 Vídeo Geral do Equipamento (YouTube ou MP4)
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: https://www.youtube.com/watch?v=..."
                    value={eqVideo}
                    onChange={(e) => setEqVideo(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#C8C6BC] text-xs font-semibold"
                  />
                </div>
              </div>

              {/* Os 3 Guias Visuais: Como Encaixar (Copo/Tampa), Como Usar e Como Limpar */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* 1. Como Encaixar */}
                <div className="p-4 rounded-2xl bg-white border border-[#E2E0D8] space-y-2.5">
                  <h4 className="text-xs font-black text-[#1E4D3B] uppercase">
                    🧩 1. Como Encaixar (Copo, Tampa, Peças)
                  </h4>
                  <textarea
                    rows={4}
                    value={encaixeTexto}
                    onChange={(e) => setEncaixeTexto(e.target.value)}
                    placeholder="Um passo por linha..."
                    className="w-full p-2.5 rounded-xl border border-[#C8C6BC] text-xs font-medium"
                  />
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      placeholder="Link vídeo encaixe (opcional)"
                      value={encaixeVideo}
                      onChange={(e) => setEncaixeVideo(e.target.value)}
                      className="flex-1 px-2.5 py-1.5 rounded-lg border border-[#C8C6BC] text-[11px]"
                    />
                    <label className="px-2.5 py-1.5 rounded-lg bg-[#EFF7F2] border border-[#2E6F4E] text-[#1E4D3B] text-[11px] font-bold cursor-pointer">
                      + Foto
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const u = await lerArquivoComoDataUrl(e.target.files?.[0]);
                          if (u) setEncaixeFoto(u);
                        }}
                      />
                    </label>
                  </div>
                </div>

                {/* 2. Como Usar */}
                <div className="p-4 rounded-2xl bg-white border border-[#E2E0D8] space-y-2.5">
                  <h4 className="text-xs font-black text-[#1E4D3B] uppercase">
                    ▶️ 2. Como Usar / Operar
                  </h4>
                  <textarea
                    rows={4}
                    value={usoTexto}
                    onChange={(e) => setUsoTexto(e.target.value)}
                    placeholder="Um passo por linha..."
                    className="w-full p-2.5 rounded-xl border border-[#C8C6BC] text-xs font-medium"
                  />
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      placeholder="Link vídeo de uso (opcional)"
                      value={usoVideo}
                      onChange={(e) => setUsoVideo(e.target.value)}
                      className="flex-1 px-2.5 py-1.5 rounded-lg border border-[#C8C6BC] text-[11px]"
                    />
                    <label className="px-2.5 py-1.5 rounded-lg bg-[#EFF7F2] border border-[#2E6F4E] text-[#1E4D3B] text-[11px] font-bold cursor-pointer">
                      + Foto
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const u = await lerArquivoComoDataUrl(e.target.files?.[0]);
                          if (u) setUsoFoto(u);
                        }}
                      />
                    </label>
                  </div>
                </div>

                {/* 3. Como Limpar */}
                <div className="p-4 rounded-2xl bg-white border border-[#E2E0D8] space-y-2.5">
                  <h4 className="text-xs font-black text-[#1E4D3B] uppercase">
                    🧼 3. Como Limpar e Higienizar
                  </h4>
                  <textarea
                    rows={4}
                    value={limpezaTexto}
                    onChange={(e) => setLimpezaTexto(e.target.value)}
                    placeholder="Um passo por linha..."
                    className="w-full p-2.5 rounded-xl border border-[#C8C6BC] text-xs font-medium"
                  />
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      placeholder="Link vídeo limpeza (opcional)"
                      value={limpezaVideo}
                      onChange={(e) => setLimpezaVideo(e.target.value)}
                      className="flex-1 px-2.5 py-1.5 rounded-lg border border-[#C8C6BC] text-[11px]"
                    />
                    <label className="px-2.5 py-1.5 rounded-lg bg-[#EFF7F2] border border-[#2E6F4E] text-[#1E4D3B] text-[11px] font-bold cursor-pointer">
                      + Foto
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const u = await lerArquivoComoDataUrl(e.target.files?.[0]);
                          if (u) setLimpezaFoto(u);
                        }}
                      />
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="submit"
                  className="px-6 py-3 rounded-xl bg-[#1E4D3B] hover:bg-[#15382A] text-white font-black text-xs sm:text-sm shadow-md transition"
                >
                  ✓ Salvar Equipamento no Green Dot Assist
                </button>
              </div>

              {equipamentosCustom.length > 0 && (
                <div className="pt-3 border-t border-[#E2E0D8] space-y-2">
                  <p className="text-xs font-extrabold text-[#55605A]">
                    Equipamentos personalizados cadastrados nesta loja:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {equipamentosCustom.map((eq) => (
                      <div
                        key={eq.id}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-[#C8C6BC] text-xs font-bold"
                      >
                        <span>
                          {eq.nome} ({eq.voltagem})
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const nova = removerEquipamentoCustom(eq.id, unidadeId);
                            onAtualizarDados?.({ equipamentos: nova });
                          }}
                          className="text-red-600 hover:text-red-800"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
