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

  // Adicionando um token e simulando sessao
  await page.evaluate(() => {
    localStorage.setItem('hefisto_auth_v3', JSON.stringify({
      id: 'mock-id',
      nome: 'Lucas Mock',
      papel: 'admin',
      unidade_id: 'central'
    }));
  });

  console.log('Indo para o dashboard...');
  await page.goto('https://erp-restaurante-sand.vercel.app/dashboard');
  
  await new Promise(r => setTimeout(r, 2000));
  
  console.log('Tentando abrir o Mega Menu...');
  try {
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const buscarBtn = btns.find(b => b.textContent.includes('Buscar') || b.textContent.includes('Hefisto'));
      if (buscarBtn) buscarBtn.click();
      else console.log('Botao Buscar nao encontrado');
    });
    
    await new Promise(r => setTimeout(r, 3000));
  } catch (e) {
    console.error('Falhou ao clicar:', e.message);
  }

  console.log('Pronto, test finalizado na producao.');
  await browser.close();
})();
