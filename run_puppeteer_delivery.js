const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  page.on('pageerror', err => {
    console.log('PAGE ERROR:', err.toString());
  });

  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('CONSOLE ERROR:', msg.text());
    }
  });

  console.log('Navegando para o app em producao...');
  await page.goto('https://erp-restaurante-sand.vercel.app/login');

  await page.evaluate(() => {
    localStorage.setItem('hefisto_auth_v3', JSON.stringify({
      id: 'mock-id',
      nome: 'Lucas Mock',
      papel: 'admin',
      unidade_id: 'central'
    }));
  });

  console.log('Indo para o delivery...');
  await page.goto('https://erp-restaurante-sand.vercel.app/dashboard/delivery');
  
  await new Promise(r => setTimeout(r, 4000));
  
  console.log('Pronto, test finalizado na producao Delivery.');
  await browser.close();
})();
