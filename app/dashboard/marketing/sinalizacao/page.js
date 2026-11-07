"use client";

// SINALIZAÇÃO DIGITAL — painel das TVs de marketing (pedido do dono, 07/11/2026).
// Telas, Mídias, Playlists e Programação. Regras em app/lib/sinalizacao.mjs;
// servidor em app/lib/server/sinalizacao.mjs; player em /tv.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown, ArrowUp, CalendarClock, Copy, Film, Image as ImageIcon, LayoutGrid, Link2, ListVideo,
  MonitorPlay, MoreVertical, Pencil, Plus, Power, RefreshCw, Trash2, Upload, Utensils,
} from "lucide-react";
import { useERP } from "../../../context/ERPContext";
import { usePermission } from "../../../components/access-control/PermissionGate";
import { PageHeader, PageBody, Card, Modal, Field, TextInput, Select, Btn, Toast, Toggle, EmptyState, SkeletonList } from "../../../components/ui";
import { chamar, lerPainel, enviarArquivo, tamanhoLegivel, segundos, Miniatura, Selo, DIAS } from "../../../components/sinalizacao/apoio";
import { regraVale, rotuloSemContato, LIMITE_BYTES, DURACAO } from "../../../lib/sinalizacao.mjs";

const ABAS = [
  { id: "visao", label: "Visão geral", icone: LayoutGrid },
  { id: "telas", label: "Telas", icone: MonitorPlay },
  { id: "midias", label: "Mídias", icone: ImageIcon },
  { id: "playlists", label: "Playlists", icone: ListVideo },
  { id: "programacao", label: "Programação", icone: CalendarClock },
];

const STATUS = {
  no_ar: { tom: "ok", texto: "No ar" },
  sem_contato: { tom: "aviso", texto: "Fora do ar" },
  aguardando: { tom: "neutro", texto: "Aguardando" },
};

export default function SinalizacaoPage() {
  const { unidadeAtiva } = useERP();
  const podeCriar = usePermission("clientes.signage.create");
  const podeEditar = usePermission("clientes.signage.edit");
  const podeExcluir = usePermission("clientes.signage.delete");

  const [aba, setAba] = useState("visao");
  const [painel, setPainel] = useState(null);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [modal, setModal] = useState(null); // { tipo, dados }

  const avisar = (t) => { setAviso(t); setTimeout(() => setAviso(""), 2600); };

  const carregar = useCallback(async () => {
    if (!unidadeAtiva) return;
    try {
      setErro("");
      setPainel(await lerPainel(unidadeAtiva));
    } catch (e) {
      setErro(e.message);
    }
  }, [unidadeAtiva]);

  useEffect(() => { setPainel(null); carregar(); }, [carregar]);
  // O status "No ar" muda sozinho: atualiza a cada 30 s com a tela aberta.
  useEffect(() => {
    const t = setInterval(() => { if (document.visibilityState === "visible") carregar(); }, 30000);
    return () => clearInterval(t);
  }, [carregar]);

  const executar = async (acao, dados, sucesso) => {
    const r = await chamar(unidadeAtiva, acao, dados);
    await carregar();
    if (sucesso) avisar(sucesso);
    return r;
  };

  const midiasPorId = useMemo(() => new Map((painel?.midias || []).map((m) => [m.id, m])), [painel]);
  const playlistsPorId = useMemo(() => new Map((painel?.playlists || []).map((p) => [p.id, p])), [painel]);

  const abrir = (tipo, dados = {}) => setModal({ tipo, dados });
  const fechar = () => setModal(null);

  return (
    <div className="min-h-full bg-hf-bg">
      <PageHeader title="Sinalização digital" subtitle="Artes, vídeos e cardápio com preço nas TVs da loja">
        {podeCriar && painel && !painel.semTabelas && (
          <button onClick={() => abrir("parear")} className="erp-btn erp-btn-primary !min-h-11 w-full md:w-auto text-sm">
            <Plus size={16} /> Parear TV
          </button>
        )}
      </PageHeader>
      <PageBody>
        <nav className="-mx-3 flex gap-1.5 overflow-x-auto px-3 pb-1 sm:mx-0 sm:px-0" style={{ scrollbarWidth: "none" }} aria-label="Áreas da Sinalização digital">
          {ABAS.map((a) => (
            <button key={a.id} onClick={() => setAba(a.id)}
              className={`flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-3.5 text-sm font-semibold transition ${aba === a.id ? "bg-hf-accent text-hf-accent-fg shadow-sm" : "border border-hf-border bg-hf-surface text-hf-text-2"}`}>
              <a.icone size={16} /> {a.label}
            </button>
          ))}
        </nav>

        {erro && <Card className="border-hf-danger/30 text-sm text-hf-danger">{erro}</Card>}
        {!painel && !erro && <SkeletonList rows={4} />}
        {painel?.semTabelas && (
          <Card className="space-y-2">
            <p className="text-sm font-semibold text-hf-text">Módulo pronto, aguardando ativação no banco</p>
            <p className="text-sm text-hf-muted">{painel.erro} Assim que a migração SINAL-1 for aplicada, as TVs podem ser pareadas aqui.</p>
          </Card>
        )}

        {painel && !painel.semTabelas && (
          <>
            {aba === "visao" && <VisaoGeral painel={painel} midiasPorId={midiasPorId} playlistsPorId={playlistsPorId} irPara={setAba} abrir={abrir} podeCriar={podeCriar} />}
            {aba === "telas" && <Telas painel={painel} midiasPorId={midiasPorId} playlistsPorId={playlistsPorId} abrir={abrir} podeCriar={podeCriar} podeEditar={podeEditar} />}
            {aba === "midias" && <Midias painel={painel} unidade={unidadeAtiva} carregar={carregar} avisar={avisar} executar={executar} abrir={abrir} podeCriar={podeCriar} podeEditar={podeEditar} podeExcluir={podeExcluir} />}
            {aba === "playlists" && <Playlists painel={painel} midiasPorId={midiasPorId} abrir={abrir} podeCriar={podeCriar} podeEditar={podeEditar} />}
            {aba === "programacao" && <Programacao painel={painel} playlistsPorId={playlistsPorId} abrir={abrir} podeCriar={podeCriar} />}
          </>
        )}
      </PageBody>

      {modal?.tipo === "parear" && <ModalParear painel={painel} dados={modal.dados} fechar={fechar} executar={executar} />}
      {modal?.tipo === "trocar" && <ModalTrocar painel={painel} dados={modal.dados} fechar={fechar} executar={executar} />}
      {modal?.tipo === "tela" && <ModalTela tela={modal.dados.tela} fechar={fechar} executar={executar} abrir={abrir} podeExcluir={podeExcluir} />}
      {modal?.tipo === "playlist" && <ModalPlaylist painel={painel} playlist={modal.dados.playlist} fechar={fechar} executar={executar} abrir={abrir} podeExcluir={podeExcluir} />}
      {modal?.tipo === "regra" && <ModalRegra painel={painel} regra={modal.dados.regra} fechar={fechar} executar={executar} podeExcluir={podeExcluir} />}
      <Toast show={!!aviso}>{aviso}</Toast>
    </div>
  );
}

