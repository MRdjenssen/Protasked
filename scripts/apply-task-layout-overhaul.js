const fs = require('fs');
const path = require('path');

const appPath = path.join(__dirname, '..', 'src', 'App.js');
let app = fs.readFileSync(appPath, 'utf8');

if (app.includes('const DAILY_TASK_LAYOUT_OVERHAUL = true;') && app.includes('const DAILY_TASK_ADMIN_OVERHAUL = true;')) {
  console.log('Task layout overhaul already applied.');
  process.exit(0);
}

const replaceSection = (source, startMarker, endMarker, replacement) => {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker);
  if (start === -1 || end === -1 || end <= start) {
    throw new Error(`Could not find section between ${startMarker} and ${endMarker}`);
  }
  return source.slice(0, start) + replacement.trimEnd() + '\n\n' + source.slice(end);
};

const workerReplacement = String.raw`// --- Worker Dashboard ---
const DAILY_TASK_LAYOUT_OVERHAUL = true;

const taskPriorityClass = {
    low: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
    medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300',
    high: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300'
};

const taskTimeOfDayLabels = {
    morning: 'Ochtend',
    afternoon: 'Middag',
    night: 'Avond'
};

const taskTimeOfDayIcons = {
    morning: <Coffee size={18}/>,
    afternoon: <Sun size={18}/>,
    night: <Moon size={18}/>
};

const sortDailyTasks = (a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    const prioritySort = (priorityOrder[a.priority] ?? 1) - (priorityOrder[b.priority] ?? 1);
    if (prioritySort !== 0) return prioritySort;
    return (a.text || '').localeCompare(b.text || '');
};

const WorkerDashboard = ({ db, user, handleLogout, setError, setMessage }) => {
    const [view, setView] = useState('tasks');
    const [currentDate, setCurrentDate] = useState(new Date());
    const [dailyTasks, setDailyTasks] = useState([]);
    const [myOrders, setMyOrders] = useState([]);
    const [manuals, setManuals] = useState([]);
    const [manualCategories, setManualCategories] = useState([]);
    const [completions, setCompletions] = useState({});
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!db || !user) return;

        const selectedDateStr = toDateString(currentDate);
        setIsLoading(true);

        const unsubTasks = onSnapshot(doc(db, 'artifacts/' + appId + '/public/data/daily_tasks', selectedDateStr), (docSnap) => {
            setDailyTasks(docSnap.exists() ? docSnap.data().tasks || [] : []);
            setIsLoading(false);
        }, () => setIsLoading(false));

        const qCompletions = query(collection(db, 'artifacts/' + appId + '/users/' + user.uid + '/completions'), where('date', '==', selectedDateStr));
        const unsubCompletions = onSnapshot(qCompletions, (snapshot) => {
            const newCompletions = {};
            snapshot.docs.forEach(doc => { newCompletions[doc.id] = doc.data().completed; });
            setCompletions(newCompletions);
        });

        const ordersQuery = query(collection(db, 'artifacts/' + appId + '/public/data/orders'), where('submittedByUid', '==', user.uid));
        const unsubOrders = onSnapshot(ordersQuery, (snapshot) => {
             const fetchedOrders = snapshot.docs.map(d => ({id: d.id, ...d.data()}));
             fetchedOrders.sort((a, b) => (b.submittedAt?.toMillis() || 0) - (a.submittedAt?.toMillis() || 0));
             setMyOrders(fetchedOrders);
        });

        const unsubManuals = onSnapshot(query(collection(db, 'artifacts/' + appId + '/public/data/manuals')), (snapshot) => {
            setManuals(snapshot.docs.map(d => ({id: d.id, ...d.data()})));
        });

        const unsubCategories = onSnapshot(query(collection(db, 'artifacts/' + appId + '/public/data/manual_categories')), (snapshot) => {
            const fetchedCategories = snapshot.docs.map(d => ({id: d.id, ...d.data()}));
            fetchedCategories.sort((a, b) => a.name.localeCompare(b.name));
            setManualCategories(fetchedCategories);
        });

        return () => { unsubTasks(); unsubCompletions(); unsubOrders(); unsubManuals(); unsubCategories(); };
    }, [db, user, currentDate]);

    const toggleCompletion = async (task) => {
        if (!db || !user) return;
        const selectedDateStr = toDateString(currentDate);
        const completionDocRef = doc(db, 'artifacts/' + appId + '/users/' + user.uid + '/completions', task.id);
        try {
            const isCompleted = !!completions[task.id];
            await setDoc(completionDocRef, { completed: !isCompleted, date: selectedDateStr, taskId: task.id });
        } catch (err) { setError('Could not update task status.'); }
    };

    const changeDay = (offset) => setCurrentDate(prev => addDays(prev, offset));

    const mergedTasks = useMemo(() => dailyTasks.map(task => ({ ...task, completed: !!completions[task.id] })), [dailyTasks, completions]);
    const extraTasks = useMemo(() => mergedTasks.filter(t => t.isOneOff === true).sort(sortDailyTasks), [mergedTasks]);
    const regularTasks = useMemo(() => mergedTasks.filter(t => t.isOneOff !== true), [mergedTasks]);
    const sortedRegularTasks = useMemo(() => ({
        morning: regularTasks.filter(t => t.timeOfDay === 'morning').sort(sortDailyTasks),
        afternoon: regularTasks.filter(t => t.timeOfDay === 'afternoon').sort(sortDailyTasks),
        night: regularTasks.filter(t => t.timeOfDay === 'night').sort(sortDailyTasks),
    }), [regularTasks]);

    const allTasksEmpty = !isLoading && dailyTasks.length === 0;
    const formattedDate = currentDate.toLocaleDateString('nl-NL', { weekday: 'long', month: 'long', day: 'numeric' });
    const isToday = toDateString(currentDate) === toDateString(new Date());

    return (
        <div className="p-4 sm:p-8">
            <header className="flex justify-between items-center mb-8">
                 <div><h1 className="text-3xl font-bold text-slate-800 dark:text-white">Worker Dashboard</h1><p className="text-slate-500 dark:text-slate-400">Welkom, {user.name || user.email}</p></div>
                 <button onClick={handleLogout} className="flex items-center gap-2 px-4 py-2 bg-slate-600 text-white font-semibold rounded-lg hover:bg-slate-500 transition"><LogOut size={18}/> Logout</button>
            </header>

            <div className="mb-6 border-b border-slate-200 dark:border-slate-700">
                <nav className="flex space-x-4">
                    <button onClick={() => setView('tasks')} className={'flex items-center gap-2 px-4 py-3 font-semibold ' + (view === 'tasks' ? 'text-sky-600 border-b-2 border-sky-600' : 'text-slate-500')}><ListOrdered size={18}/> Taken</button>
                    <button onClick={() => setView('orders')} className={'flex items-center gap-2 px-4 py-3 font-semibold ' + (view === 'orders' ? 'text-sky-600 border-b-2 border-sky-600' : 'text-slate-500')}><ShoppingCart size={18}/> Orders</button>
                    <button onClick={() => setView('manuals')} className={'flex items-center gap-2 px-4 py-3 font-semibold ' + (view === 'manuals' ? 'text-sky-600 border-b-2 border-sky-600' : 'text-slate-500')}><BookOpen size={18}/> Manuals</button>
                </nav>
            </div>

            {view === 'tasks' && (
                <>
                    <div className="flex flex-wrap justify-between items-center gap-4 mb-4">
                        <div>
                            <p className="text-sm font-semibold uppercase tracking-wide text-sky-600 dark:text-sky-400">{isToday ? 'Vandaag' : 'Gekozen dag'}</p>
                            <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Taken - <span className="font-normal text-slate-500 capitalize">{formattedDate}</span></h2>
                        </div>
                        <div className="flex items-center gap-2">
                            <button onClick={() => changeDay(-1)} className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400"><ChevronLeft/></button>
                            <button onClick={() => changeDay(1)} className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400"><ChevronRight/></button>
                        </div>
                    </div>
                    {isLoading ? <div className="p-8 text-center">Taken laden...</div> : allTasksEmpty ? (
                        <div className="text-center p-12 bg-white dark:bg-slate-800 rounded-xl shadow-lg">
                            <CalendarIcon size={48} className="mx-auto text-slate-400"/>
                            <h2 className="mt-4 text-xl font-semibold text-slate-700 dark:text-slate-200">Geen taken ingepland</h2>
                            <p className="mt-2 text-slate-500">De admin heeft voor deze dag nog geen planning aangemaakt.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-indigo-100 dark:border-indigo-900/40 p-4 sm:p-6">
                                <TaskSection title="Taken voor vandaag" subtitle="Extra losse taken voor deze datum" tasks={extraTasks} icon={<Flag size={20}/>} onToggle={toggleCompletion} emptyText="Geen extra losse taken." highlight />
                            </div>
                            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-4 sm:p-6 space-y-6">
                                <div>
                                    <h2 className="text-xl font-bold text-slate-700 dark:text-slate-200">Taken voor iedere dag</h2>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">Vaste taken blijven per dagdeel gegroepeerd.</p>
                                </div>
                                <TaskSection title="Ochtend" tasks={sortedRegularTasks.morning} icon={<Coffee size={20}/>} onToggle={toggleCompletion} emptyText="Geen vaste ochtendtaken." />
                                <TaskSection title="Middag" tasks={sortedRegularTasks.afternoon} icon={<Sun size={20}/>} onToggle={toggleCompletion} emptyText="Geen vaste middagtaken." />
                                <TaskSection title="Avond" tasks={sortedRegularTasks.night} icon={<Moon size={20}/>} onToggle={toggleCompletion} emptyText="Geen vaste avondtaken." />
                            </div>
                        </div>
                    )}
                </>
            )}

            {view === 'orders' && <OrderSubmissionPanel db={db} user={user} myOrders={myOrders} setError={setError} setMessage={setMessage} />}
            {view === 'manuals' && <ManualsViewPanel manuals={manuals} categories={manualCategories} />}
        </div>
    );
};

const TaskSection = ({ title, subtitle, tasks, icon, onToggle, emptyText, highlight = false }) => (
    <section>
        <div className="flex items-start gap-3 mb-3 px-1">
            <div className={highlight ? 'mt-1 text-indigo-600 dark:text-indigo-400' : 'mt-1 text-slate-500 dark:text-slate-400'}>{icon}</div>
            <div>
                <h2 className="text-lg font-bold text-slate-700 dark:text-slate-200">{title}</h2>
                {subtitle && <p className="text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}
            </div>
        </div>
        <div className="divide-y divide-slate-200 dark:divide-slate-700 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
            {tasks.length > 0 ? tasks.map(task => (
                <div key={task.id} className={(highlight ? 'bg-indigo-50/60 dark:bg-indigo-900/10 ' : 'bg-white dark:bg-slate-800 ') + 'flex items-center p-3 group'}>
                    <button onClick={() => onToggle(task)} className="mr-4 flex-shrink-0">
                        {task.completed ? <CheckCircle className="text-green-500" size={24} /> : <Circle className="text-slate-300 dark:text-slate-600 group-hover:text-sky-500" size={24} />}
                    </button>
                    <div className="flex-grow min-w-0">
                        <p className={'text-slate-800 dark:text-slate-200 break-words ' + (task.completed ? 'line-through text-slate-400 dark:text-slate-500' : '')}>{task.text}</p>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-1">
                            <span className={'flex items-center gap-1 px-2 py-0.5 rounded-full ' + (taskPriorityClass[task.priority] || '')}><Flag size={12} /> {task.priority || 'medium'}</span>
                        </div>
                    </div>
                </div>
            )) : <p className="text-center py-8 px-4 text-slate-500 bg-white dark:bg-slate-800">{emptyText || 'Geen taken.'}</p>}
        </div>
    </section>
);`;

