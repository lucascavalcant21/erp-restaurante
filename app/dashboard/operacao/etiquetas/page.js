"use client";

import { useState, useEffect, useMemo, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { Tag, Printer, Save, Snowflake, Thermometer, Box, QrCode, MapPin, AlertTriangle, Settings, RefreshCw, CheckCircle2, WifiOff } from "lucide-react";
import {
  PageHeader, PageBody, Card, SectionLabel, Field, TextInput, NumberInput, Select, Btn, Toast, EmptyState
} from "../../../components/ui";
import { useERP } from "../../../context/ERPContext";
import { lerSessao } from "../../../lib/auth";
import { fetchEstoque } from "../../../lib/estoque";
import { fetchProdutos } from "../../../lib/vendas";
import { fetchColaboradores } from "../../../lib/rh";
import { CONSERVACAO, gerarCodigo, criarEtiqueta } from "../../../lib/etiquetas";
import { fetchValidadesEtiqueta } from "../../../lib/parametros";
import {
  conectarAssistenteImpressao, observarAssistenteImpressao,
  imprimirEtiquetasTp20, PERFIS_TP20,
} from "../../../lib/impressaoTermica";

const UNIDADES = ["UN", "KG", "G", "L", "ML", "CX", "PCT", "BANDEJA"];
const ICONE_CONS = { Resfriado: Thermometer, Congelado: Snowflake, Ambiente: Box };

function fmtDataHora(d) {
  if (!(d instanceof Date) || !Number.isFinite(d.getTime())) return "—";
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${String(d.getFullYear()).slice(2)} - ${p(d.getHours())}H${p(d.getMinutes())}`;
}
function fmtData(d) {
  if (!(d instanceof Date) || !Number.isFinite(d.getTime())) return "—";
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function EtiquetasRunner() {
  const { unidadeAtiva, unidadeInfo } = useERP();
  const router = useRouter();
  const searchParams = useSearchParams();
  const deptUrl = searchParams.get("dept"); // 'cozinha' | 'bar' | null (todos)
  const [produtos, setProdutos] = useState([]);
  const [colaboradores, setColaboradores] = useState([]);
  const [form, setForm] = useState({ 
    produto: "", conservacao: "Congelado", quantidade: "1", unidade: "UN", 
    dias: 30, lote: "", responsavel: "" 
  });
  const [codigo, setCodigo] = useState(gerarCodigo());
  const [momentoEtiqueta, setMomentoEtiqueta] = useState(() => new Date());
  const [tamanho, setTamanho] = useState("60x60"); // "60x60" | "60x40"
  const [validadeModo, setValidadeModo] = useState("dias"); // "dias" | "data"
  // "aberto" = produto aberto/manipulado (mostra data e hora de manipulação);
  // "fechado" = produto lacrado sem validade visível (mostra etiquetagem + validade)
  const [tipoEtiqueta, setTipoEtiqueta] = useState("aberto");
  const [dataValidade, setDataValidade] = useState("");
  const [categoriasValidade, setCategoriasValidade] = useState([]);
  const [categoriaValidade, setCategoriaValidade] = useState("");
  const [salvou, setSalvou] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [codigoSalvo, setCodigoSalvo] = useState(null);
  const [assinaturaSalva, setAssinaturaSalva] = useState(null);
  const [copias, setCopias] = useState(1);
  const [impressoraStatus, setImpressoraStatus] = useState("desconectada");
  const [impressoraErro, setImpressoraErro] = useState("");
  const [impressoras, setImpressoras] = useState([]);
  const [impressoraNome, setImpressoraNome] = useState("");
  const [conectando, setConectando] = useState(false);
  const assinaturaConteudo = useMemo(() => JSON.stringify({
    unidadeAtiva, form, tipoEtiqueta, validadeModo, dataValidade, copias,
  }), [unidadeAtiva, form, tipoEtiqueta, validadeModo, dataValidade, copias]);
  const assinaturaAnterior = useRef(assinaturaConteudo);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // Dimensões/escala da etiqueta conforme o tamanho escolhido
  const dim = tamanho === "60x40"
    ? { w: "66mm", h: "40mm", paginaH: "42mm", pad: "1.8mm", titulo: "3.2mm", linha: "2.15mm", resp: "1.85mm", qr: 40, gap: "0.4mm", secPad: "0.45mm", footLh: 1.15, respMt: "0.5mm" }
    : { w: "60mm", h: "60mm", paginaH: "62mm", pad: "3.2mm", titulo: "4.4mm", linha: "2.9mm", resp: "2.55mm", qr: 64, gap: "0.7mm", secPad: "0.8mm", footLh: 1.35, respMt: "1mm" };

  useEffect(() => {
    lerSessao().then((s) => s?.nome && setForm((f) => ({ ...f, responsavel: f.responsavel || s.nome })));
    try { setImpressoraNome(localStorage.getItem("erp_impressora_termica") || ""); } catch (_) {}
    observarAssistenteImpressao({
      aoFechar: () => setImpressoraStatus("desconectada"),
      aoErro: () => setImpressoraStatus("erro"),
    }).catch(() => {});
  }, []);
  const [custoMap, setCustoMap] = useState({});
  useEffect(() => {
    (async () => {
      setCategoriaValidade("");
      // Produtos do cardápio + insumos do estoque, filtrados pelo departamento
      // da URL (?dept=cozinha ou ?dept=bar) — cada área vê só o que é dela.
      const [e, pr, colab, validades] = await Promise.all([
        fetchEstoque(unidadeAtiva, deptUrl || undefined),
        fetchProdutos(unidadeAtiva, deptUrl || undefined),
        fetchColaboradores(unidadeAtiva),
        fetchValidadesEtiqueta(unidadeAtiva),
      ]);
      const nomes = [...new Set([
        ...(e.data || []).map((x) => x.nome),
        ...(pr.data || []).map((x) => x.nome_produto),
      ].filter(Boolean))].sort();
      setProdutos(nomes);
      const mapa = {};
      (e.data || []).forEach((x) => { mapa[x.nome] = Number(x.custo_unitario) || Number(x.preco_unit) || mapa[x.nome] || 0; });
      setCustoMap(mapa);
      setColaboradores((colab.data || []).filter((c) => c.ativo !== false && c.status !== "inativo"));
      setCategoriasValidade(validades.data || []);
    })();
  }, [unidadeAtiva, deptUrl]);

  // Se uma impressão falhar depois de salvar, o mesmo código pode ser tentado
  // novamente sem duplicar o registro. Se o conteúdo for alterado, invalida a
  // tentativa anterior e cria um novo código para impedir QR/dados divergentes.
  useEffect(() => {
    if (assinaturaAnterior.current !== assinaturaConteudo && codigoSalvo === codigo) {
      setCodigo(gerarCodigo());
      setCodigoSalvo(null);
      setAssinaturaSalva(null);
    }
    assinaturaAnterior.current = assinaturaConteudo;
  }, [assinaturaConteudo, codigoSalvo, codigo]);

  function escolherConservacao(id) {
    const c = CONSERVACAO.find((x) => x.id === id);
    set("conservacao", id);
    if (c) { set("dias", c.dias); setValidadeModo("dias"); setCategoriaValidade(""); }
  }
  function aplicarCategoria(id) {
    setCategoriaValidade(id);
    const categoria = categoriasValidade.find((item) => item.id === id);
    if (categoria) {
      set("dias", categoria.dias);
      setValidadeModo("dias");
    }
  }

  async function conectarImpressora() {
    if (conectando) return;
    setConectando(true);
    setImpressoraErro("");
    setImpressoraStatus("conectando");
    try {
      const resultado = await conectarAssistenteImpressao(impressoraNome);
      setImpressoras(resultado.impressoras);
      if (!resultado.nome) {
        setImpressoraStatus("selecionar");
        setImpressoraErro("O assistente conectou, mas não reconheceu uma térmica automaticamente. Selecione abaixo a fila correta.");
        return;
      }
      setImpressoraNome(resultado.nome);
      setImpressoraStatus("conectada");
      try { localStorage.setItem("erp_impressora_termica", resultado.nome); } catch (_) {}
    } catch (erro) {
      setImpressoraStatus("erro");
      setImpressoraErro("Não foi possível abrir o assistente. Confirme que o QZ Tray está instalado e aceite a autorização do navegador.");
    } finally {
      setConectando(false);
    }
  }

  function escolherImpressora(nome) {
    setImpressoraNome(nome);
    setImpressoraStatus(nome ? "conectada" : "selecionar");
    setImpressoraErro("");
    try { localStorage.setItem("erp_impressora_termica", nome); } catch (_) {}
  }

  const agora = momentoEtiqueta;
  const validadeEm = useMemo(() => {
    if (validadeModo === "data") return dataValidade ? new Date(`${dataValidade}T23:59:00`) : new Date(Number.NaN);
    return new Date(agora.getTime() + (Number(form.dias) || 0) * 86400000);
  }, [validadeModo, dataValidade, agora, form.dias]);
  const nomeProduto = (form.produto || "").trim();
  const quantidadeCopias = Math.max(1, Math.min(100, Math.floor(Number(copias) || 1)));

  const rastreioUrl = typeof window !== "undefined" ? `${window.location.origin}/rastreio/${codigo}` : `/rastreio/${codigo}`;
  const cnpjUnidade = unidadeInfo?.cnpj || "";
  const enderecoUnidade = [
    [unidadeInfo?.endereco, unidadeInfo?.numero].filter(Boolean).join(", "),
    unidadeInfo?.bairro,
  ].filter(Boolean).join(" - ");
  const cidadeUfUnidade = [unidadeInfo?.cidade, unidadeInfo?.uf].filter(Boolean).join("/");
  const localizacaoUnidade = [unidadeInfo?.cep ? `CEP ${fmtCEP(unidadeInfo.cep)}` : "", cidadeUfUnidade].filter(Boolean).join(" - ");
  const cadastroUnidadeCompleto = Boolean(cnpjUnidade && unidadeInfo?.cep && enderecoUnidade && unidadeInfo?.cidade && unidadeInfo?.uf);

  async function salvar(modoImpressao = "") {
    if (salvando) return;
    if (codigoSalvo === codigo && assinaturaSalva !== assinaturaConteudo) {
      setCodigo(gerarCodigo());
      setCodigoSalvo(null);
      setAssinaturaSalva(null);
      setSalvou("O conteúdo mudou. Um novo código foi preparado; confirme a impressão novamente.");
      setTimeout(() => setSalvou(""), 3500);
      return;
    }
    const etiquetaJaRegistrada = codigoSalvo === codigo;
    const momentoImpressao = etiquetaJaRegistrada ? momentoEtiqueta : new Date();
    const validadeImpressao = validadeModo === "data"
      ? (dataValidade ? new Date(`${dataValidade}T23:59:00`) : new Date(Number.NaN))
      : new Date(momentoImpressao.getTime() + (Number(form.dias) || 0) * 86400000);
    const diasImpressao = Math.max(0, Math.round((validadeImpressao.getTime() - momentoImpressao.getTime()) / 86400000));
    if (!nomeProduto) { setSalvou("Informe o produto"); setTimeout(() => setSalvou(""), 2000); return; }
    if (!form.responsavel.trim()) { setSalvou("Informe o responsável"); setTimeout(() => setSalvou(""), 2000); return; }
    if (Number(form.quantidade) <= 0) { setSalvou("Informe uma quantidade maior que zero"); setTimeout(() => setSalvou(""), 2500); return; }
    if (!Number.isInteger(Number(copias))) { setSalvou("A quantidade de etiquetas deve ser um número inteiro"); setTimeout(() => setSalvou(""), 3000); return; }
    if (Number(copias) < 1) { setSalvou("Informe pelo menos uma etiqueta"); setTimeout(() => setSalvou(""), 2500); return; }
    if (Number(copias) > 100) { setSalvou("Imprima no máximo 100 etiquetas por lote"); setTimeout(() => setSalvou(""), 3000); return; }
    if (validadeModo === "data" && !dataValidade) { setSalvou("Informe a data de validade"); setTimeout(() => setSalvou(""), 3000); return; }
    if (modoImpressao && !cadastroUnidadeCompleto) {
      setSalvou("Complete CNPJ, CEP, endereço, cidade e UF da unidade antes de imprimir");
      setTimeout(() => setSalvou(""), 4000); return;
    }
    if (modoImpressao === "tp20" && impressoraStatus !== "conectada") {
      setSalvou("Conecte e autorize a TP20 antes de imprimir"); setTimeout(() => setSalvou(""), 3000); return;
    }
    if (!Number.isFinite(validadeImpressao.getTime()) || validadeImpressao.getTime() < momentoImpressao.getTime()) {
      setSalvou("A validade não pode estar no passado"); setTimeout(() => setSalvou(""), 2500); return;
    }

    setMomentoEtiqueta(momentoImpressao);
    setSalvando(true);
    let etiquetaRegistrada = etiquetaJaRegistrada;
    try {
      if (!etiquetaRegistrada) {
        const resultado = await criarEtiqueta({
          codigo, produto: nomeProduto, conservacao: form.conservacao,
          quantidade: Number(form.quantidade), unidade: form.unidade,
          validade_dias: diasImpressao,
          // O campo existente também registra a data de etiquetagem de produtos fechados.
          manipulacao_em: momentoImpressao.toISOString(),
          validade_em: validadeImpressao.toISOString(),
          lote: form.lote || null, responsavel: form.responsavel.trim(),
          custo_unit: custoMap[nomeProduto] || 0, status: "ativa",
          copias: quantidadeCopias,
          tipo_etiqueta: tipoEtiqueta,
        }, unidadeAtiva);

        if (resultado.error) {
          setSalvou("Não foi possível salvar: " + resultado.error);
          setTimeout(() => setSalvou(""), 4000);
          return;
        }
        etiquetaRegistrada = true;
        setCodigoSalvo(codigo);
        setAssinaturaSalva(assinaturaConteudo);
      }

      if (modoImpressao === "tp20") {
        await imprimirEtiquetasTp20({
          impressora: impressoraNome,
          tamanho,
          copias: quantidadeCopias,
          dados: {
            codigo,
            produto: nomeProduto,
            conservacao: form.conservacao,
            quantidade: form.quantidade,
            unidade: form.unidade,
            tipoEtiqueta,
            momento: momentoImpressao,
            validade: validadeImpressao,
            responsavel: form.responsavel.trim(),
            lote: form.lote,
            unidadeNome: unidadeInfo.nome_fantasia || unidadeInfo.nome,
            cnpj: fmtCNPJ(cnpjUnidade),
            endereco: enderecoUnidade,
            localizacao: localizacaoUnidade,
          },
        });
        setSalvou(`${quantidadeCopias} etiqueta${quantidadeCopias !== 1 ? "s" : ""} enviada${quantidadeCopias !== 1 ? "s" : ""} para ${impressoraNome}`);
      } else if (modoImpressao === "navegador") {
        await new Promise((resolve) => setTimeout(resolve, 150));
        window.print();
        setSalvou("Etiqueta salva. Impressão comum aberta.");
      } else {
        setSalvou("Etiqueta salva!");
      }
      setTimeout(() => {
        setSalvou("");
        setCodigo(gerarCodigo());
        setCodigoSalvo(null);
        setAssinaturaSalva(null);
        setMomentoEtiqueta(new Date());
      }, 2500);
    } catch (erro) {
      setSalvou(etiquetaRegistrada
        ? `Etiqueta salva, mas a impressão não foi confirmada: ${erro?.message || "erro inesperado"}. Confira o papel antes de tentar novamente.`
        : "Falha ao salvar a etiqueta: " + (erro?.message || "erro inesperado"));
      setTimeout(() => setSalvou(""), 7000);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="min-h-screen">
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body * { visibility: hidden !important; }
          #area-impressao, #area-impressao * { visibility: visible !important; }
          #area-impressao { position: absolute !important; left: 0; top: 0; margin: 0; padding: 0; background: #fff !important; color: #000 !important; width: 80mm !important; display: flex !important; flex-direction: column !important; gap: 0 !important; }
          .etiqueta-print { page-break-after: always; overflow: hidden; border-radius: 0 !important; box-shadow: none !important; border: none !important; margin-left: auto !important; margin-right: auto !important; margin-top: 0 !important; margin-bottom: 2mm !important; }
          @page { size: 80mm ${dim.paginaH}; margin: 0; }
        }
      `}} />
      <PageHeader title={`Etiquetas${deptUrl ? ` — ${deptUrl === 'bar' ? 'Bar' : 'Cozinha'}` : ''}`} subtitle={`QR Code + rastreio · ${unidadeInfo.nome}`} icon={Tag} />
      <PageBody>
        <Toast show={!!salvou}>{salvou}</Toast>

        {/* Filtro por departamento: cada área imprime etiquetas só dos seus itens */}
        <div className="inline-flex gap-1 p-1 mb-4 rounded-xl" style={{ background: "var(--elevated)" }}>
          {[["", "Todos"], ["cozinha", "Cozinha"], ["bar", "Bar"]].map(([d, l]) => (
            <button key={d} onClick={() => router.push(`/dashboard/operacao/etiquetas${d ? `?dept=${d}` : ""}`)}
              className="px-4 py-2 rounded-lg font-bold text-sm transition-all"
              style={(deptUrl || "") === d ? { background: "var(--card)", color: "var(--fg)", boxShadow: "0 1px 2px rgba(0,0,0,.15)" } : { color: "var(--muted)" }}>
              {l}
            </button>
          ))}
        </div>

        {(!unidadeAtiva || unidadeAtiva === "todas") ? (
          <EmptyState icon={Tag} title="Acesso Restrito às Unidades" hint="O Cérebro (Gestão Central) apenas visualiza o Controle de Validade. Para gerar novas etiquetas, selecione uma unidade no menu lateral." />
        ) : (
          <div className="grid lg:grid-cols-2 gap-4">
            {/* ── Formulário ── */}
            <div className="space-y-4">
            <Card>
              <Field label="Produto">
                <Select value={produtos.includes(form.produto) ? form.produto : ""} onChange={(e) => set("produto", e.target.value)}>
                  <option value="">Selecione um produto...</option>
                  {produtos.map((p) => <option key={p} value={p}>{p}</option>)}
                </Select>
              </Field>
              <Field label="Ou digite o nome manualmente">
                <TextInput value={form.produto} onChange={(e) => set("produto", e.target.value)} placeholder="Nome do produto" />
              </Field>
            </Card>

            <Card>
              <SectionLabel>Conservação</SectionLabel>
              <div className="grid grid-cols-3 gap-2">
                {CONSERVACAO.map((c) => {
                  const Icon = ICONE_CONS[c.id] || Box; const sel = form.conservacao === c.id;
                  return (
                    <button key={c.id} onClick={() => escolherConservacao(c.id)}
                      className="flex flex-col items-center gap-1 py-3 rounded-xl transition-all"
                      style={{ border: `1.5px solid ${sel ? c.cor : "var(--line)"}`, background: sel ? c.cor + "22" : "var(--panel)" }}>
                      <Icon size={18} style={{ color: sel ? c.cor : "var(--muted)" }} />
                      <span className="text-[12px] font-bold" style={{ color: sel ? "var(--fg)" : "var(--muted)" }}>{c.id}</span>
                    </button>
                  );
                })}
              </div>
            </Card>

            <Card>
              {/* Tipo da etiqueta: produto aberto ou produto fechado sem validade visível */}
              <div className="mb-4">
                <p className="erp-label mb-2">Tipo de etiqueta</p>
                <div className="flex gap-1.5">
                  {[
                    ["aberto", "Produto aberto", "manipulação + validade com hora"],
                    ["fechado", "Produto fechado sem validade impressa", "data da etiqueta + validade"],
                  ].map(([m, l, s]) => (
                    <button key={m} onClick={() => setTipoEtiqueta(m)} className="flex-1 py-2.5 px-2 rounded-lg transition-all flex flex-col items-center gap-0.5"
                      style={tipoEtiqueta === m ? { background: "var(--accent-strong)", color: "#fff" } : { background: "var(--panel)", color: "var(--muted)", border: "1px solid var(--line)" }}>
                      <span className="text-[12px] font-black">{l}</span>
                      <span className="text-[9px] font-medium opacity-80 leading-tight">{s}</span>
                    </button>
                  ))}
                </div>
                <p className="text-[10px] font-medium mt-1.5" style={{ color: "var(--dim)" }}>
                  {tipoEtiqueta === "aberto"
                    ? "Registra data e hora da abertura/manipulação e a validade."
                    : "Para produto fechado sem validade impressa: mostra a data da etiqueta e a validade em destaque."}
                </p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Peso do Produto"><NumberInput value={form.quantidade} onChange={(e) => set("quantidade", e.target.value)} placeholder="0.00" /></Field>
                <Field label="Unidade"><Select value={form.unidade} onChange={(e) => set("unidade", e.target.value)}>{UNIDADES.map((u) => <option key={u}>{u}</option>)}</Select></Field>
                <Field label="Etiquetas p/ Imprimir"><NumberInput value={copias} onChange={(e) => setCopias(e.target.value)} min="1" max="100" step="1" /></Field>
              </div>
              <div className="mb-2 flex gap-1.5">
                {[["dias", "Daqui a X dias"], ["data", "Escolher a data"]].map(([m, l]) => (
                  <button key={m} onClick={() => { setValidadeModo(m); if (m === "data") setCategoriaValidade(""); }} className="flex-1 py-2 rounded-lg text-[12px] font-bold transition-all"
                    style={validadeModo === m ? { background: "var(--accent-strong)", color: "#fff" } : { background: "var(--panel)", color: "var(--muted)", border: "1px solid var(--line)" }}>{l}</button>
                ))}
              </div>
              {validadeModo === "dias" ? (
                <Field label="Vence em quantos dias?"><NumberInput value={form.dias} onChange={(e) => { set("dias", e.target.value); setCategoriaValidade(""); }} /></Field>
              ) : (
                <Field label="Data exata da validade"><TextInput type="date" min={dataLocalParaInput()} value={dataValidade} onChange={(e) => setDataValidade(e.target.value)} /></Field>
              )}
              <Field label="Categoria de validade definida nas configurações">
                <Select value={categoriaValidade} onChange={(e) => aplicarCategoria(e.target.value)}>
                  <option value="">Escolher manualmente...</option>
                  {categoriasValidade.map((categoria) => (
                    <option key={categoria.id} value={categoria.id}>{categoria.nome} · {categoria.dias} dia{categoria.dias !== 1 ? "s" : ""}</option>
                  ))}
                </Select>
              </Field>
              <button type="button" onClick={() => router.push("/dashboard/configuracoes")}
                className="text-[11px] font-bold flex items-center gap-1.5 mb-3" style={{ color: "var(--accent-fg)" }}>
                <Settings size={13} /> Gerenciar categorias e prazos nas Configurações
              </button>
              <Field label="Lote / SIF (opcional)"><TextInput value={form.lote} onChange={(e) => set("lote", e.target.value)} placeholder="SIF 1234" /></Field>
              <Field label="Responsável">
                <Select value={form.responsavel} onChange={(e) => set("responsavel", e.target.value)}>
                  <option value="">Selecione um funcionário...</option>
                  {form.responsavel && !colaboradores.some((c) => c.nome === form.responsavel) && <option value={form.responsavel}>{form.responsavel}</option>}
                  {colaboradores.map((c) => <option key={c.id} value={c.nome}>{c.nome} ({c.cargo || "Equipe"})</option>)}
                </Select>
              </Field>
            </Card>

            <Card>
              <div className="flex items-start gap-3">
                <MapPin size={18} className="mt-0.5" style={{ color: "var(--accent-fg)" }} />
                <div className="min-w-0 flex-1">
                  <SectionLabel>Dados automáticos da unidade</SectionLabel>
                  <p className="text-sm font-bold" style={{ color: "var(--fg)" }}>{unidadeInfo.nome}</p>
                  <p className="text-[11px] mt-1" style={{ color: "var(--muted)" }}>CNPJ: {cnpjUnidade ? fmtCNPJ(cnpjUnidade) : "não cadastrado"}</p>
                  <p className="text-[11px]" style={{ color: "var(--muted)" }}>{enderecoUnidade || "Endereço não cadastrado"}</p>
                  <p className="text-[11px]" style={{ color: "var(--muted)" }}>{localizacaoUnidade || "Cidade, UF e CEP não cadastrados"}</p>
                </div>
                <button type="button" onClick={() => router.push("/dashboard/configuracoes")}
                  className="text-[11px] font-bold px-3 py-2 rounded-lg" style={{ border: "1px solid var(--line)", color: "var(--muted)" }}>Editar</button>
              </div>
              {!cadastroUnidadeCompleto && (
                <div className="mt-3 flex items-center gap-2 text-[11px] font-bold text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
                  <AlertTriangle size={14} /> Complete CNPJ, CEP, endereço, cidade e UF para a etiqueta sair completa.
                </div>
              )}
            </Card>

            <Card>
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <SectionLabel>Impressora térmica direta</SectionLabel>
                  <div className="flex items-center gap-2 mt-1">
                    {impressoraStatus === "conectada"
                      ? <CheckCircle2 size={16} className="text-emerald-600" />
                      : <WifiOff size={16} className="text-slate-400" />}
                    <span className="text-sm font-bold" style={{ color: impressoraStatus === "conectada" ? "#059669" : "var(--muted)" }}>
                      {impressoraStatus === "conectada" ? `Conectada: ${impressoraNome}`
                        : impressoraStatus === "conectando" ? "Aguardando autorização..."
                          : impressoraStatus === "selecionar" ? "Selecione a fila térmica"
                          : "Assistente desconectado"}
                    </span>
                  </div>
                </div>
                <button type="button" onClick={conectarImpressora} disabled={conectando}
                  className="px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"
                  style={{ background: "var(--accent-soft)", color: "var(--accent-fg)" }}>
                  <RefreshCw size={13} className={conectando ? "animate-spin" : ""} />
                  {impressoraStatus === "conectada" ? "Atualizar" : "Conectar e autorizar"}
                </button>
              </div>
              {impressoras.length > 0 && (
                <Field label="Fila de impressão do Windows">
                  <Select value={impressoraNome} onChange={(e) => escolherImpressora(e.target.value)}>
                    <option value="">Selecione a impressora térmica...</option>
                    {impressoras.map((nome) => <option key={nome} value={nome}>{nome}</option>)}
                  </Select>
                </Field>
              )}
              {impressoraErro && <p className="text-[11px] font-bold text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-2">{impressoraErro}</p>}
              <p className="text-[10px] font-medium" style={{ color: "var(--dim)" }}>
                Perfil {PERFIS_TP20[tamanho].descricao}. A guilhotina permanece desligada para proteger a bobina adesiva.
              </p>
              <a href="https://qz.io/download/" target="_blank" rel="noreferrer"
                className="inline-block text-[10px] font-bold mt-1.5" style={{ color: "var(--accent-fg)" }}>
                Instalar o assistente QZ Tray neste computador
              </a>
            </Card>

            <div className="grid sm:grid-cols-3 gap-3">
              <Btn variant="ghost" disabled={salvando} onClick={() => salvar("")}><Save size={16} /> {salvando ? "Salvando..." : "Salvar"}</Btn>
              <Btn variant="ghost" disabled={salvando} onClick={() => salvar("navegador")}><Printer size={16} /> Impressão comum</Btn>
              <Btn variant="primary" disabled={salvando || impressoraStatus !== "conectada"} onClick={() => salvar("tp20")}><Printer size={16} /> {salvando ? "Aguarde..." : "Imprimir na TP20"}</Btn>
            </div>
          </div>

          {/* ── Preview / Etiqueta ── */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <SectionLabel>Pré-visualização</SectionLabel>
              <div className="flex gap-1.5">
                {["60x40", "60x60"].map((t) => (
                  <button key={t} onClick={() => setTamanho(t)}
                    className="text-[11px] font-bold px-3 py-1.5 rounded-lg transition-all"
                    style={tamanho === t ? { background: "var(--accent-strong)", color: "#fff" } : { background: "var(--card)", color: "var(--muted)", border: "1px solid var(--line)" }}>
                    {t.replace("x", "×")}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex justify-center overflow-auto p-4 bg-slate-100 rounded-2xl border border-slate-200">
              <div id="area-impressao" className="flex flex-col gap-4" style={{ width: "80mm" }}>
                {Array.from({ length: quantidadeCopias }).map((_, idx) => (
                  <div key={idx} className="etiqueta-print shadow-sm" style={{ width: dim.w, height: dim.h, marginLeft: "auto", marginRight: "auto", background: "#fff", color: "#000", padding: dim.pad, fontFamily: "'Courier New', monospace", borderRadius: 8, display: "flex", flexDirection: "column", overflow: "hidden", flexShrink: 0 }}>
                    {/* produto */}
                    <div style={{ fontSize: dim.titulo, fontWeight: 800, lineHeight: 1.0, textTransform: "uppercase", paddingBottom: dim.gap, borderBottom: "0.5mm solid #000" }}>
                      {nomeProduto || "PRODUTO"}
                    </div>
                    {/* conservação + qtd */}
                    <div style={{ display: "flex", justifyContent: "space-between", whiteSpace: "nowrap", fontSize: dim.linha, fontWeight: 700, padding: `${dim.secPad} 0`, borderBottom: "0.4mm solid #000" }}>
                      <span>{form.conservacao.toUpperCase()}</span>
                      <span>PESO: {form.quantidade}{form.unidade !== "UN" ? " " + form.unidade : ""}</span>
                    </div>
                    {/* aberto: manipulação + validade com hora; fechado:
                        quando foi etiquetado + validade em destaque */}
                    <div style={{ padding: `${dim.secPad} 0`, borderBottom: "0.4mm solid #000" }}>
                      {tipoEtiqueta === "aberto" ? (
                        <>
                          <div style={{ display: "flex", justifyContent: "space-between", whiteSpace: "nowrap", fontSize: dim.linha, fontWeight: 700 }}><span>MANIPULACAO:</span><span>{fmtDataHora(agora)}</span></div>
                          <div style={{ display: "flex", justifyContent: "space-between", whiteSpace: "nowrap", fontSize: dim.linha, fontWeight: 900, marginTop: "0.4mm" }}><span>VALIDADE:</span><span>{fmtDataHora(validadeEm)}</span></div>
                        </>
                      ) : (
                        <>
                          <div style={{ display: "flex", justifyContent: "space-between", whiteSpace: "nowrap", fontSize: dim.linha, fontWeight: 700 }}><span>ETIQUETADO:</span><span>{fmtData(agora)}</span></div>
                          <div style={{ background: "#000", color: "#fff", textAlign: "center", whiteSpace: "nowrap", fontSize: dim.titulo, fontWeight: 900, letterSpacing: "0.3mm", padding: "0.7mm 0", marginTop: "0.4mm", borderRadius: "0.8mm" }}>
                            VAL: {fmtData(validadeEm)}
                          </div>
                        </>
                      )}
                    </div>
                    {/* responsável */}
                    <div style={{ fontSize: dim.linha, fontWeight: 700, marginTop: dim.respMt }}>RESP.: {(form.responsavel || "—").toUpperCase()}</div>
                    {form.lote && <div style={{ fontSize: dim.resp, fontWeight: 700, marginTop: "0.4mm" }}>LOTE/SIF: {form.lote}</div>}
                    {/* espaço flexível empurra o rodapé pra baixo */}
                    <div style={{ flex: 1, minHeight: "0.5mm" }} />
                    {/* rodapé: empresa (esq) + QR encaixado (dir) */}
                    <div style={{ borderTop: "0.5mm solid #000", paddingTop: dim.gap, display: "flex", justifyContent: "space-between", alignItems: "flex-end", fontSize: dim.resp, fontWeight: 700, gap: "1.5mm" }}>
                      <div style={{ minWidth: 0, lineHeight: dim.footLh }}>
                        <div>{(unidadeInfo.nome_fantasia || unidadeInfo.nome || "").toUpperCase()}</div>
                        {tamanho === "60x40" ? (
                          <>
                            {(cnpjUnidade || codigo) && <div>{cnpjUnidade ? `CNPJ: ${fmtCNPJ(cnpjUnidade)}` : ""}{cnpjUnidade && codigo ? "  " : ""}{codigo ? `#${codigo}` : ""}</div>}
                            {enderecoUnidade && <div>{enderecoUnidade.toUpperCase()}</div>}
                            {localizacaoUnidade && <div>{localizacaoUnidade.toUpperCase()}</div>}
                          </>
                        ) : (
                          <>
                            {cnpjUnidade && <div>CNPJ: {fmtCNPJ(cnpjUnidade)}</div>}
                            {enderecoUnidade && <div>{enderecoUnidade.toUpperCase()}</div>}
                            {localizacaoUnidade && <div>{localizacaoUnidade.toUpperCase()}</div>}
                            <div style={{ opacity: 0.7 }}>#{codigo}</div>
                          </>
                        )}
                      </div>
                      <div style={{ flexShrink: 0, lineHeight: 0 }}>
                        <QRCodeSVG data-qr-etiqueta="true" value={rastreioUrl} size={dim.qr} level="M" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <p className="text-[11px] text-center mt-3 flex items-center justify-center gap-1.5" style={{ color: "var(--dim)" }}>
              <QrCode size={13} /> {tamanho.replace("x", "×")}mm · código {codigo}
            </p>
          </div>
        </div>
        )}
      </PageBody>
    </div>
  );
}

export default function EtiquetasPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center font-bold" style={{ color: "var(--muted)" }}>Carregando Etiquetas...</div>}>
       <EtiquetasRunner />
    </Suspense>
  );
}

function fmtCNPJ(s) {
  const d = (s || "").replace(/\D/g, "");
  return d.length === 14 ? d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5") : s;
}

function fmtCEP(s) {
  const d = String(s || "").replace(/\D/g, "");
  return d.length === 8 ? d.replace(/^(\d{5})(\d{3})$/, "$1-$2") : s;
}

function dataLocalParaInput(data = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${data.getFullYear()}-${p(data.getMonth() + 1)}-${p(data.getDate())}`;
}

function Linha({ k, v, top, fs = "3.6mm", forte }) {
  const base = { display: "flex", justifyContent: "space-between", gap: "2mm", fontSize: fs, fontWeight: 700, whiteSpace: "nowrap" };
  if (forte) {
    return (
      <div style={{ ...base, background: "#000", color: "#fff", padding: "0.9mm 1.2mm", borderRadius: "0.8mm", marginTop: "1mm" }}>
        <span>{k}</span><span>{v}</span>
      </div>
    );
  }
  return (
    <div style={{ ...base, marginTop: top ? "1.2mm" : "0.6mm", borderBottom: "0.3mm solid #000", paddingBottom: "0.6mm" }}>
      <span>{k}</span><span>{v}</span>
    </div>
  );
}
