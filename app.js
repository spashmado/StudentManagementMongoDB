const state = { students: [], courses: [], attendance: [], results: [], query: { students: '', courses: '', attendance: '', results: '' }, toastTimer: null };
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
const displayName = student => student ? `${student.firstName} ${student.lastName}` : 'Unknown student';
const initials = name => name.split(/\s+/).slice(0, 2).map(s => s[0] || '').join('').toUpperCase();

async function api(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

function toast(message, error = false) {
  const el = $('#toast'); el.textContent = message; el.classList.toggle('error', error); el.classList.add('show');
  clearTimeout(state.toastTimer); state.toastTimer = setTimeout(() => el.classList.remove('show'), 3300);
}

function setView(view) {
  $$('.view').forEach(el => el.classList.toggle('active', el.id === `view-${view}`));
  $$('.nav-item').forEach(el => el.classList.toggle('active', el.dataset.view === view));
  const title = view === 'dashboard' ? 'Overview' : ({ students: 'Students', courses: 'Courses', attendance: 'Attendance', results: 'Results' })[view];
  $('#crumb-title').textContent = title; history.replaceState(null, '', `#${view}`);
  if (view !== 'dashboard') refresh(view).catch(e => toast(e.message, true));
}

function filtered(items, type) {
  const q = state.query[type].toLowerCase();
  if (!q) return items;
  return items.filter(row => Object.values(row).some(value => String(value ?? '').toLowerCase().includes(q)));
}

function rowActions(type, row) {
  return `<div class="row-actions"><button class="icon-button" data-edit="${type}" data-id="${row._id}" title="Edit">Edit</button><button class="icon-button delete" data-delete="${type}" data-id="${row._id}" title="Delete">Delete</button></div>`;
}

function renderStudents() {
  const rows = filtered(state.students, 'students'); $('#students-total').textContent = `${state.students.length} student record${state.students.length === 1 ? '' : 's'}`;
  $('#table-students').innerHTML = rows.length ? rows.map(s => `<tr><td><div class="person-cell"><span class="person-avatar">${escapeHtml(initials(displayName(s)))}</span><span><b>${escapeHtml(displayName(s))}</b><small>${escapeHtml(s.gender)}</small></span></div></td><td><b>${escapeHtml(s.studentId)}</b></td><td>${escapeHtml(s.programme)}</td><td>Year ${escapeHtml(s.yearOfStudy)}</td><td><span class="tag">${(s.registeredCourseCodes || []).length} course${(s.registeredCourseCodes || []).length === 1 ? '' : 's'}</span></td><td>${rowActions('students', s)}</td></tr>`).join('') : '<tr><td colspan="6" class="empty-state">No students found. Add a student to get started.</td></tr>';
}

function renderCourses() {
  const rows = filtered(state.courses, 'courses'); $('#courses-total').textContent = `${state.courses.length} course${state.courses.length === 1 ? '' : 's'} in catalogue`;
  $('#table-courses').innerHTML = rows.length ? rows.map(c => `<tr><td><b>${escapeHtml(c.courseName)}</b></td><td><span class="tag">${escapeHtml(c.courseCode)}</span></td><td>${escapeHtml(c.creditUnits)} units</td><td>${escapeHtml(c.lecturer)}</td><td>${rowActions('courses', c)}</td></tr>`).join('') : '<tr><td colspan="5" class="empty-state">No courses found. Add a course to the catalogue.</td></tr>';
}

function renderAttendance() {
  const rows = filtered(state.attendance, 'attendance'); $('#attendance-total').textContent = `${state.attendance.length} attendance entr${state.attendance.length === 1 ? 'y' : 'ies'}`;
  $('#table-attendance').innerHTML = rows.length ? rows.map(a => `<tr><td><b>${escapeHtml(a.studentId)}</b></td><td><span class="tag">${escapeHtml(a.courseCode)}</span></td><td>${escapeHtml(a.attendanceDate)}</td><td><span class="tag ${a.status.toLowerCase()}">${escapeHtml(a.status)}</span></td><td>${rowActions('attendance', a)}</td></tr>`).join('') : '<tr><td colspan="5" class="empty-state">No attendance records found.</td></tr>';
}

function renderResults() {
  const rows = filtered(state.results, 'results'); $('#results-total').textContent = `${state.results.length} result${state.results.length === 1 ? '' : 's'} recorded`;
  $('#table-results').innerHTML = rows.length ? rows.map(r => `<tr><td><b>${escapeHtml(r.studentId)}</b></td><td><span class="tag">${escapeHtml(r.courseCode)}</span></td><td>${Number(r.courseworkMark).toFixed(2)}%</td><td>${Number(r.examinationMark).toFixed(2)}%</td><td><b>${Number(r.totalMark).toFixed(2)}%</b></td><td><span class="tag grade-${r.grade.toLowerCase()}">${escapeHtml(r.grade)}</span></td><td>${rowActions('results', r)}</td></tr>`).join('') : '<tr><td colspan="7" class="empty-state">No results found.</td></tr>';
}

function renderSelects() {
  const studentOptions = '<option value="">Select student</option>' + state.students.map(s => `<option value="${escapeHtml(s.studentId)}">${escapeHtml(s.studentId)} · ${escapeHtml(displayName(s))}</option>`).join('');
  const courseOptions = '<option value="">Select course</option>' + state.courses.map(c => `<option value="${escapeHtml(c.courseCode)}">${escapeHtml(c.courseCode)} · ${escapeHtml(c.courseName)}</option>`).join('');
  $$('[data-student-select]').forEach(el => { const old = el.value; el.innerHTML = studentOptions; if (old) el.value = old; });
  $$('[data-course-select]').forEach(el => { const old = el.value; el.innerHTML = courseOptions; if (old) el.value = old; });
  $('[data-course-checkboxes="students"]').innerHTML = state.courses.length ? state.courses.map(c => `<label class="check-pill"><input type="checkbox" name="registeredCourseCodes" value="${escapeHtml(c.courseCode)}">${escapeHtml(c.courseCode)}</label>`).join('') : '<span class="muted">Add courses to the catalogue first.</span>';
}

function renderDashboard(data) {
  for (const [key, value] of Object.entries(data.counts)) $(`#count-${key}`).textContent = value;
  const studentMap = new Map(state.students.map(s => [s.studentId, s]));
  $('#recent-attendance').innerHTML = data.recentAttendance.length ? data.recentAttendance.map(a => `<div class="mini-row"><div><div class="mini-main">${escapeHtml(displayName(studentMap.get(a.studentId)))} <span class="muted">· ${escapeHtml(a.courseCode)}</span></div><div class="mini-sub">${escapeHtml(a.studentId)} · ${escapeHtml(a.attendanceDate)}</div></div><span class="tag ${a.status.toLowerCase()}">${escapeHtml(a.status)}</span></div>`).join('') : '<div class="empty-state">No attendance entries yet.</div>';
  $('#recent-results').innerHTML = data.recentResults.length ? data.recentResults.map(r => `<div class="mini-row"><div><div class="mini-main">${escapeHtml(displayName(studentMap.get(r.studentId)))} <span class="muted">· ${escapeHtml(r.courseCode)}</span></div><div class="mini-sub">${escapeHtml(r.studentId)} · Average ${Number(r.totalMark).toFixed(1)}%</div></div><span class="tag grade-${r.grade.toLowerCase()}">${escapeHtml(r.grade)}</span></div>`).join('') : '<div class="empty-state">No results entered yet.</div>';
}

async function loadReferenceData() {
  [state.students, state.courses] = await Promise.all([api('/api/students'), api('/api/courses')]);
  renderSelects(); renderStudents(); renderCourses();
}

async function refresh(type) {
  if (type === 'dashboard') {
    await loadReferenceData(); renderDashboard(await api('/api/dashboard')); return;
  }
  if (type === 'students' || type === 'courses') {
    state[type] = await api(`/api/${type}`); renderSelects(); (type === 'students' ? renderStudents : renderCourses)();
    if (type === 'students') { state.attendance = await api('/api/attendance'); state.results = await api('/api/results'); renderDashboard(await api('/api/dashboard')); }
    return;
  }
  state[type] = await api(`/api/${type}`); (type === 'attendance' ? renderAttendance : renderResults)();
  if (type === 'attendance' || type === 'results') renderDashboard(await api('/api/dashboard'));
}

function formObject(form) {
  const data = Object.fromEntries(new FormData(form).entries());
  for (const field of ['yearOfStudy', 'creditUnits', 'courseworkMark', 'examinationMark']) if (data[field] !== undefined && data[field] !== '') data[field] = Number(data[field]);
  if (form.id === 'form-students') data.registeredCourseCodes = $$('input[name="registeredCourseCodes"]:checked', form).map(el => el.value);
  delete data._id;
  return data;
}

function resetForm(type) {
  const form = $(`#form-${type}`); if (!form) return;
  form.reset(); form.elements._id.value = '';
  $(`#${type}-form-title`).textContent = ({ students: 'Add a student', courses: 'Add a course', attendance: 'Record attendance', results: 'Record a result' })[type];
  $(`.cancel-edit[data-cancel="${type}"]`).classList.add('hidden');
  if (type === 'attendance') form.elements.attendanceDate.value = new Date().toISOString().slice(0, 10);
}

function beginEdit(type, row) {
  const form = $(`#form-${type}`); if (!form) return;
  for (const [key, value] of Object.entries(row)) if (form.elements[key] && key !== 'registeredCourseCodes') form.elements[key].value = value ?? '';
  if (type === 'students') $$('input[name="registeredCourseCodes"]', form).forEach(el => { el.checked = (row.registeredCourseCodes || []).includes(el.value); });
  $(`#${type}-form-title`).textContent = ({ students: 'Edit student', courses: 'Edit course', attendance: 'Edit attendance', results: 'Edit result' })[type];
  $(`.cancel-edit[data-cancel="${type}"]`).classList.remove('hidden');
  form.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

async function submitForm(type, form) {
  try {
    const id = form.elements._id.value;
    const path = `/api/${type}${id ? `/${encodeURIComponent(id)}` : ''}`;
    await api(path, { method: id ? 'PUT' : 'POST', body: JSON.stringify(formObject(form)) });
    resetForm(type); toast(id ? 'Record updated successfully.' : 'Record saved successfully.');
    await Promise.all([refresh(type), refresh('dashboard')]);
  } catch (e) { toast(e.message, true); }
}

async function deleteRecord(type, id) {
  const row = state[type].find(r => r._id === id);
  const label = type === 'students' ? `student ${row?.studentId}` : type === 'courses' ? `course ${row?.courseCode}` : 'this record';
  if (!confirm(`Delete ${label}? This cannot be undone.`)) return;
  try { await api(`/api/${type}/${encodeURIComponent(id)}`, { method: 'DELETE' }); toast('Record deleted.'); await refresh(type); await refresh('dashboard'); }
  catch (e) { toast(e.message, true); }
}

function init() {
  $('#today-label').textContent = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }).format(new Date());
  $$('.nav-item').forEach(button => button.addEventListener('click', () => setView(button.dataset.view)));
  $$('[data-goto]').forEach(button => button.addEventListener('click', () => setView(button.dataset.goto)));
  $$('[data-action="quick-student"]').forEach(button => button.addEventListener('click', () => { setView('students'); $('#form-students').scrollIntoView({ behavior: 'smooth', block: 'center' }); $('#form-students').elements.studentId.focus(); }));
  $$('[data-action="new"]').forEach(button => button.addEventListener('click', () => { const type = button.dataset.type; resetForm(type); $(`#form-${type}`).scrollIntoView({ behavior: 'smooth', block: 'center' }); }));
  $$('form[id^="form-"]').forEach(form => { const type = form.id.replace('form-', ''); form.addEventListener('submit', e => { e.preventDefault(); submitForm(type, form); }); form.addEventListener('reset', () => setTimeout(() => { form.elements._id.value = ''; }, 0)); });
  $$('[data-cancel]').forEach(button => button.addEventListener('click', () => resetForm(button.dataset.cancel)));
  for (const type of ['students', 'courses', 'attendance', 'results']) $(`#search-${type}`).addEventListener('input', e => { state.query[type] = e.target.value; ({ students: renderStudents, courses: renderCourses, attendance: renderAttendance, results: renderResults })[type](); });
  document.addEventListener('click', e => {
    const edit = e.target.closest('[data-edit]'); const del = e.target.closest('[data-delete]');
    if (edit) { const type = edit.dataset.edit; const row = state[type].find(r => r._id === edit.dataset.id); if (row) beginEdit(type, row); }
    if (del) deleteRecord(del.dataset.delete, del.dataset.id);
  });
  $('#form-attendance').elements.attendanceDate.value = new Date().toISOString().slice(0, 10);
  const view = location.hash.replace('#', ''); setView(['students', 'courses', 'attendance', 'results'].includes(view) ? view : 'dashboard');
}

init();
