package br.com.hefisto.etiquetas;

import android.content.Context;

final class BuildInfo {
    private BuildInfo() {}
    static String versao(Context c) {
        try { return c.getPackageManager().getPackageInfo(c.getPackageName(), 0).versionName; }
        catch (Exception e) { return "?"; }
    }
}
