"use client";
// KDS da cozinha e do bar no desenho do protótipo (9D): Na fila → Em preparo →
// Prontos, cronômetro verde/amarelo/vermelho e PRIORIDADE que pisca. Tempo
// real: relê sozinho a cada 10 s e quando o banco muda. "Pronto" imprime a
// comanda de entrega na impressora deste aparelho.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTempoReal } from "../../../lib/realtime";
import { useERP } from "../../../context/ERPContext";
import { fetchFilaKDS, atualizarItensKDS, entregarTicketKDS } from "../../../lib/kds";
import { localDoTicket, quadroKDS, tempoMedioKDS } from "../../../lib/kds-fila.mjs";
import { useImpressaoKds, PainelImpressaoKds } from "../../../components/kds/ImpressaoKds";
import { TemaCardapio } from "../../../components/cardapio-digital/ui";
import QuadroKDS from "../../../components/kds/QuadroKDS";

const SETORES = [["todos", "Todas"], ["cozinha", "Cozinha"], ["bar", "Bar"]];

/** Só os itens do setor; pedido sem item do setor sai. */
function doSetor(tickets, setor) {
  if (setor === "todos") return tickets;
  return tickets.map((t) => ({ ...t, itens: t.itens.filter((i) => i.setor === setor) })).filter((t) => t.itens.length);
}

export default function KDSPage() {
  const { unidadeAtiva, unidadeInfo } = useERP();
  const router = useRouter();
  const [todos, setTodos] = useState([]);
  const [erro, setErro] = useState("");
  const [toast, setToast] = useState("");
  const [agora, setAgora] = useState(Date.now());
  const [somAtivo, setSomAtivo] = useState(true);
  const [setor, setSetor] = useState("todos");
  const [painelImpressao, setPainelImpressao] = useState(false);
  // Hora em que a comanda de entrega saiu, por pedido (fica neste aparelho).
  const [impressos, setImpressos] = useState({});
  const chaveImpressos = `kds-entrega:${unidadeAtiva}`;
  useEffect(() => {
    try { const s = localStorage.getItem("kds-setor"); if (SETORES.some(([id]) => id === s)) setSetor(s); } catch { /* segue */ }
  }, []);
  useEffect(() => {
    try { setImpressos(JSON.parse(localStorage.getItem(chaveImpressos) || "{}")); } catch { setImpressos({}); }
  }, [chaveImpressos]);
  const marcarImpresso = (id) => setImpressos((m) => {
    const novo = { ...m, [id]: new Date().toISOString() };
    try { localStorage.setItem(chaveImpressos, JSON.stringify(Object.fromEntries(Object.entries(novo).slice(-300)))); } catch { /* segue */ }
    return novo;
  });

  const impressao = useImpressaoKds({ unidadeId: unidadeAtiva, setor, unidadeNome: unidadeInfo?.nome || "" });
  const { processarFila } = impressao;
  const audioRef = useRef(null);
  const ultimaChegada = useRef(null);

  const avisar = (texto) => { setToast(texto); setTimeout(() => setToast(""), 2500); };

  const carregar = useCallback(async () => {
    const { data, error } = await fetchFilaKDS(unidadeAtiva, "todos");
    setErro(error || "");
    const lista = data || [];
    if (lista.length) {
      const maisRecente = Math.max(...lista.map((p) => new Date(p.created_at).getTime()));
      if (ultimaChegada.current && maisRecente > ultimaChegada.current && somAtivo && audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => { /* o navegador pode bloquear até o primeiro toque */ });
      }
      ultimaChegada.current = maisRecente;
    }
    setTodos(lista);
    if (!error) processarFila(doSetor(lista, setor));
  }, [unidadeAtiva, somAtivo, setor, processarFila]);

  useEffect(() => {
    carregar();
    const leitura = setInterval(carregar, 10000);
    const relogio = setInterval(() => setAgora(Date.now()), 1000);
    return () => { clearInterval(leitura); clearInterval(relogio); };
  }, [carregar]);
  useTempoReal(null, () => carregar()); // pedido novo aparece na hora

  const daTela = useMemo(() => doSetor(todos, setor), [todos, setor]);
  const quadro = useMemo(() => quadroKDS(daTela, agora), [daTela, agora]);
  const estacoes = SETORES.map(([id, nome]) => ({ id, nome, qtd: doSetor(todos, id).length }));

  const mudarItens = async (t, de, para) => {
    const ids = t.itens.filter((i) => de.includes(i.status)).map((i) => i.id);
    const agoraIso = new Date().toISOString();
    setTodos((lista) => lista.map((p) => (p.id === t.id ? { ...p, itens: p.itens.map((i) => (ids.includes(i.id) ? { ...i, status: para, updated_at: agoraIso } : i)) } : p)));
    const { error } = await atualizarItensKDS(ids, para);
    if (error) { avisar("Não foi possível salvar. Tente de novo."); carregar(); return false; }
    return true;
  };
  const imprimirEntrega = async (t) => {
    const ok = await impressao.imprimir([{ ...t, origem: localDoTicket(t), identificacao: null, entrega: true, itens: t.itens.map((i) => ({ ...i, status: "pronto" })) }], { marcar: false });
    if (ok) marcarImpresso(t.id);
    return ok;
  };

  return (
    <TemaCardapio>
      <audio ref={audioRef} src="https://cdn.pixabay.com/download/audio/2021/08/04/audio_0625c1539c.mp3?filename=service-bell-ring-14610.mp3" preload="auto" />
      <PainelImpressaoKds
        aberto={painelImpressao}
        fechar={() => setPainelImpressao(false)}
        cfg={impressao.cfg}
        mudar={impressao.mudar}
        aviso={impressao.aviso}
        imprimirTeste={() => impressao.imprimir([{ id: "teste", origem: "Teste de impressão", identificacao: null, cliente: null, itens: [{ id: "teste-1", nome: "Via de teste", quantidade: 1, observacao: "Se saiu, está tudo certo." }] }], { marcar: false })}
      />
      <QuadroKDS
        quadro={quadro} tempoMedio={tempoMedioKDS(quadro)} agora={agora} estacoes={estacoes} setor={setor}
        onSetor={(id) => { setSetor(id); try { localStorage.setItem("kds-setor", id); } catch { /* segue */ } }}
        impressos={impressos} toast={toast}
        somAtivo={somAtivo} onSom={() => setSomAtivo((v) => !v)}
        impressaoLigada={impressao.cfg.auto} onImpressao={() => setPainelImpressao(true)}
        onVoltar={() => router.push("/dashboard")}
        avisos={[
          ...(impressao.aviso?.tipo === "erro" ? [{ texto: `A comanda não saiu: ${impressao.aviso.texto} Toque para ver a impressão.`, onClick: () => setPainelImpressao(true) }] : []),
          ...(erro ? [{ texto: `Não foi possível ler a fila agora (${erro}). A tela tenta de novo sozinha.` }] : []),
        ]}
        onIniciar={(t) => mudarItens(t, ["pendente"], "preparando")}
        onPronto={async (t) => { if (await mudarItens(t, ["pendente", "preparando"], "pronto")) await imprimirEntrega(t); }}
        onReimprimir={(t) => imprimirEntrega(t)}
        onEntregue={async (t) => {
          setTodos((lista) => lista.filter((p) => p.id !== t.id));
          const { error } = await entregarTicketKDS(t, t.itens.map((i) => i.id));
          avisar(error ? "Não foi possível dar baixa. Tente de novo." : "Pedido entregue");
          if (error) carregar();
        }}
      />
    </TemaCardapio>
  );
}
