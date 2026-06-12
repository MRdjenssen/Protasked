import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import {
    getAuth,
    onAuthStateChanged,
    signOut,
    signInWithEmailAndPassword
} from 'firebase/auth';
import {
    getFirestore,
    collection,
    doc,
    onSnapshot,
    setDoc,
    getDoc,
    updateDoc,
    deleteDoc,
    setLogLevel,
    query,
    where,
    addDoc,
    Timestamp
} from 'firebase/firestore';
import { CheckCircle, Circle, Plus, Trash2, Edit, LogOut, Flag, X, AlertTriangle, ChevronLeft, ChevronRight, Calendar as CalendarIcon, Sun, Coffee, Moon, Mail, KeyRound, Save, Ban, ShoppingCart, ListOrdered, BookOpen } from 'lucide-react';

// --- Firebase Configuration ---
const firebaseConfig = {
  apiKey: "AIzaSyDn7jLT-4miPWcFyFLIFDgsc2vGD1i9Qpc",
  authDomain: "protasked.firebaseapp.com",
  projectId: "protasked",
  storageBucket: "protasked.appspot.com",
  messagingSenderId: "468782595662",
  appId: "1:468782595662:web:ee1716d54ddc18a40e4d1f"
};


const appId = firebaseConfig.appId;

// --- Date Helpers ---
const getDaysInMonth = (date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
const getFirstDayOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay();
const toDateString = (date) => date.toISOString().split('T')[0];
const addDays = (date, days) => {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
};

// --- Helper Function ---
const shouldTaskAppearOn = (task, date) => {
    const startDate = new Date(task.startDate + 'T00:00:00');
    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);

    if (checkDate < startDate) return false;

    switch(task.repeatRule?.type) {
        case 'daily': return true;
        case 'bi-daily': {
            const diffTime = Math.abs(checkDate - startDate);
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            return diffDays % 2 === 0;
        }
        case 'weekly': return checkDate.getDay() === startDate.getDay();
        case 'bi-weekly': {
            const diffTime = Math.abs(checkDate - startDate);
            const diffWeeks = Math.floor(diffTime / (1000 * 60 * 60 * 24 * 7));
            return checkDate.getDay() === startDate.getDay() && diffWeeks % 2 === 0;
        }
        case 'monthly': return checkDate.getDate() === startDate.getDate();
        case 'bi-monthly': {
            const monthDiff = (checkDate.getFullYear() - startDate.getFullYear()) * 12 + checkDate.getMonth() - startDate.getMonth();
            return checkDate.getDate() === startDate.getDate() && monthDiff % 2 === 0;
        }
        case 'yearly': return checkDate.getDate() === startDate.getDate() && checkDate.getMonth() === startDate.getMonth();
        case 'bi-yearly': {
            const yearDiff = checkDate.getFullYear() - startDate.getFullYear();
            return checkDate.getDate() === startDate.getDate() && checkDate.getMonth() === startDate.getMonth() && yearDiff % 2 === 0;
        }
        default: return toDateString(checkDate) === toDateString(startDate);
    }
};

// --- Main App Component ---
export default function App() {
    const [db, setDb] = useState(null);
    const [auth, setAuth] = useState(null);
    const [user, setUser] = useState(undefined);
    const [error, setError] = useState(null);
    const [message, setMessage] = useState(null);

    useEffect(() => {
        if (message) {
            const timer = setTimeout(() => setMessage(null), 5000);
            return () => clearTimeout(timer);
        }
    }, [message]);

    useEffect(() => {
        try {
            if (!firebaseConfig.apiKey) {
                setError("Firebase configuration is missing or invalid.");
                setUser(null);
                return;
            }
            const app = initializeApp(firebaseConfig);
            const firestoreInstance = getFirestore(app);
            const authInstance = getAuth(app);
            setDb(firestoreInstance);
            setAuth(authInstance);
            setLogLevel('error');

            const unsubscribe = onAuthStateChanged(authInstance, (firebaseUser) => {
                if (firebaseUser && !firebaseUser.isAnonymous) {
                    const userDocRef = doc(firestoreInstance, `artifacts/${appId}/users/${firebaseUser.uid}`);
                    const unsubscribeUser = onSnapshot(userDocRef, (docSnap) => {
                        if (docSnap.exists()) {
                            setUser({ uid: firebaseUser.uid, email: firebaseUser.email, ...docSnap.data() });
                        } else {
                            setUser({ uid: firebaseUser.uid, email: firebaseUser.email, role: 'unconfigured' });
                        }
                    }, () => setUser(null));
                    return () => unsubscribeUser();
                } else {
                    setUser(null);
                }
            });
            return () => unsubscribe();
        } catch (e) {
            setError("Could not connect to services. Check your Firebase configuration.");
            setUser(null);
        }
    }, []);

    const handleLogout = async () => {
        if (auth) await signOut(auth).catch(() => setError("Failed to log out."));
    };

    if (user === undefined) {
        return <div className="bg-slate-900 min-h-screen flex items-center justify-center text-white">Initializing...</div>;
    }

    const renderContent = () => {
        if (!user) {
            return <AuthScreen auth={auth} setError={setError} />;
        }
        switch (user.role) {
            case 'admin':
                return <AdminDashboard db={db} user={user} handleLogout={handleLogout} setError={setError} setMessage={setMessage} />;
            case 'worker':
                return <WorkerDashboard db={db} user={user} handleLogout={handleLogout} setError={setError} setMessage={setMessage} />;
            case 'unconfigured':
                return <UnconfiguredUserScreen user={user} handleLogout={handleLogout} />;
            default:
                return <AuthScreen auth={auth} setError={setError} />;
        }
    };

    return (
        <div className="bg-slate-100 dark:bg-slate-900 min-h-screen font-sans">
            {renderContent()}
            {message && <div className="fixed bottom-16 right-4 bg-green-500 text-white p-4 rounded-lg shadow-lg flex items-center gap-3 animate-fade-in-up"><CheckCircle/><span>{message}</span><button onClick={() => setMessage(null)} className="p-1 rounded-full hover:bg-green-600"><X size={18}/></button></div>}
            {error && <div className="fixed bottom-4 right-4 bg-red-500 text-white p-4 rounded-lg shadow-lg flex items-center gap-3 animate-fade-in-up"><AlertTriangle/><span>{error}</span><button onClick={() => setError(null)} className="p-1 rounded-full hover:bg-red-600"><X size={18}/></button></div>}
            <style>{`@keyframes fade-in-up { 0% { opacity: 0; transform: translateY(10px); } 100% { opacity: 1; transform: translateY(0); } } .animate-fade-in-up { animation: fade-in-up 0.3s ease-out; }`}</style>
        </div>
    );
}

