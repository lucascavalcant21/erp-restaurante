"use client";

import { supabase } from "./supabase";

async function token() {
  const { data } = await supabase.auth.getSession();
  return data?.session?.access_token || "";
}

async function request(url, options = {}) {
  const accessToken = await token();
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      ...(options.headers || {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "Não foi possível concluir a operação.");
  return body;
}

export const fetchAccessBootstrap = () =>
  request("/api/admin/access-control");

export const accessCommand = (action, payload = {}) =>
  request("/api/admin/access-control", {
    method: "POST",
    body: JSON.stringify({ action, ...payload }),
  });

export function avatarInitials(name = "") {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] || "U") + (parts.length > 1 ? parts.at(-1)[0] : "");
}

export function formatLastAccess(value) {
  if (!value) return "Nunca acessou";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

