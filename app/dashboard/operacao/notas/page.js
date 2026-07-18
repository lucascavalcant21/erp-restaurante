"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { ReceiptText, ScanLine, Camera, Trash2, Calendar, Clock, ArrowDownAZ, CheckCircle, BrainCircuit, UploadCloud, X } from "lucide-react";
import {
  PageHeader, PageBody, Card, KpiGrid, Kpi,
  SearchBar, Chips, EmptyState, Modal, Field, TextInput, NumberInput, Select, Btn, Toast, fmtBRL, fmtData
} from "../../../components/ui";
import { useERP } from "../../../context/ERPContext";
import {
  fetchNotas, salvarNota, atualizarNota, deletarNota, simularLeituraOCR, uploadImagemNota, CATEGORIAS_NOTA
} from "../../../lib/notas";
import { inserirDocumento } from "../../../lib/financeiro";
import { inserirSuprimentoCentral, entradaEstoqueCentral } from "../../../lib/suprimentos";

const CONTAS_PAGAMENTO = ["Caixa / Dinheiro", "Conta PJ", "Conta Física", "Cartão de Crédito", "Outra"];
const FORMAS_PAGAMENTO = ["Pix", "Boleto", "Dinheiro", "Débito", "Crédito", "Transferência"];

function FormScanner({ onSalvar, onCancelar }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loadingIA, setLoadingIA] = useState(false);
  const [dadosIA, setDadosIA] = useState(null);

  // Pagamento
  const [vencimento, setVencimento] = useState("");
  const [jaPaga, setJaPaga] = useState(false);
  const [conta, setConta] = useState(CONTAS_PAGAMENTO[0]);
  const [forma, setForma] = useState(FORMAS_PAGAMENTO[0]);

  // Automações
  const [lancarFinanceiro, setLancarFinanceiro] = useState(true);
  const [alimentarEstoque, setAlimentarEstoque] = useState(false);
  
  // Ref para o input de arquivo escondido
  const fileInputRef = useRef(null);

  function handleFile(e) {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);
    
    // Gerar preview local e comprimir a imagem (celulares tiram fotos de 5MB, que quebram o limite da Vercel)
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let w = img.width;
        let h = img.height;
        // Reduzir para no máximo 1800px para manter nitidez dos itens
        const MAX = 1800;
        if (w > h && w > MAX) { h = Math.round((h * MAX) / w); w = MAX; }
        else if (h > MAX) { w = Math.round((w * MAX) / h); h = MAX; }
        
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        
        // Comprime para JPEG com 85% de qualidade (texto precisa de nitidez)
        const compressedBase64 = canvas.toDataURL("image/jpeg", 0.85);
        setPreview(compressedBase64);
        iniciarLeituraOCR(compressedBase64);
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(f);
  }

  async function iniciarLeituraOCR(base64) {
    setLoadingIA(true);
    try {
      const extraido = await simularLeituraOCR(base64);
      setDadosIA(extraido);
    } catch (err) {
      alert("A Inteligência Artificial falhou: " + err.message + "\n\nTente novamente ou use uma imagem menor.");
      setPreview(null);
    } finally {
      setLoadingIA(false);
    }
  }

  function confirmar() {
    const pagamento = jaPaga
      ? { status_pagamento: "pago", pago_em: new Date().toISOString().slice(0, 10), conta_pagamento: conta, forma_pagamento: forma, data_vencimento: vencimento || null }
      : { status_pagamento: "pendente", data_vencimento: vencimento || null };
    onSalvar({ ...dadosIA, ...pagamento }, preview, lancarFinanceiro, alimentarEstoque);
  }

  if (!preview) {
    return (
      <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-xl gap-4" style={{ borderColor: "var(--line)", background: "var(--panel)" }}>
        <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: "var(--elevated)", color: "var(--accent)" }}>
          <Camera size={32} />
        </div>
        <div className="text-center">
          <p className="font-bold text-lg" style={{ color: "var(--fg)" }}>Tirar foto da Nota / DANFE</p>
          <p className="text-sm" style={{ color: "var(--dim)" }}>Aponte a câmera para o papel e a Inteligência Artificial fará o resto.</p>
        </div>
        
        <input 
          type="file" 
          accept="image/*" 
          capture="environment" // Abre a câmera do celular direto
          ref={fileInputRef}
          className="hidden" 
          onChange={handleFile} 
        />
        
        <Btn variant="primary" className="w-full mt-2" onClick={() => fileInputRef.current?.click()}>
          <ScanLine size={18} /> Abrir Câmera
        </Btn>
        <Btn variant="ghost" className="w-full" onClick={() => fileInputRef.current?.click()}>
          <UploadCloud size={18} /> Escolher da Galeria
        </Btn>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Coluna da Imagem */}
      <div className="w-full lg:w-1/3 flex flex-col gap-2">
        <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--dim)" }}>Imagem da Nota</p>
        <div className="relative rounded-xl overflow-hidden border" style={{ borderColor: "var(--line)", height: 250, background: "#000" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Nota" className="w-full h-full object-contain opacity-80" />
          
          {loadingIA && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm z-10">
              <BrainCircuit size={48} className="animate-pulse" style={{ color: "#8B5CF6" }} />
              <p className="text-white font-bold mt-4 animate-pulse">A Inteligência Artificial está lendo a nota...</p>
              <p className="text-white/70 text-xs mt-1">Extraindo fornecedor, valores e itens</p>
            </div>
          )}
        </div>
        <button onClick={() => { setPreview(null); setDadosIA(null); }} className="text-xs font-bold mt-1 text-center" style={{ color: "var(--accent-fg)" }}>Tirar foto novamente</button>
      </div>

      {/* Coluna dos Dados Extraídos */}
      <div className="flex-1 flex flex-col">
        <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: "var(--dim)" }}>Dados Extraídos</p>
        
        {!dadosIA && !loadingIA && (
          <div className="flex-1 flex items-center justify-center p-6 border border-dashed rounded-xl" style={{ borderColor: "var(--line)" }}>
            <p className="text-sm text-center" style={{ color: "var(--muted)" }}>Aguardando imagem para leitura...</p>
          </div>
        )}

        {dadosIA && (
          <div className="space-y-3 flex-1">
            <Field label="Fornecedor"><TextInput className="py-1.5 text-sm" value={dadosIA.fornecedor} onChange={e => setDadosIA({...dadosIA, fornecedor: e.target.value})} /></Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="CNPJ"><TextInput className="py-1.5 text-sm" value={dadosIA.cnpj} onChange={e => setDadosIA({...dadosIA, cnpj: e.target.value})} /></Field>
              <Field label="Categoria"><Select className="py-1.5 text-sm" value={dadosIA.categoria} onChange={e => setDadosIA({...dadosIA, categoria: e.target.value})}>{CATEGORIAS_NOTA.map(c => <option key={c}>{c}</option>)}</Select></Field>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Data"><TextInput className="py-1.5 text-sm" type="date" value={dadosIA.data_emissao} onChange={e => setDadosIA({...dadosIA, data_emissao: e.target.value})} /></Field>
              <Field label="Hora"><TextInput className="py-1.5 text-sm" type="time" value={dadosIA.hora_emissao} onChange={e => setDadosIA({...dadosIA, hora_emissao: e.target.value})} /></Field>
            </div>
            <Field label="Valor Total (R$)"><NumberInput className="py-1.5 text-sm font-bold text-emerald-600" value={dadosIA.valor_total} onChange={e => setDadosIA({...dadosIA, valor_total: e.target.value})} /></Field>

            <div className="p-3 rounded-xl space-y-2" style={{ background: "var(--elevated)", border: "1px solid var(--line)" }}>
              <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--dim)" }}>Pagamento</p>
              <Field label="Vencimento (para o aviso de pagamento)">
                <TextInput className="py-1.5 text-sm" type="date" value={vencimento} onChange={e => setVencimento(e.target.value)} />
              </Field>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" className="w-5 h-5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                  checked={jaPaga} onChange={(e) => setJaPaga(e.target.checked)} />
                <span className="text-sm font-bold" style={{ color: "var(--fg)" }}>Esta nota já está paga</span>
              </label>
              {jaPaga && (
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Conta usada"><Select className="py-1.5 text-sm" value={conta} onChange={e => setConta(e.target.value)}>{CONTAS_PAGAMENTO.map(c => <option key={c}>{c}</option>)}</Select></Field>
                  <Field label="Forma"><Select className="py-1.5 text-sm" value={forma} onChange={e => setForma(e.target.value)}>{FORMAS_PAGAMENTO.map(f => <option key={f}>{f}</option>)}</Select></Field>
                </div>
              )}
            </div>
          </div>
        )}

        {/* NOVOS CONTROLES DE AUTOMAÇÃO */}
        {dadosIA && (
          <div className="mt-3 p-3 rounded-xl space-y-2" style={{ background: "var(--elevated)", border: "1px solid var(--line)" }}>
            <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--dim)" }}>Automações Inteligentes</p>
            
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" className="w-5 h-5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500" 
                checked={lancarFinanceiro} onChange={(e) => setLancarFinanceiro(e.target.checked)} />
              <span className="text-sm font-bold" style={{ color: "var(--fg)" }}>Lançar pendência no Financeiro (Contas a Pagar)</span>
            </label>
            
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" className="w-5 h-5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500" 
                checked={alimentarEstoque} onChange={(e) => setAlimentarEstoque(e.target.checked)} />
              <span className="text-sm font-bold" style={{ color: "var(--fg)" }}>Dar entrada automática dos itens no Estoque</span>
            </label>
          </div>
        )}

        {dadosIA && (
          <div className="flex gap-2 mt-4 pt-3 border-t" style={{ borderColor: "var(--line)" }}>
            <Btn variant="ghost" className="flex-1 py-2 text-sm" onClick={onCancelar}>Cancelar</Btn>
            <Btn variant="primary" className="flex-1 py-2 text-sm" disabled={!dadosIA || loadingIA} onClick={confirmar} style={dadosIA ? { background: "#10B981", color: "#fff" } : {}}>
              <CheckCircle size={16} /> Salvar
            </Btn>
          </div>
        )}
      </div>
    </div>
  );
}

