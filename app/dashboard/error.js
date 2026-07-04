"use client";

// Tela de erro do dashboard: em vez de tela morta/branca quando algo quebra,
// mostra a mensagem real do erro e oferece recarregar — essencial para
// diagnosticar problemas em produção ("cliquei e nada aconteceu").
export default function DashboardError({ error, reset }) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="erp-card p-8 max-w-md w-full text-center">
        <p className="text-lg font-black" style={{ color: "var(--fg)" }}>Algo quebrou nesta tela</p>
        <p className="text-xs font-medium mt-2 break-words rounded-lg p-3" style={{ color: "var(--danger-strong)", background: "var(--danger-soft)" }}>
          {String(error?.message || error || "Erro desconhecido")}
        </p>
        <p className="text-[11px] font-medium mt-3" style={{ color: "var(--dim)" }}>
          Se acabou de sair uma atualização, recarregue com Ctrl+Shift+R. Se o erro continuar, me mande a mensagem acima.
        </p>
        <button onClick={() => reset()} className="erp-btn erp-btn-primary mt-5 w-full">Tentar novamente</button>
        <button onClick={() => { window.location.href = "/dashboard"; }} className="erp-btn erp-btn-ghost mt-2 w-full">Voltar ao painel</button>
      </div>
    </div>
  );
}
