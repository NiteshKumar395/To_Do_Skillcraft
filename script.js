(function(){
  const COLORS = ['#E4A544', '#6E9C7C', '#D66854', '#7B8FD6', '#C48ACB', '#5FB0B7'];
  const STORE_KEY = 'desk-app-data';

  let state = {
    lists: [
      { id: 'l1', name: 'Today', color: COLORS[0] },
      { id: 'l2', name: 'This Week', color: COLORS[1] },
    ],
    tasks: [],
    activeList: 'l1',
  };

  const $ = (id) => document.getElementById(id);
  const listsEl = $('lists');
  const tasksEl = $('tasks');
  const pageTitle = $('pageTitle');
  const pageSub = $('pageSub');
  const pageDot = $('pageDot');

  function uid(prefix){
    return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2,7);
  }

  function load(){
    try{
      const raw = localStorage.getItem(STORE_KEY);
      if (raw){
        const parsed = JSON.parse(raw);
        if (parsed && parsed.lists && parsed.lists.length){
          state = parsed;
        }
      }
    } catch(e){
      // no saved data yet — keep defaults
    }
    render();
  }

  function save(){
    try{
      localStorage.setItem(STORE_KEY, JSON.stringify(state));
    } catch(e){
      console.error('Could not save', e);
    }
  }

  function renderLists(){
    listsEl.innerHTML = '';
    state.lists.forEach(list => {
      const count = state.tasks.filter(t => t.listId === list.id && !t.completed).length;
      const li = document.createElement('li');
      li.className = 'list-tab' + (list.id === state.activeList ? ' active' : '');
      li.style.setProperty('--dot', list.color);
      li.innerHTML = `
        <span class="dot"></span>
        <span class="list-name">${escapeHtml(list.name)}</span>
        <span class="list-count">${count}</span>
      `;
      li.addEventListener('click', () => {
        state.activeList = list.id;
        render();
      });
      listsEl.appendChild(li);
    });
  }

  function formatDate(dateStr){
    if (!dateStr) return null;
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  function formatTime(timeStr){
    if (!timeStr) return null;
    const [h, m] = timeStr.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = ((h + 11) % 12) + 1;
    return `${h12}:${String(m).padStart(2,'0')} ${ampm}`;
  }

  function isOverdue(task){
    if (task.completed || !task.date) return false;
    const now = new Date();
    const due = new Date(task.date + 'T' + (task.time || '23:59'));
    return due < now;
  }

  function renderTasks(){
    const activeList = state.lists.find(l => l.id === state.activeList);
    pageTitle.textContent = activeList ? activeList.name : 'To do';
    pageDot.style.background = activeList ? activeList.color : 'var(--accent-amber)';

    let list = state.tasks
      .filter(t => t.listId === state.activeList)
      .sort((a,b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        const ad = a.date ? a.date + (a.time || '') : '9999';
        const bd = b.date ? b.date + (b.time || '') : '9999';
        return ad.localeCompare(bd);
      });

    const openCount = list.filter(t => !t.completed).length;
    pageSub.textContent = `${openCount} open · ${list.length - openCount} completed`;

    tasksEl.innerHTML = '';
    if (list.length === 0){
      tasksEl.innerHTML = `<li class="empty">Nothing here yet. Add the first task above.</li>`;
      return;
    }

    list.forEach(task => {
      const li = document.createElement('li');
      li.className = 'task-card' + (task.completed ? ' completed' : '');

      const overdue = isOverdue(task);
      const dateChip = task.date ? `<span class="chip${overdue ? ' overdue' : ''}">${formatDate(task.date)}${task.time ? ' · ' + formatTime(task.time) : ''}${overdue ? ' · overdue' : ''}</span>` : '';

      li.innerHTML = `
        <div class="check${task.completed ? ' checked' : ''}" title="Mark ${task.completed ? 'incomplete' : 'complete'}"></div>
        <div class="task-body">
          <div class="task-title">${escapeHtml(task.title)}</div>
          <div class="task-meta">${dateChip}</div>
        </div>
        <div class="task-actions">
          <button class="icon-btn edit" title="Edit">✎</button>
          <button class="icon-btn delete" title="Delete">✕</button>
        </div>
      `;

      li.querySelector('.check').addEventListener('click', () => {
        task.completed = !task.completed;
        save(); render();
      });
      li.querySelector('.delete').addEventListener('click', () => {
        state.tasks = state.tasks.filter(t => t.id !== task.id);
        save(); render();
      });
      li.querySelector('.edit').addEventListener('click', () => startEdit(li, task));

      tasksEl.appendChild(li);
    });
  }

  function startEdit(li, task){
    li.classList.add('editing');
    li.innerHTML = `
      <div class="check${task.completed ? ' checked' : ''}"></div>
      <div class="task-body" style="flex:1">
        <input type="text" value="${escapeHtml(task.title)}" maxlength="140" />
        <div class="task-meta">
          <input type="date" value="${task.date || ''}" />
          <input type="time" value="${task.time || ''}" />
        </div>
      </div>
      <div class="task-actions">
        <button class="icon-btn save" title="Save">✓</button>
        <button class="icon-btn delete cancel" title="Cancel">✕</button>
      </div>
    `;
    const titleInput = li.querySelector('input[type="text"]');
    const dateInput = li.querySelector('input[type="date"]');
    const timeInput = li.querySelector('input[type="time"]');
    titleInput.focus();
    titleInput.setSelectionRange(titleInput.value.length, titleInput.value.length);

    function commit(){
      const val = titleInput.value.trim();
      if (val){
        task.title = val;
        task.date = dateInput.value || null;
        task.time = timeInput.value || null;
      }
      save(); render();
    }

    li.querySelector('.save').addEventListener('click', commit);
    li.querySelector('.cancel').addEventListener('click', () => render());
    titleInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') commit();
      if (e.key === 'Escape') render();
    });
  }

  function escapeHtml(str){
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function render(){
    renderLists();
    renderTasks();
  }

  // Add list
  $('addListBtn').addEventListener('click', addList);
  $('newListInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') addList(); });
  function addList(){
    const input = $('newListInput');
    const name = input.value.trim();
    if (!name) return;
    const color = COLORS[state.lists.length % COLORS.length];
    const list = { id: uid('l'), name, color };
    state.lists.push(list);
    state.activeList = list.id;
    input.value = '';
    save(); render();
  }

  // Add task
  $('addTaskBtn').addEventListener('click', addTask);
  $('taskInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') addTask(); });
  function addTask(){
    const titleInput = $('taskInput');
    const title = titleInput.value.trim();
    if (!title) return;
    const task = {
      id: uid('t'),
      listId: state.activeList,
      title,
      date: $('taskDate').value || null,
      time: $('taskTime').value || null,
      completed: false,
      createdAt: Date.now(),
    };
    state.tasks.push(task);
    titleInput.value = '';
    $('taskDate').value = '';
    $('taskTime').value = '';
    save(); render();
  }

  load();
})();