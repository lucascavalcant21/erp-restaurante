import React from "react";
import { fmtBRL } from "./index";

export function CupomTermico({ pedido, unidadeInfo, tipo = "parcial" }) {
  if (!pedido) return null;

  const isFinal = tipo === "final";
  const { cliente_nome, id, created_at, status, pagamentos } = pedido;
  
  // Itens (Assumimos que itens vêm como pedido.itens ou precisamos pegá-los)
  // No PDV, o objeto mesa.pedidos[x].itens
  const itens = pedido.itens || [];

  const subtotal = itens.reduce((acc, i) => acc + (Number(i.valor_unitario) * Number(i.quantidade)), 0);
  const desconto = Number(pedido.desconto) || 0;
  const servico = Number(pedido.taxa_servico) || 0;
  const total = subtotal - desconto + servico;

  const dataEmissao = new Date().toLocaleString("pt-BR");

  return (
    <div className="print-section text-black bg-white font-mono text-[12px] leading-tight" style={{ width: "80mm", margin: "0 auto", padding: "5mm" }}>
      {/* CABEÇALHO */}
      <div className="text-center mb-4">
        <h1 className="font-bold text-[16px] uppercase">{unidadeInfo?.nome || "Meu Restaurante"}</h1>
        <p>CNPJ: {unidadeInfo?.cnpj || "00.000.000/0001-00"}</p>
        <p>{unidadeInfo?.endereco || "Endereço não cadastrado"}</p>
        <p className="mt-2 font-bold uppercase">{isFinal ? "RECIBO - NÃO É DOCUMENTO FISCAL" : "CONTA PARCIAL (CONFERÊNCIA)"}</p>
        <p>Emissão: {dataEmissao}</p>
        <p>Pedido: #{id?.substring(0, 8).toUpperCase()}</p>
        {cliente_nome && <p>Cliente: {cliente_nome}</p>}
      </div>

      <div className="border-b border-dashed border-black mb-2"></div>

      {/* ITENS */}
      <table className="w-full text-left mb-2">
        <thead>
          <tr>
            <th className="font-normal w-[60%]">Item</th>
            <th className="font-normal text-right">Qtd</th>
            <th className="font-normal text-right">V.Un</th>
            <th className="font-normal text-right">Tot</th>
          </tr>
        </thead>
        <tbody>
          {itens.map((i, idx) => (
            <tr key={idx}>
              <td className="truncate max-w-[120px]">{i.produto?.nome_produto || i.nome}</td>
              <td className="text-right">{i.quantidade}</td>
              <td className="text-right">{fmtBRL(i.valor_unitario).replace("R$", "").trim()}</td>
              <td className="text-right">{fmtBRL(i.quantidade * i.valor_unitario).replace("R$", "").trim()}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="border-b border-dashed border-black mb-2"></div>

      {/* TOTAIS */}
      <div className="flex justify-between">
        <span>Subtotal:</span>
        <span>{fmtBRL(subtotal)}</span>
      </div>
      {servico > 0 && (
        <div className="flex justify-between">
          <span>Taxa Serviço (10%):</span>
          <span>{fmtBRL(servico)}</span>
        </div>
      )}
      {desconto > 0 && (
        <div className="flex justify-between text-red-600">
          <span>Desconto:</span>
          <span>-{fmtBRL(desconto)}</span>
        </div>
      )}
      <div className="flex justify-between font-bold text-[14px] mt-1 border-t border-black pt-1">
        <span>TOTAL A PAGAR:</span>
        <span>{fmtBRL(total)}</span>
      </div>

      {/* PAGAMENTOS SE FINALIZADO */}
      {isFinal && pagamentos && pagamentos.length > 0 && (
        <>
          <div className="border-b border-dashed border-black mt-2 mb-2"></div>
          <div className="font-bold text-center mb-1">PAGAMENTOS</div>
          {pagamentos.map((p, idx) => (
            <div key={idx} className="flex justify-between">
              <span>{p.metodo}</span>
              <span>{fmtBRL(p.valor)}</span>
            </div>
          ))}
        </>
      )}

      {/* RODAPÉ */}
      <div className="border-b border-dashed border-black mt-4 mb-2"></div>
      <div className="text-center text-[10px] mt-2 mb-8">
        <p>Obrigado pela preferência!</p>
        <p>Desenvolvido por Hefisto ERP</p>
      </div>
    </div>
  );
}
