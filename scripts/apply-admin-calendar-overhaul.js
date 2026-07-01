const fs = require('fs');
const path = require('path');

const appPath = path.join(__dirname, '..', 'src', 'App.js');
let app = fs.readFileSync(appPath, 'utf8');

if (app.includes('const ADMIN_CALENDAR_OVERHAUL = true;')) {
  console.log('Admin calendar overhaul already applied.');
  process.exit(0);
}

const startMarker = '// --- Calendar View Component ---';
const endMarker = '// --- Admin Dashboard ---';
const start = app.indexOf(startMarker);
const end = app.indexOf(endMarker);

if (start === -1 || end === -1 || end <= start) {
  throw new Error('Could not find CalendarView section to replace.');
}

const calendarReplacement = String.raw`// --- Calendar View Component ---
const ADMIN_CALENDAR_OVERHAUL = true;

const CalendarView = ({ currentDate, setCurrentDate, templates, dailyOverrides, onTaskClick, onDayClick }) => {
    const daysInMonth = getDaysInMonth(currentDate);
    const firstDay = getFirstDayOfMonth(currentDate);
    const monthName = currentDate.toLocaleString('nl-NL', { month: 'long' });
    const year = currentDate.getFullYear();
    const calendarDays = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    const emptyDays = Array.from({ length: firstDay });
    const changeMonth = (offset) => setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + offset, 1));

    const getDayTasks = (date) => {
        const dayDateStr = toDateString(date);
        const dayOverride = dailyOverrides[dayDateStr];
        return dayOverride ? dayOverride.tasks || [] : templates.filter(task => shouldTaskAppearOn(task, date));
    };

    return (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-4 sm:p-6">
            <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
                <button onClick={() => changeMonth(-1)} className="p-3 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700"><ChevronLeft/></button>
                <div className="text-center">
                    <h2 className="text-2xl font-bold text-slate-700 dark:text-slate-200 capitalize">{monthName} {year}</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Tik ergens op een dagkaart om deze dag te beheren.</p>
                </div>
                <button onClick={() => changeMonth(1)} className="p-3 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700"><ChevronRight/></button>
            </div>
            <div className="grid grid-cols-7 gap-2 text-center text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">
                {['Zo', 'Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za'].map(day => <div key={day}>{day}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-2">
                {emptyDays.map((_, i) => <div key={'empty-' + i} className="border border-transparent"></div>)}
                {calendarDays.map(day => {
                    const dayDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
                    const dayDateStr = toDateString(dayDate);
                    const dayOverride = dailyOverrides[dayDateStr];
                    const dayTasks = getDayTasks(dayDate);
                    const oneOffCount = dayTasks.filter(task => task.isOneOff === true).length;
                    const regularCount = dayTasks.filter(task => task.isOneOff !== true).length;
                    const highCount = dayTasks.filter(task => task.priority === 'high').length;
                    const totalCount = dayTasks.length;
                    const isToday = toDateString(new Date()) === dayDateStr;
                    const hasSavedSchedule = !!dayOverride;

                    return (
                        <button
                            key={day}
                            onClick={() => onDayClick && onDayClick(dayDate)}
                            className={(isToday ? 'ring-2 ring-sky-400 bg-sky-50 dark:bg-sky-900/20 ' : 'bg-white dark:bg-slate-800 ') + 'min-h-32 rounded-xl border border-slate-200 dark:border-slate-700 p-2 text-left shadow-sm hover:border-sky-400 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-sky-500 transition flex flex-col'}
                            aria-label={'Dag beheren: ' + dayDate.toLocaleDateString('nl-NL')}
                        >
                            <div className="flex items-start justify-between gap-2 mb-2">
                                <div>
                                    <span className={(isToday ? 'text-sky-600 dark:text-sky-400 ' : 'text-slate-700 dark:text-slate-200 ') + 'text-lg font-bold'}>{day}</span>
                                    {dayOverride?.dayTitle && <p className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 truncate max-w-full">{dayOverride.dayTitle}</p>}
                                </div>
                                {hasSavedSchedule ? <span className="rounded-full bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300 px-2 py-0.5 text-[10px] font-bold">Online</span> : <span className="rounded-full bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300 px-2 py-0.5 text-[10px] font-bold">Concept</span>}
                            </div>

                            <div className="grid grid-cols-2 gap-1 mb-2">
                                <div className="rounded-lg bg-indigo-50 dark:bg-indigo-900/20 px-2 py-1">
                                    <p className="text-[10px] text-indigo-500 dark:text-indigo-300 font-bold">Extra</p>
                                    <p className="text-base font-bold text-indigo-700 dark:text-indigo-200">{oneOffCount}</p>
                                </div>
                                <div className="rounded-lg bg-slate-50 dark:bg-slate-700/50 px-2 py-1">
                                    <p className="text-[10px] text-slate-500 dark:text-slate-300 font-bold">Dag</p>
                                    <p className="text-base font-bold text-slate-700 dark:text-slate-200">{regularCount}</p>
                                </div>
                            </div>

                            <div className="mt-auto space-y-1">
                                {highCount > 0 && <p className="text-[11px] font-semibold text-red-600 dark:text-red-300">{highCount} hoge prioriteit</p>}
                                <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                                    <span>{totalCount} taken totaal</span>
                                    <span className="font-bold text-sky-600 dark:text-sky-400">Beheren</span>
                                </div>
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

const CalendarTaskItem = ({ task, onClick }) => {
    const priorityStyles = { low: 'bg-green-500', medium: 'bg-yellow-500', high: 'bg-red-500' };
    return (
        <div onClick={onClick} className={(task.isOneOff ? 'bg-indigo-600' : 'bg-sky-600') + ' flex items-center gap-2 p-1 rounded text-white text-xs'}>
            <span className="truncate flex-grow">{task.text}</span>
            <div className={(priorityStyles[task.priority] || 'bg-slate-400') + ' w-2 h-2 rounded-full flex-shrink-0'}></div>
        </div>
    );
};`;

app = app.slice(0, start) + calendarReplacement.trimEnd() + '\n\n' + app.slice(end);
fs.writeFileSync(appPath, app, 'utf8');
console.log('Applied admin calendar overhaul.');
