"use client";

// Central de navegação de um módulo: submódulos organizados em COLUNAS lado a
// lado (estilo kanban visual), com busca no topo. Componente único reutilizado
// por todos os módulos. Não abre nada automaticamente — cada cartão é um link.
//
// Config esperada:
// {
//   title, subtitle, icon,
//   columns: [
//     { title, subtitle, icon, accent: "#hex",
//       items: [ { label, desc, href, icon, count?, roles?, badge? } ] }
//   ]
// }
// - `roles` (opcional) em coluna ou item: só aparece se o papel do usuário
//   estiver na lista (admin vê tudo). Sem `roles`, aparece para todos.
// - Colunas sem itens visíveis são ocultadas.

import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { lerSessao } from "../lib/auth";

const norm = (s) => Array.from(String(s || "").toLowerCase().normalize("NFD")).filter((c) => { const k = c.charCodeAt(0); return k < 0x300 || k > 0x36f; }).join("");

export default function ModuleHub({ config }) {
  const router = useRouter();
  const [busca, setBusca] = useState("");
  const [papel, setPapel] = useState(null);

  useEffect(() => {
    let vivo = true;
    lerSessao().then((s) => { if (vivo) setPapel(String(s?.papel || "").toLowerCase()); }).catch(() => {});
    return () => { vivo = false; };
  }, []);

  const podeVer = (obj) => {
    if (!obj?.roles || !obj.roles.length) return true;
    if (papel === "admin") return true;
    return obj.roles.map((r) => String(r).toLowerCase()).includes(papel);
  };

  const ModuloIcon = config.icon;
  const termo = norm(busca);

  // Filtra por permissão e por busca; oculta colunas que ficaram vazias.
  const colunas = useMemo(() => {
    return (config.columns || [])
      .filter(podeVer)
      .map((col) => {
        const itens = (col.items || [])
          .filter(podeVer)
          .filter((it) => !termo || norm(it.label).includes(termo) || norm(it.desc).includes(termo) || norm(col.title).includes(termo));
        return { ...col, itens };
      })
      .filter((col) => col.itens.length > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, termo, papel]);

  const totalVisiveis = colunas.reduce((n, c) => n + c.itens.length, 0);

  return (
    <div className="min-h-screen">
      {/* Cabeçalho do módulo + busca */}
      <div className="sticky top-0 z-10 border-b px-4 sm:px-6 py-4 sm:py-5" style={{ background: "var(--surface, #fff)", borderColor: "var(--line, #e2e8f0)" }}>
        <div className="max-w-[1400px] mx-auto flex flex-col lg:flex-row lg:items-center gap-4">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {ModuloIcon && (
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0" style={{ background: "var(--accent-soft, #ecfdf5)", color: "var(--accent-strong, #047857)" }}>
                <ModuloIcon size={22} />
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-black tracking-tight truncate" style={{ color: "var(--fg, #0f172a)" }}>{config.title}</h1>
              {config.subtitle && <p className="text-xs sm:text-sm truncate" style={{ color: "var(--dim, #64748b)" }}>{config.subtitle}</p>}
            </div>
          </div>
          <div className="relative w-full lg:w-80 shrink-0">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--dim, #94a3b8)" }} />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar submódulos..."
              className="w-full h-11 pl-9 pr-3 rounded-xl text-sm font-medium outline-none border"
              style={{ background: "var(--card, #f8fafc)", borderColor: "var(--line, #e2e8f0)", color: "var(--fg, #0f172a)" }}
            />
          </div>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-5 sm:py-7">
        {colunas.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-sm font-bold" style={{ color: "var(--dim, #64748b)" }}>
              {termo ? `Nenhum submódulo encontrado para "${busca}".` : "Nenhum submódulo disponível."}
            </p>
          </div>
        ) : (
          /* Colunas lado a lado no desktop; 2–3 no tablet; empilhadas no celular */
          <div className="grid gap-4 sm:gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:[grid-template-columns:repeat(auto-fit,minmax(240px,1fr))]">
            {colunas.map((col, i) => {
              const ColIcon = col.icon;
              const accent = col.accent || "var(--accent-strong, #047857)";
              return (
                <section key={col.title + i} className="rounded-2xl border p-3 sm:p-4 flex flex-col" style={{ background: "var(--card, #f8fafc)", borderColor: "var(--line, #e2e8f0)" }}>
                  {/* Cabeçalho da categoria */}
                  <div className="flex items-center gap-2.5 mb-3 pb-3 border-b" style={{ borderColor: "var(--line-soft, #eef2f7)" }}>
                    {ColIcon && (
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: accent + "1a", color: accent }}>
                        <ColIcon size={18} />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-black text-sm leading-tight truncate" style={{ color: accent }}>{col.title}</p>
                      {col.subtitle && <p className="text-[11px] font-medium truncate" style={{ color: "var(--dim, #94a3b8)" }}>{col.subtitle}</p>}
                    </div>
                  </div>

                  {/* Cartões dos submódulos */}
                  <div className="flex flex-col gap-1.5">
                    {col.itens.map((it, j) => {
                      const ItIcon = it.icon;
                      return (
                        <button
                          key={it.href + j}
                          type="button"
                          onClick={() => router.push(it.href)}
                          className="group w-full text-left rounded-xl p-2.5 flex items-center gap-3 transition-colors hover:bg-[var(--elevated,#eef2f7)]"
                        >
                          {ItIcon && (
                            <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-colors" style={{ background: "var(--elevated, #eef2f7)", color: "var(--muted, #475569)" }}>
                              <ItIcon size={17} />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="font-bold text-sm leading-tight truncate" style={{ color: "var(--fg, #0f172a)" }}>{it.label}</p>
                              {it.badge && <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full shrink-0" style={{ background: accent + "1a", color: accent }}>{it.badge}</span>}
                            </div>
                            {it.desc && <p className="text-[11px] font-medium truncate" style={{ color: "var(--dim, #94a3b8)" }}>{it.desc}</p>}
                          </div>
                          {(it.count !== undefined && it.count !== null && it.count !== "") && (
                            <span className="text-[11px] font-black px-2 py-0.5 rounded-full shrink-0" style={{ background: "var(--elevated, #eef2f7)", color: "var(--muted, #475569)" }}>{it.count}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
