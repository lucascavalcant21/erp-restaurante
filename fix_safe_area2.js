const fs = require('fs');

let content = fs.readFileSync('app/components/layout/TopNavigation.js', 'utf-8');

// Fix Header Safe Area
// Original: className="bg-zinc-950 border-b border-zinc-900 text-white sticky top-0 z-50 shadow-sm h-16 flex items-center justify-between px-4 lg:px-8 shrink-0 w-full relative"
// New:      className="bg-zinc-950 border-b border-zinc-900 text-white sticky top-0 z-50 shadow-sm w-full relative" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
// And add inner wrapper for height
content = content.replace(
  '<header className="bg-zinc-950 border-b border-zinc-900 text-white sticky top-0 z-50 shadow-sm h-16 flex items-center justify-between px-4 lg:px-8 shrink-0 w-full relative">',
  '<header className="bg-zinc-950 border-b border-zinc-900 text-white sticky top-0 z-50 shadow-sm w-full relative" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>\n        <div className="h-16 flex items-center justify-between px-4 lg:px-8 w-full">'
);

// Close the inner wrapper
const closeHeaderMatch = content.lastIndexOf('</header>');
if (closeHeaderMatch !== -1) {
  content = content.substring(0, closeHeaderMatch) + '        </div>\n      </header>' + content.substring(closeHeaderMatch + 9);
}

// Fix Drawer Safe Area
// Original: <div className="flex items-center justify-between p-4 border-b border-zinc-900">
// New:      <div className="flex items-center justify-between p-4 border-b border-zinc-900" style={{ marginTop: "env(safe-area-inset-top, 0px)" }}>
content = content.replace(
  '<div className="flex items-center justify-between p-4 border-b border-zinc-900">',
  '<div className="flex items-center justify-between p-4 border-b border-zinc-900" style={{ marginTop: "env(safe-area-inset-top, 0px)" }}>'
);

fs.writeFileSync('app/components/layout/TopNavigation.js', content);
console.log('TopNavigation fixed for Safe Area');
