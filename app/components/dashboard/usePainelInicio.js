"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useERP } from "../../context/ERPContext";
import { canAccessRoute } from "../../lib/permissions-catalog.mjs";
import { carregarPainelInicio } from "../../lib/painel-inicio-dados";
import { saudacao, primeiroNome } from "../../lib/painel-inicio.mjs";
import { useTempoReal } from "../../lib/realtime";

export const ROTAS_DASHBOARD = {
  financeiro: "/dashboard/financeiro",
  dre: "/dashboard/financeiro/dre",
  lancarFaturamento: "/dashboard/operacao/estoque/cmv",
  contas: "/dashboard/financeiro/contas",
  rh: "/dashboard/rh",
  eventos: "/dashboard/reservas-eventos",
  reservas: "/dashboard/reservas-eventos/reservas",
  estoque: "/dashboard/operacao/estoque",
  mesas: "/dashboard/mesas",
};

const TABELAS_TEMPO_REAL = [
  "fin_faturamento_diario",
  "registro_ponto",
  "reservas",
  "eventos",
  "estoque_itens",
  "contas_pagar",
  "comandas",
  "mesas",
];

export function usePainelInicio() {
  const { sessao, unidadeAtiva, unidadeInfo } = useERP();
  const [agora, setAgora] = useState(null);
  const [dados, setDados] = useState(undefined);
  const [atualizando, setAtualizando] = useState(false);
  const [erroRede, setErroRede] = useState(null);

  const pode = useMemo(() => {
    if (!sessao) return null;
    const ok = (rota) => {
      const [caminho, busca = ""] = rota.split("?");
      return !sessao.gerenciado || canAccessRoute(sessao, caminho, busca);
    };
    return Object.fromEntries(
      Object.entries(ROTAS_DASHBOARD).map(([k, rota]) => [k, ok(rota)])
    );
  }, [sessao]);

  const carregar = useCallback(async () => {
    if (!pode || !unidadeAtiva || unidadeAtiva === "todas") return;
    setAtualizando(true);
    setErroRede(null);
    try {
      const momento = new Date();
      const r = await carregarPainelInicio(unidadeAtiva, pode, momento);
      setAgora(momento);
      setDados(r);
    } catch (err) {
      console.error("[usePainelInicio] Erro ao carregar dados do painel:", err);
      setErroRede("Falha na sincronização dos dados com o servidor.");
    } finally {
      setAtualizando(false);
    }
  }, [pode, unidadeAtiva]);

  // Inicialização no browser
  useEffect(() => {
    setAgora(new Date());
  }, []);

  // Recarga ao trocar unidade ou permissões
  useEffect(() => {
    setDados(undefined);
    carregar();
  }, [carregar]);

  // Atualização periódica (a cada 2 minutos)
  useEffect(() => {
    const t = setInterval(carregar, 120000);
    return () => clearInterval(t);
  }, [carregar]);

  // Sincronização em tempo real quando ocorrem mutações
  useTempoReal(TABELAS_TEMPO_REAL, carregar);

  const nomeOperador = useMemo(() => primeiroNome(sessao?.nome), [sessao?.nome]);
  const saudacaoTexto = useMemo(
    () => (agora ? `${saudacao(agora)}${nomeOperador ? `, ${nomeOperador}` : ""}` : ""),
    [agora, nomeOperador]
  );

  const dataExtenso = useMemo(() => {
    if (!agora) return "";
    return agora.toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }, [agora]);

  const semUnidade = !unidadeAtiva || unidadeAtiva === "todas";
  const faturamento = dados?.faturamento?.ok ? dados.faturamento.dados : null;
  const contas = dados?.contas?.ok ? dados.contas.dados : null;
  const equipe = dados?.equipe?.ok ? dados.equipe.dados : null;
  const reservas = dados?.reservas?.ok ? dados.reservas.dados : null;
  const eventos = dados?.eventos?.ok ? dados.eventos.dados : null;
  const estoque = dados?.estoque?.ok ? dados.estoque.dados : null;
  const mesas = dados?.mesas?.ok ? dados.mesas.dados : null;

  const nCartoes = pode
    ? [
        pode.financeiro,
        pode.contas,
        pode.rh,
        pode.eventos,
        pode.eventos,
        pode.estoque,
        pode.mesas && mesas?.total > 0,
      ].filter(Boolean).length
    : 0;

  const colunasGrid =
    nCartoes === 4 || nCartoes >= 7 ? "xl:grid-cols-4" : "xl:grid-cols-3";

  return {
    sessao,
    unidadeAtiva,
    unidadeInfo,
    agora,
    dados,
    atualizando,
    erroRede,
    carregar,
    pode,
    semUnidade,
    nomeOperador,
    saudacaoTexto,
    dataExtenso,
    colunasGrid,
    faturamento,
    contas,
    equipe,
    reservas,
    eventos,
    estoque,
    mesas,
  };
}
