"use client";

import Link from "next/link";

// Ficha técnica: monta cada marmita, sobremesa e bebida e mostra só o custo,
// já com a embalagem. Preço, taxas e lucro ficam no Cardápio.

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Search, UtensilsCrossed } from "lucide-react";
import { useMarmitaria } from "../../../components/marmitaria/contexto";
import EditorMarmita from "../../../components/marmitaria/EditorMarmita";
import { Aviso, Botao, Cartao, Secao, brl, inputCls } from "../../../components/marmitaria/ui";
import { formDaMarmita } from "../../../lib/marmitaria/formulario.mjs";
import { ordenarCategorias } from "../../../lib/marmitaria/cardapio.mjs";
import { normalizarBusca } from "../../../lib/ingredientes-utils.mjs";
import { casaBusca } from "../../../lib/busca.mjs";

const SEM_CATEGORIA = "Sem categoria";

function Conteudo() {
  const { base, carregando } = useMarmitaria();
  const params = useSearchParams();
  const router = useRouter();
  const [editando, setEditando] = useState(null);
  const [aviso, setAviso] = useState(null);
  // Links antigos das abas de preço e de combos, e o "Editar" vindo do Cardápio.
  const editarId = params.get("editar");
  useEffect(() => { if (["combos", "precos"].includes(params.get("aba"))) router.replace("/dashboard/marmitaria/marmitas/cardapio"); }, [params, router]);
  useEffect(() => {
    if (!base || !editarId) return;
    const m = base.marmitas.find((x) => String(x.id) === editarId);
    if (m) setEditando(formDaMarmita(m, { insumos: base.insumos, fichas: base.fichas }));
    router.replace("/dashboard/marmitaria/marmitas");
  }, [base, editarId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!base) return carregando ? <Cartao><p className="text-sm text-hf-muted">Carregando fichas…</p></Cartao> : null;

  if (editando) {
    return (
      <EditorMarmita key={editando.id} form={editando}
        onFechar={() => setEditando(null)}
        onSalvo={(r) => { setEditando(null); setAviso(`Ficha técnica salva${r?.codigo ? ` (${r.codigo})` : ""}.`); }} />
    );
  }

  const nova = () => setEditando(formDaMarmita(null, { insumos: base.insumos, fichas: base.fichas }));
  const editar = (m) => setEditando(formDaMarmita(m, { insumos: base.insumos, fichas: base.fichas }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-end gap-2">
        <Link href="/dashboard/marmitaria/marmitas/criar" className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-hf-accent px-4 text-sm font-semibold text-white">Criar marmita pronta para vender</Link>
        <Botao variante="secundario" onClick={nova}><Plus size={16} /> Nova ficha técnica</Botao>
      </div>
      {aviso && <Aviso>{aviso}</Aviso>}
      <ListaDeFichas onEditar={editar} onNova={nova} />
    </div>
  );
}

function ListaDeFichas({ onEditar, onNova }) {
  const { base, custos } = useMarmitaria();
  const [busca, setBusca] = useState("");
  const [categoria, setCategoria] = useState("");

  const categorias = useMemo(() => ordenarCategorias(base.marmitas.map((m) => m.categoria || SEM_CATEGORIA)), [base.marmitas]);
  const grupos = useMemo(() => {
    const t = normalizarBusca(busca);
    const lista = base.marmitas
      .filter((m) => !categoria || (m.categoria || SEM_CATEGORIA) === categoria)
      .filter((m) => !t || casaBusca(`${m.nome_receita} ${m.codigo || ""} ${m.categoria || ""}`, busca));
    return categorias.map((c) => ({ categoria: c, itens: lista.filter((m) => (m.categoria || SEM_CATEGORIA) === c) })).filter((g) => g.itens.length);
  }, [base.marmitas, busca, categoria, categorias]);

  if (!base.marmitas.length) {
    return (
      <Secao titulo="Nenhuma ficha técnica ainda">
        <p className="text-sm text-hf-text-2">Monte a primeira: escolha os ingredientes do cadastro do sistema, a embalagem, e veja o custo na hora.</p>
        <Botao className="mt-3" onClick={onNova}><Plus size={16} /> Montar ficha técnica</Botao>
      </Secao>
    );
  }

  return (
    <Secao>
      <div className="relative mb-3">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-hf-muted" />
        <input className={`${inputCls} pl-9`} value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar na ficha técnica" aria-label="Buscar na ficha técnica" />
      </div>
      {categorias.length > 1 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {["", ...categorias].map((c) => (
            <button key={c || "todas"} type="button" onClick={() => setCategoria(c)} aria-pressed={categoria === c}
              className={`min-h-[40px] rounded-full border px-3 text-sm font-semibold ${categoria === c ? "border-hf-accent bg-hf-accent text-hf-accent-fg" : "border-hf-border bg-hf-surface text-hf-text-2"}`}>{c || "Todas"}</button>
          ))}
        </div>
      )}
      <div className="space-y-4">
        {grupos.map((g) => (
          <div key={g.categoria}>
            <p className="text-xs font-black uppercase tracking-wide text-hf-muted">{g.categoria}</p>
            <ul className="divide-y divide-hf-border">
              {g.itens.map((m) => {
                const c = custos.get(m.id);
                return (
                  <li key={m.id}>
                    <button type="button" onClick={() => onEditar(m)} className="flex w-full items-center gap-3 py-3 text-left hover:bg-hf-elevated/40">
                      <span className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-hf-elevated text-hf-muted">
                        {m.imagem ? <img src={m.imagem} alt="" className="h-full w-full object-cover" /> : <UtensilsCrossed size={20} />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-bold text-hf-text">{m.nome_receita}</span>
                        <span className="block text-xs text-hf-muted">
                          {c ? `Comida ${brl(c.alimentos + c.prePreparos)} · Embalagem ${brl(c.embalagens)}` : ""}{m.ativo === false ? " · Fora do cardápio" : ""}
                        </span>
                        {c && !c.completo && <span className="block text-xs font-semibold text-hf-warning">Custo incompleto</span>}
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block text-[11px] text-hf-muted">Custo</span>
                        <span className="block text-base font-black tabular-nums text-hf-text">{c ? brl(c.total) : "—"}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
      {!grupos.length && <p className="py-4 text-sm text-hf-muted">Nada encontrado com essa busca.</p>}
    </Secao>
  );
}

export default function MarmitasPage() {
  return <Suspense fallback={null}><Conteudo /></Suspense>;
}
