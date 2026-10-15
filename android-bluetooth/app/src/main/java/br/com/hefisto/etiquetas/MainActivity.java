package br.com.hefisto.etiquetas;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.AlertDialog;
import android.bluetooth.BluetoothDevice;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * O Héfisto (tela de etiquetas) dentro do app, com a ponte Bluetooth nativa.
 * A ponte só responde quando a página aberta é do Héfisto (Origens.permitida).
 */
public class MainActivity extends Activity {
    private WebView web;
    private volatile String urlAtual = "";
    private final ExecutorService fila = Executors.newSingleThreadExecutor();
    private final Handler tela = new Handler(Looper.getMainLooper());
    private ImpressoraBluetooth imp;

    @SuppressLint({ "SetJavaScriptEnabled", "AddJavascriptInterface" })
    @Override protected void onCreate(Bundle b) {
        super.onCreate(b);
        imp = Permissoes.impressora(this);
        web = new WebView(this);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        s.setUserAgentString(s.getUserAgentString() + " HefistoEtiquetas/" + BuildInfo.versao(this));

        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                String u = r.getUrl().toString();
                if (Origens.permitida(u)) return false;
                // Fora do Héfisto: abre no navegador, longe da ponte.
                try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(u))); } catch (Exception ignored) {}
                return true;
            }
            @Override public void onPageStarted(WebView v, String u, android.graphics.Bitmap f) { urlAtual = u == null ? "" : u; }
            @Override public void doUpdateVisitedHistory(WebView v, String u, boolean recarga) { urlAtual = u == null ? "" : u; }
        });
        web.addJavascriptInterface(new Ponte(), "HefistoBluetoothNativo");
        setContentView(web);
        Permissoes.pedir(this);

        String alvo = getIntent().getStringExtra("url");
        web.loadUrl(Origens.permitida(alvo) ? alvo : Origens.PRODUCAO);
        // Primeira vez (nenhuma impressora salva): começa pelo diagnóstico.
        if (alvo == null && imp.salvaMac() == null) startActivity(new Intent(this, DiagnosticoActivity.class));
    }

    @Override protected void onNewIntent(Intent i) {
        super.onNewIntent(i);
        String alvo = i.getStringExtra("url");
        if (Origens.permitida(alvo)) web.loadUrl(alvo);
    }

    @Override public void onBackPressed() {
        if (web.canGoBack()) web.goBack(); else super.onBackPressed();
    }

    private void responder(String id, boolean ok, String mensagem) {
        String js = "window.__hefistoBtRetorno&&window.__hefistoBtRetorno(" + JSONObject.quote(id) + "," + ok + "," + JSONObject.quote(mensagem == null ? "" : mensagem) + ")";
        tela.post(() -> web.evaluateJavascript(js, null));
    }

    interface Trabalho { String rodar() throws Exception; }

    private void emSegundoPlano(String id, Trabalho t) {
        fila.submit(() -> {
            try { responder(id, true, t.rodar()); }
            catch (Exception e) { imp.registrar("ERRO: " + e.getMessage()); responder(id, false, e.getMessage()); }
        });
    }

    /** O que o JavaScript do Héfisto enxerga. Só funciona em página do Héfisto. */
    class Ponte {
        private boolean liberada() { return Origens.permitida(urlAtual); }

        @JavascriptInterface public String versao() { return liberada() ? BuildInfo.versao(MainActivity.this) : ""; }

        @JavascriptInterface public String estado() {
            if (!liberada()) return "{}";
            try {
                JSONObject j = new JSONObject();
                j.put("bluetooth", imp.temBluetooth());
                j.put("ligado", imp.ligado());
                j.put("permissoes", Permissoes.ok(MainActivity.this));
                j.put("salva", imp.salvaMac() != null);
                j.put("nome", imp.salvaNome() == null ? "" : imp.salvaNome());
                j.put("modo", imp.salvaModo() == null ? "" : imp.salvaModo());
                j.put("conectada", imp.conectada());
                return j.toString();
            } catch (Exception e) { return "{}"; }
        }

        /** Escolher a impressora entre as pareadas no Android e conectar. */
        @JavascriptInterface public void escolher(String id) {
            if (!liberada()) return;
            if (!Permissoes.ok(MainActivity.this)) { tela.post(() -> Permissoes.pedir(MainActivity.this)); responder(id, false, "Permita o Bluetooth e toque de novo."); return; }
            if (!imp.ligado()) { responder(id, false, "Ligue o Bluetooth do aparelho."); return; }
            List<BluetoothDevice> pareadas = new ArrayList<>(imp.pareadas());
            tela.post(() -> {
                List<String> nomes = new ArrayList<>();
                for (BluetoothDevice d : pareadas) nomes.add(ImpressoraBluetooth.nomeDe(d) + "  ·  " + d.getAddress());
                nomes.add("Não está aqui → abrir diagnóstico");
                new AlertDialog.Builder(MainActivity.this)
                    .setTitle("Escolha a impressora")
                    .setItems(nomes.toArray(new String[0]), (dlg, i) -> {
                        if (i == pareadas.size()) { startActivity(new Intent(MainActivity.this, DiagnosticoActivity.class)); responder(id, false, "Abra o diagnóstico para parear."); return; }
                        BluetoothDevice d = pareadas.get(i);
                        emSegundoPlano(id, () -> {
                            if (!imp.conectar(d)) throw new Exception("Não conectou em " + ImpressoraBluetooth.nomeDe(d) + ". Abra o diagnóstico e copie o log.");
                            return ImpressoraBluetooth.nomeDe(d);
                        });
                    })
                    .setOnCancelListener(dlg -> responder(id, false, "cancelado"))
                    .show();
            });
        }

        /** Reconecta na impressora salva (sem perguntar). */
        @JavascriptInterface public void reconectar(String id) {
            if (!liberada()) return;
            emSegundoPlano(id, () -> {
                if (!imp.garantirConexao()) throw new Exception("Impressora salva não respondeu. Ela está ligada?");
                return imp.salvaNome();
            });
        }

        /** Bytes (TSPL) em base64, montados pelo Héfisto. */
        @JavascriptInterface public void enviar(String base64, String id) {
            if (!liberada()) return;
            emSegundoPlano(id, () -> {
                byte[] dados = Base64.decode(base64, Base64.DEFAULT);
                if (dados.length == 0 || dados.length > 4 * 1024 * 1024) throw new Exception("Etiqueta vazia ou grande demais.");
                imp.enviar(dados);
                return String.valueOf(dados.length);
            });
        }

        @JavascriptInterface public void imprimirTeste(String id) {
            if (!liberada()) return;
            emSegundoPlano(id, () -> { imp.enviar(Tspl.etiquetaTeste(imp.salvaNome())); return "ok"; });
        }

        @JavascriptInterface public void abrirDiagnostico() {
            if (!liberada()) return;
            tela.post(() -> startActivity(new Intent(MainActivity.this, DiagnosticoActivity.class)));
        }
    }
}