// ─── O que está passando na tela ─────────────────────────────────────────────
function conteudoDaTela(tela, midiasPorId, playlistsPorId) {
  const exibindo = tela.exibindo?.midia_id ? midiasPorId.get(tela.exibindo.midia_id) : null;
  const c = tela.agora?.conteudo;
  let rotulo = "Sem conteúdo";
  let midia = exibindo || null;
  let cardapio = tela.exibindo?.tipo === "cardapio";
  if (c?.tipo === "midia") {
    const m = midiasPorId.get(c.id);
    rotulo = m ? `Arte: ${m.nome}` : "Arte removida";
    midia = midia || m || null;
  } else if (c?.tipo === "playlist") {
    const p = playlistsPorId.get(c.id);
    rotulo = p ? p.nome : "Playlist removida";
    if (!midia && p) {
      const primeira = (p.itens || [])[0];
      if (primeira?.tipo === "midia") midia = midiasPorId.get(primeira.midia_id) || null;
      else if (primeira?.tipo === "cardapio") cardapio = true;
    }
  }
  const origem = tela.agora?.origem === "programacao" ? `Programação · ${tela.agora.regra?.nome || ""}` : tela.agora?.origem === "fixo" ? "Conteúdo fixo" : "";
  return { rotulo, midia, cardapio, origem };
}

function CartaoTela({ tela, midiasPorId, playlistsPorId, abrir, podeEditar }) {
  const { rotulo, midia, cardapio, origem } = conteudoDaTela(tela, midiasPorId, playlistsPorId);
  const st = STATUS[tela.status] || STATUS.aguardando;
  return (
    <Card className="flex flex-col gap-3 !p-3">
      <div className="relative">
        <Miniatura midia={midia} cardapio={cardapio} orientacao="horizontal" />
        <div className="absolute left-2 top-2 rounded-full bg-white shadow-sm"><Selo tom={st.tom}>{st.texto}</Selo></div>
        <div className="absolute right-2 top-2 rounded-full bg-white shadow-sm"><Selo>{tela.orientacao === "vertical" ? "Vertical" : "Horizontal"}</Selo></div>
        {tela.status === "sem_contato" && (
          <p className="absolute inset-x-2 bottom-2 rounded-lg bg-white/90 px-2 py-1 text-[11px] font-semibold text-hf-warning">{rotuloSemContato(tela.ultimo_contato)}</p>
        )}
      </div>
      <div className="min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold text-hf-text">{tela.nome}</p>
            <p className="truncate text-xs text-hf-muted">{[tela.local, rotulo].filter(Boolean).join(" · ")}</p>
            {origem && <p className="truncate text-[11px] text-hf-muted">{origem}</p>}
          </div>
          {podeEditar && (
            <button onClick={() => abrir("tela", { tela })} aria-label={`Ajustes da ${tela.nome}`} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-hf-muted hover:bg-hf-elevated">
              <MoreVertical size={18} />
            </button>
          )}
        </div>
        {!tela.pareada && <p className="mt-1 text-xs font-medium text-hf-warning">Desconectada: abra /tv no aparelho e pareie de novo.</p>}
      </div>
      {podeEditar && (
        <button onClick={() => abrir("trocar", { telas: [tela.id] })} className="erp-btn erp-btn-primary !min-h-11 w-full text-sm">
          <MonitorPlay size={16} /> Trocar conteúdo
        </button>
      )}
    </Card>
  );
}

// ─── Visão geral ─────────────────────────────────────────────────────────────
function VisaoGeral({ painel, midiasPorId, playlistsPorId, irPara, abrir, podeCriar }) {
  const r = painel.resumo;
  const linkTv = typeof window !== "undefined" ? `${window.location.origin}/tv` : "/tv";
  const [copiado, setCopiado] = useState(false);
  const numeros = [
    { rotulo: "Telas", valor: r.total, aba: "telas" },
    { rotulo: "No ar", valor: r.no_ar, aba: "telas", tom: "text-hf-success" },
    { rotulo: "Fora do ar", valor: r.sem_contato, aba: "telas", tom: r.sem_contato ? "text-hf-warning" : "" },
    { rotulo: "Mídias", valor: painel.midias.length, aba: "midias" },
    { rotulo: "Playlists", valor: painel.playlists.length, aba: "playlists" },
  ];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {numeros.map((n) => (
          <button key={n.rotulo} onClick={() => irPara(n.aba)} className="erp-card min-h-[88px] p-4 text-left">
            <p className="text-[13px] font-medium text-hf-muted">{n.rotulo}</p>
            <p className={`mt-1 text-3xl font-semibold tracking-tight text-hf-text ${n.tom || ""}`}>{n.valor}</p>
          </button>
        ))}
      </div>

      <Card className="space-y-3">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-hf-tile-rosa text-white"><Link2 size={20} /></span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-hf-text">Como ligar uma TV</p>
            <p className="text-sm text-hf-muted">No navegador da TV, do TV Box ou do Fire Stick, abra o endereço abaixo. Aparece um código: toque em <b>Parear TV</b> e digite. Funciona em qualquer TV com internet, em qualquer lugar.</p>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <code className="flex min-h-11 flex-1 items-center truncate rounded-xl border border-hf-border bg-hf-elevated px-3 text-sm text-hf-text">{linkTv}</code>
          <button onClick={() => { navigator.clipboard?.writeText(linkTv); setCopiado(true); setTimeout(() => setCopiado(false), 2000); }} className="erp-btn erp-btn-ghost !min-h-11 text-sm">
            <Copy size={16} /> {copiado ? "Copiado" : "Copiar endereço"}
          </button>
          {podeCriar && <button onClick={() => abrir("parear")} className="erp-btn erp-btn-primary !min-h-11 text-sm"><Plus size={16} /> Parear TV</button>}
        </div>
      </Card>

      {painel.telas.length ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {painel.telas.map((t) => <CartaoTela key={t.id} tela={t} midiasPorId={midiasPorId} playlistsPorId={playlistsPorId} abrir={abrir} podeEditar={false} />)}
        </div>
      ) : (
        <EmptyState icon={MonitorPlay} title="Nenhuma TV pareada ainda" hint="Abra o endereço /tv na TV e toque em Parear TV." actionLabel={podeCriar ? "Parear TV" : undefined} onAction={() => abrir("parear")} />
      )}
    </div>
  );
}

