"use client";

// Ficha técnica: monta cada marmita, sobremesa e bebida e mostra só o custo,
// já com a embalagem. Preço, taxas e lucro ficam no Cardápio.

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Printer, Search, UtensilsCrossed } from "lucide-react";
import { useMarmitaria } from "../../../components/marmitaria/contexto";
import EditorMarmita, { chaveRascunhoFicha } from "../../../components/marmitaria/EditorMarmita";
import { apagarRascunhoNoBanco, lerRascunhoDoBanco } from "../../../lib/rascunho-aparelho";
import { Botao, Cartao, Secao, brl, inputCls } from "../../../components/marmitaria/ui";
import { formDaMarmita, payloadDoForm } from "../../../lib/marmitaria/formulario.mjs";
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
  const [recuperado, setRecuperado] = useState(null);
  const { unidadeId } = useMarmitaria();
  // Rascunho de ficha não salva (a tela recarregou no meio). Dono, 17/11/2026:
  // "quando aperto em ficha técnica aparece a ficha aberta" → a lista abre
  // sempre fechada; o rascunho vira um aviso com Continuar / Descartar. Se o
  // rascunho é igual à ficha salva, é descartado sem perguntar.
  const [pendente, setPendente] = useState(null);
  useEffect(() => {
    if (!base || editando || params.get("editar")) return;
    let vivo = true;
    const chave = chaveRascunhoFicha(unidadeId);
    lerRascunhoDoBanco(chave).then((r) => {
      if (!vivo || !r?.form?.id) return;
      const ctx = { insumos: base.insumos, fichas: base.fichas };
      const salva = base.marmitas.find((m) => String(m.id) === String(r.form.id));
      const igual = salva && JSON.stringify(payloadDoForm(r.form, ctx, unidadeId)) === JSON.stringify(payloadDoForm(formDaMarmita(salva, ctx), ctx, unidadeId));
      if (igual || (!salva && !r.form.nome?.trim() && !r.form.itens?.length)) { apagarRascunhoNoBanco(chave); return; }
      setPendente(r);
    });
    return () => { vivo = false; };
  }, [base]); // eslint-disable-line react-hooks/exhaustive-deps
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
      <EditorMarmita key={editando.id} form={editando} recuperado={recuperado && recuperado.form?.id === editando.id ? recuperado : null}
        onFechar={() => { setEditando(null); setRecuperado(null); }}
        onSalvo={(r) => {
          // dono, 17/11/2026: salvou, fica na ficha técnica e pergunta se cadastra a próxima
          setEditando(null); setRecuperado(null);
          setAviso(`Ficha técnica salva${r?.codigo ? ` (${r.codigo})` : ""}.`);
          if (typeof window !== "undefined") document.querySelector(".erp-main-scroll")?.scrollTo({ top: 0, behavior: "smooth" });
        }} />
    );
  }

  const nova = () => setEditando(formDaMarmita(null, { insumos: base.insumos, fichas: base.fichas }));
  const editar = (m) => setEditando(formDaMarmita(m, { insumos: base.insumos, fichas: base.fichas }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-end gap-2">
        {/* impressão (dono, 17/11/2026): montagem das marmitas e fichas das bases */}
        <Botao variante="secundario" onClick={() => router.push("/dashboard/marmitaria/marmitas/processos")}><Printer size={16} /> Imprimir montagem</Botao>
        <Botao variante="secundario" onClick={() => router.push("/dashboard/marmitaria/estoque/producoes?aba=subprodutos")}><Printer size={16} /> Imprimir bases</Botao>
        <Botao onClick={nova}><Plus size={16} /> Nova ficha técnica</Botao>
      </div>
      {pendente && (
        <Cartao>
          <p className="font-semibold text-hf-text">Ficha não salva: {pendente.form.nome?.trim() || "ficha nova"}</p>
          <p className="mt-0.5 text-sm text-hf-text-2">Ficou guardada quando a tela recarregou.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Botao onClick={() => { setRecuperado(pendente); setEditando(pendente.form); setPendente(null); }}>Continuar editando</Botao>
            <Botao variante="secundario" onClick={() => { apagarRascunhoNoBanco(chaveRascunhoFicha(unidadeId)); setPendente(null); }}>Descartar</Botao>
          </div>
        </Cartao>
      )}
      {aviso && (
        <Cartao>
          <p className="font-semibold text-hf-text">{aviso}</p>
          <p className="mt-0.5 text-sm text-hf-text-2">Cadastrar nova ficha técnica?</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Botao onClick={() => { setAviso(null); nova(); }}><Plus size={16} /> Cadastrar nova ficha</Botao>
            <Botao variante="secundario" onClick={() => setAviso(null)}>Agora não</Botao>
          </div>
        </Cartao>
      )}
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
            {/* cards fechados, fundo escuro (dono, 17/11: "ela tem que ser minimizada… organiza em cards"); toque abre para editar */}
            <ul className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {g.itens.map((m) => {
                const c = custos.get(m.id);
                return (
                  <li key={m.id}>
                    <button type="button" onClick={() => onEditar(m)} aria-label={`Abrir ficha técnica ${m.nome_receita}`}
                      className="hf-manter-dourado flex h-full w-full flex-col overflow-hidden rounded-2xl bg-hf-menu text-left text-white shadow-sm transition active:scale-[0.98]">
                      <span className="grid aspect-[4/3] w-full place-items-center overflow-hidden bg-white/10 text-white/60">
                        {m.imagem ? <img src={m.imagem} alt="" className="h-full w-full object-cover" /> : <UtensilsCrossed size={28} />}
                      </span>
                      <span className="flex flex-1 flex-col gap-1 p-3">
                        <span className="line-clamp-2 text-sm font-bold leading-snug">{m.nome_receita}</span>
                        <span className="mt-auto text-[11px] text-white/60">Custo</span>
                        <span className="text-lg font-black tabular-nums leading-none">{c ? brl(c.total) : "—"}</span>
                        {c && !c.completo && <span className="text-[11px] font-semibold text-amber-300">Custo incompleto</span>}
                        {m.ativo === false && <span className="text-[11px] text-white/60">Fora do cardápio</span>}
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
