import React, { useEffect, useMemo, useState } from 'react';
import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirestore, collection, doc, onSnapshot, addDoc, updateDoc, deleteDoc, Timestamp, setLogLevel } from 'firebase/firestore';
import { AlertTriangle, CheckCircle, ChevronDown, Circle, Flag, LogOut, MapPin, MessageSquare, Pencil, Plus, Trash2, User, UserCheck, X } from 'lucide-react';

const firebaseConfig = {
  apiKey: 'AIzaSyDn7jLT-4miPWcFyFLIFDgsc2vGD1i9Qpc',
  authDomain: 'protasked.firebaseapp.com',
  projectId: 'protasked',
  storageBucket: 'protasked.appspot.com',
  messagingSenderId: '468782595662',
  appId: '1:468782595662:web:ee1716d54ddc18a40e4d1f',
};

const appId = firebaseConfig.appId;
const tasksPath = `artifacts/${appId}/public/data/action_items`;
const userPath = (uid) => `artifacts/${appId}/users/${uid}`;
const nameOf = (user) => user?.name || user?.email || 'Unknown user';

const labels = { low: 'Low', normal: 'Normal', high: 'High', urgent: 'Urgent' };
const order = { urgent: 0, high: 1, normal: 2, low: 3 };
const badge = {
  low: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
  normal: 'bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-300',
  high: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300',
  urgent: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
};

const locationLabels = { WB: 'WB', SB: 'SB', algemeen: 'Algemeen' };
const locationOrder = ['WB', 'SB', 'algemeen'];
const normalizeLocation = (location) => (locationOrder.includes(location) ? location : 'algemeen');