// ─── Telas ───────────────────────────────────────────────────────────────────
function Telas({ painel, midiasPorId, playlistsPorId, abrir, podeCriar, podeEditar }) {
  if (!painel.telas.length) {
    return <EmptyState icon={MonitorPlay} title="Nenhuma TV pareada ainda" hint="Abra o endereço /tv na TV e toque em Parear TV." actionLabel={podeCriar ? "Parear TV" : undefined} onAction={() => abrir("parear")} />;
  }
  const locais = [...new Set(painel.telas.map((t) => t.local || "Sem local"))];
  return (
    <div className="space-y-5">
      {podeEditar && painel.telas.length > 1 && (
        <button onClick={() => abrir("trocar", { telas: "todas" })} className="erp-btn erp-btn-ghost !min-h-11 w-full text-sm sm:w-auto">
          <MonitorPlay size={16} /> Mesmo conteúdo em todas as telas
        </button>
      )}
      {locais.map((local) => {
        const lista = painel.telas.filter((t) => (t.local || "Sem local") === local);
        const noAr = lista.filter((t) => t.status === "no_ar").length;
        return (
          <section key={local} className="space-y-2">
            <p className="text-[13px] font-medium text-hf-muted">{local} · <span className="text-hf-success">{noAr} no ar</span>{lista.length - noAr ? ` · ${lista.length - noAr} fora` : ""}</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {lista.map((t) => <CartaoTela key={t.id} tela={t} midiasPorId={midiasPorId} playlistsPorId={playlistsPorId} abrir={abrir} podeEditar={podeEditar} />)}
            </div>
          </section>
        );
      })}
    </div>
  );
}

