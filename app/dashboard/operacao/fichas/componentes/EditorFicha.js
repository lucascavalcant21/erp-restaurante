"use client";

// EDITOR DA FICHA — criar e editar, para prato e pré-preparo, na cozinha e no bar.
//
// Um editor só: o tipo decide o formulário (FORMULARIO_DO_TIPO) e a cor; o
// setor é um campo. Usado pela listagem de fichas e pela página da ficha.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CookingPot, Loader2, Plus, Save, UtensilsCrossed, X } from "lucide-react";
import { configDoTipo, estiloDoTipo, setorId, unidadePadraoDepartamento } from "../../../../lib/ficha-modelo.mjs";
import {
  estadoInicialDoEditor, itemDeOpcao, opcoesDeIngrediente, rendimentoSomado, rendimentoEhAutomatizavel,
} from "../../../../lib/ficha-editor.mjs";
import { carregarComplementosDaFicha, salvarFichaDoEditor } from "../../../../lib/ficha-salvar";
import { FORMULARIO_DO_TIPO } from "./FormulariosFicha";

export const ICONE_DO_TIPO = { prato: UtensilsCrossed, pre_preparo: CookingPot };

export default function EditorFicha({
  tipo, departamento, ficha = null, rascunho = null,
  fichas = [], insumos = [], embalagens = [],
  categoriasDe, onGerenciarCategorias,
  unidadeId, sessao, podeVerCustos = false,
  onFechar, onSalvo,
}) {
  const cfg = configDoTipo(tipo);
  const Formulario = FORMULARIO_DO_TIPO[cfg.id];
  const Icone = ICONE_DO_TIPO[cfg.id];

  const [inicial] = useState(() => estadoInicialDoEditor({ departamento, tipo: cfg.id, ficha, rascunho, todasFichas: fichas }));
  const [form, setForm] = useState(inicial.form);
  const [itens, setItens] = useState(inicial.itens);
  const [autoRendimento, setAuto] = useState(inicial.autoRendimento);
  const [armazenamento, setArmazenamentoBruto] = useState(inicial.armazenamento);
  const [armazenamentoOriginal, setArmazenamentoOriginal] = useState(null);
  const [equipamentos, setEquipamentosBruto] = useState(inicial.equipamentos);
  const [alergenicos, setAlergenicosBruto] = useState(inicial.alergenicos);
  const [carregandoComplementos, setCarregandoComplementos] = useState(!!ficha);
  const [complementosOk, setComplementosOk] = useState(!ficha);
  const [avisoComplementos, setAvisoComplementos] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [sujo, setSujo] = useState(!!rascunho);
  // Enquanto a pessoa não digitar, o texto de montagem/preparo ainda pode ser
  // completado com o que vem das tabelas filhas (montagem antiga, etapas).
  const textoTocado = useRef(false);

  // Seções do pré-preparo e texto antigo de montagem/etapas moram em tabelas
  // filhas: chegam depois, sem apagar o que a pessoa já tenha digitado.
  useEffect(() => {
    if (!ficha?.id) return undefined;
    let ativo = true;
    carregarComplementosDaFicha(ficha.id).then(r => {
      if (!ativo) return;
      const base = estadoInicialDoEditor({ departamento, ficha, todasFichas: fichas, complementos: r.data });
      setArmazenamentoBruto(base.armazenamento);
      setArmazenamentoOriginal(base.armazenamentoOriginal);
      setEquipamentosBruto(base.equipamentos);
      setAlergenicosBruto(base.alergenicos);
      setForm(atual => (textoTocado.current ? atual : { ...atual, modo_preparo: base.form.modo_preparo }));
      setComplementosOk(!r.falhou);
      if (r.falhou) setAvisoComplementos("Não foi possível ler armazenamento, equipamentos e alergênicos. Eles não serão regravados neste salvamento.");
      else if (r.semTabela && cfg.id === "pre_preparo") setAvisoComplementos("Armazenamento, equipamentos e alergênicos só são gravados depois da migração db/migracao_ficha_tecnica_completa.sql.");
      setCarregandoComplementos(false);
    });
    return () => { ativo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ficha?.id]);

  const marcar = (fn) => (...args) => { setSujo(true); return fn(...args); };
  const setArmazenamento = marcar(setArmazenamentoBruto);
  const setEquipamentos = marcar(setEquipamentosBruto);
  const setAlergenicos = marcar(setAlergenicosBruto);

  // Rendimento automático = soma dos ingredientes, na unidade do setor.
  const aplicarRendimento = useCallback((proximoForm, proximosItens, auto) => {
    if (!auto || !rendimentoEhAutomatizavel(proximoForm)) return proximoForm;
    const soma = rendimentoSomado(proximosItens, proximoForm.departamento);
    return soma ? { ...proximoForm, rendimento_porcoes: String(soma.valor), rendimento_unidade: soma.unidade } : proximoForm;
  }, []);

  const mudar = (patch) => {
    setSujo(true);
    if ("modo_preparo" in patch) textoTocado.current = true;
    setForm(atual => {
      let proximo = { ...atual, ...patch };
      // Trocar o setor leva junto a unidade do rendimento (kg ↔ L), se era a padrão.
      if (patch.departamento && setorId(patch.departamento) !== setorId(atual.departamento)
          && atual.rendimento_unidade === unidadePadraoDepartamento(atual.departamento)) {
        proximo.rendimento_unidade = unidadePadraoDepartamento(patch.departamento);
      }
      proximo = aplicarRendimento(proximo, itens, autoRendimento);
      return proximo;
    });
  };

  const mudarItens = (fn) => {
    setSujo(true);
    const proximos = fn(itens);
    setItens(proximos);
    setForm(f => aplicarRendimento(f, proximos, autoRendimento));
  };

  const setAutoRendimento = (ligar) => {
    setAuto(ligar);
    setSujo(true);
    if (ligar) setForm(f => aplicarRendimento(f, itens, true));
  };

  const fontes = useMemo(() => ({ insumos, embalagens, fichas }), [insumos, embalagens, fichas]);
  const opcoes = useMemo(() => opcoesDeIngrediente({ ...fontes, fichaId: form.id }), [fontes, form.id]);
  const idsEmbalagem = useMemo(() => new Set(embalagens.map(e => e.id)), [embalagens]);
  const categorias = categoriasDe ? categoriasDe(form.departamento, cfg.id) : [];

  const ingredientes = {
    itens,
    opcoes,
    onAdicionar: (valor) => {
      const novo = itemDeOpcao(valor, fontes, 0);
      if (novo) mudarItens(lista => (lista.some(i => i.chave === novo.chave) ? lista : [...lista, novo]));
    },
    onQuantidade: (chave, quantidade) => mudarItens(lista => lista.map(i => (i.chave === chave ? { ...i, quantidade } : i))),
    onAlternarModo: (chave) => mudarItens(lista => lista.map(i => (i.chave === chave ? { ...i, modo: i.modo === "sub" ? "base" : "sub" } : i))),
    onRemover: (chave) => mudarItens(lista => lista.filter(i => i.chave !== chave)),
    onSubstituir: (chave, valor) => mudarItens(lista => {
      const antigo = lista.find(i => i.chave === chave);
      const novo = itemDeOpcao(valor, fontes, antigo?.quantidade || 0);
      if (!novo) return lista;
      if (lista.some(i => i.chave === novo.chave)) return lista.filter(i => i.chave !== chave);
      return lista.map(i => (i.chave === chave ? novo : i));
    }),
  };

  const fechar = () => {
    if (sujo && !window.confirm("Descartar as alterações desta ficha?")) return;
    onFechar?.();
  };

  const salvar = async (continuar = false) => {
    if (salvando) return;
    setErro("");
    setSalvando(true);
    let resultado;
    try {
      resultado = await salvarFichaDoEditor({
        tipo: cfg.id, form, itens, armazenamento, armazenamentoOriginal, equipamentos, alergenicos,
        complementosCarregados: complementosOk, unidadeId, sessao, idsEmbalagem,
      });
    } catch (e) {
      resultado = { error: e?.message || "Falha ao salvar." };
    }
    setSalvando(false);
    if (resultado.error) { setErro(resultado.error); return; }
    setSujo(false);
    onSalvo?.({ id: resultado.id, avisos: resultado.avisos || [], continuar });
    if (continuar) {
      const vazio = estadoInicialDoEditor({ departamento: form.departamento, tipo: cfg.id });
      setForm(vazio.form);
      setItens(vazio.itens);
      setAuto(true);
      setArmazenamentoBruto(vazio.armazenamento);
      setArmazenamentoOriginal(null);
      setEquipamentosBruto([]);
      setAlergenicosBruto([]);
    }
  };

  const titulo = `${form.id ? "Editar" : "Novo"} ${cfg.id === "prato" ? "prato" : "pré-preparo"}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-2 backdrop-blur-sm sm:p-4" style={estiloDoTipo(cfg)}>
      <div role="dialog" aria-modal="true" aria-labelledby="editor-ficha-titulo"
        className="flex max-h-[calc(100dvh-1rem)] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-card shadow-2xl sm:max-h-[94vh]">
        <header className="flex items-center gap-3 border-b-4 border-[color:var(--tipo)] px-4 py-4 sm:px-6">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[color:var(--tipo)] text-[color:var(--tipo-fg)]">
            <Icone size={24} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-3xs font-black uppercase tracking-[0.18em] text-[color:var(--tipo)]">
              Ficha de {cfg.id === "prato" ? "prato" : "pré-preparo"} · {form.departamento === "bar" ? "Bar" : "Cozinha"}
            </p>
            <h2 id="editor-ficha-titulo" className="truncate text-xl font-black text-fg sm:text-2xl">{titulo}</h2>
            <p className="hidden text-xs font-medium text-muted sm:block">{cfg.resumo}</p>
          </div>
          <button type="button" onClick={fechar} aria-label="Fechar" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-elevated text-muted hover:text-fg">
            <X size={20} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto bg-[color:var(--surface)] p-3 sm:p-5">
          {avisoComplementos ? (
            <p className="mb-3 flex items-start gap-2 rounded-xl border border-[color:var(--warning)] bg-[color:var(--warning-soft)] px-3 py-2 text-xs font-bold text-[color:var(--warning-strong)]">
              <AlertTriangle size={15} className="mt-0.5 shrink-0" /> {avisoComplementos}
            </p>
          ) : null}
          <Formulario
            cfg={cfg} form={form} mudar={mudar} itens={itens} ingredientes={ingredientes}
            categorias={categorias} onGerenciarCategorias={onGerenciarCategorias ? () => onGerenciarCategorias(cfg.id) : null}
            autoRendimento={autoRendimento} setAutoRendimento={setAutoRendimento}
            armazenamento={armazenamento} setArmazenamento={setArmazenamento}
            equipamentos={equipamentos} setEquipamentos={setEquipamentos}
            alergenicos={alergenicos} setAlergenicos={setAlergenicos}
            podeVerCustos={podeVerCustos} carregandoComplementos={carregandoComplementos}
          />
        </div>

        <footer className="border-t border-line bg-card p-3 sm:p-4">
          {erro ? (
            <p role="alert" className="mb-2 flex items-start gap-2 rounded-xl border border-[color:var(--danger)] bg-[color:var(--danger-soft)] px-3 py-2 text-sm font-bold text-[color:var(--danger-strong)]">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" /> {erro}
            </p>
          ) : null}
          <div className="flex flex-col gap-2 sm:flex-row">
            <button type="button" onClick={() => salvar(false)} disabled={salvando}
              className="flex min-h-14 flex-1 items-center justify-center gap-2 rounded-2xl bg-[color:var(--tipo)] text-base font-black text-[color:var(--tipo-fg)] disabled:opacity-50">
              {salvando ? <Loader2 size={19} className="animate-spin" /> : <Save size={19} />}
              {salvando ? "Salvando..." : `Salvar ${cfg.id === "prato" ? "prato" : "pré-preparo"}`}
            </button>
            {!form.id ? (
              <button type="button" onClick={() => salvar(true)} disabled={salvando}
                className="flex min-h-14 items-center justify-center gap-2 rounded-2xl border-2 border-line px-5 text-sm font-black text-fg-soft hover:border-[color:var(--tipo)] disabled:opacity-50 sm:w-60">
                <Plus size={17} /> Salvar e criar {cfg.id === "prato" ? "outro prato" : "outro pré-preparo"}
              </button>
            ) : null}
          </div>
        </footer>
      </div>
    </div>
  );
}