export default function NotasFiscaisPage() {
  const { unidadeAtiva, unidadeInfo } = useERP();
  const [notas, setNotas] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filtros e Ordenação solicitados
  const [busca, setBusca] = useState("");
  const [cat, setCat] = useState("Todas");
  const [situacao, setSituacao] = useState("Todas"); // Todas, A pagar, Vencidas, Pagas
  const [ordem, setOrdem] = useState("data_desc"); // data_desc, data_asc, hora, az

  // Modal de "Marcar como paga": guarda a nota + conta e forma escolhidas
  const [notaPagar, setNotaPagar] = useState(null);
  const [pagtoConta, setPagtoConta] = useState(CONTAS_PAGAMENTO[0]);
  const [pagtoForma, setPagtoForma] = useState(FORMAS_PAGAMENTO[0]);
  const [pagtoData, setPagtoData] = useState(new Date().toISOString().slice(0, 10));

  const [modalScanner, setModalScanner] = useState(false);
  const [toast, setToast] = useState("");
  const [notaExpandida, setNotaExpandida] = useState(null); // ID da nota para mostrar a foto e itens
  const [fotoAberta, setFotoAberta] = useState(null); // URL da imagem para o modal de tela cheia

  async function carregar() {
    setLoading(true);
    const { data } = await fetchNotas(unidadeAtiva);
    setNotas(data || []);
    setLoading(false);
  }

  useEffect(() => { carregar(); /* eslint-disable-next-line */ }, [unidadeAtiva]);

  // Situação de pagamento da nota: pago, vencida, vence hoje/em breve ou a pagar
  const infoPagamento = (n) => {
    if ((n.status_pagamento || "pendente") === "pago") {
      const detalhe = [n.conta_pagamento, n.forma_pagamento].filter(Boolean).join(" · ");
      return { chave: "Pagas", rotulo: `Paga${n.pago_em ? " em " + fmtData(n.pago_em) : ""}${detalhe ? " · " + detalhe : ""}`, cor: "#15803D", fundo: "rgba(34,197,94,0.12)", urgencia: 9 };
    }
    if (!n.data_vencimento) return { chave: "A pagar", rotulo: "A pagar · sem vencimento", cor: "#B45309", fundo: "rgba(245,158,11,0.12)", urgencia: 3 };
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    const dias = Math.round((new Date(n.data_vencimento + "T00:00:00") - hoje) / 86400000);
    if (dias < 0) return { chave: "Vencidas", rotulo: `VENCIDA há ${-dias} dia(s)`, cor: "#DC2626", fundo: "rgba(239,68,68,0.14)", urgencia: 0 };
    if (dias === 0) return { chave: "A pagar", rotulo: "Vence HOJE", cor: "#DC2626", fundo: "rgba(239,68,68,0.14)", urgencia: 1 };
    if (dias <= 3) return { chave: "A pagar", rotulo: `Vence em ${dias} dia(s)`, cor: "#B45309", fundo: "rgba(245,158,11,0.12)", urgencia: 2 };
    return { chave: "A pagar", rotulo: `Vence ${fmtData(n.data_vencimento)}`, cor: "var(--muted)", fundo: "var(--elevated)", urgencia: 4 };
  };

  const filtrados = useMemo(() => {
    let list = notas.filter(n => {
      const mb = n.fornecedor?.toLowerCase().includes(busca.toLowerCase()) || n.cnpj?.includes(busca);
      const mc = cat === "Todas" || n.categoria === cat;
      const ip = infoPagamento(n);
      const ms = situacao === "Todas" || ip.chave === situacao || (situacao === "A pagar" && ip.chave === "Vencidas");
      return mb && mc && ms;
    });

    list.sort((a, b) => {
      // Vencidas e prestes a vencer sempre no topo, depois a ordem escolhida
      const u = infoPagamento(a).urgencia - infoPagamento(b).urgencia;
      if (u !== 0) return u;
      if (ordem === "data_desc") return new Date(b.data_emissao) - new Date(a.data_emissao);
      if (ordem === "data_asc") return new Date(a.data_emissao) - new Date(b.data_emissao);
      if (ordem === "hora") return (b.hora_emissao || "00:00").localeCompare(a.hora_emissao || "00:00");
      if (ordem === "az") return a.fornecedor.localeCompare(b.fornecedor);
      return 0;
    });

    return list;
  }, [notas, busca, cat, situacao, ordem]);

  const resumo = useMemo(() => {
    const aPagar = notas.filter(n => (n.status_pagamento || "pendente") !== "pago");
    const vencidas = aPagar.filter(n => infoPagamento(n).chave === "Vencidas");
    return {
      total: filtrados.length,
      valorMes: filtrados.reduce((acc, n) => acc + (Number(n.valor_total) || 0), 0),
      aPagarQtd: aPagar.length,
      aPagarValor: aPagar.reduce((acc, n) => acc + (Number(n.valor_total) || 0), 0),
      vencidasQtd: vencidas.length,
      vencidasValor: vencidas.reduce((acc, n) => acc + (Number(n.valor_total) || 0), 0),
    };
  }, [notas, filtrados]);

  async function marcarComoPaga() {
    const { error } = await atualizarNota(notaPagar.id, {
      status_pagamento: "pago", pago_em: pagtoData, conta_pagamento: pagtoConta, forma_pagamento: pagtoForma,
    });
    if (error) return alert("Não foi possível marcar como paga: " + error);
    setToast(`Nota de ${notaPagar.fornecedor} marcada como paga (${pagtoConta} · ${pagtoForma}).`);
    setNotaPagar(null);
    setTimeout(() => setToast(""), 3000);
    carregar();
  }

  async function salvar(dadosIA, imagemBase64, lancarFinanceiro, alimentarEstoque) {
    // 1. Upload da imagem para o Supabase Storage
    let urlOficial = null;
    if (imagemBase64) {
      const { url, error: errUp } = await uploadImagemNota(imagemBase64, unidadeAtiva);
      if (errUp) {
        alert("Aviso: Falha ao fazer upload da imagem: " + errUp);
      } else {
        urlOficial = url;
      }
    }

    // Mesclar dados da IA com a imagem gerada
    // Garantir que os campos obrigatórios não fiquem vazios (o banco de dados rejeita "" para data e nulo para fornecedor)
    const payload = {
      ...dadosIA,
      fornecedor: dadosIA.fornecedor || "Fornecedor Não Identificado",
      data_emissao: dadosIA.data_emissao || new Date().toISOString().slice(0, 10),
      valor_total: Number(dadosIA.valor_total) || 0,
      imagem_url: urlOficial 
    };
    
    const resNota = await salvarNota(payload, unidadeAtiva);
    if (resNota.error) {
      alert("Erro ao salvar nota no banco: " + resNota.error);
      return;
    }

    // ── 1. Automação Financeira ──
    if (lancarFinanceiro) {
      await inserirDocumento({
        tipo: "despesa",
        descricao: `Nota: ${dadosIA.fornecedor || "Diversos"}`,
        categoria: dadosIA.categoria || "Geral",
        valor: Number(dadosIA.valor_total) || 0,
        emissao: dadosIA.data_emissao || new Date().toISOString().slice(0, 10),
        vencimento: dadosIA.data_vencimento || dadosIA.data_emissao || new Date().toISOString().slice(0, 10),
        status: dadosIA.status_pagamento === "pago" ? "pago" : "pendente"
      }, unidadeAtiva);
    }

    // ── 2. Automação de Estoque ──
    if (alimentarEstoque && dadosIA.itens && dadosIA.itens.length > 0) {
      for (const item of dadosIA.itens) {
        // Na demonstração: Cadastramos os itens automaticamente no Catálogo Central (se houver duplicado, o ideal era um de/para)
        const resCat = await inserirSuprimentoCentral({
          nome: item.nome || "Item Desconhecido",
          categoria: dadosIA.categoria || "Geral",
          unidade_medida: item.un || "UN",
          estoque_minimo: 10
        });
        
        // Dá entrada no estoque
        if (resCat.data && resCat.data.id) {
          // Calcula o custo unitário (Assumindo que o preço lido é o total da linha ou unitário. Geralmente é total / qtd)
          const precoTotalLinha = Number(item.preco) || 0;
          const qtd = Number(item.qtd) || 1;
          const custoUnit = precoTotalLinha / qtd;
          await entradaEstoqueCentral(resCat.data.id, qtd, custoUnit);
        }
      }
    }
    setToast("Nota Fiscal salva com sucesso!");
    setModalScanner(false);
    setTimeout(() => setToast(""), 3000);
    carregar();
  }

  async function remover(id) {
    if(!confirm("Tem certeza que deseja apagar esta nota?")) return;
    await deletarNota(id);
    carregar();
  }

  return (
    <div className="min-h-screen">
      <PageHeader 
        title="Notas Fiscais & DANFEs" 
        subtitle={`Gestão Eletrônica de Documentos · ${unidadeInfo.nome}`} 
        icon={ReceiptText} 
        actionLabel="Escanear Nota"
        onAction={() => setModalScanner(true)}
      />
      
      <PageBody>
        <Toast show={!!toast}>{toast}</Toast>

        <KpiGrid>
          <Kpi icon={ReceiptText} label="Notas Filtradas" value={resumo.total} tint="#3B82F6" />
          <Kpi icon={CheckCircle} label="Valor Total (Filtro)" value={fmtBRL(resumo.valorMes)} tint="#10B981" />
          <Kpi icon={Clock} label={`A Pagar (${resumo.aPagarQtd})`} value={fmtBRL(resumo.aPagarValor)} tint="#F59E0B" />
          <Kpi icon={ReceiptText} label={`Vencidas (${resumo.vencidasQtd})`} value={fmtBRL(resumo.vencidasValor)} tint="#EF4444" />
        </KpiGrid>

        <div className="space-y-3">
          <SearchBar value={busca} onChange={setBusca} placeholder="Buscar por fornecedor ou CNPJ..." />
          <Chips options={["Todas", "A pagar", "Vencidas", "Pagas"]} value={situacao} onChange={setSituacao} />
          <Chips options={["Todas", ...CATEGORIAS_NOTA]} value={cat} onChange={setCat} />
          
          <div className="flex gap-2 items-center flex-wrap" style={{ background: "var(--panel)", padding: "12px", borderRadius: "12px", border: "1px solid var(--line)" }}>
            <span className="text-xs font-bold uppercase tracking-wide mr-2" style={{ color: "var(--dim)" }}>Ordenar por:</span>
            {[
              { id: "data_desc", label: "Mais Recentes", icon: Calendar },
              { id: "data_asc", label: "Mais Antigas", icon: Calendar },
              { id: "hora", label: "Hora (Tarde > Cedo)", icon: Clock },
              { id: "az", label: "Alfabética (A-Z)", icon: ArrowDownAZ },
            ].map(o => (
              <button key={o.id} onClick={() => setOrdem(o.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition"
                style={ordem === o.id ? { background: "var(--accent-strong)", color: "#fff" } : { background: "var(--card)", color: "var(--muted)", border: "1px solid var(--line)" }}>
                <o.icon size={14} /> {o.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <EmptyState icon={ReceiptText} title="Carregando gaveta..." />
        ) : filtrados.length === 0 ? (
          <EmptyState icon={ScanLine} title="Nenhuma nota fiscal" hint="Clique em 'Escanear Nota' e aponte a câmera para uma nota ou DANFE." />
        ) : (
          <div className="space-y-3 mt-4">
            {filtrados.map(n => {
              const ip = infoPagamento(n);
              const paga = (n.status_pagamento || "pendente") === "pago";
              return (
              <div key={n.id}>
                <Card className="!p-4 cursor-pointer hover:opacity-90 transition" onClick={() => setNotaExpandida(notaExpandida === n.id ? null : n.id)}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md" style={{ background: "var(--elevated)", color: "var(--dim)" }}>{n.categoria}</span>
                        <span className="text-[11px] font-bold" style={{ color: "var(--dim)" }}>{fmtData(n.data_emissao)} • {n.hora_emissao}</span>
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md" style={{ background: ip.fundo, color: ip.cor }}>{ip.rotulo}</span>
                      </div>
                      <p className="font-black text-lg leading-tight" style={{ color: "var(--fg)" }}>{n.fornecedor}</p>
                      <p className="text-xs font-bold mt-1" style={{ color: "var(--muted)" }}>CNPJ: {n.cnpj || "Não lido"}</p>
                    </div>

                    <div className="text-right flex flex-col items-end">
                      <p className="text-xl font-black" style={{ color: "var(--accent-fg)" }}>{fmtBRL(n.valor_total)}</p>
                      <div className="flex items-center gap-1 mt-2">
                        {!paga && (
                          <button onClick={(e) => { e.stopPropagation(); setNotaPagar(n); setPagtoData(new Date().toISOString().slice(0, 10)); }}
                            className="px-2.5 py-1.5 rounded-md text-[11px] font-black transition" style={{ background: "rgba(34,197,94,0.14)", color: "#15803D" }}>
                            <CheckCircle size={12} className="inline align-[-2px] mr-1" />Marcar paga
                          </button>
                        )}
                        <button onClick={(e) => { e.stopPropagation(); remover(n.id); }} className="p-1.5 rounded-md hover:bg-emerald-500/10 text-slate-600 transition">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                </Card>

                {/* Área Expansível (Foto da Nota) */}
                {notaExpandida === n.id && (
                  <div className="p-4 mt-2 rounded-xl mb-6 flex flex-col sm:flex-row gap-4" style={{ background: "var(--card)", border: "1px dashed var(--line)" }}>
                    <div className="flex flex-col gap-2">
                      <div onClick={() => n.imagem_url && setFotoAberta(n.imagem_url)} title="Clique para ampliar na mesma tela" className="w-full sm:w-32 h-48 sm:h-40 rounded-lg overflow-hidden border flex items-center justify-center bg-black/5 hover:ring-2 hover:ring-blue-500 transition-all cursor-pointer" style={{ borderColor: "var(--line)" }}>
                        {n.imagem_url ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img src={n.imagem_url} alt="Nota Fisical" className="w-full h-full object-cover hover:object-contain transition-all" />
                        ) : (
                          <span className="text-[10px] text-center" style={{ color: "var(--muted)" }}>Sem<br/>Imagem</span>
                        )}
                      </div>
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-bold uppercase mb-2" style={{ color: "var(--dim)" }}>Itens Identificados pela IA</p>
                      {n.itens && n.itens.length > 0 ? (
                        <div className="space-y-1">
                          {n.itens.map((item, idx) => (
                            <div key={idx} className="flex justify-between text-sm py-1 border-b" style={{ borderColor: "var(--line-soft)" }}>
                              <span style={{ color: "var(--fg)" }}>{item.qtd}{item.un} - {item.nome}</span>
                              <span className="font-bold" style={{ color: "var(--dim)" }}>{fmtBRL(item.preco)}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm" style={{ color: "var(--muted)" }}>Nenhum item listado.</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );})}
          </div>
        )}
      </PageBody>

      {/* Modal: marcar nota como paga (conta + forma + data) */}
      <Modal open={!!notaPagar} onClose={() => setNotaPagar(null)} title="Marcar nota como paga">
        {notaPagar && (
          <div className="space-y-3">
            <p className="text-sm font-bold" style={{ color: "var(--fg)" }}>
              {notaPagar.fornecedor} · <span style={{ color: "var(--accent-strong)" }}>{fmtBRL(notaPagar.valor_total)}</span>
            </p>
            <Field label="Data do pagamento"><TextInput type="date" value={pagtoData} onChange={e => setPagtoData(e.target.value)} /></Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Paga por qual conta"><Select value={pagtoConta} onChange={e => setPagtoConta(e.target.value)}>{CONTAS_PAGAMENTO.map(c => <option key={c}>{c}</option>)}</Select></Field>
              <Field label="Forma de pagamento"><Select value={pagtoForma} onChange={e => setPagtoForma(e.target.value)}>{FORMAS_PAGAMENTO.map(f => <option key={f}>{f}</option>)}</Select></Field>
            </div>
            <div className="flex gap-3 pt-1">
              <Btn variant="ghost" className="flex-1" onClick={() => setNotaPagar(null)}>Cancelar</Btn>
              <Btn variant="primary" className="flex-1" onClick={marcarComoPaga}><CheckCircle size={16} /> Confirmar pagamento</Btn>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={modalScanner} onClose={() => setModalScanner(false)} title="Escaneamento Inteligente">
        <FormScanner onSalvar={salvar} onCancelar={() => setModalScanner(false)} />
      </Modal>

      {/* Modal de Ampliação de Imagem (Lightbox) */}
      <Modal open={!!fotoAberta} onClose={() => setFotoAberta(null)} title="Visualizador de Documento" maxWidth="max-w-4xl">
        {fotoAberta && (
          <div className="flex flex-col items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={fotoAberta} alt="Nota Ampliada" className="max-h-[70vh] object-contain rounded-xl border mb-4" style={{ borderColor: "var(--line)" }} />
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 w-full justify-center">
              <a href={fotoAberta} download="nota_fiscal_erp.jpg" className="px-6 py-2 rounded-lg font-bold transition-all text-white flex items-center justify-center gap-2" style={{ background: "#3B82F6" }}>
                <UploadCloud size={18} className="rotate-180" /> Baixar Imagem
              </a>
              <Btn variant="ghost" onClick={() => setFotoAberta(null)}>Fechar Visualizador</Btn>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
