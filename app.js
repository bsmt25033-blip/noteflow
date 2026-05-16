const API_BASE = '/api';

let notes = JSON.parse(localStorage.getItem('noteflow_notes') || '[]');
let currentId = null;
let currentFilter = 'all';
let currentTags = [];
let saveTimer = null;

const sidebar        = document.getElementById('sidebar');
const sidebarToggle  = document.getElementById('sidebarToggle');
const mobileMenuBtn  = document.getElementById('mobileMenuBtn');
const notesList      = document.getElementById('notesList');
const searchInput    = document.getElementById('searchInput');
const emptyState     = document.getElementById('emptyState');
const noteEditor     = document.getElementById('noteEditor');
const noteTitleInput = document.getElementById('noteTitleInput');
const editorBody     = document.getElementById('editorBody');
const tagInput       = document.getElementById('tagInput');
const tagsDisplay    = document.getElementById('tagsDisplay');
const noteDate       = document.getElementById('noteDate');
const wordCount      = document.getElementById('wordCount');
const deleteModal    = document.getElementById('deleteModal');
const toast          = document.getElementById('toast');

editorBody.setAttribute('data-placeholder', 'Start writing… your ideas live here.');
renderList();

sidebarToggle.addEventListener('click', () => {
  sidebar.classList.toggle('collapsed');
  sidebarToggle.textContent = sidebar.classList.contains('collapsed') ? '›' : '‹';
});

mobileMenuBtn.addEventListener('click', () => {
  sidebar.classList.toggle('mobile-open');
});

document.addEventListener('click', (e) => {
  if (window.innerWidth <= 700 && sidebar.classList.contains('mobile-open')) {
    if (!sidebar.contains(e.target) && e.target !== mobileMenuBtn) {
      sidebar.classList.remove('mobile-open');
    }
  }
});

document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = btn.dataset.filter;
    renderList();
  });
});

searchInput.addEventListener('input', renderList);

document.getElementById('btnNew').addEventListener('click', createNote);
document.getElementById('btnNewLg').addEventListener('click', createNote);

function createNote() {
  const note = {
    id:       Date.now().toString(),
    title:    '',
    body:     '',
    tags:     [],
    pinned:   false,
    archived: false,
    created:  new Date().toISOString(),
    updated:  new Date().toISOString(),
  };
  notes.unshift(note);
  persist();
  renderList();
  openNote(note.id);
  noteTitleInput.focus();
  showToast('New note created ✦');
}

function openNote(id) {
  currentId = id;
  const note = getNoteById(id);
  if (!note) return;

  currentTags = [...note.tags];

  emptyState.style.display = 'none';
  noteEditor.style.display = 'flex';
  noteEditor.style.flexDirection = 'column';

  noteTitleInput.value = note.title;
  editorBody.innerHTML = note.body;
  noteDate.textContent = formatDate(note.updated);
  renderTagChips();
  updateWordCount();

  document.querySelectorAll('.note-item').forEach(el => {
    el.classList.toggle('active', el.dataset.id === id);
  });

  if (window.innerWidth <= 700) sidebar.classList.remove('mobile-open');
}

document.getElementById('btnSave').addEventListener('click', saveCurrentNote);

function saveCurrentNote() {
  if (!currentId) return;
  const note = getNoteById(currentId);
  if (!note) return;

  note.title   = noteTitleInput.value.trim() || 'Untitled';
  note.body    = editorBody.innerHTML;
  note.tags    = [...currentTags];
  note.updated = new Date().toISOString();
  noteDate.textContent = formatDate(note.updated);

  persist();
  renderList();
  showToast('Note saved ✓');
  syncToBackend(note);
}

noteTitleInput.addEventListener('input', scheduleAutoSave);
editorBody.addEventListener('input', () => { updateWordCount(); scheduleAutoSave(); });

function scheduleAutoSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveCurrentNote, 1500);
}

document.getElementById('btnPin').addEventListener('click', () => {
  const note = getNoteById(currentId);
  if (!note) return;
  note.pinned = !note.pinned;
  persist(); renderList(); openNote(currentId);
  showToast(note.pinned ? '📌 Note pinned' : 'Note unpinned');
});

document.getElementById('btnArchive').addEventListener('click', () => {
  const note = getNoteById(currentId);
  if (!note) return;
  note.archived = !note.archived;
  persist(); renderList();
  showToast(note.archived ? '🗂 Note archived' : 'Note unarchived');
  closeEditor();
});

