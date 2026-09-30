const fs = require('fs');

let content = fs.readFileSync('app/components/layout/TopNavigation.js', 'utf-8');

// Change the header wrapper to use padding top for safe area, and keep the inner content 64px tall.
content = content.replace(
  '<header className="bg-zinc-950 border-b border-zinc-900 text-white sticky top-0 z-50 shadow-sm h-16 flex items-center justify-between px-4 lg:px-8 shrink-0 w-full relative">',
  '<header className="bg-zinc-950 border-b border-zinc-900 text-white sticky top-0 z-50 shadow-sm w-full relative" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>\n        <div className="h-16 flex items-center justify-between px-4 lg:px-8 w-full">'
);

// We need to close the new div. Let's find the closing </header> and insert </div> before it.
const closingHeaderIndex = content.lastIndexOf('</header>');
if (closingHeaderIndex !== -1) {
  content = content.substring(0, closingHeaderIndex) + '        </div>\n      </header>' + content.substring(closingHeaderIndex + 9);
}

// Since mobile Drawer needs to be below safe area, let's also fix the Drawer's top.
// The drawer uses "top-16" or similar.
// Actually the Drawer uses: className="fixed inset-y-0 left-0 w-[280px] bg-zinc-950 ... z-40 top-16"
// The drawer should start after the header. Let's just remove top-16 and add pt-16?
// If the Drawer is "inset-y-0", it will cover the safe area. 
// "top-16" was used to put it below the header. But the header is now 16 + safe-area.
// So the drawer should also be pushed down. But if we just use z-40, the header (z-50) is above it.
// If the Drawer uses `pt-[calc(4rem+env(safe-area-inset-top))]`, it will work perfectly!

content = content.replace(/top-16/g, ''); // Remove hardcoded top-16
content = content.replace('bg-zinc-950 border-r border-zinc-900', 'bg-zinc-950 border-r border-zinc-900" style={{ paddingTop: "calc(4rem + env(safe-area-inset-top, 0px))" }} className="');

// Fix the classes that I messed up with the regex
content = content.replace('className="fixed inset-y-0 left-0 w-[280px] bg-zinc-950 border-r border-zinc-900" style={{ paddingTop: "calc(4rem + env(safe-area-inset-top, 0px))" }} className=" text-white z-40 transform transition-transform duration-300 ease-in-out', 
'className="fixed inset-y-0 left-0 w-[280px] bg-zinc-950 border-r border-zinc-900 text-white z-40 transform transition-transform duration-300 ease-in-out" style={{ paddingTop: "calc(4rem + env(safe-area-inset-top, 0px))" }}');

fs.writeFileSync('app/components/layout/TopNavigation.js', content);
console.log("TopNavigation Safe Area fixed!");
