package br.com.hefisto.etiquetas;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

/**
 * Etiqueta de teste em TSPL. São os MESMOS comandos do teste USB que já
 * imprime na MDK-022 pelo Héfisto (SIZE, GAP, DIRECTION, CLS, TEXT, PRINT),
 * mais o QRCODE que o Héfisto já usa nas etiquetas reais.
 */
public final class Tspl {
    private Tspl() {}

    /** 60 × 40 mm, vão (GAP) de 2 mm, com QR Code. Só ASCII (sem acento). */
    public static byte[] etiquetaTeste(String nomeAparelho) {
        String nome = somenteAscii(nomeAparelho == null ? "" : nomeAparelho);
        if (nome.length() > 24) nome = nome.substring(0, 24);
        String s =
            "SIZE 60 mm,40 mm\r\n" +
            "GAP 2 mm,0 mm\r\n" +
            "DIRECTION 1\r\n" +
            "CLS\r\n" +
            "TEXT 24,24,\"3\",0,1,1,\"HEFISTO\"\r\n" +
            "TEXT 24,80,\"3\",0,1,1,\"TESTE BLUETOOTH\"\r\n" +
            "TEXT 24,136,\"2\",0,1,1,\"MDK-022 60x40 GAP 2\"\r\n" +
            "TEXT 24,176,\"2\",0,1,1,\"" + nome + "\"\r\n" +
            "QRCODE 330,40,L,5,A,0,\"HEFISTO BLUETOOTH OK\"\r\n" +
            "PRINT 1,1\r\n";
        return s.getBytes(StandardCharsets.US_ASCII);
    }

    /** Troca acentos e qualquer caractere fora do ASCII imprimível (inclusive aspas). */
    static String somenteAscii(String s) {
        String semAcento = java.text.Normalizer.normalize(s, java.text.Normalizer.Form.NFD)
            .replaceAll("\\p{M}", "");
        StringBuilder b = new StringBuilder();
        for (char c : semAcento.toCharArray()) {
            b.append(c >= 32 && c < 127 && c != '"' ? c : ' ');
        }
        return b.toString().trim();
    }

    /** Fatia os bytes em blocos: impressora térmica engasga com tudo de uma vez. */
    public static List<byte[]> blocos(byte[] dados, int tamanho) {
        if (tamanho <= 0) throw new IllegalArgumentException("tamanho do bloco");
        List<byte[]> out = new ArrayList<>();
        for (int i = 0; i < dados.length; i += tamanho) {
            int fim = Math.min(dados.length, i + tamanho);
            byte[] b = new byte[fim - i];
            System.arraycopy(dados, i, b, 0, b.length);
            out.add(b);
        }
        return out;
    }
}
