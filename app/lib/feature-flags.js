// Feature Flags para evoluções do Héfisto ERP.
// Permite habilitar/desabilitar a navegação v2 com suporte a rollback imediato.

export const FEATURE_FLAGS = {
  NAVIGATION_V2: true,
};

export function isFeatureEnabled(flagName) {
  if (typeof window !== "undefined") {
    try {
      const override = localStorage.getItem(`hefisto_ff_${flagName}`);
      if (override === "true") return true;
      if (override === "false") return false;
    } catch (_) {}
  }
  return FEATURE_FLAGS[flagName] ?? false;
}
