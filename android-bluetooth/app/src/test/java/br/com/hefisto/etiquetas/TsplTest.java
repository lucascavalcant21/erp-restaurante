package br.com.hefisto.etiquetas;

import static org.junit.Assert.*;

import java.nio.charset.StandardCharsets;
import java.util.List;
import org.junit.Test;

public class TsplTest {
    @Test
    public void etiquetaTeste60x40Gap2ComQr() {
        String s = new String(Tspl.etiquetaTeste("MDK-022"), StandardCharsets.US_ASCII);
        assertTrue(s.startsWith("SIZE 60 mm,40 mm\r\nGAP 2 mm,0 mm\r\n"));
        assertTrue(s.contains("\r\nQRCODE "));
        assertTrue(s.endsWith("PRINT 1,1\r\n"));
        for (char c : s.toCharArray()) assertTrue("só ASCII", c < 128);
    }

    @Test
    public void nomeComAcentoEAspasNaoQuebraOComando() {
        String s = new String(Tspl.etiquetaTeste("Impressão \"Cozinha\""), StandardCharsets.US_ASCII);
        assertTrue(s.contains("\"Impressao  Cozinha\"\r\n"));
    }

    @Test
    public void blocosCobremTudoSemPerder() {
        byte[] d = new byte[1000];
        for (int i = 0; i < d.length; i++) d[i] = (byte) i;
        List<byte[]> b = Tspl.blocos(d, 180);
        assertEquals(6, b.size());
        assertEquals(100, b.get(5).length);
        int n = 0;
        for (byte[] x : b) for (byte y : x) assertEquals(d[n++], y);
        assertEquals(1000, n);
    }

    @Test
    public void ponteSoParaOHefisto() {
        assertTrue(Origens.permitida("https://app.hefisto.com.br/dashboard/operacao/etiquetas"));
        assertTrue(Origens.permitida(Origens.PREVIEW_TESTE));
        assertFalse(Origens.permitida("http://app.hefisto.com.br/"));
        assertFalse(Origens.permitida("https://app.hefisto.com.br.golpe.com/"));
        assertFalse(Origens.permitida("https://outro-lucas-cavalcante.vercel.app/"));
        assertFalse(Origens.permitida("https://erp-restaurante-x.vercel.app/"));
        assertFalse(Origens.permitida(null));
    }
}