const dailyReplacement = String.raw`// --- Daily Task Editor Modal ---
const DAILY_TASK_ADMIN_OVERHAUL = true;

const DailyTaskEditorModal = ({ db, user, selectedDate, closeModal, setError }) => {
    const [dailyData, setDailyData] = useState({ tasks: [], dayTitle: '' });
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [editingTaskId, setEditingTaskId] = useState(null);
    const selectedDateStr = toDateString(selectedDate);

    useEffect(() => {
        const dailyTasksDocRef = doc(db, 'artifacts/' + appId + '/public/data/daily_tasks', selectedDateStr);
        const unsub = onSnapshot(dailyTasksDocRef, (docSnap) => {
            if (docSnap.exists()) {
                setDailyData({ tasks: docSnap.data().tasks || [], dayTitle: docSnap.data().dayTitle || '' });
            }
            setIsLoading(false);
        }, () => setIsLoading(false));
        return () => unsub();
    }, [db, selectedDateStr]);

    const oneOffTasks = useMemo(() => dailyData.tasks.filter(task => task.isOneOff === true), [dailyData.tasks]);
    const regularTasks = useMemo(() => dailyData.tasks.filter(task => task.isOneOff !== true), [dailyData.tasks]);
    const groupedRegularTasks = useMemo(() => ({
        morning: regularTasks.filter(task => task.timeOfDay === 'morning'),
        afternoon: regularTasks.filter(task => task.timeOfDay === 'afternoon'),
        night: regularTasks.filter(task => task.timeOfDay === 'night'),
    }), [regularTasks]);

    const handleAddOneOffTask = () => {
        const newTask = { id: crypto.randomUUID(), text: '', priority: 'medium', isOneOff: true };
        setDailyData(prev => ({ ...prev, tasks: [...prev.tasks, newTask] }));
        setEditingTaskId(newTask.id);
    };

    const handleUpdateTask = (updatedTask) => {
        setDailyData(prev => ({ ...prev, tasks: prev.tasks.map(t => t.id === updatedTask.id ? updatedTask : t) }));
    };

    const handleDeleteTask = (taskId) => {
        setDailyData(prev => ({ ...prev, tasks: prev.tasks.filter(t => t.id !== taskId) }));
    };

    const handleTitleChange = (e) => {
        setDailyData(prev => ({ ...prev, dayTitle: e.target.value }));
    };

    const handleSaveChanges = async () => {
        setIsSaving(true);
        const dailyTasksDocRef = doc(db, 'artifacts/' + appId + '/public/data/daily_tasks', selectedDateStr);
        try {
            await setDoc(dailyTasksDocRef, { ...dailyData, lastUpdatedAt: Timestamp.now(), updatedBy: user.uid }, { merge: true });
            closeModal();
        } catch (err) {
            setError('Failed to save tasks for ' + selectedDateStr + '.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-5xl flex flex-col" style={{height: '90vh'}}>
                <header className="flex justify-between items-center p-4 border-b dark:border-slate-700 flex-shrink-0">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800 dark:text-white">Dag beheren</h2>
                        <p className="text-slate-500 dark:text-slate-400 capitalize">{selectedDate.toLocaleDateString('nl-NL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                    </div>
                    <button onClick={closeModal} className="p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700"><X className="text-slate-500"/></button>
                </header>
                <main className="p-6 space-y-5 overflow-y-auto flex-grow">
                    {isLoading ? <p>Laden...</p> : (
                        <>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Dag titel (optioneel)</label>
                                <input type="text" value={dailyData.dayTitle} onChange={handleTitleChange} placeholder="Bijv. Onderhoudsdag" className="w-full input-style"/>
                            </div>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <section className="rounded-xl border border-indigo-100 dark:border-indigo-900/40 bg-indigo-50/50 dark:bg-indigo-900/10 p-4">
                                    <div className="flex items-start justify-between gap-3 mb-4">
                                        <div>
                                            <h3 className="text-lg font-bold text-slate-800 dark:text-white">Extra losse taken</h3>
                                            <p className="text-sm text-slate-500 dark:text-slate-400">Eenmalige taken voor deze specifieke dag. Geen dagdeel nodig.</p>
                                        </div>
                                        <button onClick={handleAddOneOffTask} className="btn-primary flex items-center gap-2 flex-shrink-0"><Plus size={16}/> Losse taak</button>
                                    </div>
                                    <div className="space-y-2">
                                        {oneOffTasks.length > 0 ? oneOffTasks.map(task => (
                                            <EditableTaskItem
                                                key={task.id}
                                                task={task}
                                                onUpdate={handleUpdateTask}
                                                onDelete={handleDeleteTask}
                                                isEditing={editingTaskId === task.id}
                                                setEditing={setEditingTaskId}
                                            />
                                        )) : <p className="text-center py-8 text-slate-500 bg-white/70 dark:bg-slate-800/50 rounded-lg">Nog geen extra losse taken.</p>}
                                    </div>
                                </section>
                                <section className="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                                    <div className="mb-4">
                                        <h3 className="text-lg font-bold text-slate-800 dark:text-white">Vaste taken voor deze dag</h3>
                                        <p className="text-sm text-slate-500 dark:text-slate-400">Deze taken blijven gegroepeerd per dagdeel.</p>
                                    </div>
                                    {['morning', 'afternoon', 'night'].map(timeOfDay => (
                                        <div key={timeOfDay} className="mb-5 last:mb-0">
                                            <h4 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700 pb-2 mb-2">
                                                {taskTimeOfDayIcons[timeOfDay]} {taskTimeOfDayLabels[timeOfDay]}
                                            </h4>
                                            <div className="space-y-2">
                                                {groupedRegularTasks[timeOfDay].length > 0 ? groupedRegularTasks[timeOfDay].map(task => (
                                                    <EditableTaskItem
                                                        key={task.id}
                                                        task={task}
                                                        onUpdate={handleUpdateTask}
                                                        onDelete={handleDeleteTask}
                                                        isEditing={editingTaskId === task.id}
                                                        setEditing={setEditingTaskId}
                                                    />
                                                )) : <p className="text-sm text-slate-400 py-3">Geen vaste taken voor {taskTimeOfDayLabels[timeOfDay].toLowerCase()}.</p>}
                                            </div>
                                        </div>
                                    ))}
                                </section>
                            </div>
                        </>
                    )}
                </main>
                <footer className="flex justify-end items-center p-4 border-t dark:border-slate-700 gap-4 flex-shrink-0">
                     <button onClick={closeModal} className="btn-secondary">Annuleren</button>
                     <button onClick={handleSaveChanges} disabled={isSaving} className="btn-primary flex items-center gap-2"><Save size={16}/> {isSaving ? 'Opslaan...' : 'Wijzigingen opslaan'}</button>
                </footer>
            </div>
        </div>
    );
};

const EditableTaskItem = ({ task, onUpdate, onDelete, isEditing, setEditing }) => {
    const [text, setText] = useState(task.text);
    const [priority, setPriority] = useState(task.priority || 'medium');
    const [timeOfDay, setTimeOfDay] = useState(task.timeOfDay || 'morning');

    const handleSave = () => {
        const updatedTask = task.isOneOff
            ? { ...task, text, priority, isOneOff: true }
            : { ...task, text, priority, timeOfDay };
        onUpdate(updatedTask);
        setEditing(null);
    };

    const handleCancel = () => {
        if (task.isOneOff && task.text === '') {
            onDelete(task.id);
        }
        setEditing(null);
    };

    if (isEditing) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-2 p-2 bg-white dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600 mb-2">
                <input type="text" value={text} onChange={e => setText(e.target.value)} placeholder="Taakomschrijving..." className="md:col-span-5 input-style"/>
                <select value={priority} onChange={e => setPriority(e.target.value)} className="md:col-span-3 input-style"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select>
                {!task.isOneOff && <select value={timeOfDay} onChange={e => setTimeOfDay(e.target.value)} className="md:col-span-3 input-style"><option value="morning">Ochtend</option><option value="afternoon">Middag</option><option value="night">Avond</option></select>}
                <div className="md:col-span-1 flex items-center justify-end gap-1">
                    <button onClick={handleSave} className="p-2 text-green-600 hover:bg-green-100 dark:hover:bg-green-900/50 rounded-full"><Save size={18}/></button>
                    <button onClick={handleCancel} className="p-2 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-full"><Ban size={18}/></button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex items-center gap-2 p-2 group bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-lg border border-slate-100 dark:border-slate-700 mb-2">
            <div className="flex-grow min-w-0">
                <p className="text-slate-800 dark:text-slate-200 break-words">{task.text || 'Nieuwe taak zonder tekst'}</p>
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-1">
                    <span className={'flex items-center gap-1 px-2 py-0.5 rounded-full ' + (taskPriorityClass[priority] || '')}><Flag size={12} /> {priority}</span>
                    {!task.isOneOff && <span className="flex items-center gap-1">{taskTimeOfDayIcons[timeOfDay]} {taskTimeOfDayLabels[timeOfDay]}</span>}
                    {task.isOneOff && <span className="text-indigo-600 dark:text-indigo-300 font-semibold">Losse taak</span>}
                </div>
            </div>
            <div className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex items-center gap-1">
                <button onClick={() => setEditing(task.id)} className="p-2 text-sky-600 hover:bg-sky-100 dark:hover:bg-sky-900/50 rounded-full"><Edit size={16}/></button>
                <button onClick={() => onDelete(task.id)} className="p-2 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-full"><Trash2 size={16}/></button>
            </div>
        </div>
    );
};`;

app = replaceSection(app, '// --- Worker Dashboard ---', '// --- Task Template Creation/Edit Modal ---', workerReplacement);
app = replaceSection(app, '// --- Daily Task Editor Modal ---', '// --- Order Management Panel (Admin) ---', dailyReplacement);
fs.writeFileSync(appPath, app, 'utf8');
console.log('Applied Protasked task layout overhaul.');
