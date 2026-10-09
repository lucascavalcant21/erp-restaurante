const fs = require('fs');
const path = require('path');

function checkFile(filePath) {
    const text = fs.readFileSync(filePath, 'utf8');
    if (text.includes('Loader2')) {
        const importMatch = text.match(/import\s*\{[^}]*Loader2[^}]*\}\s*from\s*['"]lucide-react['"]/);
        if (!importMatch) {
            console.log('MISSING Loader2 import in:', filePath);
        }
    }
}

function walk(dir) {
    fs.readdirSync(dir).forEach(file => {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            walk(fullPath);
        } else if (fullPath.endsWith('.js') || fullPath.endsWith('.jsx')) {
            checkFile(fullPath);
        }
    });
}

walk('app');
