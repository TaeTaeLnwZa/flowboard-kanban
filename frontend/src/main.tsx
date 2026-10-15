import { useCallback, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

type Status = 'todo' | 'doing' | 'done';
type Priority = 'low' | 'medium' | 'high';
type Task = {
  id: string;
  title: string;
  description: string;
  status: Status;
  priority: Priority;
  due_date: string | null;
  created_at: string;
};
type Draft = Pick<Task, 'title' | 'description' | 'status' | 'priority' | 'due_date'>;

const columns: { status: Status; title: string; hint: string }[] = [
  { status: 'todo', title: 'To do', hint: 'Ideas and next steps' },
  { status: 'doing', title: 'Doing', hint: 'Work in motion' },
  { status: 'done', title: 'Done', hint: 'Finished and filed' },
];
const emptyDraft = (status: Status = 'todo'): Draft => ({
  title: '', description: '', status, priority: 'medium', due_date: null,
});

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    });
  } catch {
    throw new Error('Could not connect to the server. Please try again.');
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(typeof body.detail === 'string' ? body.detail : 'The request failed. Please try again.');
  }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
}

function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Priority | 'all'>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const data = await api<Task[]>('/tasks');
      setTasks(data);
      setError('');
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 12000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(''), 3500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const filtered = useMemo(() => tasks.filter(task =>
    (filter === 'all' || task.priority === filter) &&
    `${task.title} ${task.description}`.toLowerCase().includes(search.toLowerCase().trim())
  ), [tasks, filter, search]);
  const doneCount = tasks.filter(task => task.status === 'done').length;
  const doingCount = tasks.filter(task => task.status === 'doing').length;

  function openNew(status: Status = 'todo') {
    setEditingId(null);
    setDraft(emptyDraft(status));
    setDialogOpen(true);
  }

  function openEdit(task: Task) {
    setEditingId(task.id);
    setDraft({ title: task.title, description: task.description, status: task.status,
      priority: task.priority, due_date: task.due_date });
    setDialogOpen(true);
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!draft.title.trim()) return;
    setBusy(true);
    try {
      const path = editingId ? `/tasks/${editingId}` : '/tasks';
      await api<Task>(path, { method: editingId ? 'PATCH' : 'POST',
        body: JSON.stringify({ ...draft, title: draft.title.trim(), description: draft.description.trim() }) });
      setDialogOpen(false);
      setNotice(editingId ? 'Card updated' : 'Card added');
      await refresh();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!editingId || !window.confirm('Delete this card permanently?')) return;
    setBusy(true);
    try {
      await api<void>(`/tasks/${editingId}`, { method: 'DELETE' });
      setDialogOpen(false);
      setNotice('Card deleted');
      await refresh();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function move(task: Task, status: Status) {
    if (task.status === status) return;
    const previous = tasks;
    setTasks(current => current.map(item => item.id === task.id ? { ...item, status } : item));
    try {
      await api<Task>(`/tasks/${task.id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
      setNotice(`Moved to ${columns.find(column => column.status === status)?.title}`);
      await refresh();
    } catch (cause) {
      setTasks(previous);
      setError((cause as Error).message);
    }
  }

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark">F</span><span>flowboard<span className="brand-dot">.</span></span></div>
      <div className="sidebar-section-label">WORKSPACE</div>
      <div className="workspace-chip"><span className="workspace-avatar">W</span><span><strong>Team workspace</strong><small>Shared board</small></span></div>
      <div className="sidebar-section-label nav-label">GENERAL</div>
      <div className="nav-link active"><span className="nav-icon">▦</span><span>Board</span></div>
      <div className="sidebar-bottom">
        <div className="progress-card"><span className="sparkle">✦</span><strong>Keep it moving</strong><p>Every completed card is progress worth celebrating.</p>
          <div className="progress-track"><div style={{ width: `${tasks.length ? Math.round(doneCount / tasks.length * 100) : 0}%` }} /></div>
          <small>{tasks.length ? Math.round(doneCount / tasks.length * 100) : 0}% complete</small>
        </div>
        <div className="public-note"><span>◎</span><span>Public board<small>Anyone with the link can edit</small></span></div>
      </div>
    </aside>

    <main className="board-main">
      <header className="topbar"><div>Workspace <span>/</span> <strong>Board</strong></div><div className="topbar-right"><span className="live-dot" /> Shared workspace</div></header>
      <div className="board-content">
        <div className="board-heading"><div><p className="eyebrow">YOUR WORKSPACE</p><h1>Project board<span>.</span></h1><p>A clear view of everything you’re working on.</p></div>
          <button className="button button-primary" onClick={() => openNew()}><span className="plus">＋</span> New card</button></div>

        <div className="stats-row">
          <div className="stat"><span className="stat-icon all">▦</span><span><strong>{tasks.length}</strong><small>Total cards</small></span></div>
          <div className="stat"><span className="stat-icon doing">◷</span><span><strong>{doingCount}</strong><small>Doing</small></span></div>
          <div className="stat"><span className="stat-icon done">✓</span><span><strong>{doneCount}</strong><small>Done</small></span></div>
          <div className="stat stat-message"><span>✦</span><p>Small steps make big progress.</p></div>
        </div>

        {error && <div className="error-banner" role="alert"><span>{error}</span><button onClick={() => { setError(''); void refresh(); }}>Retry</button></div>}
        <div className="board-toolbar"><div><h2>Board view</h2><span>{filtered.length} {filtered.length === 1 ? 'card' : 'cards'}</span></div>
          <div className="toolbar-controls"><label className="search-wrap"><span>⌕</span><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search cards..." aria-label="Search cards" /></label>
            <select value={filter} onChange={event => setFilter(event.target.value as Priority | 'all')} aria-label="Filter by priority"><option value="all">All priorities</option><option value="high">High priority</option><option value="medium">Medium priority</option><option value="low">Low priority</option></select></div></div>

        <div className="board" aria-label="Kanban board">
          {columns.map(column => {
            const cards = filtered.filter(task => task.status === column.status);
            return <section className={`column column-${column.status}`} key={column.status}
              onDragOver={event => event.preventDefault()}
              onDrop={event => { event.preventDefault(); const id = event.dataTransfer.getData('text/plain'); const task = tasks.find(item => item.id === id); if (task) void move(task, column.status); }}>
              <header className="column-header"><div><span className={`column-dot dot-${column.status}`} /><h3>{column.title}</h3><span className="column-count">{cards.length}</span></div><button onClick={() => openNew(column.status)} aria-label={`Add card to ${column.title}`}>＋</button></header>
              <p className="column-hint">{column.hint}</p>
              <div className="task-list">{loading ? <p className="empty-column">Loading cards…</p> : cards.length ? cards.map(task =>
                <article className="task-card" key={task.id} draggable onDragStart={event => event.dataTransfer.setData('text/plain', task.id)}>
                  <div className="card-top"><span className={`priority-badge priority-${task.priority}`}>{task.priority}</span><button onClick={() => openEdit(task)} aria-label={`Edit ${task.title}`}>···</button></div>
                  <button className="card-title" onClick={() => openEdit(task)}>{task.title}</button>
                  {task.description && <p className="card-description">{task.description}</p>}
                  <div className="card-footer"><span>{task.due_date ? `◷ ${new Date(`${task.due_date}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}` : '◷ No due date'}</span>
                    <select value={task.status} onChange={event => void move(task, event.target.value as Status)} aria-label={`Move ${task.title} to column`}>
                      {columns.map(item => <option key={item.status} value={item.status}>{item.title}</option>)}
                    </select></div>
                </article>) : <p className="empty-column">{search || filter !== 'all' ? 'No matching cards here.' : 'Nothing here yet. Add a card to get started.'}</p>}</div>
              <button className="add-card-inline" onClick={() => openNew(column.status)}>＋ Add a card</button>
            </section>;
          })}
        </div>
        <p className="board-help">Drag cards between columns, or use the move menu on each card.</p>
      </div>
    </main>

    {dialogOpen && <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setDialogOpen(false); }}>
      <div className="task-dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
        <form onSubmit={event => void save(event)}>
          <div className="dialog-header"><div><p className="eyebrow">CARD DETAILS</p><h2 id="dialog-title">{editingId ? 'Edit card' : 'New card'}</h2></div><button type="button" className="close-button" onClick={() => setDialogOpen(false)} aria-label="Close dialog">×</button></div>
          <div className="dialog-body"><label htmlFor="task-title">Card title *</label><input id="task-title" autoFocus required maxLength={120} value={draft.title} onChange={event => setDraft({ ...draft, title: event.target.value })} placeholder="What needs to get done?" />
            <label htmlFor="task-description">Description</label><textarea id="task-description" rows={4} maxLength={2000} value={draft.description} onChange={event => setDraft({ ...draft, description: event.target.value })} placeholder="Add a little more detail..." />
            <div className="form-grid"><div><label htmlFor="task-status">Status</label><select id="task-status" value={draft.status} onChange={event => setDraft({ ...draft, status: event.target.value as Status })}>{columns.map(item => <option key={item.status} value={item.status}>{item.title}</option>)}</select></div>
              <div><label htmlFor="task-priority">Priority</label><select id="task-priority" value={draft.priority} onChange={event => setDraft({ ...draft, priority: event.target.value as Priority })}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></div></div>
            <label htmlFor="task-due-date">Due date <span className="optional">optional</span></label><input id="task-due-date" type="date" value={draft.due_date || ''} onChange={event => setDraft({ ...draft, due_date: event.target.value || null })} /></div>
          <div className="dialog-footer">{editingId && <button type="button" disabled={busy} className="button button-danger" onClick={() => void remove()}>Delete card</button>}<span className="spacer" /><button type="button" className="button button-ghost" onClick={() => setDialogOpen(false)}>Cancel</button><button type="submit" disabled={busy} className="button button-primary">{busy ? 'Saving…' : editingId ? 'Save changes' : 'Create card'}</button></div>
        </form>
      </div>
    </div>}
    {notice && <div className="toast" role="status">{notice}</div>}
  </div>;
}

createRoot(document.getElementById('root')!).render(<App />);
