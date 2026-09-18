// ═══════════════════════════════════════════════════════════════
// FASE 3A — WHATSAPP IDENTITY RESOLVER
// app/lib/server/channels/whatsapp/identity.mjs
// ═══════════════════════════════════════════════════════════════

import { supabase, isSupabaseReady } from "../../../supabase.js";

// Store em memória para testes sintéticos e ambiente de desenvolvimento local
const memoryIdentitiesStore = new Map();

// Registro padrão de teste de administrador autorizado (+5511987654321)
memoryIdentitiesStore.set("+5511987654321", {
  phone_number: "+5511987654321",
  user_id: "usr-admin-1",
  empresa_id: "empresa-teste",
  unidade_id: "unidade-teste",
  role: "ADMIN",
  active: true
});

memoryIdentitiesStore.set("5511987654321", memoryIdentitiesStore.get("+5511987654321"));

/**
 * Normaliza número de telefone para E.164.
 */
export function normalizePhoneNumber(phone = "") {
  let cleaned = String(phone || "").replace(/[^\d+]/g, "");
  if (!cleaned.startsWith("+")) {
    cleaned = "+" + cleaned;
  }
  return cleaned;
}

/**
 * Registra um novo vínculo de identidade (usado em testes e no painel admin).
 */
export function registerWhatsAppIdentity({ phoneNumber, userId, empresaId, unidadeId, role = "ADMIN" }) {
  const normPhone = normalizePhoneNumber(phoneNumber);
  const record = {
    phone_number: normPhone,
    user_id: userId,
    empresa_id: empresaId,
    unidade_id: unidadeId,
    role: role.toUpperCase(),
    active: true
  };
  memoryIdentitiesStore.set(normPhone, record);
  memoryIdentitiesStore.set(normPhone.replace("+", ""), record);
  return record;
}

/**
 * Resolve a identidade ERP associada a um número de telefone do WhatsApp.
 * NUNCA aceita permissões ou IDs enviados pelo usuário na mensagem.
 * 
 * @param {string} rawPhone - Número de telefone no WhatsApp
 * @returns {Promise<{ isAuthorized: boolean, session?: object, role: string, phoneNumber: string }>}
 */
export async function resolveWhatsAppIdentity(rawPhone) {
  const normPhone = normalizePhoneNumber(rawPhone);
  const plainPhone = normPhone.replace("+", "");

  let identity = memoryIdentitiesStore.get(normPhone) || memoryIdentitiesStore.get(plainPhone);

  if (!identity && isSupabaseReady()) {
    try {
      const { data, error } = await supabase
        .from("whatsapp_identities")
        .select("*")
        .or(`phone_number.eq.${normPhone},phone_number.eq.${plainPhone}`)
        .eq("active", true)
        .single();
      if (!error && data) identity = data;
    } catch (e) {}
  }

  if (!identity || !identity.active) {
    return {
      isAuthorized: false,
      role: "UNKNOWN",
      phoneNumber: normPhone,
      session: null
    };
  }

  // Permissões e sessão resolvidas estritamente a partir do vínculo seguro no banco
  const session = {
    usuarioId: identity.user_id,
    empresaId: identity.empresa_id,
    unidadeId: identity.unidade_id,
    papel: identity.role.toLowerCase(),
    gerenciado: identity.role !== "ADMIN",
    canal: "whatsapp"
  };

  return {
    isAuthorized: true,
    role: identity.role,
    phoneNumber: normPhone,
    session
  };
}
