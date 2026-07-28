"use client";

import { useMemo, useState } from "react";
import { Check, ChevronRight, Copy, Eye, ShieldCheck, X } from "lucide-react";
import {
  ACTION_LABELS, PERMISSION_MODULES, allPermissionKeys,
  permissionKey, permissionMatches,
} from "../../lib/permissions-catalog";

const OPERATIONAL = new Set(["view","create","edit","confirm","cancel","print","adjust_stock","inventory","transfer","record_loss"]);
const MANAGERIAL = new Set(["view","create","edit","delete","confirm","cancel","approve","reject","print","export","import","view_values","view_costs","view_margin","adjust_stock","inventory","close_inventory","transfer","record_loss","view_history"]);

function expanded(keys = []) {
  const all = allPermissionKeys();
  return new Set(all.filter((wanted) => keys.some((granted) => permissionMatches(granted, wanted))));
}

export default function PermissionBuilder({ value = [], onChange, copySources = [] }) {
  const [moduleId, setModuleId] = useState(PERMISSION_MODULES[0].id);
  const [copyId, setCopyId] = useState("");
  const module = PERMISSION_MODULES.find((item) => item.id === moduleId) || PERMISSION_MODULES[0];
  const selected = useMemo(() => expanded(value), [value]);
  const moduleKeys = module.pages.flatMap((page) => page.actions.map((action) => permissionKey(module.id, page.id, action)));
  const moduleCount = moduleKeys.filter((key) => selected.has(key)).length;

  const commit = (next) => onChange?.([...next]);
  const setKey = (key, checked) => {
    const next = new Set(selected);
    checked ? next.add(key) : next.delete(key);
    commit(next);
  };
  const setModule = (checked) => {
    const next = new Set(selected);
    moduleKeys.forEach((key) => checked ? next.add(key) : next.delete(key));
    commit(next);
  };
  const quick = (mode) => {
    const next = new Set(selected);
    moduleKeys.forEach((key) => next.delete(key));
    if (mode === "all") moduleKeys.forEach((key) => next.add(key));
    if (mode === "view") module.pages.forEach((page) => next.add(permissionKey(module.id, page.id, "view")));
    if (mode === "operational" || mode === "managerial") {
      const actions = mode === "operational" ? OPERATIONAL : MANAGERIAL;
      module.pages.forEach((page) => page.actions.filter((action) => actions.has(action)).forEach((action) => next.add(permissionKey(module.id, page.id, action))));
    }
    commit(next);
  };
  const copy = () => {
    const source = copySources.find((item) => item.id === copyId);
    if (source) onChange?.([...expanded(source.permissions)]);
  };

  return (
    <div className="grid min-h-[32rem] grid-cols-1 overflow-hidden rounded-2xl border border-slate-200 bg-white lg:grid-cols-[15rem_1fr]">
      <aside className="border-b border-slate-200 bg-slate-50 p-3 lg:border-b-0 lg:border-r">
        <p className="px-2 pb-2 text-[10px] font-black uppercase tracking-[.18em] text-slate-400">Módulos</p>
        <div className="space-y-1">
          {PERMISSION_MODULES.map((item) => {
            const keys = item.pages.flatMap((page) => page.actions.map((action) => permissionKey(item.id, page.id, action)));
            const count = keys.filter((key) => selected.has(key)).length;
            return (
              <button key={item.id} type="button" onClick={() => setModuleId(item.id)}
                className={`flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-bold transition ${moduleId === item.id ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-white"}`}>
                <span className={`flex h-6 w-6 items-center justify-center rounded-lg text-[10px] ${count ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-500"}`}>
                  {count ? <Check size={13} /> : "—"}
                </span>
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                <ChevronRight size={14} className="opacity-50" />
              </button>
            );
          })}
        </div>
      </aside>

      <section className="min-w-0 p-4 sm:p-6">
        <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[.16em] text-emerald-600">{module.label}</p>
            <h3 className="mt-1 text-xl font-black text-slate-800">Páginas e ações</h3>
            <p className="mt-1 text-sm text-slate-500">{moduleCount} de {moduleKeys.length} permissões selecionadas</p>
          </div>
          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">
            <input type="checkbox" checked={moduleCount === moduleKeys.length}
              ref={(node) => { if (node) node.indeterminate = moduleCount > 0 && moduleCount < moduleKeys.length; }}
              onChange={(event) => setModule(event.target.checked)} className="h-4 w-4 accent-emerald-600" />
            Liberar módulo inteiro
          </label>
        </div>

        <div className="mb-5 flex flex-wrap gap-2">
          <button type="button" onClick={() => quick("all")} className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white">Selecionar tudo</button>
          <button type="button" onClick={() => quick("none")} className="flex items-center gap-1 rounded-lg bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700"><X size={13}/> Remover tudo</button>
          <button type="button" onClick={() => quick("view")} className="flex items-center gap-1 rounded-lg bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700"><Eye size={13}/> Somente visualizar</button>
          <button type="button" onClick={() => quick("operational")} className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700">Acesso operacional</button>
          <button type="button" onClick={() => quick("managerial")} className="flex items-center gap-1 rounded-lg bg-violet-50 px-3 py-2 text-xs font-bold text-violet-700"><ShieldCheck size={13}/> Acesso gerencial</button>
        </div>

        {copySources.length > 0 && (
          <div className="mb-5 flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:flex-row">
            <select value={copyId} onChange={(event) => setCopyId(event.target.value)} className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium">
              <option value="">Copiar permissões de usuário ou perfil...</option>
              {copySources.map((source) => <option key={source.id} value={source.id}>{source.label}</option>)}
            </select>
            <button type="button" disabled={!copyId} onClick={copy} className="flex items-center justify-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm disabled:opacity-40"><Copy size={15}/> Copiar</button>
          </div>
        )}

        <div className="space-y-4">
          {module.pages.map((page) => (
            <div key={page.id} className="rounded-xl border border-slate-200 p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div>
                  <p className="font-black text-slate-800">{page.label}</p>
                  <p className="text-[11px] text-slate-400">{page.route}</p>
                </div>
                <label className="flex cursor-pointer items-center gap-2 text-xs font-bold text-slate-500">
                  <input type="checkbox"
                    checked={page.actions.every((action) => selected.has(permissionKey(module.id, page.id, action)))}
                    onChange={(event) => {
                      const next = new Set(selected);
                      page.actions.forEach((action) => {
                        const key = permissionKey(module.id, page.id, action);
                        event.target.checked ? next.add(key) : next.delete(key);
                      });
                      commit(next);
                    }} className="accent-emerald-600" />
                  Página inteira
                </label>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {page.actions.map((action) => {
                  const key = permissionKey(module.id, page.id, action);
                  return (
                    <label key={key} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition ${selected.has(key) ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-slate-100 bg-slate-50 text-slate-600"}`}>
                      <input type="checkbox" checked={selected.has(key)} onChange={(event) => setKey(key, event.target.checked)} className="accent-emerald-600" />
                      {ACTION_LABELS[action] || action}
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

