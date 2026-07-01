const fs = require('fs');
const path = require('path');

const appPath = path.join(__dirname, '..', 'src', 'App.js');
let app = fs.readFileSync(appPath, 'utf8');

if (app.includes('const ADMIN_BUTTON_COLOR_TWEAKS = true;')) {
  console.log('Admin button color tweaks already applied.');
  process.exit(0);
}

const replaceExact = (source, from, to) => {
  if (!source.includes(from)) {
    throw new Error('Could not find expected text to replace: ' + from.slice(0, 120));
  }
  return source.replace(from, to);
};

app = replaceExact(
  app,
  'const ADMIN_CALENDAR_OVERHAUL = true;',
  'const ADMIN_CALENDAR_OVERHAUL = true;\nconst ADMIN_BUTTON_COLOR_TWEAKS = true;'
);

app = replaceExact(
  app,
  '<button onClick={() => changeMonth(-1)} className="p-3 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700"><ChevronLeft/></button>',
  '<button onClick={() => changeMonth(-1)} className="p-3 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400"><ChevronLeft/></button>'
);

app = replaceExact(
  app,
  '<button onClick={() => changeMonth(1)} className="p-3 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700"><ChevronRight/></button>',
  '<button onClick={() => changeMonth(1)} className="p-3 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400"><ChevronRight/></button>'
);

app = replaceExact(
  app,
  '<button onClick={openTemplateModalForNew} className="btn-primary flex items-center gap-2">',
  '<button onClick={openTemplateModalForNew} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600 font-semibold transition">'
);

fs.writeFileSync(appPath, app, 'utf8');
console.log('Applied admin button color tweaks.');
