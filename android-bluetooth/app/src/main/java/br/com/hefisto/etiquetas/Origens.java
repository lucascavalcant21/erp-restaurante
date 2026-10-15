package br.com.hefisto.etiquetas;

import java.net.URI;

/**
 * Quais páginas podem usar a ponte Bluetooth e abrir dentro do app.
 * Qualquer outro endereço abre no navegador do aparelho, sem acesso à ponte.
 */
public final class Origens {
    private Origens() {}

    public static final String PRODUCAO = "https://app.hefisto.com.br/dashboard/operacao/etiquetas";
    public static final String PREVIEW_TESTE =
        "https://erp-restaurante-git-claude-bluetooth-nativo-lucas-cavalcante.vercel.app/dashboard/operacao/etiquetas";

    public static boolean permitida(String url) {
        if (url == null) return false;
        try {
            URI u = new URI(url);
            if (!"https".equalsIgnoreCase(u.getScheme())) return false;
            String h = u.getHost();
            if (h == null) return false;
            h = h.toLowerCase();
            if (h.equals("app.hefisto.com.br")) return true;
            // Previews do projeto erp-restaurante na Vercel (time lucas-cavalcante)
            return h.endsWith("-lucas-cavalcante.vercel.app") && h.startsWith("erp-restaurante-");
        } catch (Exception e) {
            return false;
        }
    }
}
