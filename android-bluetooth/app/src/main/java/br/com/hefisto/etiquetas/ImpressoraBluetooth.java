package br.com.hefisto.etiquetas;

import android.annotation.SuppressLint;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothGatt;
import android.bluetooth.BluetoothGattCallback;
import android.bluetooth.BluetoothGattCharacteristic;
import android.bluetooth.BluetoothGattService;
import android.bluetooth.BluetoothManager;
import android.bluetooth.BluetoothProfile;
import android.bluetooth.BluetoothSocket;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.ParcelUuid;
import android.os.Parcelable;

import java.io.IOException;
import java.io.OutputStream;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

/**
 * Conexão com a impressora pelo Bluetooth do Android.
 *
 * 1º Bluetooth CLÁSSICO (SPP/RFCOMM): é o que impressoras térmicas que aparecem
 *    na lista de Bluetooth do Android costumam usar. UUID oficial do Serial
 *    Port Profile (Bluetooth SIG): 00001101-0000-1000-8000-00805F9B34FB.
 *    Três tentativas, nesta ordem: segura, insegura e canal 1 direto.
 * 2º BLE (GATT): se o aparelho for BLE ou o clássico falhar, procura qualquer
 *    característica que aceite escrita (não presume UUID de fabricante).
 *
 * Tudo que acontece vai para o log de diagnóstico, com o erro exato.
 * Os métodos bloqueiam: chame fora da thread de tela.
 */
@SuppressLint("MissingPermission") // as permissões são pedidas pela tela antes
public class ImpressoraBluetooth {
    public static final UUID SPP = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");
    private static final String PREFS = "impressora";
    private static final int BLOCO_SPP = 512;
    private static final int PAUSA_SPP_MS = 8;

    private final Context ctx;
    private final BluetoothAdapter adaptador;
    private final StringBuilder log = new StringBuilder();

    private BluetoothSocket socket;
    private OutputStream saida;
    private BluetoothGatt gatt;
    private BluetoothGattCharacteristic escritaBle;
    private int mtuBle = 20;
    private String conectadaMac = null;
    private String modo = null; // "spp" | "ble"

    public ImpressoraBluetooth(Context ctx) {
        this.ctx = ctx.getApplicationContext();
        BluetoothManager m = (BluetoothManager) ctx.getSystemService(Context.BLUETOOTH_SERVICE);
        this.adaptador = m == null ? null : m.getAdapter();
    }

    // ───────────────────────── log ─────────────────────────
    public synchronized void registrar(String s) {
        String hora = new SimpleDateFormat("HH:mm:ss", Locale.US).format(new Date());
        log.append(hora).append("  ").append(s).append('\n');
        if (log.length() > 20000) log.delete(0, log.length() - 15000);
    }
    public synchronized String log() { return log.toString(); }
    public synchronized void limparLog() { log.setLength(0); }

    // ───────────────────────── estado ─────────────────────────
    public boolean temBluetooth() { return adaptador != null; }
    public boolean ligado() { return adaptador != null && adaptador.isEnabled(); }

