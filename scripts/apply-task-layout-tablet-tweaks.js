const fs = require('fs');
const path = require('path');

const appPath = path.join(__dirname, '..', 'src', 'App.js');
let app = fs.readFileSync(appPath, 'utf8');

if (app.includes('const DAILY_TASK_TABLET_TWEAKS = true;')) {
  console.log('Task layout tablet tweaks already applied.');
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
  'const DAILY_TASK_LAYOUT_OVERHAUL = true;',
  'const DAILY_TASK_LAYOUT_OVERHAUL = true;\nconst DAILY_TASK_TABLET_TWEAKS = true;'
);

app = replaceExact(
  app,
  '<div className="grid grid-cols-1 xl:grid-cols-2 gap-6">',
  '<div className="grid grid-cols-2 gap-4 lg:gap-6">'
);

app = replaceExact(
  app,
  '<TaskSection title="Ochtend" tasks={sortedRegularTasks.morning} icon={<Coffee size={20}/>} onToggle={toggleCompletion} emptyText="Geen vaste ochtendtaken." />',
  '<TaskSection title="Ochtend" tasks={sortedRegularTasks.morning} icon={<Coffee size={20}/>} emptyText="Geen vaste ochtendtaken." showCompletion={false} showPriority={false} />'
);

app = replaceExact(
  app,
  '<TaskSection title="Middag" tasks={sortedRegularTasks.afternoon} icon={<Sun size={20}/>} onToggle={toggleCompletion} emptyText="Geen vaste middagtaken." />',
  '<TaskSection title="Middag" tasks={sortedRegularTasks.afternoon} icon={<Sun size={20}/>} emptyText="Geen vaste middagtaken." showCompletion={false} showPriority={false} />'
);

app = replaceExact(
  app,
  '<TaskSection title="Avond" tasks={sortedRegularTasks.night} icon={<Moon size={20}/>} onToggle={toggleCompletion} emptyText="Geen vaste avondtaken." />',
  '<TaskSection title="Avond" tasks={sortedRegularTasks.night} icon={<Moon size={20}/>} emptyText="Geen vaste avondtaken." showCompletion={false} showPriority={false} />'
);

app = replaceExact(
  app,
  'const TaskSection = ({ title, subtitle, tasks, icon, onToggle, emptyText, highlight = false }) => (',
  'const TaskSection = ({ title, subtitle, tasks, icon, onToggle, emptyText, highlight = false, showCompletion = true, showPriority = true }) => ('
);

app = replaceExact(
  app,
  `                    <button onClick={() => onToggle(task)} className="mr-4 flex-shrink-0">
                        {task.completed ? <CheckCircle className="text-green-500" size={24} /> : <Circle className="text-slate-300 dark:text-slate-600 group-hover:text-sky-500" size={24} />}
                    </button>`,
  `                    {showCompletion && onToggle && (
                        <button onClick={() => onToggle(task)} className="mr-4 flex-shrink-0">
                            {task.completed ? <CheckCircle className="text-green-500" size={24} /> : <Circle className="text-slate-300 dark:text-slate-600 group-hover:text-sky-500" size={24} />}
                        </button>
                    )}`
);

app = replaceExact(
  app,
  `<p className={'text-slate-800 dark:text-slate-200 break-words ' + (task.completed ? 'line-through text-slate-400 dark:text-slate-500' : '')}>{task.text}</p>`,
  `<p className={'text-slate-800 dark:text-slate-200 break-words ' + (showCompletion && task.completed ? 'line-through text-slate-400 dark:text-slate-500' : '')}>{task.text}</p>`
);

app = replaceExact(
  app,
  `                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-1">
                            <span className={'flex items-center gap-1 px-2 py-0.5 rounded-full ' + (taskPriorityClass[task.priority] || '')}><Flag size={12} /> {task.priority || 'medium'}</span>
                        </div>`,
  `                        {showPriority && (
                            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-1">
                                <span className={'flex items-center gap-1 px-2 py-0.5 rounded-full ' + (taskPriorityClass[task.priority] || '')}><Flag size={12} /> {task.priority || 'medium'}</span>
                            </div>
                        )}`
);

fs.writeFileSync(appPath, app, 'utf8');
console.log('Applied Protasked tablet task layout tweaks.');
