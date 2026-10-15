package br.com.hefisto.etiquetas;

import android.app.Activity;
import android.bluetooth.BluetoothDevice;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Tela de diagnóstico: mostra o que o Android sabe da impressora e o erro
 * exato de cada tentativa. Funciona sem o Héfisto (não precisa de login).
 */
@android.annotation.SuppressLint("MissingPermission") // procurar() só roda com Permissoes.ok()
public class DiagnosticoActivity extends Activity {
    private final ExecutorService fila = Executors.newSingleThreadExecutor();
    private final Handler tela = new Handler(Looper.getMainLooper());
    private ImpressoraBluetooth imp;
    private TextView estado, detalhe, log;
    private LinearLayout lista;
    private BluetoothDevice escolhida;

    @Override protected void onCreate(Bundle b) {
        super.onCreate(b);
        imp = Permissoes.impressora(this);

        LinearLayout raiz = new LinearLayout(this);
        raiz.setOrientation(LinearLayout.VERTICAL);
        raiz.setPadding(32, 48, 32, 32);

        TextView titulo = texto("Diagnóstico Bluetooth — Héfisto", 20, true);
        raiz.addView(titulo);
        estado = texto("", 14, false);
        raiz.addView(estado);

        raiz.addView(botao("1. Permitir Bluetooth", v -> Permissoes.pedir(this)));
        raiz.addView(botao("2. Procurar impressoras", v -> procurar()));
        lista = new LinearLayout(this);
        lista.setOrientation(LinearLayout.VERTICAL);
        raiz.addView(lista);

        detalhe = texto("Toque numa impressora da lista.", 14, false);
        detalhe.setTypeface(Typeface.MONOSPACE);
        raiz.addView(detalhe);

        LinearLayout acoes = new LinearLayout(this);
        acoes.setOrientation(LinearLayout.VERTICAL);
        acoes.addView(botao("Ver detalhes e serviços", v -> comEscolhida(d -> imp.diagnosticar(d))));
        acoes.addView(botao("Parear", v -> comEscolhida(d -> imp.parear(d) ? "Pareada." : "Não pareou — veja o log.")));
        acoes.addView(botao("3. Conectar impressora Bluetooth", v -> comEscolhida(d -> imp.conectar(d) ? "Conectada e salva." : "Não conectou — veja o log.")));
        acoes.addView(botao("4. Imprimir teste (60×40, GAP 2, QR)", v -> rodar(() -> {
            imp.enviar(Tspl.etiquetaTeste(imp.salvaNome()));
            return "Teste enviado. Saiu a etiqueta?";
        })));
        acoes.addView(botao("Esquecer impressora salva", v -> rodar(() -> { imp.esquecer(); return "Esquecida."; })));
        acoes.addView(botao("Copiar log (para enviar ao suporte)", v -> copiarLog()));
        acoes.addView(botao("Abrir Héfisto (etiquetas)", v -> abrirHefisto(Origens.PRODUCAO)));
        acoes.addView(botao("Abrir Héfisto — PREVIEW de teste", v -> abrirHefisto(Origens.PREVIEW_TESTE)));
        raiz.addView(acoes);

        raiz.addView(texto("Log", 16, true));
        log = texto("", 12, false);
        log.setTypeface(Typeface.MONOSPACE);
        log.setTextIsSelectable(true);
        raiz.addView(log);

        ScrollView rolagem = new ScrollView(this);
        rolagem.addView(raiz);
        setContentView(rolagem);
        Permissoes.pedir(this);
        atualizar();
    }

    @Override protected void onResume() { super.onResume(); atualizar(); }

