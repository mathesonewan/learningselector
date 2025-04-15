import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL = 'https://miqlzqeugdmpcgnumpwx.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pcWx6cWV1Z2RtcGNnbnVtcHd4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQyMDYzNDQsImV4cCI6MjA1OTc4MjM0NH0.DQXm9kcKtW3GPjeaxkm7jYVId9nMEdmqMBjhUVL-rcc';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const taskListEl = document.getElementById('task-list');
const summaryEl = document.getElementById('summary');
const adminTable = document.getElementById('admin-table');
const form = document.getElementById('task-form');
const formMsg = document.getElementById('form-message');
let selectedTasks = [];

// === Panel switching ===
const navButtons = document.querySelectorAll('#panel-nav button');
const panels = document.querySelectorAll('.panel');
navButtons.forEach(button => {
  button.addEventListener('click', () => {
    navButtons.forEach(btn => btn.classList.remove('active'));
    button.classList.add('active');
    panels.forEach(panel => panel.classList.add('hidden'));
    document.querySelector(`#panel-${button.dataset.panel}`).classList.remove('hidden');

    if (button.dataset.panel === 'ksh') renderNestedTree();
    if (button.dataset.panel === 'admin') loadAdminTable();
  });
});

// === Supabase data loader for KSH ===
async function loadNestedTasks() {
  const { data: tasks, error } = await supabase.from('task_table').select('*');
  if (error) {
    console.error('Error loading nested tasks:', error.message);
    return [];
  }

  const nested = [];
  tasks.forEach(task => {
    let top = nested.find(t => t.top_level === task.top_level);
    if (!top) {
      top = { top_level: task.top_level, sub_levels: [] };
      nested.push(top);
    }
    let sub = top.sub_levels.find(s => s.sub_level === task.sub_level);
    if (!sub) {
      sub = { sub_level: task.sub_level, tasks: [] };
      top.sub_levels.push(sub);
    }
    sub.tasks.push(task);
  });
  return nested;
}

// === KSH Renderer ===
async function renderNestedTree() {
  const nested = await loadNestedTasks();
  taskListEl.innerHTML = '';
  summaryEl.innerHTML = '';
  selectedTasks = [];

  nested.forEach(top => {
    const topWrap = document.createElement('details');
    const topSummary = document.createElement('summary');

    const topCheckbox = document.createElement('input');
    topCheckbox.type = 'checkbox';
    topCheckbox.id = `top-${top.top_level}`;
    topSummary.appendChild(topCheckbox);

    const topLabel = document.createElement('label');
    topLabel.setAttribute('for', topCheckbox.id);
    topLabel.textContent = ` ${top.top_level}`;
    topSummary.appendChild(topLabel);

    topWrap.appendChild(topSummary);

    top.sub_levels.forEach(sub => {
      const subWrap = document.createElement('details');
      const subSummary = document.createElement('summary');

      const subCheckbox = document.createElement('input');
      subCheckbox.type = 'checkbox';
      subCheckbox.id = `sub-${sub.sub_level}`;
      subSummary.appendChild(subCheckbox);

      const subLabel = document.createElement('label');
      subLabel.setAttribute('for', subCheckbox.id);
      subLabel.textContent = ` ${sub.sub_level}`;
      subSummary.appendChild(subLabel);

      subWrap.appendChild(subSummary);

      sub.tasks.forEach(task => {
        const line = document.createElement('div');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `task-${task.id}`;
        checkbox.classList.add(
            'task-checkbox',
            `top-${top.top_level.replace(/\s+/g, '-')}`,
            `sub-${sub.sub_level.replace(/\s+/g, '-')}`
          );
                  checkbox.addEventListener('change', () => handleTaskSelection(task, checkbox.checked));
        const label = document.createElement('label');
        label.setAttribute('for', checkbox.id);
        label.textContent = `${task.task_name}`;

        line.appendChild(checkbox);
        line.appendChild(label);
        subWrap.appendChild(line);
      });

      subCheckbox.addEventListener('change', () => {
        const checkboxes = subWrap.querySelectorAll('input.task-checkbox');
        checkboxes.forEach(cb => {
          cb.checked = subCheckbox.checked;
          cb.dispatchEvent(new Event('change'));
        });
      });

      topWrap.appendChild(subWrap);
    });

    topCheckbox.addEventListener('change', () => {
      const checkboxes = topWrap.querySelectorAll('input.task-checkbox');
      checkboxes.forEach(cb => {
        cb.checked = topCheckbox.checked;
        cb.dispatchEvent(new Event('change'));
      });

      const subCheckboxes = topWrap.querySelectorAll('summary > input[type="checkbox"]');
      subCheckboxes.forEach(subCB => {
        subCB.checked = topCheckbox.checked;
      });
    });

    taskListEl.appendChild(topWrap);
  });

  console.log("Running renderNestedTree()");


}