// --- Authentication Screen (Login Only) ---
const AuthScreen = ({ auth, setError }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!auth) { setError("Auth service not available."); return; }
        setIsLoading(true);
        setError(null);
        try {
            await signInWithEmailAndPassword(auth, email, password);
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
            <div className="w-full max-w-md p-8 space-y-8 bg-white dark:bg-slate-800 rounded-xl shadow-lg">
                <div><h1 className="text-3xl font-bold text-center text-slate-800 dark:text-white">ProTasked</h1><p className="text-center text-slate-500 dark:text-slate-400">Sign in to your account</p></div>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="relative"><Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20}/><input type="email" placeholder="Email address" required value={email} onChange={e => setEmail(e.target.value)} className="w-full pl-10 p-3 rounded-lg bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-500"/></div>
                    <div className="relative"><KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20}/><input type="password" placeholder="Password" required value={password} onChange={e => setPassword(e.target.value)} className="w-full pl-10 p-3 rounded-lg bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-500"/></div>
                    <button type="submit" disabled={isLoading} className="w-full py-3 px-4 bg-sky-600 text-white font-semibold rounded-lg shadow-md hover:bg-sky-500 transition disabled:bg-sky-400">{isLoading ? 'Processing...' : 'Login'}</button>
                </form>
            </div>
        </div>
    );
};

// --- Unconfigured User Screen ---
const UnconfiguredUserScreen = ({ user, handleLogout }) => {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 text-white">
            <div className="text-center p-8 bg-slate-800/50 rounded-lg shadow-xl">
                <h1 className="text-3xl font-bold mb-4">Account Not Configured</h1>
                <p className="text-slate-300 mb-2">You have successfully logged in as:</p>
                <p className="font-mono bg-slate-700 px-4 py-2 rounded-md inline-block mb-6">{user.email}</p>
                <p className="text-slate-300 max-w-md mx-auto mb-8">However, your account does not have a role assigned. Please contact an administrator to have them set up your role in the Firestore database.</p>
                <button onClick={handleLogout} className="flex items-center justify-center gap-3 w-64 mx-auto px-6 py-4 bg-red-600 text-white font-semibold rounded-lg shadow-lg hover:bg-red-500 transition"><LogOut size={18} /> Logout</button>
            </div>
        </div>
    );
};

