const fs = require('fs');
const path = require('path');

function searchSW(dir) {
  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of items) {
    if (['node_modules', '.next', '.git', 'scratch'].includes(item.name)) continue;
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      searchSW(fullPath);
    } else {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes('serviceWorker') || content.includes('sw.js') || content.includes('workbox')) {
        console.log(`SERVICE WORKER REF IN: ${fullPath}`);
      }
    }
  }
}

searchSW('.');
