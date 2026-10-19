import { imprimirHtml } from "./imprimir";
import { montarHtmlRecibo } from "./recibo-extra";

export function imprimirReciboFuncionario(recibo, unidadeInfo, infoFuncionario) {
  const recNormalizado = recibo?.dados
    ? recibo
    : {
        numero: recibo?.numero || `REC-${Date.now()}`,
        data_trabalho: recibo?.data_trabalho || new Date().toISOString().slice(0, 10),
        datas_contratadas: recibo?.datas_contratadas || [recibo?.data_trabalho || new Date().toISOString().slice(0, 10)],
        dias_contratados: recibo?.dias_contratados || (Array.isArray(recibo?.dias_detalhados) && recibo.dias_detalhados.length ? recibo.dias_detalhados.length : 1),
        valor_diaria: recibo?.valor_diaria || recibo?.valor || 0,
        valor_total: recibo?.valor_total ?? recibo?.valor ?? 0,
        pagamento_realizado: recibo?.pagamento_realizado !== false,
        forma_pagamento: recibo?.forma_pagamento || recibo?.formaPagamento || "Pix",
        funcao: infoFuncionario?.cargo || "Colaborador",
        dados: {
          ...(recibo || {}),
          forma_pagamento: recibo?.forma_pagamento || recibo?.formaPagamento || "Pix",
          nome: infoFuncionario?.nome || recibo?.nome || "",
          cpf: infoFuncionario?.cpf || recibo?.cpf || "",
          rg: infoFuncionario?.rg || recibo?.rg || "",
          telefone: infoFuncionario?.telefone || recibo?.telefone || "",
          chave_pix: infoFuncionario?.chave_pix || recibo?.chave_pix || "",
          endereco: infoFuncionario?.endereco || infoFuncionario?.rua_av || recibo?.endereco || "",
          rua_av: infoFuncionario?.rua_av || "",
          numero_casa: infoFuncionario?.numero_casa || "",
          bairro: infoFuncionario?.bairro || "",
          cidade_uf: infoFuncionario?.cidade_uf || "",
          tipo_contrato: infoFuncionario?.tipo_contrato || "Fixo",
        },
      };

  const html = montarHtmlRecibo({
    extra: infoFuncionario,
    funcionario: infoFuncionario,
    recibo: recNormalizado,
    unidade: unidadeInfo,
    unidadeInfo,
    unidadeNome: unidadeInfo?.nome,
  });

  return imprimirHtml(html);
}

