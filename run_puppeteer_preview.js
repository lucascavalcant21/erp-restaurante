const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  const errors = [];

  page.on('pageerror', err => {
    errors.push('PAGE ERROR: ' + err.toString());
  });

  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push('CONSOLE ERROR: ' + msg.text());
    }
  });

  page.on('requestfailed', req => {
    errors.push('REQUEST FAILED: ' + req.url() + ' - ' + req.failure().errorText);
  });

  console.log('Navegando para o delivery da preview...');
  // Usar o preview novo que não tem cache
  await page.goto('https://erp-restaurante-nk6xmm2yt-lucas-cavalcante.vercel.app/login');

  await page.evaluate(() => {
    localStorage.setItem('hefisto_auth_v3', JSON.stringify({
      id: 'mock-id',
      nome: 'Lucas Mock',
      papel: 'admin',
      unidade_id: 'central'
    }));
  });

  await page.goto('https://erp-restaurante-nk6xmm2yt-lucas-cavalcante.vercel.app/dashboard/delivery');
  
  await new Promise(r => setTimeout(r, 6000));

  const html = await page.evaluate(() => document.body.innerHTML.substring(0, 3000));
  console.log('HTML da pagina:');
  console.log(html);

  console.log('\n=== ERROS DETECTADOS ===');
  if (errors.length === 0) {
    console.log('Nenhum erro JavaScript detectado!');
  } else {
    errors.forEach(e => console.log(e));
  }

  await browser.close();
})();