    public String salvaMac() { return prefs().getString("mac", null); }
    public String salvaNome() { return prefs().getString("nome", null); }
    public String salvaModo() { return prefs().getString("modo", null); }
    private SharedPreferences prefs() { return ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE); }
    private void salvar(BluetoothDevice d, String modo) {
        prefs().edit().putString("mac", d.getAddress()).putString("nome", nomeDe(d)).putString("modo", modo).apply();
    }
    public void esquecer() { prefs().edit().clear().apply(); desconectar(); }

    public synchronized boolean conectada() {
        if ("spp".equals(modo)) return socket != null && socket.isConnected();
        if ("ble".equals(modo)) return gatt != null && escritaBle != null;
        return false;
    }

    public static String tipoTexto(int t) {
        switch (t) {
            case BluetoothDevice.DEVICE_TYPE_CLASSIC: return "CLÁSSICO (BR/EDR)";
            case BluetoothDevice.DEVICE_TYPE_LE: return "BLE";
            case BluetoothDevice.DEVICE_TYPE_DUAL: return "DUPLO (clássico + BLE)";
            default: return "DESCONHECIDO";
        }
    }
    public static String pareamentoTexto(int b) {
        switch (b) {
            case BluetoothDevice.BOND_BONDED: return "PAREADA";
            case BluetoothDevice.BOND_BONDING: return "PAREANDO…";
            default: return "NÃO PAREADA";
        }
    }
    static String nomeDe(BluetoothDevice d) {
        try { String n = d.getName(); return n == null || n.isEmpty() ? "(sem nome)" : n; }
        catch (SecurityException e) { return "(sem permissão)"; }
    }

    public BluetoothDevice aparelho(String mac) { return adaptador.getRemoteDevice(mac); }

    // ───────────────────────── busca ─────────────────────────
    public List<BluetoothDevice> pareadas() {
        List<BluetoothDevice> out = new ArrayList<>();
        if (!ligado()) return out;
        out.addAll(adaptador.getBondedDevices());
        return out;
    }

    /** Busca clássica (aparelhos que aparecem nas configurações do Android). */
    public List<BluetoothDevice> procurar(int segundos) {
        Map<String, BluetoothDevice> achados = new LinkedHashMap<>();
        if (!ligado()) { registrar("Bluetooth desligado."); return new ArrayList<>(); }
        BroadcastReceiver r = new BroadcastReceiver() {
            @Override public void onReceive(Context c, Intent i) {
                if (BluetoothDevice.ACTION_FOUND.equals(i.getAction())) {
                    BluetoothDevice d = i.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE);
                    if (d != null && !achados.containsKey(d.getAddress())) {
                        achados.put(d.getAddress(), d);
                        registrar("Encontrada: " + nomeDe(d) + " [" + d.getAddress() + "] tipo " + tipoTexto(d.getType()));
                    }
                }
            }
        };
        ctx.registerReceiver(r, new IntentFilter(BluetoothDevice.ACTION_FOUND));
        try {
            adaptador.cancelDiscovery();
            boolean ok = adaptador.startDiscovery();
            registrar(ok ? "Procurando aparelhos por " + segundos + " s…" : "O Android recusou iniciar a busca (permissão ou localização desligada?).");
            Thread.sleep(segundos * 1000L);
        } catch (InterruptedException ignored) {
        } finally {
            adaptador.cancelDiscovery();
            try { ctx.unregisterReceiver(r); } catch (Exception ignored) {}
        }
        return new ArrayList<>(achados.values());
    }

    // ───────────────────────── diagnóstico ─────────────────────────
    /** Tudo que o Android sabe do aparelho, incluindo os serviços (SDP). */
    public String diagnosticar(BluetoothDevice d) {
        StringBuilder b = new StringBuilder();
        b.append("Nome: ").append(nomeDe(d)).append('\n');
        b.append("Endereço: ").append(d.getAddress()).append('\n');
        b.append("Tipo: ").append(tipoTexto(d.getType())).append('\n');
        b.append("Pareamento: ").append(pareamentoTexto(d.getBondState())).append('\n');
        try {
            if (d.getBluetoothClass() != null) {
                b.append("Classe: 0x").append(Integer.toHexString(d.getBluetoothClass().getDeviceClass()))
                 .append(" (maior 0x").append(Integer.toHexString(d.getBluetoothClass().getMajorDeviceClass())).append(")\n");
            }
        } catch (Exception ignored) {}
        List<String> uuids = servicosSdp(d);
        b.append("Serviços (SDP): ").append(uuids.isEmpty() ? "nenhum informado" : String.join(", ", uuids)).append('\n');
        b.append("Tem SPP (porta serial): ").append(uuids.contains(SPP.toString()) ? "SIM" : (uuids.isEmpty() ? "não informado" : "NÃO")).append('\n');
        registrar("Diagnóstico:\n" + b);
        return b.toString();
    }

    /** Pede ao aparelho a lista de serviços (SDP) e espera até 8 s. */
    public List<String> servicosSdp(BluetoothDevice d) {
        List<String> out = new ArrayList<>();
        CountDownLatch fim = new CountDownLatch(1);
        BroadcastReceiver r = new BroadcastReceiver() {
            @Override public void onReceive(Context c, Intent i) {
                BluetoothDevice x = i.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE);
                if (x == null || !x.getAddress().equals(d.getAddress())) return;
                Parcelable[] us = i.getParcelableArrayExtra(BluetoothDevice.EXTRA_UUID);
                if (us != null) for (Parcelable p : us) out.add(((ParcelUuid) p).getUuid().toString());
                fim.countDown();
            }
        };
        ctx.registerReceiver(r, new IntentFilter(BluetoothDevice.ACTION_UUID));
        try {
            ParcelUuid[] cache = d.getUuids();
            if (cache != null) for (ParcelUuid p : cache) if (!out.contains(p.getUuid().toString())) out.add(p.getUuid().toString());
            adaptador.cancelDiscovery();
            if (d.fetchUuidsWithSdp()) fim.await(8, TimeUnit.SECONDS);
        } catch (Exception e) {
            registrar("SDP falhou: " + e);
        } finally {
            try { ctx.unregisterReceiver(r); } catch (Exception ignored) {}
        }
        return out;
    }

    // ───────────────────────── pareamento ─────────────────────────
    /** Pede o pareamento e espera até 30 s (o Android pode pedir PIN na tela). */
    public boolean parear(BluetoothDevice d) {
        if (d.getBondState() == BluetoothDevice.BOND_BONDED) { registrar("Já pareada."); return true; }
        CountDownLatch fim = new CountDownLatch(1);
        final int[] ultimo = { d.getBondState() };
        BroadcastReceiver r = new BroadcastReceiver() {
            @Override public void onReceive(Context c, Intent i) {
                BluetoothDevice x = i.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE);
                if (x == null || !x.getAddress().equals(d.getAddress())) return;
                int estado = i.getIntExtra(BluetoothDevice.EXTRA_BOND_STATE, -1);
                int antes = i.getIntExtra(BluetoothDevice.EXTRA_PREVIOUS_BOND_STATE, -1);
                ultimo[0] = estado;
                registrar("Pareamento: " + pareamentoTexto(antes) + " → " + pareamentoTexto(estado));
                if (estado == BluetoothDevice.BOND_BONDED || (estado == BluetoothDevice.BOND_NONE && antes == BluetoothDevice.BOND_BONDING)) fim.countDown();
            }
        };
        ctx.registerReceiver(r, new IntentFilter(BluetoothDevice.ACTION_BOND_STATE_CHANGED));
        try {
            adaptador.cancelDiscovery();
            registrar("Pedindo pareamento com " + nomeDe(d) + "… (se pedir PIN, use o do manual da impressora)");
            if (!d.createBond()) registrar("O Android recusou começar o pareamento.");
            fim.await(30, TimeUnit.SECONDS);
        } catch (Exception e) {
            registrar("Pareamento falhou: " + e);
        } finally {
            try { ctx.unregisterReceiver(r); } catch (Exception ignored) {}
        }
        boolean ok = d.getBondState() == BluetoothDevice.BOND_BONDED;
        registrar(ok ? "Pareada com sucesso." : "Não pareou (estado final: " + pareamentoTexto(ultimo[0]) + ").");
        return ok;
    }

    // ───────────────────────── conexão ─────────────────────────
    /** Conecta (clássico primeiro; BLE se for o caso) e salva a impressora. */
    public synchronized boolean conectar(BluetoothDevice d) {
        desconectar();
        adaptador.cancelDiscovery();
        int tipo = d.getType();
        registrar("Conectando em " + nomeDe(d) + " [" + d.getAddress() + "] tipo " + tipoTexto(tipo) + ", " + pareamentoTexto(d.getBondState()));
        if (tipo != BluetoothDevice.DEVICE_TYPE_LE) {
            if (conectarSpp(d)) { salvar(d, "spp"); return true; }
        }
        if (tipo == BluetoothDevice.DEVICE_TYPE_LE || tipo == BluetoothDevice.DEVICE_TYPE_DUAL || tipo == BluetoothDevice.DEVICE_TYPE_UNKNOWN) {
            if (conectarBle(d)) { salvar(d, "ble"); return true; }
        }
        registrar("FALHOU: nenhuma forma de conexão funcionou. Copie este log e envie ao suporte.");
        return false;
    }

    /** Reconecta na impressora salva (usado antes de cada impressão). */
    public synchronized boolean garantirConexao() {
        if (conectada()) return true;
        String mac = salvaMac();
        if (mac == null) { registrar("Nenhuma impressora salva."); return false; }
        if (!ligado()) { registrar("Bluetooth desligado."); return false; }
        registrar("Reconectando na impressora salva…");
        return conectar(aparelho(mac));
    }

    private boolean conectarSpp(BluetoothDevice d) {
        String[] nomes = { "SPP segura", "SPP insegura", "RFCOMM canal 1" };
        for (int i = 0; i < nomes.length; i++) {
            BluetoothSocket s = null;
            try {
                if (i == 0) s = d.createRfcommSocketToServiceRecord(SPP);
                else if (i == 1) s = d.createInsecureRfcommSocketToServiceRecord(SPP);
                else s = (BluetoothSocket) d.getClass().getMethod("createRfcommSocket", int.class).invoke(d, 1);
                registrar("Tentativa " + (i + 1) + "/3: " + nomes[i] + "…");
                s.connect();
                socket = s;
                saida = s.getOutputStream();
                conectadaMac = d.getAddress();
                modo = "spp";
                registrar("CONECTADA por " + nomes[i] + ".");
                return true;
            } catch (Exception e) {
                Throwable c = e.getCause() != null ? e.getCause() : e;
                registrar("  falhou: " + c.getClass().getSimpleName() + ": " + c.getMessage());
                try { if (s != null) s.close(); } catch (IOException ignored) {}
            }
        }
        return false;
    }

    private boolean conectarBle(BluetoothDevice d) {
        registrar("Tentando BLE (GATT)…");
        CountDownLatch pronto = new CountDownLatch(1);
        final boolean[] ok = { false };
        BluetoothGattCallback cb = new BluetoothGattCallback() {
            @Override public void onConnectionStateChange(BluetoothGatt g, int status, int novo) {
                registrar("  GATT estado=" + novo + " status=" + status);
                if (novo == BluetoothProfile.STATE_CONNECTED) g.discoverServices();
                else if (novo == BluetoothProfile.STATE_DISCONNECTED) { escritaBle = null; pronto.countDown(); }
            }
            @Override public void onServicesDiscovered(BluetoothGatt g, int status) {
                for (BluetoothGattService s : g.getServices()) {
                    StringBuilder linha = new StringBuilder("  serviço " + s.getUuid());
                    for (BluetoothGattCharacteristic c : s.getCharacteristics()) {
                        int p = c.getProperties();
                        boolean escreve = (p & (BluetoothGattCharacteristic.PROPERTY_WRITE | BluetoothGattCharacteristic.PROPERTY_WRITE_NO_RESPONSE)) != 0;
                        linha.append("\n    car. ").append(c.getUuid()).append(escreve ? " [escrita]" : "");
                        if (escreve && escritaBle == null) escritaBle = c;
                    }
                    registrar(linha.toString());
                }
                if (escritaBle != null) {
                    // Sem MTU maior, segue com 20 bytes por bloco.
                    if (!g.requestMtu(185)) { ok[0] = true; pronto.countDown(); }
                } else { registrar("  nenhuma característica aceita escrita."); pronto.countDown(); }
            }
            @Override public void onMtuChanged(BluetoothGatt g, int mtu, int status) {
                mtuBle = Math.max(20, mtu - 3);
                registrar("  MTU " + mtu + " (bloco " + mtuBle + " bytes)");
                ok[0] = true;
                pronto.countDown();
            }
        };
        try {
            gatt = Build.VERSION.SDK_INT >= 23 ? d.connectGatt(ctx, false, cb, BluetoothDevice.TRANSPORT_LE) : d.connectGatt(ctx, false, cb);
            pronto.await(15, TimeUnit.SECONDS);
        } catch (Exception e) {
            registrar("  BLE falhou: " + e);
        }
        if (ok[0] && escritaBle != null) {
            conectadaMac = d.getAddress();
            modo = "ble";
            registrar("CONECTADA por BLE.");
            return true;
        }
        if (gatt != null) { try { gatt.close(); } catch (Exception ignored) {} gatt = null; }
        return false;
    }

    public synchronized void desconectar() {
        try { if (socket != null) socket.close(); } catch (IOException ignored) {}
        socket = null; saida = null;
        if (gatt != null) { try { gatt.disconnect(); gatt.close(); } catch (Exception ignored) {} }
        gatt = null; escritaBle = null;
        conectadaMac = null; modo = null;
    }

    // ───────────────────────── envio ─────────────────────────
    /** Envia os bytes (TSPL) na impressora salva, reconectando se precisar. */
    public synchronized void enviar(byte[] dados) throws IOException {
        if (!garantirConexao()) throw new IOException("Impressora Bluetooth não conectada. Abra o diagnóstico e toque em Conectar.");
        try {
            enviarDireto(dados);
        } catch (IOException e) {
            // Conexão caiu (impressora desligou e ligou): uma nova tentativa.
            registrar("Envio falhou (" + e.getMessage() + "); reconectando uma vez…");
            desconectar();
            if (!garantirConexao()) throw e;
            enviarDireto(dados);
        }
        registrar("Enviados " + dados.length + " bytes por " + modo.toUpperCase(Locale.ROOT) + ".");
    }

    @SuppressWarnings("deprecation")
    private void enviarDireto(byte[] dados) throws IOException {
        if ("spp".equals(modo)) {
            for (byte[] b : Tspl.blocos(dados, BLOCO_SPP)) {
                saida.write(b);
                try { Thread.sleep(PAUSA_SPP_MS); } catch (InterruptedException ignored) {}
            }
            saida.flush();
            return;
        }
        boolean semResposta = (escritaBle.getProperties() & BluetoothGattCharacteristic.PROPERTY_WRITE_NO_RESPONSE) != 0;
        escritaBle.setWriteType(semResposta ? BluetoothGattCharacteristic.WRITE_TYPE_NO_RESPONSE : BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT);
        for (byte[] b : Tspl.blocos(dados, mtuBle)) {
            escritaBle.setValue(b);
            boolean ok = false;
            for (int t = 0; t < 20 && !ok; t++) {
                ok = gatt.writeCharacteristic(escritaBle);
                if (!ok) try { Thread.sleep(15); } catch (InterruptedException ignored) {}
            }
            if (!ok) throw new IOException("BLE recusou a escrita.");
            try { Thread.sleep(semResposta ? 12 : 25); } catch (InterruptedException ignored) {}
        }
    }
}