// --- Calendar View Component ---
const CalendarView = ({ currentDate, setCurrentDate, templates, dailyOverrides, onTaskClick, onDayClick }) => {
    const daysInMonth = getDaysInMonth(currentDate);
    const firstDay = getFirstDayOfMonth(currentDate);
    const monthName = currentDate.toLocaleString('default', { month: 'long' });
    const year = currentDate.getFullYear();
    const calendarDays = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    const emptyDays = Array.from({ length: firstDay });
    const changeMonth = (offset) => setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + offset, 1));

    return (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-4 sm:p-6">
            <div className="flex justify-between items-center mb-4">
                <button onClick={() => changeMonth(-1)} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400"><ChevronLeft className="text-slate-400" /></button>
                <h2 className="text-xl font-bold text-slate-700 dark:text-slate-200">{monthName} {year}</h2>
                <button onClick={() => changeMonth(1)} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400"><ChevronRight className="text-slate-400" /></button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-xs text-slate-500 dark:text-slate-400 mb-2">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => <div key={day}>{day}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
                {emptyDays.map((_, i) => <div key={`empty-${i}`} className="border border-transparent"></div>)}
                {calendarDays.map(day => {
                    const dayDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
                    const dayDateStr = toDateString(dayDate);
                    const dayOverride = dailyOverrides[dayDateStr];
                    const dayTasks = dayOverride ? dayOverride.tasks : templates.filter(task => shouldTaskAppearOn(task, dayDate));
                    const isToday = toDateString(new Date()) === dayDateStr;

                    return (
                        <div key={day} className={`relative border border-slate-200 dark:border-slate-700/50 p-2 h-32 flex flex-col overflow-y-auto ${isToday ? 'bg-sky-50 dark:bg-sky-900/20' : ''}`}>
                            {onDayClick && <button onClick={() => onDayClick(dayDate)} className="absolute inset-0 z-0 focus:outline-none focus:ring-2 focus:ring-sky-500 rounded-sm" aria-label={`Manage tasks for ${dayDate.toLocaleDateString()}`}></button>}
                            <span className={`relative z-10 font-bold ${isToday ? 'text-sky-600 dark:text-sky-400' : 'text-slate-600 dark:text-slate-300'}`}>{day}</span>
                            {dayOverride?.dayTitle && <div className="text-xs mt-1 text-center font-semibold text-indigo-600 dark:text-indigo-400 truncate z-10 relative">{dayOverride.dayTitle}</div>}
                            {dayOverride && !dayOverride.dayTitle && <div className="absolute top-1 right-1 w-2 h-2 bg-blue-500 rounded-full z-10" title="This day has a saved schedule"></div>}
                            <div className="relative z-10 mt-1 space-y-1">
                                {dayTasks.map(task => <CalendarTaskItem key={task.id} task={task} onClick={onTaskClick && !task.isOneOff ? (e) => { e.stopPropagation(); onTaskClick(task); } : null} />)}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const CalendarTaskItem = ({ task, onClick }) => {
    const priorityStyles = { low: 'bg-green-500', medium: 'bg-yellow-500', high: 'bg-red-500' };
    return (
        <div onClick={onClick} className={`flex items-center gap-2 p-1 rounded text-white text-xs ${task.isOneOff ? 'bg-indigo-600' : 'bg-sky-600'} ${onClick ? 'cursor-pointer' : ''}`}>
            <span className="truncate flex-grow">{task.text}</span>
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${priorityStyles[task.priority]}`}></div>
        </div>
    );
};

// --- Admin Dashboard ---
const AdminDashboard = ({ db, user, handleLogout, setError, setMessage }) => {
    const [view, setView] = useState('calendar');
    const [templates, setTemplates] = useState([]);
    const [dailyOverrides, setDailyOverrides] = useState({});
    const [orders, setOrders] = useState([]);
    const [manuals, setManuals] = useState([]);
    const [manualCategories, setManualCategories] = useState([]);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
    const [isDailyModalOpen, setIsDailyModalOpen] = useState(false);
    const [isManualModalOpen, setIsManualModalOpen] = useState(false);
    const [editingTask, setEditingTask] = useState(null);
    const [editingManual, setEditingManual] = useState(null);
    const [selectedDate, setSelectedDate] = useState(null);
    const [workers, setWorkers] = useState([]);

    useEffect(() => {
        if (!db) return;

        const unsubTemplates = onSnapshot(doc(db, `artifacts/${appId}/public/data/task_templates_config`, 'all_templates'), (docSnap) => {
            setTemplates(docSnap.exists() ? docSnap.data().templates || [] : []);
        }, () => setError("Failed to load task templates."));

        const unsubDaily = onSnapshot(collection(db, `artifacts/${appId}/public/data/daily_tasks`), (snapshot) => {
            const overrides = {};
            snapshot.forEach(doc => { overrides[doc.id] = doc.data(); });
            setDailyOverrides(overrides);
        }, () => setError("Failed to load daily task overrides."));

        const unsubWorkers = onSnapshot(query(collection(db, `artifacts/${appId}/users`), where("role", "==", "worker")), (snapshot) => {
            setWorkers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        const unsubOrders = onSnapshot(query(collection(db, `artifacts/${appId}/public/data/orders`)), (snapshot) => {
            const fetchedOrders = snapshot.docs.map(d => ({id: d.id, ...d.data()}));
            fetchedOrders.sort((a, b) => (a.status === 'pending' ? -1 : 1) - (b.status === 'pending' ? -1 : 1) || (b.submittedAt?.toMillis() || 0) - (a.submittedAt?.toMillis() || 0));
            setOrders(fetchedOrders);
        }, () => setError("Failed to load orders."));

        const unsubManuals = onSnapshot(query(collection(db, `artifacts/${appId}/public/data/manuals`)), (snapshot) => {
            const fetchedManuals = snapshot.docs.map(d => ({id: d.id, ...d.data()}));
            setManuals(fetchedManuals);
        }, () => setError("Failed to load manuals."));

        const unsubCategories = onSnapshot(query(collection(db, `artifacts/${appId}/public/data/manual_categories`)), (snapshot) => {
            const fetchedCategories = snapshot.docs.map(d => ({id: d.id, ...d.data()}));
            fetchedCategories.sort((a, b) => a.name.localeCompare(b.name));
            setManualCategories(fetchedCategories);
        }, () => setError("Failed to load manual categories."));

        return () => { unsubTemplates(); unsubDaily(); unsubWorkers(); unsubOrders(); unsubManuals(); unsubCategories(); };
    }, [db, setError]);

    const openTemplateModalForNew = () => { setEditingTask(null); setIsTemplateModalOpen(true); };
    const openTemplateModalForEdit = (task) => { setEditingTask(task); setIsTemplateModalOpen(true); };
    const openManualModalForNew = () => { setEditingManual(null); setIsManualModalOpen(true); };
    const openManualModalForEdit = (manual) => { setEditingManual(manual); setIsManualModalOpen(true); };

    const handleDayClick = async (date) => {
        const today = new Date();
        const twoMonthsFromNow = new Date(today.getFullYear(), today.getMonth() + 2, today.getDate());

        if (date > twoMonthsFromNow) {
            setError("Cannot generate tasks more than two months in advance.");
            return;
        }

        const dateStr = toDateString(date);
        const dailyTasksDocRef = doc(db, `artifacts/${appId}/public/data/daily_tasks`, dateStr);
        try {
            const docSnap = await getDoc(dailyTasksDocRef);
            if (!docSnap.exists()) {
                const tasksForDay = templates.filter(template => shouldTaskAppearOn(template, date));
                await setDoc(dailyTasksDocRef, { tasks: tasksForDay, createdAt: Timestamp.now(), createdBy: user.uid });
                setMessage(`Schedule for ${dateStr} auto-generated.`);
            }
        } catch (err) { setError("Failed to auto-generate schedule."); return; }
        setSelectedDate(date);
        setIsDailyModalOpen(true);
    };

    return (
        <div className="p-4 sm:p-8">
            <header className="flex flex-wrap gap-4 justify-between items-center mb-8">
                <div><h1 className="text-3xl font-bold text-slate-800 dark:text-white">Admin Dashboard</h1></div>
                <div className="flex items-center gap-4">
                    <button onClick={handleLogout} className="flex items-center gap-2 px-4 py-2 bg-slate-600 text-white font-semibold rounded-lg hover:bg-slate-500 transition"><LogOut size={18}/> Logout</button>
                </div>
            </header>

            <div className="mb-6 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                <nav className="flex space-x-4">
                    <button onClick={() => setView('calendar')} className={`flex items-center gap-2 px-4 py-3 font-semibold ${view === 'calendar' ? 'text-sky-600 border-b-2 border-sky-600' : 'text-slate-500'}`}><CalendarIcon size={18}/> Schedules</button>
                    <button onClick={() => setView('orders')} className={`flex items-center gap-2 px-4 py-3 font-semibold ${view === 'orders' ? 'text-sky-600 border-b-2 border-sky-600' : 'text-slate-500'}`}><ShoppingCart size={18}/> Orders</button>
                    <button onClick={() => setView('manuals')} className={`flex items-center gap-2 px-4 py-3 font-semibold ${view === 'manuals' ? 'text-sky-600 border-b-2 border-sky-600' : 'text-slate-500'}`}><BookOpen size={18}/> Manuals</button>
                </nav>
                {view === 'calendar' && (
                    <button onClick={openTemplateModalForNew} className="btn-primary flex items-center gap-2">
                        <Plus size={16}/> New Task Template
                    </button>
                )}
            </div>

            {view === 'calendar' && <CalendarView currentDate={currentDate} setCurrentDate={setCurrentDate} templates={templates} dailyOverrides={dailyOverrides} onTaskClick={openTemplateModalForEdit} onDayClick={handleDayClick} />}
            {view === 'orders' && <OrderManagementPanel db={db} user={user} orders={orders} workers={workers} setError={setError} setMessage={setMessage} />}
            {view === 'manuals' && <ManualManagementPanel db={db} manuals={manuals} categories={manualCategories} onNew={openManualModalForNew} onEdit={openManualModalForEdit} setError={setError} setMessage={setMessage} />}

            {isTemplateModalOpen && <TaskTemplateModal db={db} user={user} task={editingTask} closeModal={() => setIsTemplateModalOpen(false)} setError={setError} setMessage={setMessage} />}
            {isDailyModalOpen && <DailyTaskEditorModal db={db} user={user} selectedDate={selectedDate} closeModal={() => setIsDailyModalOpen(false)} setError={setError} />}
            {isManualModalOpen && <ManualModal db={db} user={user} manual={editingManual} categories={manualCategories} closeModal={() => setIsManualModalOpen(false)} setError={setError} setMessage={setMessage} />}
        </div>
    );
};

// --- Worker Dashboard ---
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

        const unsubTasks = onSnapshot(doc(db, `artifacts/${appId}/public/data/daily_tasks`, selectedDateStr), (docSnap) => {
            setDailyTasks(docSnap.exists() ? docSnap.data().tasks || [] : []);
            setIsLoading(false);
        }, () => setIsLoading(false));

        const qCompletions = query(collection(db, `artifacts/${appId}/users/${user.uid}/completions`), where("date", "==", selectedDateStr));
        const unsubCompletions = onSnapshot(qCompletions, (snapshot) => {
            const newCompletions = {};
            snapshot.docs.forEach(doc => { newCompletions[doc.id] = doc.data().completed; });
            setCompletions(newCompletions);
        });

        const ordersQuery = query(collection(db, `artifacts/${appId}/public/data/orders`), where("submittedByUid", "==", user.uid));
        const unsubOrders = onSnapshot(ordersQuery, (snapshot) => {
             const fetchedOrders = snapshot.docs.map(d => ({id: d.id, ...d.data()}));
             fetchedOrders.sort((a, b) => (b.submittedAt?.toMillis() || 0) - (a.submittedAt?.toMillis() || 0));
             setMyOrders(fetchedOrders);
        });

        const unsubManuals = onSnapshot(query(collection(db, `artifacts/${appId}/public/data/manuals`)), (snapshot) => {
            setManuals(snapshot.docs.map(d => ({id: d.id, ...d.data()})));
        });

        const unsubCategories = onSnapshot(query(collection(db, `artifacts/${appId}/public/data/manual_categories`)), (snapshot) => {
            const fetchedCategories = snapshot.docs.map(d => ({id: d.id, ...d.data()}));
            fetchedCategories.sort((a, b) => a.name.localeCompare(b.name));
            setManualCategories(fetchedCategories);
        });

        return () => { unsubTasks(); unsubCompletions(); unsubOrders(); unsubManuals(); unsubCategories(); };
    }, [db, user, currentDate]);

    const toggleCompletion = async (task) => {
        if (!db || !user) return;
        const selectedDateStr = toDateString(currentDate);
        const completionDocRef = doc(db, `artifacts/${appId}/users/${user.uid}/completions`, task.id);
        try {
            const isCompleted = !!completions[task.id];
            await setDoc(completionDocRef, { completed: !isCompleted, date: selectedDateStr, taskId: task.id });
        } catch (err) { setError("Could not update task status."); }
    };

    const changeDay = (offset) => setCurrentDate(prev => addDays(prev, offset));

    const mergedTasks = useMemo(() => dailyTasks.map(task => ({ ...task, completed: !!completions[task.id] })), [dailyTasks, completions]);
    const sortedTasks = useMemo(() => {
        const sorter = (a, b) => (a.priority === 'high' ? -1 : 1) - (b.priority === 'high' ? -1 : 1) || (a.priority === 'medium' ? -1 : 1) - (b.priority === 'medium' ? -1 : 1);
        return {
            morning: mergedTasks.filter(t => t.timeOfDay === 'morning').sort(sorter),
            afternoon: mergedTasks.filter(t => t.timeOfDay === 'afternoon').sort(sorter),
            night: mergedTasks.filter(t => t.timeOfDay === 'night').sort(sorter),
        };
    }, [mergedTasks]);

    const allTasksEmpty = !isLoading && dailyTasks.length === 0;
    const formattedDate = currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    const isToday = toDateString(currentDate) === toDateString(new Date());

    return (
        <div className="p-4 sm:p-8">
            <header className="flex justify-between items-center mb-8">
                 <div><h1 className="text-3xl font-bold text-slate-800 dark:text-white">Worker Dashboard</h1><p className="text-slate-500 dark:text-slate-400">Welcome, {user.name || user.email}</p></div>
                 <button onClick={handleLogout} className="flex items-center gap-2 px-4 py-2 bg-slate-600 text-white font-semibold rounded-lg hover:bg-slate-500 transition"><LogOut size={18}/> Logout</button>
            </header>

            <div className="mb-6 border-b border-slate-200 dark:border-slate-700">
                <nav className="flex space-x-4">
                    <button onClick={() => setView('tasks')} className={`flex items-center gap-2 px-4 py-3 font-semibold ${view === 'tasks' ? 'text-sky-600 border-b-2 border-sky-600' : 'text-slate-500'}`}><ListOrdered size={18}/> Daily Tasks</button>
                    <button onClick={() => setView('orders')} className={`flex items-center gap-2 px-4 py-3 font-semibold ${view === 'orders' ? 'text-sky-600 border-b-2 border-sky-600' : 'text-slate-500'}`}><ShoppingCart size={18}/> Orders</button>
                    <button onClick={() => setView('manuals')} className={`flex items-center gap-2 px-4 py-3 font-semibold ${view === 'manuals' ? 'text-sky-600 border-b-2 border-sky-600' : 'text-slate-500'}`}><BookOpen size={18}/> Manuals</button>
                </nav>
            </div>

            {view === 'tasks' && (
                <>
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-2xl font-bold text-slate-800 dark:text-white">{isToday ? "Today's Tasks" : "Tasks"} - <span className="font-normal text-slate-500">{formattedDate}</span></h2>
                        <div className="flex items-center gap-2">
                            <button onClick={() => changeDay(-1)} className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400"><ChevronLeft/></button>
                            <button onClick={() => changeDay(1)} className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400"><ChevronRight/></button>
                        </div>
                    </div>
                    {isLoading ? <div className="p-8 text-center">Loading tasks...</div> : allTasksEmpty ? (
                        <div className="text-center p-12 bg-white dark:bg-slate-800 rounded-xl shadow-lg">
                            <CalendarIcon size={48} className="mx-auto text-slate-400"/>
                            <h2 className="mt-4 text-xl font-semibold text-slate-700 dark:text-slate-200">No Tasks Scheduled</h2>
                            <p className="mt-2 text-slate-500">The admin has not created a schedule for this day yet.</p>
                        </div>
                    ) : (
                        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-2 sm:p-6 space-y-6">
                            <TaskSection title="Morning" tasks={sortedTasks.morning} icon={<Coffee size={20}/>} onToggle={toggleCompletion} />
                            <TaskSection title="Afternoon" tasks={sortedTasks.afternoon} icon={<Sun size={20}/>} onToggle={toggleCompletion} />
                            <TaskSection title="Night" tasks={sortedTasks.night} icon={<Moon size={20}/>} onToggle={toggleCompletion} />
                        </div>
                    )}
                </>
            )}

            {view === 'orders' && <OrderSubmissionPanel db={db} user={user} myOrders={myOrders} setError={setError} setMessage={setMessage} />}
            {view === 'manuals' && <ManualsViewPanel manuals={manuals} categories={manualCategories} />}
        </div>
    );
};

const TaskSection = ({ title, tasks, icon, onToggle }) => (
    <div>
        <h2 className="flex items-center gap-3 text-xl font-bold text-slate-700 dark:text-slate-200 mb-4 px-4 py-2 border-b-2 border-slate-200 dark:border-slate-700">{icon} {title}</h2>
        <div className="divide-y divide-slate-200 dark:divide-slate-700">
            {tasks.length > 0 ? tasks.map(task => (
                <div key={task.id} className="flex items-center p-4 group">
                    <button onClick={() => onToggle(task)} className="mr-4 flex-shrink-0">
                        {task.completed ? <CheckCircle className="text-green-500" size={24} /> : <Circle className="text-slate-300 dark:text-slate-600 group-hover:text-sky-500" size={24} />}
                    </button>
                    <div className="flex-grow">
                        <p className={`text-slate-800 dark:text-slate-200 ${task.completed ? 'line-through text-slate-400 dark:text-slate-500' : ''}`}>{task.text}</p>
                        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-1">
                            <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full ${ {low: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300', medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300', high: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300'}[task.priority] || ''}`}><Flag size={12} /> {task.priority}</span>
                        </div>
                    </div>
                </div>
            )) : <p className="text-center py-8 px-4 text-slate-500">No tasks for {title.toLowerCase()}.</p>}
        </div>
    </div>
);

// --- Task Template Creation/Edit Modal ---
const TaskTemplateModal = ({ db, user, task, closeModal, setError, setMessage }) => {
    const [text, setText] = useState(task?.text || '');
    const [priority, setPriority] = useState(task?.priority || 'medium');
    const [startDate, setStartDate] = useState(task?.startDate?.split('T')[0] || new Date().toISOString().split('T')[0]);
    const [repeatType, setRepeatType] = useState(task?.repeatRule?.type || 'none');
    const [timeOfDay, setTimeOfDay] = useState(task?.timeOfDay || 'morning');
    const [isSaving, setIsSaving] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!db || !user) return;
        setIsSaving(true);
        const templatesDocRef = doc(db, `artifacts/${appId}/public/data/task_templates_config`, 'all_templates');
        try {
            const docSnap = await getDoc(templatesDocRef);
            const currentTemplates = docSnap.exists() ? docSnap.data().templates || [] : [];
            let newTemplates;
            if (task) {
                newTemplates = currentTemplates.map(t => t.id === task.id ? { ...t, text, priority, startDate, repeatRule: { type: repeatType }, timeOfDay } : t);
            } else {
                const newTemplate = { id: crypto.randomUUID(), text, priority, startDate, repeatRule: { type: repeatType }, timeOfDay, createdBy: user.uid };
                newTemplates = [...currentTemplates, newTemplate];
            }
            await setDoc(templatesDocRef, { templates: newTemplates });
            setMessage(task ? 'Task template updated successfully!' : 'New task template created!');
            closeModal();
        } catch (err) {
            setError("Could not save the task template.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!db || !task) return;
        setIsSaving(true);
        const templatesDocRef = doc(db, `artifacts/${appId}/public/data/task_templates_config`, 'all_templates');
        try {
            const docSnap = await getDoc(templatesDocRef);
            if (docSnap.exists()) {
                const newTemplates = (docSnap.data().templates || []).filter(t => t.id !== task.id);
                await setDoc(templatesDocRef, { templates: newTemplates });
                setMessage('Task template deleted.');
            }
            closeModal();
        } catch (err) {
            setError("Could not delete the task template.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-md">
                <div className="flex justify-between items-center p-4 border-b dark:border-slate-700"><h2 className="text-xl font-bold text-slate-800 dark:text-white">{task ? 'Edit Task Template' : 'Create New Task Template'}</h2><button onClick={closeModal} className="p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700"><X className="text-slate-500"/></button></div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div><label htmlFor="text" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Task Description</label><input type="text" id="text" value={text} onChange={e => setText(e.target.value)} required className="w-full input-style"/></div>
                    <div className="flex gap-4">
                        <div className="flex-1"><label htmlFor="startDate" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Start Date</label><input type="date" id="startDate" value={startDate} onChange={e => setStartDate(e.target.value)} required className="w-full input-style"/></div>
                        <div className="flex-1"><label htmlFor="priority" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Priority</label><select id="priority" value={priority} onChange={e => setPriority(e.target.value)} className="w-full input-style"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></div>
                    </div>
                    <div className="flex gap-4">
                        <div className="flex-1"><label htmlFor="repeatType" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Repeat</label><select id="repeatType" value={repeatType} onChange={e => setRepeatType(e.target.value)} className="w-full input-style"><option value="none">Does not repeat</option><option value="daily">Daily</option><option value="bi-daily">Bi-Daily</option><option value="weekly">Weekly</option><option value="bi-weekly">Bi-Weekly</option><option value="monthly">Monthly</option><option value="bi-monthly">Bi-Monthly</option><option value="yearly">Yearly</option><option value="bi-yearly">Bi-Yearly</option></select></div>
                        <div className="flex-1"><label htmlFor="timeOfDay" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Time of Day</label><select id="timeOfDay" value={timeOfDay} onChange={e => setTimeOfDay(e.target.value)} className="w-full input-style"><option value="morning">Morning</option><option value="afternoon">Afternoon</option><option value="night">Night</option></select></div>
                    </div>
                    <div className="flex justify-between items-center pt-4">
                        <div>
                            {task && !confirmDelete && <button type="button" onClick={() => setConfirmDelete(true)} disabled={isSaving} className="btn-danger flex items-center gap-2"><Trash2 size={16} /> Delete</button>}
                            {task && confirmDelete && <div className="flex gap-2"><button type="button" onClick={handleDelete} disabled={isSaving} className="btn-danger">Confirm</button><button type="button" onClick={() => setConfirmDelete(false)} disabled={isSaving} className="btn-secondary">Cancel</button></div>}
                        </div>
                        <div className="flex gap-3"><button type="button" onClick={closeModal} className="btn-secondary">Cancel</button><button type="submit" disabled={isSaving} className="btn-primary">{isSaving ? 'Saving...' : (task ? 'Save Changes' : 'Create Template')}</button></div>
                    </div>
                </form>
            </div>
            <style>{`.input-style { padding: 0.5rem 0.75rem; background-color: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 0.375rem; outline: none; } .dark .input-style { background-color: #334155; border-color: #475569; color: white; } .input-style:focus { ring: 2px; ring-color: #0ea5e9; } .btn-primary { padding: 0.5rem 1rem; background-color: #0ea5e9; color: white; border-radius: 0.375rem; font-weight: 600; transition: background-color 0.2s; } .btn-primary:hover { background-color: #0284c7; } .btn-primary:disabled { background-color: #93c5fd; cursor: not-allowed; } .btn-secondary { padding: 0.5rem 1rem; background-color: #e2e8f0; color: #1e293b; border-radius: 0.375rem; font-weight: 600; transition: background-color 0.2s; } .dark .btn-secondary { background-color: #475569; color: #e2e8f0; } .dark .btn-secondary:hover { background-color: #64748b; } .btn-danger { padding: 0.5rem 1rem; background-color: #ef4444; color: white; border-radius: 0.375rem; font-weight: 600; transition: background-color 0.2s; } .btn-danger:hover { background-color: #dc2626; } .btn-danger:disabled { background-color: #fca5a5; cursor: not-allowed; }`}</style>
        </div>
    );
};

// --- Daily Task Editor Modal ---
const DailyTaskEditorModal = ({ db, user, selectedDate, closeModal, setError }) => {
    const [dailyData, setDailyData] = useState({ tasks: [], dayTitle: '' });
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [editingTaskId, setEditingTaskId] = useState(null);

    const selectedDateStr = toDateString(selectedDate);

    useEffect(() => {
        const dailyTasksDocRef = doc(db, `artifacts/${appId}/public/data/daily_tasks`, selectedDateStr);
        const unsub = onSnapshot(dailyTasksDocRef, (docSnap) => {
            if (docSnap.exists()) {
                setDailyData({ tasks: docSnap.data().tasks || [], dayTitle: docSnap.data().dayTitle || '' });
            }
            setIsLoading(false);
        }, () => setIsLoading(false));
        return () => unsub();
    }, [db, selectedDateStr]);

    const handleAddTask = () => {
        const newTask = { id: crypto.randomUUID(), text: '', priority: 'medium', timeOfDay: 'morning', isOneOff: true };
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
        const dailyTasksDocRef = doc(db, `artifacts/${appId}/public/data/daily_tasks`, selectedDateStr);
        try {
            await setDoc(dailyTasksDocRef, { ...dailyData, lastUpdatedAt: Timestamp.now(), updatedBy: user.uid }, { merge: true });
            closeModal();
        } catch (err) {
            setError(`Failed to save tasks for ${selectedDateStr}.`);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-2xl flex flex-col" style={{height: '90vh'}}>
                <header className="flex justify-between items-center p-4 border-b dark:border-slate-700 flex-shrink-0">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800 dark:text-white">Manage Day</h2>
                        <p className="text-slate-500 dark:text-slate-400">{selectedDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                    </div>
                    <button onClick={closeModal} className="p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700"><X className="text-slate-500"/></button>
                </header>
                <main className="p-6 space-y-4 overflow-y-auto flex-grow">
                    {isLoading ? <p>Loading...</p> : (
                        <>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Day Title (Optional)</label>
                                <input type="text" value={dailyData.dayTitle} onChange={handleTitleChange} placeholder="e.g., Maintenance Day" className="w-full input-style"/>
                            </div>
                            <h3 className="text-lg font-semibold pt-4">Tasks for this day</h3>
                            <div>
                                {dailyData.tasks.map(task => (
                                    <EditableTaskItem
                                        key={task.id}
                                        task={task}
                                        onUpdate={handleUpdateTask}
                                        onDelete={handleDeleteTask}
                                        isEditing={editingTaskId === task.id}
                                        setEditing={setEditingTaskId}
                                    />
                                ))}
                            </div>
                        </>
                    )}
                     <button onClick={handleAddTask} className="btn-secondary flex items-center gap-2 mt-4"><Plus size={16}/> Add One-Off Task</button>
                </main>
                <footer className="flex justify-end items-center p-4 border-t dark:border-slate-700 gap-4 flex-shrink-0">
                     <button onClick={closeModal} className="btn-secondary">Cancel</button>
                     <button onClick={handleSaveChanges} disabled={isSaving} className="btn-primary flex items-center gap-2"><Save size={16}/> {isSaving ? 'Saving...' : 'Save Changes'}</button>
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
        onUpdate({ ...task, text, priority, timeOfDay });
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
            <div className="flex items-center gap-2 p-2 bg-slate-100 dark:bg-slate-700/50 rounded-lg mb-2">
                <input type="text" value={text} onChange={e => setText(e.target.value)} placeholder="Task description..." className="flex-grow input-style"/>
                <select value={priority} onChange={e => setPriority(e.target.value)} className="input-style"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select>
                <select value={timeOfDay} onChange={e => setTimeOfDay(e.target.value)} className="input-style"><option value="morning">Morning</option><option value="afternoon">Afternoon</option><option value="night">Night</option></select>
                <button onClick={handleSave} className="p-2 text-green-600 hover:bg-green-100 dark:hover:bg-green-900/50 rounded-full"><Save size={18}/></button>
                <button onClick={handleCancel} className="p-2 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-full"><Ban size={18}/></button>
            </div>
        );
    }

    return (
        <div className="flex items-center gap-2 p-2 group hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-lg mb-2">
            <div className="flex-grow">
                <p className="text-slate-800 dark:text-slate-200">{task.text}</p>
                <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400 mt-1">
                    <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full ${ {low: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300', medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300', high: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300'}[priority] || ''}`}><Flag size={12} /> {priority}</span>
                    <span className="flex items-center gap-1">
                        {timeOfDay === 'morning' && <Coffee size={12}/>}
                        {timeOfDay === 'afternoon' && <Sun size={12}/>}
                        {timeOfDay === 'night' && <Moon size={12}/>}
                        {timeOfDay}
                    </span>
                </div>
            </div>
            <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                <button onClick={() => setEditing(task.id)} className="p-2 text-sky-600 hover:bg-sky-100 dark:hover:bg-sky-900/50 rounded-full"><Edit size={16}/></button>
                <button onClick={() => onDelete(task.id)} className="p-2 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-full"><Trash2 size={16}/></button>
            </div>
        </div>
    );
};

// --- Order Management Panel (Admin) ---
const OrderManagementPanel = ({ db, user, orders, workers, setError, setMessage }) => {
    const workerIdToNameMap = useMemo(() => workers.reduce((acc, worker) => {
        acc[worker.id] = worker.name || worker.email;
        return acc;
    }, {}), [workers]);

    const handleMarkComplete = async (orderId) => {
        const orderDocRef = doc(db, `artifacts/${appId}/public/data/orders`, orderId);
        try {
            await updateDoc(orderDocRef, {
                status: 'completed',
                completedAt: Timestamp.now(),
                completedByUid: user.uid,
            });
            setMessage("Order marked as complete.");
        } catch (err) {
            setError("Failed to update order status.");
        }
    };

    return (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-4 sm:p-6">
            <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-4">Submitted Orders</h2>
            <div className="space-y-4">
                {orders.length > 0 ? orders.map(order => (
                    <div key={order.id} className={`p-4 rounded-lg ${order.status === 'completed' ? 'bg-slate-100 dark:bg-slate-700/50' : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700'}`}>
                        <div className="flex justify-between items-start">
                            <div>
                                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${ {clothes: 'bg-sky-100 text-sky-800', parts: 'bg-amber-100 text-amber-800', products: 'bg-lime-100 text-lime-800', other: 'bg-slate-200 text-slate-800'}[order.category]}`}>{order.category}</span>
                                <p className="mt-2 font-semibold text-slate-800 dark:text-slate-100">{order.description}</p>
                                <p className="text-sm text-slate-600 dark:text-slate-300">For: {order.forWho}</p>
                            </div>
                             {order.status === 'pending' && <button onClick={() => handleMarkComplete(order.id)} className="btn-primary flex-shrink-0">Mark Complete</button>}
                        </div>
                        <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400">
                            {order.status === 'completed' ? (
                                <p className="text-green-600 dark:text-green-400 font-semibold flex items-center gap-2"><CheckCircle size={14}/> Completed on {order.completedAt?.toDate().toLocaleDateString()}</p>
                            ) : (
                                <p>Submitted by {workerIdToNameMap[order.submittedByUid] || order.submittedByUid.substring(0,6)} on {order.submittedAt?.toDate().toLocaleDateString()}</p>
                            )}
                        </div>
                    </div>
                )) : <p className="text-center py-8 text-slate-500">No orders have been submitted yet.</p>}
            </div>
        </div>
    );
};

// --- Order Submission Panel (Worker) ---
const OrderSubmissionPanel = ({ db, user, myOrders, setError, setMessage }) => {
    const [forWho, setForWho] = useState('');
    const [description, setDescription] = useState('');
    const [category, setCategory] = useState('products');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!forWho || !description) { setError("Please fill out all fields."); return; }
        setIsSubmitting(true);
        try {
            const ordersCollectionRef = collection(db, `artifacts/${appId}/public/data/orders`);
            await addDoc(ordersCollectionRef, {
                forWho, description, category,
                submittedByUid: user.uid,
                submittedByName: user.name || user.email,
                submittedAt: Timestamp.now(),
                status: 'pending',
            });
            setMessage("Order submitted successfully!");
            setForWho(''); setDescription(''); setCategory('products');
        } catch (err) {
            setError("Failed to submit order.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6">
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-4">Submit an Order</h2>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div><label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Who or what is it for?</label><input type="text" value={forWho} onChange={e => setForWho(e.target.value)} required className="w-full input-style"/></div>
                        <div><label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">What do you want to order?</label><textarea value={description} onChange={e => setDescription(e.target.value)} required className="w-full input-style" rows="3"></textarea></div>
                        <div><label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Category</label><select value={category} onChange={e => setCategory(e.target.value)} className="w-full input-style"><option value="clothes">Clothes</option><option value="parts">Parts</option><option value="products">Products</option><option value="other">Other</option></select></div>
                        <button type="submit" disabled={isSubmitting} className="btn-primary w-full">{isSubmitting ? 'Submitting...' : 'Submit Order'}</button>
                    </form>
                </div>
            </div>
             <div>
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6">
                     <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-4">My Past Orders</h2>
                     <div className="space-y-3 max-h-96 overflow-y-auto">
                        {myOrders.length > 0 ? myOrders.map(order => (
                             <div key={order.id} className={`p-3 rounded-lg ${order.status === 'completed' ? 'bg-slate-100 dark:bg-slate-700/50' : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700'}`}>
                                <p className="font-semibold text-slate-700 dark:text-slate-200">{order.description}</p>
                                <div className="flex justify-between items-center text-xs mt-1">
                                    <span className="text-slate-500">{order.submittedAt.toDate().toLocaleDateString()}</span>
                                    {order.status === 'completed' ? <span className="font-semibold text-green-600">Completed</span> : <span className="font-semibold text-amber-600">Pending</span>}
                                </div>
                            </div>
                        )) : <p className="text-center text-slate-500 py-8">You haven't submitted any orders yet.</p>}
                     </div>
                </div>
            </div>
        </div>
    );
};

// --- Manual Management Panel (Admin) ---
const ManualManagementPanel = ({ db, manuals, categories, onNew, onEdit, setError, setMessage }) => {
    const [subView, setSubView] = useState('manuals'); // 'manuals' or 'categories'

    const manualsWithCategoryNames = useMemo(() => {
        const categoryMap = new Map(categories.map(c => [c.id, c.name]));
        return manuals.map(manual => ({
            ...manual,
            categoryName: categoryMap.get(manual.categoryId) || 'Uncategorized'
        })).sort((a, b) => a.categoryName.localeCompare(b.categoryName) || a.title.localeCompare(b.title));
    }, [manuals, categories]);

    const groupedManuals = useMemo(() => {
        return manualsWithCategoryNames.reduce((acc, manual) => {
            const category = manual.categoryName;
            if (!acc[category]) acc[category] = [];
            acc[category].push(manual);
            return acc;
        }, {});
    }, [manualsWithCategoryNames]);

    return (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-4 sm:p-6">
            <div className="mb-4 border-b border-slate-200 dark:border-slate-700">
                <nav className="flex space-x-2">
                    <button onClick={() => setSubView('manuals')} className={`px-3 py-2 text-sm font-medium rounded-t-lg ${subView === 'manuals' ? 'bg-slate-100 dark:bg-slate-700 text-sky-600' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}>Manuals</button>
                    <button onClick={() => setSubView('categories')} className={`px-3 py-2 text-sm font-medium rounded-t-lg ${subView === 'categories' ? 'bg-slate-100 dark:bg-slate-700 text-sky-600' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}>Categories</button>
                </nav>
            </div>

            {subView === 'manuals' && (
                <div>
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Manage Manuals</h2>
                        <button onClick={onNew} className="btn-primary flex items-center gap-2"><Plus size={16}/> New Manual</button>
                    </div>
                    <div className="space-y-6">
                        {Object.entries(groupedManuals).map(([category, items]) => (
                            <div key={category}>
                                <h3 className="text-lg font-semibold text-slate-600 dark:text-slate-300 border-b pb-2 mb-3">{category}</h3>
                                <div className="space-y-2">
                                    {items.map(manual => (
                                        <div key={manual.id} className="flex justify-between items-center p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                            <span className="text-slate-800 dark:text-slate-200">{manual.title}</span>
                                            <button onClick={() => onEdit(manual)} className="p-2 text-sky-600 hover:bg-sky-100 dark:hover:bg-sky-900/50 rounded-full"><Edit size={16}/></button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {subView === 'categories' && (
                <CategoryManagementPanel db={db} categories={categories} setError={setError} setMessage={setMessage} />
            )}
        </div>
    );
};


// --- Category Management Panel (Admin) ---
const CategoryManagementPanel = ({ db, categories, setError, setMessage }) => {
    const [newCategoryName, setNewCategoryName] = useState('');
    const [editingCategory, setEditingCategory] = useState(null); // { id, name }

    const handleAddCategory = async (e) => {
        e.preventDefault();
        if (!newCategoryName.trim()) return;
        try {
            await addDoc(collection(db, `artifacts/${appId}/public/data/manual_categories`), { name: newCategoryName.trim() });
            setMessage("Category added.");
            setNewCategoryName('');
        } catch (err) { setError("Failed to add category."); }
    };

    const handleUpdateCategory = async () => {
        if (!editingCategory || !editingCategory.name.trim()) return;
        try {
            const categoryDocRef = doc(db, `artifacts/${appId}/public/data/manual_categories`, editingCategory.id);
            await updateDoc(categoryDocRef, { name: editingCategory.name.trim() });
            setMessage("Category updated.");
            setEditingCategory(null);
        } catch (err) { setError("Failed to update category."); }
    };

    const handleDeleteCategory = async (categoryId) => {
        // A simple confirm dialog is used here. For a better UX, a custom modal would be preferable.
        if (!window.confirm("Are you sure? Deleting a category will not delete its manuals, but they will become uncategorized.")) return;
        try {
            await deleteDoc(doc(db, `artifacts/${appId}/public/data/manual_categories`, categoryId));
            setMessage("Category deleted.");
        } catch (err) { setError("Failed to delete category."); }
    };

    return (
        <div>
            <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-4">Manage Manual Categories</h2>
            <form onSubmit={handleAddCategory} className="flex gap-2 mb-6">
                <input type="text" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} placeholder="New category name..." className="flex-grow input-style"/>
                <button type="submit" className="btn-primary">Add</button>
            </form>
            <div className="space-y-2">
                {categories.map(cat => (
                    <div key={cat.id} className="flex justify-between items-center p-3 rounded-lg bg-slate-50 dark:bg-slate-700/50">
                        {editingCategory?.id === cat.id ? (
                            <input type="text" value={editingCategory.name} onChange={(e) => setEditingCategory({...editingCategory, name: e.target.value})} className="flex-grow input-style mr-2"/>
                        ) : (
                            <span className="text-slate-800 dark:text-slate-200">{cat.name}</span>
                        )}
                        <div className="flex items-center gap-2">
                            {editingCategory?.id === cat.id ? (
                                <>
                                    <button onClick={handleUpdateCategory} className="p-2 text-green-600 hover:bg-green-100 rounded-full"><Save size={16}/></button>
                                    <button onClick={() => setEditingCategory(null)} className="p-2 text-slate-500 hover:bg-slate-200 rounded-full"><Ban size={16}/></button>
                                </>
                            ) : (
                                <button onClick={() => setEditingCategory(cat)} className="p-2 text-sky-600 hover:bg-sky-100 dark:hover:bg-sky-900/50 rounded-full"><Edit size={16}/></button>
                            )}
                            <button onClick={() => handleDeleteCategory(cat.id)} className="p-2 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-full"><Trash2 size={16}/></button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};


// --- Manuals View Panel (Worker) ---
const ManualsViewPanel = ({ manuals, categories }) => {
    const [selectedCategoryId, setSelectedCategoryId] = useState('');
    const [selectedManual, setSelectedManual] = useState(null);

    const filteredManuals = useMemo(() => {
        if (!selectedCategoryId) return [];
        return manuals.filter(m => m.categoryId === selectedCategoryId);
    }, [manuals, selectedCategoryId]);

    if (selectedManual) {
        return (
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6">
                <button onClick={() => setSelectedManual(null)} className="flex items-center gap-2 text-sky-600 font-semibold mb-4"><ChevronLeft size={18}/> Back to List</button>
                <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">{selectedManual.title}</h2>
                <div className="max-w-none whitespace-pre-wrap text-slate-700 dark:text-slate-300">{selectedManual.content}</div>
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-4 sm:p-6">
            <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-4">Manuals & Guides</h2>
            <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Select a Category</label>
                <select value={selectedCategoryId} onChange={(e) => setSelectedCategoryId(e.target.value)} className="w-full input-style">
                    <option value="">-- Please choose a category --</option>
                    {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                </select>
            </div>
            {selectedCategoryId && (
                 <div className="space-y-2">
                    {filteredManuals.length > 0 ? filteredManuals.map(manual => (
                        <button key={manual.id} onClick={() => setSelectedManual(manual)} className="w-full text-left p-3 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">
                            <span className="text-slate-800 dark:text-slate-200">{manual.title}</span>
                        </button>
                    )) : <p className="text-center text-slate-500 py-4">No manuals in this category.</p>}
                </div>
            )}
        </div>
    );
};

// --- Manual Creation/Edit Modal ---
const ManualModal = ({ db, user, manual, categories, closeModal, setError, setMessage }) => {
    const [title, setTitle] = useState(manual?.title || '');
    const [categoryId, setCategoryId] = useState(manual?.categoryId || '');
    const [content, setContent] = useState(manual?.content || '');
    const [isSaving, setIsSaving] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!title || !categoryId || !content) {
            setError("All fields are required.");
            return;
        }
        setIsSaving(true);
        const manualData = { title, categoryId, content, lastUpdatedBy: user.uid, lastUpdatedAt: Timestamp.now() };
        try {
            if (manual) {
                await updateDoc(doc(db, `artifacts/${appId}/public/data/manuals`, manual.id), manualData);
                setMessage("Manual updated successfully!");
            } else {
                await addDoc(collection(db, `artifacts/${appId}/public/data/manuals`), { ...manualData, createdBy: user.uid, createdAt: Timestamp.now() });
                setMessage("Manual created successfully!");
            }
            closeModal();
        } catch (err) {
            setError("Could not save the manual.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!manual) return;
        setIsSaving(true);
        try {
            await deleteDoc(doc(db, `artifacts/${appId}/public/data/manuals`, manual.id));
            setMessage("Manual deleted.");
            closeModal();
        } catch (err) {
            setError("Could not delete the manual.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-2xl">
                <div className="flex justify-between items-center p-4 border-b dark:border-slate-700"><h2 className="text-xl font-bold text-slate-800 dark:text-white">{manual ? 'Edit Manual' : 'Create New Manual'}</h2><button onClick={closeModal} className="p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700"><X className="text-slate-500"/></button></div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="flex gap-4">
                        <div className="flex-1"><label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Title</label><input type="text" value={title} onChange={e => setTitle(e.target.value)} required className="w-full input-style"/></div>
                        <div className="flex-1"><label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Category</label>
                            <select value={categoryId} onChange={e => setCategoryId(e.target.value)} required className="w-full input-style">
                                <option value="">Select a category</option>
                                {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                            </select>
                        </div>
                    </div>
                    <div><label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Content</label><textarea value={content} onChange={e => setContent(e.target.value)} required className="w-full input-style" rows="10"></textarea></div>
                    <div className="flex justify-between items-center pt-4">
                        <div>
                            {manual && !confirmDelete && <button type="button" onClick={() => setConfirmDelete(true)} disabled={isSaving} className="btn-danger flex items-center gap-2"><Trash2 size={16} /> Delete</button>}
                            {manual && confirmDelete && <div className="flex gap-2"><button type="button" onClick={handleDelete} disabled={isSaving} className="btn-danger">Confirm</button><button type="button" onClick={() => setConfirmDelete(false)} disabled={isSaving} className="btn-secondary">Cancel</button></div>}
                        </div>
                        <div className="flex gap-3"><button type="button" onClick={closeModal} className="btn-secondary">Cancel</button><button type="submit" disabled={isSaving} className="btn-primary">{isSaving ? 'Saving...' : (manual ? 'Save Changes' : 'Create Manual')}</button></div>
                    </div>
                </form>
            </div>
        </div>
    );
};