function handleTaskSelection(task, selected) {
  if (selected) {
    selectedTasks.push(task);
  } else {
    selectedTasks = selectedTasks.filter(t => t.id !== task.id);
  }
  updateSummary();
}

function updateSummary() {
    const totalTime = selectedTasks.reduce((sum, task) => sum + (task.seat_time_mins || 0), 0);
    const compliant = selectedTasks.filter(t => !(t.compliance_status && t.compliance_status.toLowerCase().includes('non')));
    const nonCompliant = selectedTasks.filter(t => t.compliance_status && t.compliance_status.toLowerCase().includes('non'));
  
    let summaryHTML = `<p><strong>Total Learning Seat Time:</strong> ${totalTime} mins</p>`;
  
    if (nonCompliant.length > 0) {
      const totalHours = nonCompliant.reduce((sum, task) => sum + (task.estimated_completion_time || 0), 0);
      const workingDays = Math.ceil(totalHours / 8);
      const projectDays = workingDays + 7;
      summaryHTML += `<p><strong>Estimated Project Time:</strong> ${projectDays} days</p>`;
    }
  
    summaryEl.innerHTML = summaryHTML;
  }
  
  document.getElementById('submit-ksh-btn').addEventListener('click', () => {
    // Swap to GSA panel
    document.querySelectorAll('.panel').forEach(panel => panel.classList.add('hidden'));
    document.querySelectorAll('#panel-nav button').forEach(btn => btn.classList.remove('active'));
  
    document.getElementById('panel-gsa').classList.remove('hidden');
    document.querySelector('[data-panel="gsa"]').classList.add('active');
  
    renderGSA(); // Trigger render based on selectedTasks
  });
    

// === Admin Panel Logic ===
async function loadAdminTable() {
    const { data: tasks, error } = await supabase.from('task_table').select('*');
    if (error) {
      adminTable.innerHTML = 'Error loading tasks.';
      console.error(error);
      return;
    }
  
    const headers = tasks.length > 0 ? Object.keys(tasks[0]) : [];
  

  const table = document.createElement('table');
  table.style.borderCollapse = 'collapse';
  table.style.width = '100%';

  const headerRow = document.createElement('tr');
  headers.forEach(key => {
    const th = document.createElement('th');
    th.textContent = key;
    th.style.border = '1px solid #ccc';
    th.style.padding = '4px';
    headerRow.appendChild(th);
  });

  const thAction = document.createElement('th');
  thAction.textContent = 'Actions';
  headerRow.appendChild(thAction);
  table.appendChild(headerRow);

  tasks.forEach(task => {
    const row = document.createElement('tr');
    headers.forEach(key => {
      const td = document.createElement('td');
      td.style.border = '1px solid #ccc';
      td.style.padding = '4px';

      const input = document.createElement('input');
      input.type = (key === 'seat_time_mins') ? 'number' : 'text';
      input.value = task[key] || '';
      input.dataset.key = key;
      input.dataset.id = task.id;
      td.appendChild(input);
      row.appendChild(td);
    });

    const actionTd = document.createElement('td');
    const saveBtn = document.createElement('button');
    saveBtn.textContent = 'Save';
    saveBtn.addEventListener('click', async () => {
      const updated = {};
      row.querySelectorAll('input').forEach(input => {
        updated[input.dataset.key] = input.type === 'number' ? parseInt(input.value, 10) : input.value;
      });

      const { error } = await supabase.from('task_table').update(updated).eq('id', task.id);
      if (error) {
        alert('Error saving changes: ' + error.message);
        console.error(error);
      } else {
        alert('Task updated successfully.');
      }
    });
    actionTd.appendChild(saveBtn);
    row.appendChild(actionTd);
    table.appendChild(row);
  });

  adminTable.innerHTML = '';
  adminTable.appendChild(table);
}

// === Save All Admin Changes ===
document.getElementById('save-all-btn').addEventListener('click', async () => {
  const inputFields = document.querySelectorAll('#admin-table input');
  const updatesById = {};

  inputFields.forEach(input => {
    const id = input.dataset.id;
    const key = input.dataset.key;
    const value = input.type === 'number' ? parseInt(input.value, 10) : input.value;
    if (!updatesById[id]) updatesById[id] = {};
    updatesById[id][key] = value;
  });

  let errors = 0;
  for (const [id, updates] of Object.entries(updatesById)) {
    const { error } = await supabase.from('task_table').update(updates).eq('id', id);
    if (error) {
      console.error(`Error saving row ${id}:`, error.message);
      errors++;
    }
  }

  alert(errors ? `Saved with ${errors} error(s). Check console.` : 'All changes saved.');
});

