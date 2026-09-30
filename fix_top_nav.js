const fs = require('fs');

let content = fs.readFileSync('app/components/layout/TopNavigation.js', 'utf-8');

// The header already got modified by my previous regex... wait, did it? 
// Yes, my regex replaced it. But it might have been mangled because my regex was weird.
// Let's restore the file and cleanly apply the fixes.