const formatDate = (value) => {
  if (!value) return '-';
  const date = typeof value.toDate === 'function' ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const taskTitle = (task) => task?.title || task?.task || 'Untitled task';
const taskDescription = (task) => task?.description || '';

const matchesFilters = (task, filters) => {
  const location = normalizeLocation(task.location);
  const importance = task.importance || 'normal';
  const responsible = task.responsible || '';

  if (filters.location !== 'all' && location !== filters.location) return false;
  if (filters.importance !== 'all' && importance !== filters.importance) return false;
  if (filters.responsible !== 'all' && responsible !== filters.responsible) return false;

  return true;
};

export default function TodoPage() {
  const [db, setDb] = useState(null);
  const [auth, setAuth] = useState(null);
  const [user, setUser] = useState(undefined);
  const [tasks, setTasks] = useState([]);
  const [tab, setTab] = useState('open');
  const [filters, setFilters] = useState({ location: 'all', importance: 'all', responsible: 'all' });
  const [showAdd, setShowAdd] = useState(false);
  const [completeTask, setCompleteTask] = useState(null);
  const [editTask, setEditTask] = useState(null);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const timer = message ? setTimeout(() => setMessage(null), 4000) : null;
    return () => timer && clearTimeout(timer);
  }, [message]);

  useEffect(() => {
    try {
      const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
      const firestore = getFirestore(app);
      const firebaseAuth = getAuth(app);
      setLogLevel('error');
      setDb(firestore);
      setAuth(firebaseAuth);

      let unsubscribeProfile = () => {};
      const unsubscribeAuth = onAuthStateChanged(firebaseAuth, (firebaseUser) => {
        unsubscribeProfile();
        if (!firebaseUser || firebaseUser.isAnonymous) {
          setUser(null);
          return;
        }
        unsubscribeProfile = onSnapshot(
          doc(firestore, userPath(firebaseUser.uid)),
          (snapshot) => setUser({ uid: firebaseUser.uid, email: firebaseUser.email, ...(snapshot.exists() ? snapshot.data() : {}) }),
          () => setUser({ uid: firebaseUser.uid, email: firebaseUser.email })
        );
      });

      return () => {
        unsubscribeProfile();
        unsubscribeAuth();
      };
    } catch (err) {
      setError('Could not connect to Firebase.');
      setUser(null);
      return undefined;
    }
  }, []);

  useEffect(() => {
    if (!db || !user) return undefined;
    return onSnapshot(
      collection(db, tasksPath),
      (snapshot) => {
        const items = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
        items.sort((a, b) => {
          const statusSort = (a.status === 'completed' ? 1 : 0) - (b.status === 'completed' ? 1 : 0);
          if (statusSort !== 0) return statusSort;
          const locationSort = locationOrder.indexOf(normalizeLocation(a.location)) - locationOrder.indexOf(normalizeLocation(b.location));
          if (locationSort !== 0) return locationSort;
          const prioritySort = (order[a.importance] ?? 2) - (order[b.importance] ?? 2);
          if (prioritySort !== 0) return prioritySort;
          return (b.addedAt?.toMillis?.() || 0) - (a.addedAt?.toMillis?.() || 0);
        });
        setTasks(items);
      },
      () => setError('Could not load the action list.')
    );
  }, [db, user]);

  const openTasks = useMemo(() => tasks.filter((task) => task.status !== 'completed'), [tasks]);
  const completedTasks = useMemo(() => tasks.filter((task) => task.status === 'completed'), [tasks]);
  const filteredOpenTasks = useMemo(() => openTasks.filter((task) => matchesFilters(task, filters)), [openTasks, filters]);
  const filteredCompletedTasks = useMemo(() => completedTasks.filter((task) => matchesFilters(task, filters)), [completedTasks, filters]);
  const responsibleOptions = useMemo(() => {
    return Array.from(new Set(tasks.map((task) => task.responsible).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  }, [tasks]);

  const deleteCompletedTask = async (task) => {
    if (!db || !task || task.status !== 'completed') return;
    const confirmed = window.confirm(`Delete the completed task "${taskTitle(task)}"? This cannot be undone.`);
    if (!confirmed) return;

    try {
      await deleteDoc(doc(db, tasksPath, task.id));
      setMessage('Completed task deleted.');
    } catch (err) {
      setError('Could not delete the completed task.');
    }
  };

  if (user === undefined) return <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">Loading...</div>;

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900 p-4 sm:p-8 font-sans">
      {!user ? (
        <Login auth={auth} setError={setError} />
      ) : (
        <main className="max-w-6xl mx-auto">
          <header className="flex flex-wrap gap-4 justify-between items-start mb-8">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-sky-600 dark:text-sky-400">ProTasked</p>
              <h1 className="text-3xl font-bold text-slate-800 dark:text-white">Actielijst</h1>
              <p className="text-slate-500 dark:text-slate-400 mt-1">Logged in as {nameOf(user)}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {tab === 'open' && <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-2"><Plus size={18} /> New task</button>}
              <button onClick={() => signOut(auth).catch(() => setError('Failed to log out.'))} className="btn-secondary flex items-center gap-2"><LogOut size={18} /> Logout</button>
            </div>
          </header>

          <section className="bg-white dark:bg-slate-800 rounded-xl shadow-lg overflow-hidden">
            <nav className="border-b border-slate-200 dark:border-slate-700 px-4 sm:px-6 flex gap-4">
              <button onClick={() => setTab('open')} className={`py-4 font-semibold border-b-2 ${tab === 'open' ? 'border-sky-600 text-sky-600' : 'border-transparent text-slate-500'}`}>Open tasks ({openTasks.length})</button>
              <button onClick={() => setTab('completed')} className={`py-4 font-semibold border-b-2 ${tab === 'completed' ? 'border-sky-600 text-sky-600' : 'border-transparent text-slate-500'}`}>Completed ({completedTasks.length})</button>
            </nav>
            <div className="p-4 sm:p-6">
              <FilterPanel
                filters={filters}
                setFilters={setFilters}
                responsibleOptions={responsibleOptions}
                visibleCount={tab === 'open' ? filteredOpenTasks.length : filteredCompletedTasks.length}
                totalCount={tab === 'open' ? openTasks.length : completedTasks.length}
              />
              {tab === 'open' ? (
                <TaskList tasks={filteredOpenTasks} emptyTitle="No open tasks" emptyText="Create the first action item or change the filters." onComplete={setCompleteTask} onEdit={setEditTask} />
              ) : (
                <TaskList tasks={filteredCompletedTasks} emptyTitle="No completed tasks" emptyText="Completed tasks will be stored here. Change the filters if needed." completed onDelete={deleteCompletedTask} />
              )}
            </div>
          </section>
        </main>
      )}

      {showAdd && <AddTask db={db} user={user} close={() => setShowAdd(false)} setError={setError} setMessage={setMessage} />}
      {completeTask && <CompleteTask db={db} user={user} task={completeTask} close={() => setCompleteTask(null)} setError={setError} setMessage={setMessage} />}
      {editTask && <EditTask db={db} user={user} task={editTask} close={() => setEditTask(null)} setError={setError} setMessage={setMessage} />}
      {message && <Toast type="success" message={message} close={() => setMessage(null)} />}
      {error && <Toast type="error" message={error} close={() => setError(null)} />}
      <style>{styles}</style>
    </div>
  );
}

function Login({ auth, setError }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    if (!auth) return setError('Auth service not available.');
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      setError(err.message || 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center">
      <form onSubmit={submit} className="w-full max-w-md p-8 bg-white dark:bg-slate-800 rounded-xl shadow-lg space-y-4">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-slate-800 dark:text-white">ProTasked</h1>
          <p className="text-slate-500 dark:text-slate-400">Sign in to open the action list</p>
        </div>
        <input type="email" placeholder="Email address" required value={email} onChange={(event) => setEmail(event.target.value)} className="input-style" />
        <input type="password" placeholder="Password" required value={password} onChange={(event) => setPassword(event.target.value)} className="input-style" />
        <button type="submit" disabled={loading} className="btn-primary w-full">{loading ? 'Logging in...' : 'Login'}</button>
      </form>
    </div>
  );
}

function FilterPanel({ filters, setFilters, responsibleOptions, visibleCount, totalCount }) {
  const hasActiveFilters = filters.location !== 'all' || filters.importance !== 'all' || filters.responsible !== 'all';
  const updateFilter = (key, value) => setFilters((current) => ({ ...current, [key]: value }));

  return (
    <div className="mb-6 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/30 p-4">
      <div className="flex flex-col lg:flex-row lg:items-end gap-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 flex-grow">
          <div>
            <label className="label">Location</label>
            <select value={filters.location} onChange={(event) => updateFilter('location', event.target.value)} className="input-style">
              <option value="all">All locations</option>
              {locationOrder.map((location) => <option key={location} value={location}>{locationLabels[location]}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Importance</label>
            <select value={filters.importance} onChange={(event) => updateFilter('importance', event.target.value)} className="input-style">
              <option value="all">All importance levels</option>
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
          <div>
            <label className="label">Responsible person / party</label>
            <select value={filters.responsible} onChange={(event) => updateFilter('responsible', event.target.value)} className="input-style">
              <option value="all">All people / parties</option>
              {responsibleOptions.map((responsible) => <option key={responsible} value={responsible}>{responsible}</option>)}
            </select>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row lg:flex-col gap-2 lg:items-end">
          <p className="text-sm text-slate-500 dark:text-slate-400 whitespace-nowrap">Showing {visibleCount} of {totalCount}</p>
          {hasActiveFilters && <button type="button" onClick={() => setFilters({ location: 'all', importance: 'all', responsible: 'all' })} className="btn-secondary compact">Clear filters</button>}
        </div>
      </div>
    </div>
  );
}

function TaskList({ tasks, emptyTitle, emptyText, onComplete, completed = false, onDelete, onEdit }) {
  const groupedTasks = useMemo(() => {
    return locationOrder
      .map((location) => ({ location, tasks: tasks.filter((task) => normalizeLocation(task.location) === location) }))
      .filter((group) => group.tasks.length > 0);
  }, [tasks]);

  if (tasks.length === 0) {
    return (
      <div className="text-center py-16">
        <Circle size={44} className="mx-auto text-slate-300 dark:text-slate-600" />
        <h2 className="mt-4 text-xl font-bold text-slate-700 dark:text-slate-200">{emptyTitle}</h2>
        <p className="mt-2 text-slate-500 dark:text-slate-400">{emptyText}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {groupedTasks.map((group) => (
        <section key={group.location}>
          <div className="mb-2 flex items-center gap-2 border-b border-slate-200 dark:border-slate-700 pb-2">
            <MapPin size={18} className="text-sky-600 dark:text-sky-400" />
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">{locationLabels[group.location]}</h2>
            <span className="rounded-full bg-slate-200 dark:bg-slate-700 px-2 py-0.5 text-xs font-bold text-slate-600 dark:text-slate-300">{group.tasks.length}</span>
          </div>
          <div className="space-y-2">
            {group.tasks.map((task) => <TaskCard key={task.id} task={task} onComplete={onComplete} completed={completed} onDelete={onDelete} onEdit={onEdit} />)}
          </div>
        </section>
      ))}
    </div>
  );
}

function TaskCard({ task, onComplete, completed, onDelete, onEdit }) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const title = taskTitle(task);
  const description = taskDescription(task);
  const location = normalizeLocation(task.location);

  return (
    <article className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm">
      <button
        type="button"
        onClick={() => setDetailsOpen((current) => !current)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-700/50"
      >
        <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100 break-words">{title}</h2>
        <ChevronDown size={18} className={`flex-shrink-0 text-slate-400 transition-transform ${detailsOpen ? 'rotate-180' : ''}`} />
      </button>

      {detailsOpen && (
        <div className="border-t border-slate-200 dark:border-slate-700 px-4 py-4">
          <div className="flex flex-wrap gap-2 mb-4">
            {onEdit && !completed && (
              <button type="button" onClick={() => onEdit(task)} className="btn-secondary compact flex items-center gap-2">
                <Pencil size={16} /> Edit
              </button>
            )}
            {onComplete && (
              <button type="button" onClick={() => onComplete(task)} className="btn-primary compact flex items-center gap-2">
                <CheckCircle size={16} /> Mark off
              </button>
            )}
            {completed && <span className="inline-flex items-center gap-2 rounded-lg bg-green-100 px-3 py-2 text-sm font-bold text-green-700 dark:bg-green-900/50 dark:text-green-300"><CheckCircle size={16} /> Completed</span>}
            {completed && onDelete && (
              <button type="button" onClick={() => onDelete(task)} className="btn-danger compact flex items-center justify-center gap-2">
                <Trash2 size={16} /> Delete
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
            <Meta icon={<MapPin size={15} />} label="Location" value={locationLabels[location]} />
            <Meta icon={<User size={15} />} label="Added by" value={task.addedByName || 'Unknown'} />
            <Meta icon={<Flag size={15} />} label="Importance" value={labels[task.importance] || 'Normal'} badgeClass={badge[task.importance] || badge.normal} />
            <Meta icon={<UserCheck size={15} />} label="Responsible" value={task.responsible || 'Not assigned'} />
          </div>

          <div className="mt-4 rounded-lg bg-slate-50 dark:bg-slate-700/50 p-3 text-sm text-slate-600 dark:text-slate-300">
            <p className="text-xs uppercase tracking-wide text-slate-400 font-bold mb-1">Description</p>
            {description ? <p className="whitespace-pre-wrap">{description}</p> : <p className="text-slate-400 dark:text-slate-500">No description added.</p>}
          </div>

          {completed && (
            <div className="mt-4 rounded-lg bg-slate-50 dark:bg-slate-700/50 p-3 text-sm text-slate-600 dark:text-slate-300">
              <p className="font-semibold text-green-700 dark:text-green-300">Marked off by {task.completedByName || 'Unknown'} on {formatDate(task.completedAt)}</p>
              {task.completionComment ? <p className="mt-2 flex gap-2"><MessageSquare size={16} className="flex-shrink-0 mt-0.5" /> <span>{task.completionComment}</span></p> : <p className="mt-2 text-slate-500 dark:text-slate-400">No comment left.</p>}
            </div>
          )}
        </div>
      )}
    </article>
  );
}

function Meta({ icon, label, value, badgeClass }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-slate-400 font-bold mb-1">{label}</p>
      {badgeClass ? <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full font-semibold ${badgeClass}`}>{icon} {value}</span> : <p className="flex items-center gap-1 text-slate-600 dark:text-slate-300">{icon} {value}</p>}
    </div>
  );
}

function AddTask({ db, user, close, setError, setMessage }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('algemeen');
  const [importance, setImportance] = useState('normal');
  const [responsible, setResponsible] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    if (!db || !user) return;
    if (!title.trim() || !responsible.trim()) return setError('Fill in the title and responsible person or party.');
    setSaving(true);
    try {
      await addDoc(collection(db, tasksPath), {
        title: title.trim(),
        description: description.trim(),
        task: title.trim(),
        location,
        importance,
        responsible: responsible.trim(),
        addedByUid: user.uid,
        addedByName: nameOf(user),
        addedAt: Timestamp.now(),
        status: 'open',
      });
      setMessage('Task added.');
      close();
    } catch (err) {
      setError('Could not add the task.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="New action item" close={close}>
      <form onSubmit={submit} className="space-y-4">
        <div><label className="label">Title</label><input value={title} onChange={(event) => setTitle(event.target.value)} required className="input-style" placeholder="Short title for the task" /></div>
        <div><label className="label">Description</label><textarea value={description} onChange={(event) => setDescription(event.target.value)} rows="4" className="input-style" placeholder="Add the details here. This will be collapsed on the main page." /></div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div><label className="label">Location</label><select value={location} onChange={(event) => setLocation(event.target.value)} className="input-style"><option value="WB">WB</option><option value="SB">SB</option><option value="algemeen">Algemeen</option></select></div>
          <div><label className="label">Importance</label><select value={importance} onChange={(event) => setImportance(event.target.value)} className="input-style"><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select></div>
          <div><label className="label">Responsible person / party</label><input value={responsible} onChange={(event) => setResponsible(event.target.value)} required className="input-style" placeholder="e.g. Sam, supplier, planning" /></div>
        </div>
        <div className="flex justify-end gap-3 pt-2"><button type="button" onClick={close} className="btn-secondary">Cancel</button><button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving...' : 'Add task'}</button></div>
      </form>
    </Modal>
  );
}

function EditTask({ db, user, task, close, setError, setMessage }) {
  const [title, setTitle] = useState(taskTitle(task));
  const [description, setDescription] = useState(taskDescription(task));
  const [location, setLocation] = useState(normalizeLocation(task.location));
  const [importance, setImportance] = useState(task.importance || 'normal');
  const [responsible, setResponsible] = useState(task.responsible || '');
  const [saving, setSaving] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    if (!db || !user || !task || task.status === 'completed') return;
    if (!title.trim() || !responsible.trim()) return setError('Fill in the title and responsible person or party.');
    setSaving(true);
    try {
      await updateDoc(doc(db, tasksPath, task.id), {
        title: title.trim(),
        description: description.trim(),
        task: title.trim(),
        location,
        importance,
        responsible: responsible.trim(),
        editedAt: Timestamp.now(),
        editedByUid: user.uid,
        editedByName: nameOf(user),
      });
      setMessage('Task updated.');
      close();
    } catch (err) {
      setError('Could not update the task.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Edit action item" close={close}>
      <form onSubmit={submit} className="space-y-4">
        <div><label className="label">Title</label><input value={title} onChange={(event) => setTitle(event.target.value)} required className="input-style" placeholder="Short title for the task" /></div>
        <div><label className="label">Description</label><textarea value={description} onChange={(event) => setDescription(event.target.value)} rows="4" className="input-style" placeholder="Add the details here." /></div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div><label className="label">Location</label><select value={location} onChange={(event) => setLocation(event.target.value)} className="input-style"><option value="WB">WB</option><option value="SB">SB</option><option value="algemeen">Algemeen</option></select></div>
          <div><label className="label">Importance</label><select value={importance} onChange={(event) => setImportance(event.target.value)} className="input-style"><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select></div>
          <div><label className="label">Responsible person / party</label><input value={responsible} onChange={(event) => setResponsible(event.target.value)} required className="input-style" placeholder="e.g. Sam, supplier, planning" /></div>
        </div>
        <div className="flex justify-end gap-3 pt-2"><button type="button" onClick={close} className="btn-secondary">Cancel</button><button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving...' : 'Save changes'}</button></div>
      </form>
    </Modal>
  );
}

function CompleteTask({ db, user, task, close, setError, setMessage }) {
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);

  const complete = async () => {
    if (!db || !user || !task) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, tasksPath, task.id), {
        status: 'completed',
        completedAt: Timestamp.now(),
        completedByUid: user.uid,
        completedByName: nameOf(user),
        completionComment: comment.trim(),
      });
      setMessage('Task marked as completed.');
      close();
    } catch (err) {
      setError('Could not complete the task.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Mark task as completed" close={close}>
      <div className="space-y-4">
        <div className="rounded-lg bg-slate-50 dark:bg-slate-700/50 p-3">
          <p className="font-semibold text-slate-800 dark:text-slate-100">{taskTitle(task)}</p>
          {taskDescription(task) && <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 whitespace-pre-wrap">{taskDescription(task)}</p>}
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Location: {locationLabels[normalizeLocation(task.location)]}</p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Responsible: {task.responsible || 'Not assigned'}</p>
        </div>
        <div><label className="label">Comment after completion (optional)</label><textarea value={comment} onChange={(event) => setComment(event.target.value)} rows="4" className="input-style" placeholder="Leave a note about what was done..." /></div>
        <div className="flex justify-end gap-3"><button type="button" onClick={close} className="btn-secondary">Cancel</button><button type="button" onClick={complete} disabled={saving} className="btn-primary">{saving ? 'Saving...' : 'Mark off'}</button></div>
      </div>
    </Modal>
  );
}

function Modal({ title, close, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl bg-white dark:bg-slate-800 rounded-xl shadow-xl">
        <div className="flex justify-between items-center p-4 border-b border-slate-200 dark:border-slate-700"><h2 className="text-xl font-bold text-slate-800 dark:text-white">{title}</h2><button onClick={close} className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700"><X className="text-slate-500" /></button></div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

function Toast({ type, message, close }) {
  const isError = type === 'error';
  return <div className={`fixed bottom-4 right-4 z-50 text-white p-4 rounded-lg shadow-lg flex items-center gap-3 ${isError ? 'bg-red-500' : 'bg-green-500'}`}>{isError ? <AlertTriangle size={20} /> : <CheckCircle size={20} />}<span>{message}</span><button onClick={close} className="p-1 rounded-full hover:bg-white/20"><X size={18} /></button></div>;
}

const styles = `
.input-style { width: 100%; padding: 0.65rem 0.75rem; background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 0.5rem; outline: none; }
.input-style:focus { border-color: #0ea5e9; box-shadow: 0 0 0 2px rgba(14, 165, 233, 0.2); }
.dark .input-style { background-color: #334155; border-color: #475569; color: white; }
.label { display: block; font-size: 0.875rem; font-weight: 700; color: #334155; margin-bottom: 0.25rem; }
.dark .label { color: #cbd5e1; }
.btn-primary { padding: 0.6rem 1rem; background-color: #0ea5e9; color: white; border-radius: 0.5rem; font-weight: 700; transition: background-color 0.2s; }
.btn-primary:hover { background-color: #0284c7; }
.btn-primary:disabled { background-color: #93c5fd; cursor: not-allowed; }
.btn-primary.compact { padding: 0.45rem 0.75rem; font-size: 0.875rem; }
.btn-secondary { padding: 0.6rem 1rem; background-color: #e2e8f0; color: #1e293b; border-radius: 0.5rem; font-weight: 700; transition: background-color 0.2s; }
.btn-secondary:hover { background-color: #cbd5e1; }
.btn-secondary.compact { padding: 0.45rem 0.75rem; font-size: 0.875rem; }
.dark .btn-secondary { background-color: #475569; color: #e2e8f0; }
.dark .btn-secondary:hover { background-color: #64748b; }
.btn-danger { padding: 0.6rem 1rem; background-color: #ef4444; color: white; border-radius: 0.5rem; font-weight: 700; transition: background-color 0.2s; }
.btn-danger:hover { background-color: #dc2626; }
.btn-danger.compact { padding: 0.45rem 0.75rem; font-size: 0.875rem; }
`;