// === Input Form Handler ===
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const formData = new FormData(form);
  const values = Object.fromEntries(formData.entries());

  values.seat_time_mins = parseInt(values.seat_time_mins, 10);
  values.estimated_completion_time = parseInt(values.estimated_completion_time, 10);
  
  const requiredFields = [
    "task_name", "top_level", "sub_level", "software_version", "learning_version",
    "branding_version", "product", "hypervisor_support", "audience",
    "competence_subcategory", "compliance_status", "task_status",
    "learning_object_link", "estimated_completion_time", "seat_time_mins"
  ];
  
  for (let field of requiredFields) {
    if (!values[field] || values[field] === "") {
      formMsg.textContent = `Missing or invalid field: ${field}`;
      formMsg.style.color = 'red';
      return;
    }
  }
  
  if (isNaN(values.seat_time_mins) || values.seat_time_mins <= 0 ||
      isNaN(values.estimated_completion_time) || values.estimated_completion_time <= 0) {
    formMsg.textContent = 'Seat time and estimated completion must be valid numbers > 0';
    formMsg.style.color = 'red';
    return;
  }
  

  const { error } = await supabase.from('task_table').insert([values]);
  if (error) {
    formMsg.textContent = `Error: ${error.message}`;
    formMsg.style.color = 'red';
  } else {
    formMsg.textContent = 'Task added successfully!';
    formMsg.style.color = 'green';
    form.reset();
  }
});
// Default to render if KSH is already visible

  function renderGSA() {
    const gsaContent = document.getElementById('gsa-content');
    gsaContent.innerHTML = '';
  
    const nonCompliant = selectedTasks.filter(t =>
      t.compliance_status && t.compliance_status.toLowerCase().includes('non')
    );
  
    if (nonCompliant.length === 0) {
      gsaContent.innerHTML = '<p>No non-compliant tasks selected.</p>';
      return;
    }
  
    const table = document.createElement('table');
    table.style.borderCollapse = 'collapse';
    table.style.width = '100%';
    table.style.marginTop = '1em';
  
    const headers = ['Top Level', 'Sub Level', 'Task Name', 'Seat Time (mins)', 'Learning Link'];
    const headerRow = document.createElement('tr');
    headers.forEach(text => {
      const th = document.createElement('th');
      th.textContent = text;
      th.style.border = '1px solid #ccc';
      th.style.padding = '6px';
      headerRow.appendChild(th);
    });
    table.appendChild(headerRow);
  
    nonCompliant.forEach(task => {
      const row = document.createElement('tr');
      [task.top_level, task.sub_level, task.task_name, task.seat_time_mins, task.learning_object_link].forEach((val, idx) => {
        const td = document.createElement('td');
        td.textContent = idx === 4 ? '' : val;
        td.style.border = '1px solid #ccc';
        td.style.padding = '6px';
        if (idx === 4 && val) {
          const link = document.createElement('a');
          link.href = val;
          link.textContent = 'View';
          link.target = '_blank';
          td.appendChild(link);
        }
        row.appendChild(td);
      });
      table.appendChild(row);
    });
  
    gsaContent.appendChild(table);
  }
  
  // GSA nav listener
  document.querySelector('[data-panel="gsa"]').addEventListener('click', () => {
    renderGSA();
  });
  document.getElementById('gsa-download-btn').addEventListener('click', () => {
    const nonCompliant = selectedTasks.filter(t =>
      t.compliance_status && t.compliance_status.toLowerCase().includes('non')
    );
  
    if (nonCompliant.length === 0) {
      alert('No non-compliant tasks selected.');
      return;
    }
  
    const csvRows = [
      ['Top Level', 'Sub Level', 'Task Name', 'Seat Time (mins)', 'Learning Link'],
      ...nonCompliant.map(t => [
        t.top_level,
        t.sub_level,
        t.task_name,
        t.seat_time_mins,
        t.learning_object_link
      ])
    ];
  
    const csvContent = csvRows.map(r => r.map(v => `"${(v || '').toString().replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
  
    const link = document.createElement('a');
    link.href = url;
    link.download = 'gsa_report.csv';
    link.click();
  
    URL.revokeObjectURL(url);
  });
  

window.addEventListener('DOMContentLoaded', () => {
  loadAdminTable();
  document.querySelector('[data-panel="admin"]').classList.add('active');
});


// === Dark Mode Toggle ===
const toggle = document.getElementById('dark-mode-toggle');
toggle.addEventListener('change', () => {
  document.body.classList.toggle('dark-mode', toggle.checked);
});
