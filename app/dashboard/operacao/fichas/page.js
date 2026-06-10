"use client";

import { useState, useEffect, useMemo } from "react";
import { BookOpen, Plus, Trash2, FlaskConical, Calculator } from "lucide-react";
import {
  PageHeader, PageBody, Card, SectionLabel, Chips, Field, NumberInput, Select, TextInput, Btn, EmptyState, Toast, fmtBRL, fmtPct,
} from "../../../components/ui";

const SETORES = ["Cozinha", "Bar"];
import { useERP } from "../../../context/ERPContext";
import { fetchIngredientes, getIngredienteById, calcCustoLinha, getUnidade } from "../../../lib/ingredientes";

export default function FichasTecnicasPage() {
  const { unidadeAtiva, unidadeInfo } = useERP();
  const [catalogo, setCatalogo] = useState([]);
  const [loading, setLoading]   = useState(true);

  const [nome, setNome]   = useState("");
  const [preco, setPreco] = useState("");
  const [itens, setItens] = useState([]); // { id, ingrediente_id, quantidade }
  const [selId, setSelId] = useState("");
  const [qtd, setQtd]     = useState("");
  const [setor, setSetor] = useState("Cozinha");
  const [salvou, setSalvou] = useState(false);

  const catalogoSetor = catalogo.filter((i) => (i.setor || "Cozinha") === setor);

  useEffect(() => {
    setLoading(true);
    fetchIngredientes(unidadeAtiva).then(({ data }) => {
      setCatalogo(data || []);
      setSelId(String(data?.[0]?.id ?? ""));
      setLoading(false);
    });
  }, [unidadeAtiva]);

  const custoTotal = useMemo(() => itens.reduce((acc, it) => {
    const ing = getIngredienteById(it.ingrediente_id, catalogo);
    return acc + (ing ? calcCustoLinha(ing, it.quantidade) : 0);
  }, 0), [itens, catalogo]);

  const precoN = parseFloat(String(preco).replace(",", ".")) || 0;
  const mc  = precoN > 0 ? ((precoN - custoTotal) / precoN) * 100 : 0;
  const cmv = precoN > 0 ? (custoTotal / precoN) * 100 : 0;
  const ok  = mc >= 30;

  function adicionar() {
    const ing = getIngredienteById(selId, catalogo);
    const q = parseFloat(String(qtd).replace(",", ".")) || 0;
    if (!ing || q <= 0) return;
    setItens((p) => [...p, { id: `l${Date.now()}`, ingrediente_id: ing.id, quantidade: q }]);
    setQtd("");
  }
  function remover(id) { setItens((p) => p.filter((x) => x.id !== id)); }
  function salvar() {
    if (!nome.trim() || !itens.length) return;
    setSalvou(true); setTimeout(() => setSalvou(false), 2500);
  }

  const ingSel = getIngredienteById(selId, catalogo);

  return (
    <div className="min-h-screen">
      <PageHeader title="Ficha Técnica" subtitle={`Composição e custo · ${unidadeInfo.nome}`} icon={BookOpen} />
      <PageBody>
        <Toast show={salvou}>Ficha calculada e pronta!</Toast>

        {loading ? (
          <EmptyState icon={BookOpen} title="Carregando catálogo..." />
        ) : catalogo.length === 0 ? (
          <EmptyState icon={FlaskConical} title="Sem ingredientes nesta unidade"
            hint="Cadastre ingredientes em Operação → Ingredientes para montar fichas técnicas." />
        ) : (
          <>
            {/* Identificação */}
            <Card>
              <Field label="Nome do prato / ficha"><TextInput value={nome} onChange={(e) => setNome(e.target.value)} placeholder="ex: Marmitex Executiva" /></Field>
              <Field label="Preço de venda (R$)"><NumberInput value={preco} onChange={(e) => setPreco(e.target.value)} placeholder="0,00" step="0.01" /></Field>
            </Card>

            {/* Adicionar ingrediente */}
            <Card>
              <SectionLabel>Adicionar ingrediente</SectionLabel>
              <div className="mb-3">
                <Chips options={SETORES} value={setor}
                  onChange={(s) => { setSetor(s); const first = catalogo.find((i) => (i.setor || "Cozinha") === s); setSelId(String(first?.id ?? "")); }} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Ingrediente">
                  <Select value={selId} onChange={(e) => setSelId(e.target.value)}>
                    {catalogoSetor.length === 0 && <option value="">— sem ingredientes de {setor} —</option>}
                    {catalogoSetor.map((i) => <option key={i.id} value={i.id}>{i.nome}</option>)}
                  </Select>
                </Field>
                <Field label={`Quantidade${ingSel ? ` (${getUnidade(ingSel.unidade).base})` : ""}`}>
                  <NumberInput value={qtd} onChange={(e) => setQtd(e.target.value)} placeholder="0" onKeyDown={(e) => e.key === "Enter" && adicionar()} />
                </Field>
              </div>
              <Btn variant="primary" className="w-full" onClick={adicionar}><Plus size={15} /> Adicionar à ficha</Btn>
            </Card>

            {/* Linhas da receita */}
            <div>
              <SectionLabel>Composição ({itens.length})</SectionLabel>
              {itens.length === 0 ? (
                <EmptyState icon={Calculator} title="Nenhum ingrediente na ficha" hint="Adicione ingredientes acima para calcular o custo." />
              ) : (
                <div className="space-y-2">
                  {itens.map((it) => {
                    const ing = getIngredienteById(it.ingrediente_id, catalogo);
                    if (!ing) return null;
                    const un = getUnidade(ing.unidade);
                    const custo = calcCustoLinha(ing, it.quantidade);
                    return (
                      <Card key={it.id} className="!p-3">
                        <div className="flex items-center gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold truncate" style={{ color: "var(--fg)" }}>{ing.nome}</p>
                            <p className="text-[11px]" style={{ color: "var(--dim)" }}>{it.quantidade} {un.base} · {fmtBRL(ing.custo_por_unidade_base, 4)} {un.label_base}</p>
                          </div>
                          <p className="text-sm font-bold" style={{ color: "var(--fg)" }}>{fmtBRL(custo)}</p>
                          <button onClick={() => remover(it.id)} className="w-8 h-8 rounded-lg flex items-center justify-center erp-badge-danger"><Trash2 size={14} /></button>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Resumo de custo */}
            <Card>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium" style={{ color: "var(--muted)" }}>Custo total da ficha</span>
                <span className="text-xl font-bold" style={{ color: "var(--fg)" }}>{fmtBRL(custoTotal)}</span>
              </div>
              {precoN > 0 && (
                <div className="flex justify-between text-[12px] font-bold" style={{ color: ok ? "var(--accent-fg)" : "#DC2626" }}>
                  <span>CMV {fmtPct(cmv)}</span>
                  <span>Margem {fmtPct(mc)}</span>
                </div>
              )}
            </Card>

            <Btn variant="primary" className="w-full !h-12" disabled={!nome.trim() || !itens.length} onClick={salvar}>Salvar ficha técnica</Btn>
          </>
        )}
      </PageBody>
    </div>
  );
}
