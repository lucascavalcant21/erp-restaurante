package br.com.hefisto.etiquetas;

import android.Manifest;
import android.app.Activity;
import android.content.Context;
import android.content.pm.PackageManager;
import android.os.Build;

import java.util.ArrayList;
import java.util.List;

/** Permissões de Bluetooth, que mudaram no Android 12. */
public final class Permissoes {
    private Permissoes() {}
    public static final int PEDIDO = 4021;

    static String[] necessarias() {
        if (Build.VERSION.SDK_INT >= 31) {
            return new String[] { Manifest.permission.BLUETOOTH_SCAN, Manifest.permission.BLUETOOTH_CONNECT };
        }
        return new String[] { Manifest.permission.ACCESS_FINE_LOCATION };
    }

    public static boolean ok(Context c) {
        if (Build.VERSION.SDK_INT < 23) return true;
        for (String p : necessarias()) if (c.checkSelfPermission(p) != PackageManager.PERMISSION_GRANTED) return false;
        return true;
    }

    public static void pedir(Activity a) {
        if (Build.VERSION.SDK_INT < 23) return;
        List<String> faltam = new ArrayList<>();
        for (String p : necessarias()) if (a.checkSelfPermission(p) != PackageManager.PERMISSION_GRANTED) faltam.add(p);
        if (!faltam.isEmpty()) a.requestPermissions(faltam.toArray(new String[0]), PEDIDO);
    }

    private static ImpressoraBluetooth unica;
    /** Uma conexão só para o app inteiro (diagnóstico e Héfisto usam a mesma). */
    public static synchronized ImpressoraBluetooth impressora(Context c) {
        if (unica == null) unica = new ImpressoraBluetooth(c);
        return unica;
    }
}