    private void atualizar() {
        String s = "Bluetooth: " + (!imp.temBluetooth() ? "este aparelho não tem" : imp.ligado() ? "ligado" : "DESLIGADO — ligue nas configurações")
            + "\nPermissões: " + (Permissoes.ok(this) ? "ok" : "FALTAM — toque em 1")
            + "\nSalva: " + (imp.salvaMac() == null ? "nenhuma" : imp.salvaNome() + " [" + imp.salvaMac() + "] por " + imp.salvaModo())
            + "\nConectada agora: " + (imp.conectada() ? "sim" : "não");
        estado.setText(s);
        log.setText(imp.log());
    }

    private void procurar() {
        if (!Permissoes.ok(this)) { Permissoes.pedir(this); return; }
        lista.removeAllViews();
        lista.addView(texto("Procurando… (12 s)", 14, false));
        fila.submit(() -> {
            Map<String, BluetoothDevice> todos = new LinkedHashMap<>();
            for (BluetoothDevice d : imp.pareadas()) todos.put(d.getAddress(), d);
            imp.registrar("Pareadas no Android: " + todos.size());
            List<BluetoothDevice> achadas = imp.procurar(12);
            for (BluetoothDevice d : achadas) if (!todos.containsKey(d.getAddress())) todos.put(d.getAddress(), d);
            tela.post(() -> {
                lista.removeAllViews();
                if (todos.isEmpty()) lista.addView(texto("Nada encontrado. A impressora está ligada? O Bluetooth dela está aceso?", 14, false));
                for (BluetoothDevice d : todos.values()) {
                    String rotulo = ImpressoraBluetooth.nomeDe(d) + "\n" + d.getAddress() + " · " + ImpressoraBluetooth.tipoTexto(d.getType())
                        + " · " + ImpressoraBluetooth.pareamentoTexto(d.getBondState());
                    lista.addView(botao(rotulo, v -> {
                        escolhida = d;
                        detalhe.setText("Escolhida: " + ImpressoraBluetooth.nomeDe(d) + " [" + d.getAddress() + "]");
                    }));
                }
                atualizar();
            });
        });
    }

    interface Acao { String rodar() throws Exception; }
    interface ComAparelho { Object rodar(BluetoothDevice d) throws Exception; }

    private void comEscolhida(ComAparelho a) {
        if (escolhida == null) { Toast.makeText(this, "Escolha uma impressora da lista primeiro.", Toast.LENGTH_LONG).show(); return; }
        BluetoothDevice d = escolhida;
        rodar(() -> String.valueOf(a.rodar(d)));
    }

    private void rodar(Acao a) {
        if (!Permissoes.ok(this)) { Permissoes.pedir(this); return; }
        detalhe.setText("Trabalhando…");
        fila.submit(() -> {
            String r;
            try { r = a.rodar(); } catch (Exception e) { r = "ERRO: " + e.getMessage(); imp.registrar(r); }
            final String fim = r;
            tela.post(() -> { detalhe.setText(fim); atualizar(); });
        });
    }

    private void copiarLog() {
        ClipboardManager c = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
        c.setPrimaryClip(ClipData.newPlainText("log bluetooth", "Héfisto Etiquetas " + BuildInfo.versao(this) + "\n" + estado.getText() + "\n\n" + imp.log()));
        Toast.makeText(this, "Log copiado. Cole no WhatsApp ou e-mail.", Toast.LENGTH_LONG).show();
    }

    private void abrirHefisto(String url) {
        Intent i = new Intent(this, MainActivity.class);
        i.putExtra("url", url);
        i.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP);
        startActivity(i);
    }

    private TextView texto(String s, int sp, boolean negrito) {
        TextView t = new TextView(this);
        t.setText(s);
        t.setTextSize(sp);
        t.setTextColor(Color.rgb(15, 23, 42));
        t.setPadding(0, 12, 0, 12);
        if (negrito) t.setTypeface(Typeface.DEFAULT_BOLD);
        return t;
    }

    private Button botao(String s, View.OnClickListener l) {
        Button b = new Button(this);
        b.setText(s);
        b.setAllCaps(false);
        b.setOnClickListener(l);
        return b;
    }
}
