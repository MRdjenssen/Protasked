const fs = require('fs');
const path = require('path');

const appPath = path.join(__dirname, '..', 'src', 'App.js');
let app = fs.readFileSync(appPath, 'utf8');

if (app.includes('const ADMIN_EXTRA_COMPLETION_COUNTER = true;')) {
  console.log('Admin extra completion counter already applied.');
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
  'const ADMIN_CALENDAR_OVERHAUL = true;\nconst ADMIN_EXTRA_COMPLETION_COUNTER = true;'
);

app = replaceExact(
  app,
  'const CalendarView = ({ currentDate, setCurrentDate, templates, dailyOverrides, onTaskClick, onDayClick }) => {',
  'const CalendarView = ({ currentDate, setCurrentDate, templates, dailyOverrides, extraTaskCompletionStats = {}, onTaskClick, onDayClick }) => {'
);

app = replaceExact(
  app,
  '                    const highCount = dayTasks.filter(task => task.priority === \'high\').length;',
  '                    const extraCompletedCount = dayTasks.filter(task => task.isOneOff === true && extraTaskCompletionStats[dayDateStr]?.[task.id]).length;'
);

app = replaceExact(
  app,
  "                                {highCount > 0 && <p className=\"text-[11px] font-semibold text-red-600 dark:text-red-300\">{highCount} hoge prioriteit</p>}",
  "                                {oneOffCount > 0 && <p className=\"text-[11px] font-semibold text-indigo-600 dark:text-indigo-300\">{extraCompletedCount} van {oneOffCount} extra afgevinkt</p>}"
);

app = replaceExact(
  app,
  '    const [workers, setWorkers] = useState([]);',
  '    const [workers, setWorkers] = useState([]);\n    const [extraTaskCompletionStats, setExtraTaskCompletionStats] = useState({});'
);

app = replaceExact(
  app,
  `    }, [db, setError]);

    const openTemplateModalForNew = () => { setEditingTask(null); setIsTemplateModalOpen(true); };`,
  `    }, [db, setError]);

    useEffect(() => {
        if (!db || workers.length === 0) {
            setExtraTaskCompletionStats({});
            return undefined;
        }

        const monthStart = toDateString(new Date(currentDate.getFullYear(), currentDate.getMonth(), 1));
        const monthEnd = toDateString(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0));
        const workerStats = {};

        const mergeAndSetStats = () => {
            const mergedStats = {};
            Object.values(workerStats).forEach(workerDates => {
                Object.entries(workerDates).forEach(([date, tasks]) => {
                    if (!mergedStats[date]) mergedStats[date] = {};
                    Object.assign(mergedStats[date], tasks);
                });
            });
            setExtraTaskCompletionStats(mergedStats);
        };

        const unsubscribers = workers.map(worker => {
            const completionsQuery = query(
                collection(db, 'artifacts/' + appId + '/users/' + worker.id + '/completions'),
                where('date', '>=', monthStart),
                where('date', '<=', monthEnd)
            );

            return onSnapshot(completionsQuery, (snapshot) => {
                workerStats[worker.id] = {};
                snapshot.docs.forEach(completionDoc => {
                    const data = completionDoc.data();
                    if (data.completed && data.date && data.taskId) {
                        if (!workerStats[worker.id][data.date]) workerStats[worker.id][data.date] = {};
                        workerStats[worker.id][data.date][data.taskId] = true;
                    }
                });
                mergeAndSetStats();
            });
        });

        return () => unsubscribers.forEach(unsubscribe => unsubscribe());
    }, [db, workers, currentDate]);

    const openTemplateModalForNew = () => { setEditingTask(null); setIsTemplateModalOpen(true); };`
);

app = replaceExact(
  app,
  '<CalendarView currentDate={currentDate} setCurrentDate={setCurrentDate} templates={templates} dailyOverrides={dailyOverrides} onTaskClick={openTemplateModalForEdit} onDayClick={handleDayClick} />',
  '<CalendarView currentDate={currentDate} setCurrentDate={setCurrentDate} templates={templates} dailyOverrides={dailyOverrides} extraTaskCompletionStats={extraTaskCompletionStats} onTaskClick={openTemplateModalForEdit} onDayClick={handleDayClick} />'
);

fs.writeFileSync(appPath, app, 'utf8');
console.log('Applied admin extra completion counter.');
