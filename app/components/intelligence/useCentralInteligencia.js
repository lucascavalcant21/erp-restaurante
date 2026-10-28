"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buscarResumoDoDia, responderInsight, buscarHistorico } from "../../lib/intelligence/client/api";

/**
 * Custom Hook de Domínio para a Central de Inteligência do Héfisto.
 * Desacopla toda a lógica de busca, cancelamento de requisições (AbortController),
 * tratamento de erros de rede (try/catch), memoização de listas e feedback de insights da camada de UI.
 */
export function useCentralInteligencia(unidadeAtiva) {
  const [brief, setBrief] = useState(null);
  const [erro, setErro] = useState(null);
  const [codigoErro, setCodigoErro] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [erroAcao, setErroAcao] = useState(null);
  const [ocultos, setOcultos] = useState(() => new Set());
  const [historico, setHistorico] = useState([]);
  const [verInfo, setVerInfo] = useState(false);
  const [verTodos, setVerTodos] = useState(false);

  const abortRef = useRef(null);
  const semUnidade = !unidadeAtiva || unidadeAtiva === "todas";

  const carregar = useCallback(async () => {
    if (semUnidade) return;

    // Cancela requisição anterior em andamento para evitar race condition e vazamento de memória
    if (abortRef.current) {
      abortRef.current.abort();
    }
    const ctl = new AbortController();
    abortRef.current = ctl;

    setCarregando(true);
    setErro(null);
    setCodigoErro(null);
    setErroAcao(null);

    try {
      const [resBrief, resHist] = await Promise.all([
        buscarResumoDoDia(unidadeAtiva, ctl.signal),
        buscarHistorico(unidadeAtiva, ctl.signal),
      ]);

      if (ctl.signal.aborted) return;

      if (resBrief.ok && resBrief.dados?.brief) {
        setBrief({
          ...resBrief.dados.brief,
          auditoriaPersistente: resBrief.dados.auditoriaPersistente,
        });
        setOcultos(new Set());
      } else if (!resBrief.cancelado) {
        setErro(resBrief.dados?.erro || "Não foi possível carregar a Central de Inteligência agora.");
        setCodigoErro(resBrief.dados?.codigo || null);
      }

      if (resHist.ok) {
        setHistorico(resHist.dados?.itens || []);
      }
    } catch (e) {
      if (!ctl.signal.aborted) {
        setErro(e?.message || "Ocorreu um erro inesperado ao comunicar com o servidor.");
        setCodigoErro("FALHA_REDE");
      }
    } finally {
      if (abortRef.current === ctl) {
        setCarregando(false);
      }
    }
  }, [unidadeAtiva, semUnidade]);

  useEffect(() => {
    setBrief(null);
    carregar();
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, [carregar]);

  const responder = useCallback(async (insight, opcao) => {
    setErroAcao(null);
    try {
      const r = await responderInsight(unidadeAtiva, {
        insightId: insight.id,
        insightTipo: insight.tipo,
        resposta: "opcao",
        opcao,
      });
      if (!r.ok) {
        setErroAcao(r.dados?.erro || "Não foi possível registrar sua resposta. Verifique a conexão.");
      }
      return r.ok;
    } catch {
      setErroAcao("Falha de conexão ao salvar sua resposta. Tente novamente.");
      return false;
    }
  }, [unidadeAtiva]);

  const dispensar = useCallback(async (insight) => {
    setErroAcao(null);
    try {
      const r = await responderInsight(unidadeAtiva, {
        insightId: insight.id,
        insightTipo: insight.tipo,
        resposta: "dispensar",
      });
      if (r.ok) {
        setOcultos((prev) => {
          const proximo = new Set(prev);
          proximo.add(insight.id);
          return proximo;
        });
        return true;
      }
      setErroAcao(r.dados?.erro || "Não foi possível dispensar o alerta agora.");
      return false;
    } catch {
      setErroAcao("Sem conexão para dispensar o alerta. Tente novamente.");
      return false;
    }
  }, [unidadeAtiva]);

  const responderPergunta = useCallback(async (q, opcao) => {
    setErroAcao(null);
    try {
      const r = await responderInsight(unidadeAtiva, {
        insightId: q.insightId,
        insightTipo: q.insightTipo,
        resposta: "opcao",
        opcao,
      });
      if (!r.ok) {
        setErroAcao(r.dados?.erro || "Não foi possível registrar a resposta.");
      }
      return r.ok;
    } catch {
      setErroAcao("Falha de rede ao registrar resposta.");
      return false;
    }
  }, [unidadeAtiva]);

  const limparErroAcao = useCallback(() => setErroAcao(null), []);

  // Listas derivadas memoizadas para evitar realocação e re-render em cascata
  const dadosDerivados = useMemo(() => {
    if (!brief) {
      return {
        atencao: [],
        atencaoVisivel: [],
        limite: 3,
        perguntas: [],
        idsComPergunta: new Set(),
        oportunidades: [],
        informacoes: [],
      };
    }
    const visiveis = (xs) => (xs || []).filter((i) => !ocultos.has(i.id));
    const atencao = [...visiveis(brief.critical), ...visiveis(brief.warnings)];
    const limite = brief.destaques || 3;
    const atencaoVisivel = verTodos ? atencao : atencao.slice(0, limite);
    const perguntas = (brief.perguntasAbertas || []).filter((q) => !ocultos.has(q.insightId));
    const idsComPergunta = new Set(perguntas.map((q) => q.insightId));
    const oportunidades = visiveis(brief.opportunities);
    const informacoes = visiveis(brief.information);

    return {
      atencao,
      atencaoVisivel,
      limite,
      perguntas,
      idsComPergunta,
      oportunidades,
      informacoes,
    };
  }, [brief, ocultos, verTodos]);

  return {
    semUnidade,
    brief,
    erro,
    codigoErro,
    carregando,
    erroAcao,
    limparErroAcao,
    historico,
    verInfo,
    setVerInfo,
    verTodos,
    setVerTodos,
    carregar,
    responder,
    dispensar,
    responderPergunta,
    ...dadosDerivados,
  };
}