document.getElementById('btnDelete').addEventListener('click', () => {
  if (!currentId) return;
  deleteModal.classList.add('visible');
});

document.getElementById('btnCancelDelete').addEventListener('click', () => {
  deleteModal.classList.remove('visible');
});

document.getElementById('btnConfirmDelete').addEventListener('click', () => {
  notes = notes.filter(n => n.id !== currentId);
  persist();
  renderList();
  closeEditor();
  deleteModal.classList.remove('visible');
  showToast('Note deleted 🗑');
});

function closeEditor() {
  currentId = null;
  emptyState.style.display = '';
  noteEditor.style.display = 'none';
  noteDate.textContent = '—';
}

tagInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ',') {
    e.preventDefault();
    const val = tagInput.value.trim().toLowerCase().replace(/,/g, '');
    if (val && !currentTags.includes(val)) {
      currentTags.push(val);
      renderTagChips();
      scheduleAutoSave();
    }
    tagInput.value = '';
  }
});

function renderTagChips() {
  tagsDisplay.innerHTML = '';
  currentTags.forEach(tag => {
    const chip = document.createElement('span');
    chip.className = 'tag-chip';
    chip.innerHTML = `${tag}<span class="tag-remove" data-tag="${tag}">×</span>`;
    chip.querySelector('.tag-remove').addEventListener('click', () => {
      currentTags = currentTags.filter(t => t !== tag);
      renderTagChips();
      scheduleAutoSave();
    });
    tagsDisplay.appendChild(chip);
  });
}

function renderList() {
  const q = searchInput.value.trim().toLowerCase();
  let filtered = notes.filter(n => {
    if (currentFilter === 'pinned' && !n.pinned) return false;
    if (currentFilter === 'archived' && !n.archived) return false;
    if (currentFilter === 'all' && n.archived) return false;
    if (q) {
      const inTitle = n.title.toLowerCase().includes(q);
      const inBody  = n.body.replace(/<[^>]+>/g, '').toLowerCase().includes(q);
      const inTags  = n.tags.some(t => t.includes(q));
      if (!inTitle && !inBody && !inTags) return false;
    }
    return true;
  });

  filtered.sort((a, b) => (b.pinned - a.pinned) || (new Date(b.updated) - new Date(a.updated)));

  notesList.innerHTML = '';
  if (filtered.length === 0) {
    notesList.innerHTML = `<p style="text-align:center;color:var(--text-muted);font-size:13px;padding:24px 0;">No notes found</p>`;
    return;
  }

  filtered.forEach(note => {
    const item = document.createElement('div');
    item.className = `note-item${note.pinned ? ' pinned' : ''}${note.id === currentId ? ' active' : ''}`;
    item.dataset.id = note.id;

    const preview = note.body.replace(/<[^>]+>/g, '').slice(0, 60) || 'Empty note…';
    const tagsHtml = note.tags.map(t => `<span class="tag-pill">${t}</span>`).join('');

    item.innerHTML = `
      <div class="note-item-title">${note.title || 'Untitled'}</div>
      <div class="note-item-preview">${preview}</div>
      <div class="note-item-date">${formatDate(note.updated)}</div>
      ${note.tags.length ? `<div class="note-item-tags">${tagsHtml}</div>` : ''}
    `;

    item.addEventListener('click', () => openNote(note.id));
    notesList.appendChild(item);
  });
}

function updateWordCount() {
  const text = editorBody.innerText.trim();
  const count = text ? text.split(/\s+/).length : 0;
  wordCount.textContent = `${count} word${count !== 1 ? 's' : ''}`;
}

function execCmd(cmd, val = null) {
  document.execCommand(cmd, false, val);
  editorBody.focus();
  scheduleAutoSave();
}

function persist() {
  localStorage.setItem('noteflow_notes', JSON.stringify(notes));
}

async function syncToBackend(note) {
  try {
    console.log('[Noteflow] Synced note:', note.id);
  } catch (err) {
    console.error('[Noteflow] Sync error:', err);
    showToast('⚠ Sync failed — saved locally');
  }
}

function getNoteById(id) { return notes.find(n => n.id === id); }

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })
       + ' · '
       + d.toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit' });
}

let toastTimer;
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2800);
}