// ─── Mídias ──────────────────────────────────────────────────────────────────
function Midias({ painel, unidade, carregar, avisar, executar, abrir, podeCriar, podeEditar, podeExcluir }) {
  const entrada = useRef(null);
  const [enviando, setEnviando] = useState([]); // [{ nome, estado }]
  const [filtro, setFiltro] = useState("todas");

  const enviar = async (arquivos) => {
    const lista = [...arquivos];
    setEnviando(lista.map((a) => ({ nome: a.name, estado: "Enviando…" })));
    let certos = 0;
    for (let i = 0; i < lista.length; i++) {
      const a = lista[i];
      try {
        const tipo = a.type.startsWith("video/") ? "video" : "imagem";
        if (a.size > LIMITE_BYTES[tipo]) throw new Error(`${tipo === "video" ? "Vídeo" : "Imagem"} acima de ${Math.round(LIMITE_BYTES[tipo] / 1024 / 1024)} MB.`);
        await enviarArquivo(unidade, a);
        certos += 1;
        setEnviando((e) => e.map((x, j) => (j === i ? { ...x, estado: "Pronto" } : x)));
      } catch (err) {
        setEnviando((e) => e.map((x, j) => (j === i ? { ...x, estado: err.message, erro: true } : x)));
      }
    }
    await carregar();
    if (certos) avisar(certos === 1 ? "Mídia enviada" : `${certos} mídias enviadas`);
    setTimeout(() => setEnviando((e) => e.filter((x) => x.erro)), 2500);
  };

  const midias = painel.midias.filter((m) => filtro === "todas" || m.tipo === filtro);
  const renomear = async (m) => {
    const nome = window.prompt("Novo nome da mídia", m.nome);
    if (!nome || nome === m.nome) return;
    try { await executar("renomear_midia", { id: m.id, nome }, "Nome atualizado"); } catch (e) { avisar(e.message); }
  };
  const excluir = async (m) => {
    if (!window.confirm(`Excluir "${m.nome}"? Ela sai de todas as playlists e das telas.`)) return;
    try { await executar("excluir_midia", { id: m.id }, "Mídia excluída"); } catch (e) { avisar(e.message); }
  };

  return (
    <div className="space-y-4">
      {podeCriar && (
        <Card className="space-y-3">
          <button onClick={() => entrada.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files?.length) enviar(e.dataTransfer.files); }}
            className="flex min-h-[132px] w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-hf-border-strong bg-hf-elevated px-4 text-center">
            <Upload size={24} className="text-hf-accent" />
            <span className="text-sm font-semibold text-hf-text">Enviar fotos ou vídeos</span>
            <span className="text-xs text-hf-muted">JPG, PNG ou WebP até 25 MB · vídeo MP4 (H.264/AAC) até 50 MB · vários de uma vez</span>
          </button>
          <input ref={entrada} type="file" multiple accept="image/jpeg,image/png,image/webp,video/mp4" className="hidden"
            onChange={(e) => { if (e.target.files?.length) enviar(e.target.files); e.target.value = ""; }} />
          {enviando.length > 0 && (
            <ul className="space-y-1">
              {enviando.map((x, i) => (
                <li key={i} className="flex items-center justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate text-hf-text">{x.nome}</span>
                  <span className={`shrink-0 text-xs font-medium ${x.erro ? "text-hf-danger" : x.estado === "Pronto" ? "text-hf-success" : "text-hf-muted"}`}>{x.estado}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      <div className="flex gap-1.5">
        {[["todas", "Todas"], ["imagem", "Imagens"], ["video", "Vídeos"]].map(([v, l]) => (
          <button key={v} onClick={() => setFiltro(v)} className={`min-h-10 rounded-full px-3.5 text-sm font-medium ${filtro === v ? "bg-hf-accent text-hf-accent-fg" : "border border-hf-border bg-hf-surface text-hf-text-2"}`}>{l}</button>
        ))}
      </div>

      {!midias.length ? (
        <EmptyState icon={ImageIcon} title="Nenhuma mídia no acervo" hint="Envie as artes e os vídeos uma vez e use em qualquer TV." />
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          {midias.map((m) => (
            <Card key={m.id} className="flex flex-col gap-2 !p-2.5">
              <Miniatura midia={m} orientacao={m.orientacao} className={m.orientacao === "vertical" ? "mx-auto max-h-[220px]" : ""} />
              <div className="min-w-0 px-0.5">
                <p className="truncate text-sm font-semibold text-hf-text">{m.nome}</p>
                <p className="truncate text-[11px] text-hf-muted">
                  {m.tipo === "video" ? <Film size={11} className="mr-1 inline" /> : <ImageIcon size={11} className="mr-1 inline" />}
                  {[m.orientacao === "vertical" ? "Vertical" : "Horizontal", m.tipo === "video" ? segundos(m.duracao_seg) : null, tamanhoLegivel(m.tamanho_bytes)].filter(Boolean).join(" · ")}
                </p>
              </div>
              <div className="mt-auto flex gap-1">
                {podeEditar && <button onClick={() => abrir("trocar", { conteudo: { tipo: "midia", id: m.id } })} className="erp-btn erp-btn-primary !min-h-10 flex-1 !px-2 text-xs"><MonitorPlay size={14} /> Enviar para TV</button>}
                {podeEditar && <button onClick={() => renomear(m)} aria-label="Renomear" className="flex h-10 w-10 items-center justify-center rounded-xl border border-hf-border text-hf-muted"><Pencil size={15} /></button>}
                {podeExcluir && <button onClick={() => excluir(m)} aria-label="Excluir" className="flex h-10 w-10 items-center justify-center rounded-xl border border-hf-border text-hf-danger"><Trash2 size={15} /></button>}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Playlists ───────────────────────────────────────────────────────────────
function resumoItens(itens, midiasPorId) {
  const total = (itens || []).reduce((s, i) => {
    if (i.tipo === "midia") {
      const m = midiasPorId.get(i.midia_id);
      return s + (i.duracao_seg || (m?.tipo === "video" ? Math.ceil(m.duracao_seg || 0) : DURACAO.imagem));
    }
    return s + (i.duracao_seg || DURACAO.cardapio);
  }, 0);
  return `${(itens || []).length} conteúdo(s) · ${segundos(total)} por volta`;
}

function Playlists({ painel, midiasPorId, abrir, podeCriar, podeEditar }) {
  return (
    <div className="space-y-3">
      {podeCriar && <button onClick={() => abrir("playlist", { playlist: null })} className="erp-btn erp-btn-primary !min-h-11 w-full text-sm sm:w-auto"><Plus size={16} /> Nova playlist</button>}
      {!painel.playlists.length ? (
        <EmptyState icon={ListVideo} title="Nenhuma playlist ainda" hint="Junte artes, vídeos e o cardápio com preço numa sequência e publique nas telas." />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {painel.playlists.map((p) => {
            const usadas = painel.telas.filter((t) => t.agora?.conteudo?.tipo === "playlist" && t.agora.conteudo.id === p.id).length;
            // Publicada = é o conteúdo fixo de alguma tela ou está numa regra ligada.
            const publicada = painel.telas.some((t) => t.conteudo?.tipo === "playlist" && t.conteudo.id === p.id)
              || painel.programacoes.some((r) => r.ativa && r.playlist_id === p.id);
            const capas = (p.itens || []).slice(0, 4);
            return (
              <Card key={p.id} className="flex flex-col gap-3">
                <div className="flex gap-1.5">
                  {capas.map((i, k) => (
                    <Miniatura key={k} midia={i.tipo === "midia" ? midiasPorId.get(i.midia_id) : null} cardapio={i.tipo === "cardapio"} className="w-1/4" />
                  ))}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="min-w-0 truncate text-[15px] font-semibold text-hf-text">{p.nome}</p>
                    <Selo>V{p.versao || 1}</Selo>
                    {publicada ? <Selo tom="ok">Publicada</Selo> : <Selo tom="aviso">Não publicada</Selo>}
                  </div>
                  <p className="text-xs text-hf-muted">{p.orientacao === "vertical" ? "Vertical" : "Horizontal"} · {resumoItens(p.itens, midiasPorId)}</p>
                  <p className="text-xs text-hf-muted">{usadas ? `Passando agora em ${usadas} tela(s)` : "Não está passando agora"}</p>
                </div>
                {podeEditar && (
                  <div className="flex gap-2">
                    <button onClick={() => abrir("trocar", { conteudo: { tipo: "playlist", id: p.id } })} className="erp-btn erp-btn-primary !min-h-11 flex-1 text-sm"><MonitorPlay size={16} /> Publicar nas telas</button>
                    <button onClick={() => abrir("playlist", { playlist: p })} className="erp-btn erp-btn-ghost !min-h-11 text-sm"><Pencil size={16} /> Editar</button>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Programação ─────────────────────────────────────────────────────────────
function quandoVale(r) {
  const dias = r.dias_semana?.length ? (r.dias_semana.length === 7 ? "Todos os dias" : r.dias_semana.map((d) => DIAS[d]).join(", ")) : "Todos os dias";
  const hora = r.hora_inicio ? `${r.hora_inicio}–${r.hora_fim}` : "Dia inteiro";
  const br = (d) => d.split("-").reverse().join("/");
  const datas = r.data_inicio || r.data_fim ? ` · ${r.data_inicio ? br(r.data_inicio) : "…"} até ${r.data_fim ? br(r.data_fim) : "…"}` : "";
  return `${dias} · ${hora}${datas}`;
}

function Programacao({ painel, playlistsPorId, abrir, podeCriar }) {
  const agora = new Date();
  const nomesTelas = new Map(painel.telas.map((t) => [t.id, t.nome]));
  return (
    <div className="space-y-3">
      <Card className="text-sm text-hf-muted">
        A regra que vale agora com a <b className="text-hf-text">maior prioridade</b> manda na tela. Fora dos horários, a tela volta para o conteúdo fixo dela (Trocar conteúdo). Horário que vira a noite (18:00–02:00) conta para o dia em que começou.
      </Card>
      {podeCriar && painel.playlists.length > 0 && <button onClick={() => abrir("regra", { regra: null })} className="erp-btn erp-btn-primary !min-h-11 w-full text-sm sm:w-auto"><Plus size={16} /> Nova regra</button>}
      {!painel.playlists.length && <EmptyState icon={CalendarClock} title="Crie uma playlist primeiro" hint="A programação diz qual playlist cada tela roda em cada dia e horário." />}
      {painel.programacoes.map((r) => {
        const telasDaRegra = r.tela_ids?.length ? r.tela_ids : painel.telas.map((t) => t.id);
        const valendo = r.ativa && telasDaRegra.some((id) => regraVale(r, id, agora));
        return (
          <button key={r.id} onClick={() => abrir("regra", { regra: r })} className="erp-card flex w-full items-start gap-3 p-4 text-left">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-hf-tile-violeta text-white"><CalendarClock size={18} /></span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <p className="truncate text-[15px] font-semibold text-hf-text">{r.nome}</p>
                {valendo && <Selo tom="ok">Valendo agora</Selo>}
                {!r.ativa && <Selo>Desligada</Selo>}
                <Selo tom="destaque">Prioridade {r.prioridade}</Selo>
              </div>
              <p className="text-xs text-hf-text-2">{playlistsPorId.get(r.playlist_id)?.nome || "Playlist removida"}</p>
              <p className="text-xs text-hf-muted">{quandoVale(r)}</p>
              <p className="truncate text-xs text-hf-muted">Telas: {r.tela_ids?.length ? r.tela_ids.map((id) => nomesTelas.get(id) || "removida").join(", ") : "todas"}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ─── Modais ──────────────────────────────────────────────────────────────────
function Erro({ texto }) {
  return texto ? <p className="mb-3 rounded-xl bg-hf-danger/10 px-3 py-2 text-sm font-medium text-hf-danger">{texto}</p> : null;
}

function ModalParear({ painel, dados, fechar, executar }) {
  const [codigo, setCodigo] = useState("");
  const [nome, setNome] = useState(dados.tela?.nome || "");
  const [local, setLocal] = useState("");
  const [orientacao, setOrientacao] = useState("horizontal");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const locais = [...new Set(painel.telas.map((t) => t.local).filter(Boolean))];

  const parear = async (e) => {
    e.preventDefault();
    setErro(""); setSalvando(true);
    try {
      await executar("parear", { codigo, nome, local, orientacao, tela_id: dados.tela?.id }, "TV pareada");
      fechar();
    } catch (err) { setErro(err.message); } finally { setSalvando(false); }
  };

  return (
    <Modal open onClose={fechar} title={dados.tela ? `Parear de novo: ${dados.tela.nome}` : "Parear TV"}>
      <form onSubmit={parear}>
        <p className="mb-3 text-sm text-hf-muted">Abra <b>/tv</b> no navegador da TV e digite os 4 números que aparecem.</p>
        <Erro texto={erro} />
        <Field label="Código da TV">
          <TextInput value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="0000" autoFocus
            inputMode="numeric" pattern="[0-9]*" className="!h-14 text-center !text-3xl font-semibold tracking-[0.5em]" autoComplete="off" />
        </Field>
        {!dados.tela && (
          <>
            <Field label="Nome da tela"><TextInput value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Parede 01 do salão" maxLength={80} /></Field>
            <Field label="Local (para agrupar)">
              <TextInput value={local} onChange={(e) => setLocal(e.target.value)} placeholder="Ex.: Salão, Fachada, Shopping" maxLength={80} list="locais-telas" />
              <datalist id="locais-telas">{locais.map((l) => <option key={l} value={l} />)}</datalist>
            </Field>
            <Field label="Posição da TV">
              <div className="grid grid-cols-2 gap-2">
                {[["horizontal", "Horizontal (deitada)"], ["vertical", "Vertical (em pé, totem)"]].map(([v, l]) => (
                  <button type="button" key={v} onClick={() => setOrientacao(v)} className={`min-h-11 rounded-xl border text-sm font-medium ${orientacao === v ? "border-hf-accent bg-hf-accent/15 text-hf-text" : "border-hf-border text-hf-text-2"}`}>{l}</button>
                ))}
              </div>
            </Field>
          </>
        )}
        <Btn type="submit" disabled={salvando || codigo.length !== 4 || (!dados.tela && !nome.trim())} className="mt-2 !min-h-12 w-full">
          {salvando ? "Pareando…" : "Parear"}
        </Btn>
      </form>
    </Modal>
  );
}

function ModalTrocar({ painel, dados, fechar, executar }) {
  const [tipo, setTipo] = useState(dados.conteudo?.tipo || (painel.playlists.length ? "playlist" : "midia"));
  const [id, setId] = useState(dados.conteudo?.id || "");
  const [telas, setTelas] = useState(dados.telas === "todas" ? painel.telas.map((t) => t.id) : dados.telas || []);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const opcoes = tipo === "playlist" ? painel.playlists : painel.midias;
  const todas = telas.length === painel.telas.length && painel.telas.length > 0;

  const salvar = async (limpar = false) => {
    setErro(""); setSalvando(true);
    try {
      const r = await executar("trocar_conteudo", { tela_ids: todas ? "todas" : telas, conteudo: limpar ? null : { tipo, id } });
      fechar();
      return r;
    } catch (e) { setErro(e.message); } finally { setSalvando(false); }
  };

  const alternar = (tid) => setTelas((l) => (l.includes(tid) ? l.filter((x) => x !== tid) : [...l, tid]));

  return (
    <Modal open onClose={fechar} title="Trocar conteúdo" maxWidth="md:max-w-lg">
      <Erro texto={erro} />
      <Field label="O que vai passar">
        <div className="mb-2 grid grid-cols-2 gap-2">
          {[["playlist", "Playlist"], ["midia", "Uma arte ou vídeo"]].map(([v, l]) => (
            <button key={v} onClick={() => { setTipo(v); setId(""); }} className={`min-h-11 rounded-xl border text-sm font-medium ${tipo === v ? "border-hf-accent bg-hf-accent/15 text-hf-text" : "border-hf-border text-hf-text-2"}`}>{l}</button>
          ))}
        </div>
        {opcoes.length ? (
          <div className="grid max-h-[260px] grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
            {opcoes.map((o) => (
              <button key={o.id} onClick={() => setId(o.id)} className={`rounded-xl border p-1.5 text-left ${id === o.id ? "border-hf-accent ring-2 ring-hf-accent/40" : "border-hf-border"}`}>
                {tipo === "midia" ? <Miniatura midia={o} /> : <Miniatura midia={o.itens?.[0]?.tipo === "midia" ? painel.midias.find((m) => m.id === o.itens[0].midia_id) : null} cardapio={o.itens?.[0]?.tipo === "cardapio"} />}
                <p className="mt-1 truncate px-0.5 text-xs font-semibold text-hf-text">{o.nome}</p>
              </button>
            ))}
          </div>
        ) : <p className="text-sm text-hf-muted">{tipo === "playlist" ? "Nenhuma playlist criada ainda." : "Nenhuma mídia no acervo ainda."}</p>}
      </Field>
      <Field label="Em quais telas">
        <label className="mb-1 flex min-h-11 items-center gap-3 rounded-xl border border-hf-border px-3">
          <input type="checkbox" className="h-5 w-5 accent-[rgb(var(--hf-accent))]" checked={todas} onChange={() => setTelas(todas ? [] : painel.telas.map((t) => t.id))} />
          <span className="text-sm font-semibold text-hf-text">Todas as telas ({painel.telas.length})</span>
        </label>
        <div className="max-h-[200px] space-y-1 overflow-y-auto">
          {painel.telas.map((t) => (
            <label key={t.id} className="flex min-h-11 items-center gap-3 rounded-xl px-3 hover:bg-hf-elevated">
              <input type="checkbox" className="h-5 w-5 accent-[rgb(var(--hf-accent))]" checked={telas.includes(t.id)} onChange={() => alternar(t.id)} />
              <span className="min-w-0 flex-1 truncate text-sm text-hf-text">{t.nome}</span>
              <span className="shrink-0 text-xs text-hf-muted">{t.local || ""}</span>
            </label>
          ))}
        </div>
      </Field>
      <Btn onClick={() => salvar(false)} disabled={salvando || !id || !telas.length} className="!min-h-12 w-full">{salvando ? "Enviando…" : `Enviar para ${todas ? "todas as telas" : `${telas.length} tela(s)`}`}</Btn>
      {dados.telas && dados.telas !== "todas" && (
        <button onClick={() => salvar(true)} disabled={salvando} className="mt-2 min-h-11 w-full text-sm font-medium text-hf-muted">Tirar o conteúdo fixo desta tela</button>
      )}
      <p className="mt-3 text-xs text-hf-muted">A TV troca em até 30 segundos. Uma regra de programação valendo agora tem prioridade sobre este conteúdo.</p>
    </Modal>
  );
}

function ModalTela({ tela, fechar, executar, abrir, podeExcluir }) {
  const [nome, setNome] = useState(tela.nome);
  const [local, setLocal] = useState(tela.local || "");
  const [orientacao, setOrientacao] = useState(tela.orientacao);
  const [ativa, setAtiva] = useState(tela.ativa !== false);
  const [erro, setErro] = useState("");

  const acao = async (fn) => { setErro(""); try { await fn(); fechar(); } catch (e) { setErro(e.message); } };
  return (
    <Modal open onClose={fechar} title={tela.nome}>
      <Erro texto={erro} />
      <Field label="Nome"><TextInput value={nome} onChange={(e) => setNome(e.target.value)} maxLength={80} /></Field>
      <Field label="Local"><TextInput value={local} onChange={(e) => setLocal(e.target.value)} maxLength={80} /></Field>
      <Field label="Posição">
        <Select value={orientacao} onChange={(e) => setOrientacao(e.target.value)}>
          <option value="horizontal">Horizontal (deitada)</option>
          <option value="vertical">Vertical (em pé, totem)</option>
        </Select>
      </Field>
      <div className="mb-4 flex min-h-11 items-center justify-between gap-3">
        <span className="text-sm text-hf-text">Tela ligada (desligada mostra só o aviso de pausa)</span>
        <Toggle active={ativa} onChange={() => setAtiva((a) => !a)} />
      </div>
      {tela.aparelho && <p className="mb-3 truncate text-xs text-hf-muted">Aparelho: {tela.aparelho}</p>}
      <Btn onClick={() => acao(() => executar("salvar_tela", { id: tela.id, nome, local, orientacao, ativa }, "Tela salva"))} className="!min-h-12 w-full">Salvar</Btn>
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {tela.pareada ? (
          <button onClick={() => window.confirm("Desconectar? A TV volta a mostrar um código.") && acao(() => executar("desconectar_tela", { id: tela.id }, "TV desconectada"))} className="erp-btn erp-btn-ghost !min-h-11 text-sm"><Power size={16} /> Desconectar TV</button>
        ) : (
          <button onClick={() => { fechar(); abrir("parear", { tela }); }} className="erp-btn erp-btn-ghost !min-h-11 text-sm"><RefreshCw size={16} /> Parear de novo</button>
        )}
        {podeExcluir && <button onClick={() => window.confirm(`Excluir a tela "${tela.nome}"? Ela sai das regras de programação.`) && acao(() => executar("excluir_tela", { id: tela.id }, "Tela excluída"))} className="erp-btn erp-btn-danger !min-h-11 text-sm"><Trash2 size={16} /> Excluir tela</button>}
      </div>
    </Modal>
  );
}

function ModalPlaylist({ painel, playlist, fechar, executar, abrir, podeExcluir }) {
  const [nome, setNome] = useState(playlist?.nome || "");
  const [orientacao, setOrientacao] = useState(playlist?.orientacao || "horizontal");
  const [itens, setItens] = useState(playlist?.itens || []);
  const [escolhendo, setEscolhendo] = useState(false);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const midiasPorId = new Map(painel.midias.map((m) => [m.id, m]));

  const mover = (i, d) => setItens((l) => { const n = [...l]; const j = i + d; if (j < 0 || j >= n.length) return l; [n[i], n[j]] = [n[j], n[i]]; return n; });
  const mudar = (i, campo, v) => setItens((l) => l.map((x, k) => (k === i ? { ...x, [campo]: v } : x)));

  const salvar = async (publicar = false) => {
    setErro(""); setSalvando(true);
    try {
      const r = await executar("salvar_playlist", { id: playlist?.id, nome, orientacao, itens }, "Playlist salva");
      fechar();
      if (publicar) abrir("trocar", { conteudo: { tipo: "playlist", id: r.id } });
    } catch (e) { setErro(e.message); } finally { setSalvando(false); }
  };

  return (
    <Modal open onClose={fechar} title={playlist ? "Editar playlist" : "Nova playlist"} maxWidth="md:max-w-2xl">
      <Erro texto={erro} />
      <div className="grid grid-cols-1 gap-x-3 sm:grid-cols-2">
        <Field label="Nome"><TextInput value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Almoço executivo · horizontal" maxLength={80} /></Field>
        <Field label="Formato">
          <Select value={orientacao} onChange={(e) => setOrientacao(e.target.value)}>
            <option value="horizontal">Horizontal</option>
            <option value="vertical">Vertical</option>
          </Select>
        </Field>
      </div>

      <p className="erp-label mb-1.5">Sequência</p>
      {!itens.length && <p className="mb-2 text-sm text-hf-muted">Adicione artes, vídeos ou o cardápio com preço.</p>}
      <ol className="mb-3 space-y-2">
        {itens.map((it, i) => {
          const m = it.tipo === "midia" ? midiasPorId.get(it.midia_id) : null;
          return (
            <li key={i} className="flex items-center gap-2 rounded-xl border border-hf-border p-2">
              <span className="w-5 shrink-0 text-center text-xs font-semibold text-hf-muted">{i + 1}</span>
              <Miniatura midia={m} cardapio={it.tipo === "cardapio"} className="w-20 shrink-0" />
              <div className="min-w-0 flex-1 space-y-1">
                <p className="truncate text-sm font-semibold text-hf-text">{it.tipo === "cardapio" ? (it.titulo || "Cardápio") : m?.nome || "Mídia removida"}</p>
                {it.tipo === "cardapio" && (
                  <div className="flex flex-wrap gap-1.5">
                    <TextInput value={it.titulo || ""} onChange={(e) => mudar(i, "titulo", e.target.value)} placeholder="Título na TV" className="!h-10 !w-full text-xs sm:!w-36" maxLength={60} />
                    <Select value={it.categoria_ids?.[0] || ""} onChange={(e) => mudar(i, "categoria_ids", e.target.value ? [e.target.value] : [])} className="!h-10 !w-full text-xs sm:!w-44">
                      <option value="">Todas as seções</option>
                      {painel.categorias.map((c) => <option key={c.id} value={c.id}>{c.nome} ({c.pratos})</option>)}
                    </Select>
                    <Select value={it.por_pagina || 6} onChange={(e) => mudar(i, "por_pagina", Number(e.target.value))} className="!h-10 !w-full text-xs sm:!w-32">
                      {[4, 5, 6, 8, 10, 12].map((n) => <option key={n} value={n}>{n} por tela</option>)}
                    </Select>
                  </div>
                )}
                <label className="flex items-center gap-1.5 text-xs text-hf-muted">
                  Tempo
                  <input type="number" min={DURACAO.min} max={DURACAO.max} value={it.duracao_seg ?? ""} placeholder={m?.tipo === "video" ? "vídeo inteiro" : String(it.tipo === "cardapio" ? DURACAO.cardapio : DURACAO.imagem)}
                    onChange={(e) => mudar(i, "duracao_seg", e.target.value ? Number(e.target.value) : null)} className="erp-input !h-8 !w-24 !px-2 text-xs" /> s
                </label>
              </div>
              <div className="flex shrink-0 flex-col gap-1">
                <button onClick={() => mover(i, -1)} aria-label="Subir" className="flex h-9 w-9 items-center justify-center rounded-lg border border-hf-border text-hf-muted"><ArrowUp size={14} /></button>
                <button onClick={() => mover(i, 1)} aria-label="Descer" className="flex h-9 w-9 items-center justify-center rounded-lg border border-hf-border text-hf-muted"><ArrowDown size={14} /></button>
              </div>
              <button onClick={() => setItens((l) => l.filter((_, k) => k !== i))} aria-label="Remover" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-hf-danger"><Trash2 size={15} /></button>
            </li>
          );
        })}
      </ol>

      <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <button onClick={() => setEscolhendo((e) => !e)} className="erp-btn erp-btn-ghost !min-h-11 text-sm"><ImageIcon size={16} /> Adicionar arte ou vídeo</button>
        <button onClick={() => setItens((l) => [...l, { tipo: "cardapio", titulo: "Cardápio", categoria_ids: [], por_pagina: 6, duracao_seg: DURACAO.cardapio }])} disabled={!painel.cardapioDisponivel}
          className="erp-btn erp-btn-ghost !min-h-11 text-sm"><Utensils size={16} /> Cardápio com preço do Héfisto</button>
      </div>
      {!painel.cardapioDisponivel && <p className="-mt-2 mb-3 text-xs text-hf-muted">Cardápio indisponível: confira se há pratos ativos com preço no Cardápio digital.</p>}
      {escolhendo && (
        <div className="mb-4 grid max-h-[240px] grid-cols-3 gap-2 overflow-y-auto rounded-xl bg-hf-elevated p-2 sm:grid-cols-4">
          {painel.midias.length ? painel.midias.map((m) => (
            <button key={m.id} onClick={() => setItens((l) => [...l, { tipo: "midia", midia_id: m.id, duracao_seg: null }])} className="rounded-lg bg-hf-surface p-1 text-left">
              <Miniatura midia={m} />
              <p className="mt-0.5 truncate text-[11px] font-medium text-hf-text">{m.nome}</p>
            </button>
          )) : <p className="col-span-full p-2 text-sm text-hf-muted">Envie mídias na aba Mídias.</p>}
        </div>
      )}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Btn variant="ghost" onClick={() => salvar(false)} disabled={salvando || !nome.trim() || !itens.length} className="!min-h-12">Salvar</Btn>
        <Btn onClick={() => salvar(true)} disabled={salvando || !nome.trim() || !itens.length} className="!min-h-12">Salvar e publicar</Btn>
      </div>
      {playlist && podeExcluir && (
        <button onClick={() => window.confirm("Excluir a playlist? As regras de programação dela também saem.") && executar("excluir_playlist", { id: playlist.id }, "Playlist excluída").then(fechar).catch((e) => setErro(e.message))}
          className="mt-3 min-h-11 w-full text-sm font-medium text-hf-danger">Excluir playlist</button>
      )}
    </Modal>
  );
}

function ModalRegra({ painel, regra, fechar, executar, podeExcluir }) {
  const [f, setF] = useState(() => ({
    nome: regra?.nome || "",
    playlist_id: regra?.playlist_id || painel.playlists[0]?.id || "",
    tela_ids: regra?.tela_ids || [],
    dias_semana: regra?.dias_semana || [],
    diaInteiro: !regra?.hora_inicio,
    hora_inicio: regra?.hora_inicio || "11:00",
    hora_fim: regra?.hora_fim || "15:00",
    data_inicio: regra?.data_inicio || "",
    data_fim: regra?.data_fim || "",
    prioridade: regra?.prioridade ?? 100,
    ativa: regra?.ativa !== false,
  }));
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const alternarDia = (d) => set("dias_semana", f.dias_semana.includes(d) ? f.dias_semana.filter((x) => x !== d) : [...f.dias_semana, d].sort());
  const alternarTela = (id) => set("tela_ids", f.tela_ids.includes(id) ? f.tela_ids.filter((x) => x !== id) : [...f.tela_ids, id]);

  const salvar = async () => {
    setErro(""); setSalvando(true);
    try {
      await executar("salvar_programacao", {
        id: regra?.id, nome: f.nome, playlist_id: f.playlist_id, tela_ids: f.tela_ids, dias_semana: f.dias_semana,
        hora_inicio: f.diaInteiro ? null : f.hora_inicio, hora_fim: f.diaInteiro ? null : f.hora_fim,
        data_inicio: f.data_inicio || null, data_fim: f.data_fim || null, prioridade: Number(f.prioridade), ativa: f.ativa,
      }, "Regra salva");
      fechar();
    } catch (e) { setErro(e.message); } finally { setSalvando(false); }
  };

  return (
    <Modal open onClose={fechar} title={regra ? "Editar regra" : "Nova regra de programação"} maxWidth="md:max-w-lg">
      <Erro texto={erro} />
      <Field label="Nome"><TextInput value={f.nome} onChange={(e) => set("nome", e.target.value)} placeholder="Ex.: Almoço de segunda a sexta" maxLength={80} /></Field>
      <Field label="Playlist exibida">
        <Select value={f.playlist_id} onChange={(e) => set("playlist_id", e.target.value)}>
          {painel.playlists.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </Select>
      </Field>
      <Field label="Dias da semana (nenhum = todos)">
        <div className="grid grid-cols-7 gap-1">
          {DIAS.map((d, i) => (
            <button key={d} onClick={() => alternarDia(i)} className={`min-h-11 rounded-lg text-xs font-semibold ${f.dias_semana.includes(i) ? "bg-hf-accent text-hf-accent-fg" : "border border-hf-border text-hf-text-2"}`}>{d}</button>
          ))}
        </div>
      </Field>
      <div className="mb-2 flex min-h-11 items-center justify-between">
        <span className="text-sm text-hf-text">Dia inteiro</span>
        <Toggle active={f.diaInteiro} onChange={() => set("diaInteiro", !f.diaInteiro)} />
      </div>
      {!f.diaInteiro && (
        <div className="grid grid-cols-2 gap-2">
          <Field label="Começa às"><TextInput type="time" value={f.hora_inicio} onChange={(e) => set("hora_inicio", e.target.value)} /></Field>
          <Field label="Termina às"><TextInput type="time" value={f.hora_fim} onChange={(e) => set("hora_fim", e.target.value)} /></Field>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Field label="A partir de (opcional)"><TextInput type="date" value={f.data_inicio} onChange={(e) => set("data_inicio", e.target.value)} /></Field>
        <Field label="Até (opcional)"><TextInput type="date" value={f.data_fim} onChange={(e) => set("data_fim", e.target.value)} /></Field>
      </div>
      <Field label="Prioridade (maior vence quando duas regras valem ao mesmo tempo)">
        <TextInput type="number" min={1} max={999} value={f.prioridade} onChange={(e) => set("prioridade", e.target.value)} />
      </Field>
      <Field label={`Telas (${f.tela_ids.length ? f.tela_ids.length : "todas"})`}>
        <div className="max-h-[180px] space-y-1 overflow-y-auto">
          {painel.telas.map((t) => (
            <label key={t.id} className="flex min-h-11 items-center gap-3 rounded-xl px-2 hover:bg-hf-elevated">
              <input type="checkbox" className="h-5 w-5 accent-[rgb(var(--hf-accent))]" checked={f.tela_ids.includes(t.id)} onChange={() => alternarTela(t.id)} />
              <span className="min-w-0 flex-1 truncate text-sm text-hf-text">{t.nome}</span>
            </label>
          ))}
          {!painel.telas.length && <p className="text-sm text-hf-muted">Sem telas pareadas: a regra vale para todas as que forem pareadas.</p>}
        </div>
      </Field>
      <div className="mb-4 flex min-h-11 items-center justify-between">
        <span className="text-sm text-hf-text">Regra ligada</span>
        <Toggle active={f.ativa} onChange={() => set("ativa", !f.ativa)} />
      </div>
      <Btn onClick={salvar} disabled={salvando || !f.nome.trim() || !f.playlist_id} className="!min-h-12 w-full">{salvando ? "Salvando…" : "Salvar regra"}</Btn>
      {regra && podeExcluir && (
        <button onClick={() => window.confirm("Excluir a regra?") && executar("excluir_programacao", { id: regra.id }, "Regra excluída").then(fechar).catch((e) => setErro(e.message))}
          className="mt-3 min-h-11 w-full text-sm font-medium text-hf-danger">Excluir regra</button>
      )}
    </Modal>
  );
}
