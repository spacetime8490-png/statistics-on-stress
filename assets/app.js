/**
 * Statistics Pro - Frontend Reactive Application Logic
 * Supports 72+ statistical tools, Full View expanded graphs, Script & Formula Engine (<>),
 * KaTeX formula rendering, real-time recalculations, and 100% full English academic documentation.
 */

let appState = {
  options: [],
  variables: [],
  currentCategory: 'ALL',
  searchQuery: '',
  activeOption: null,
  currentPage: 1,
  pageSize: 12,
  totalStudents: 72,
  charts: {},
  currentModalResult: null
};

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', async () => {
  await loadMetadataAndOptions();
  await loadOverviewAndCharts();
  await refreshTable(1);
  setupEventListeners();
});

// Setup event listeners
function setupEventListeners() {
  const globalSearch = document.getElementById('globalSearchInput');
  if (globalSearch) {
    globalSearch.addEventListener('input', (e) => {
      appState.searchQuery = e.target.value.toLowerCase().trim();
      if (document.getElementById('view-suite').classList.contains('hidden')) {
        switchTab('suite');
      }
      renderOptionsGrid();
    });
  }

  const tableSearch = document.getElementById('tableSearchInput');
  if (tableSearch) {
    let debounceTimer;
    tableSearch.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => refreshTable(1), 300);
    });
  }
}

// Switch navigation tabs
function switchTab(tabName) {
  const views = ['dashboard', 'suite', 'datatable', 'heatmap', 'scorecard', 'solutions', 'encyclopedia'];
  views.forEach(v => {
    const el = document.getElementById(`view-${v}`);
    const tabBtn = document.getElementById(`tab-${v}`);
    if (el) el.classList.toggle('hidden', v !== tabName);
    if (tabBtn) tabBtn.classList.toggle('active', v === tabName);
  });

  if (tabName === 'heatmap') {
    loadHeatmap();
  } else if (tabName === 'scorecard') {
    loadScorecard();
  } else if (tabName === 'solutions') {
    initStressSolutionsView();
  } else if (tabName === 'encyclopedia') {
    renderEncyclopedia();
  }
}

// -----------------------------------------------------------------------------
// METADATA & 72+ OPTIONS SUITE
// -----------------------------------------------------------------------------

async function loadMetadataAndOptions() {
  try {
    const res = await fetch('/api/options');
    const json = await res.json();
    if (json.success) {
      appState.options = json.options;
      appState.variables = json.variables;
      renderOptionsGrid();
    }
  } catch (err) {
    console.error('Failed to load options catalog:', err);
  }
}

function filterCategory(cat) {
  appState.currentCategory = cat;
  document.querySelectorAll('.category-pill').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-category') === cat);
    if (btn.getAttribute('data-category') === cat) {
      btn.classList.add('bg-brand-600', 'text-white');
      btn.classList.remove('bg-slate-900', 'text-slate-400');
    } else {
      btn.classList.remove('bg-brand-600', 'text-white');
      btn.classList.add('bg-slate-900', 'text-slate-400');
    }
  });
  renderOptionsGrid();
}

function renderOptionsGrid() {
  const grid = document.getElementById('optionsGrid');
  if (!grid) return;

  let filtered = appState.options.filter(opt => {
    const matchesCategory = appState.currentCategory === 'ALL' || opt.category === appState.currentCategory;
    const q = appState.searchQuery;
    const matchesSearch = !q || 
      opt.title.toLowerCase().includes(q) || 
      opt.category.toLowerCase().includes(q) ||
      opt.desc_en.toLowerCase().includes(q);
    return matchesCategory && matchesSearch;
  });

  document.getElementById('visibleOptionsCount').textContent = filtered.length;

  grid.innerHTML = filtered.map(opt => `
    <div class="glass-panel p-5 glass-card-interactive flex flex-col justify-between border-t-2 border-t-brand-500/50 hover:border-brand-400 transition-all">
      <div>
        <div class="flex items-center justify-between text-[11px] font-semibold text-slate-400 mb-2">
          <span class="px-2 py-0.5 rounded bg-brand-500/10 text-brand-300 border border-brand-500/20">${opt.category}</span>
          <span class="font-mono text-slate-500">Option #${opt.number}</span>
        </div>
        <h3 class="text-base font-bold text-white tracking-tight cursor-pointer hover:text-brand-300 transition-colors" onclick="openCalcModal('${opt.id}')">${opt.title}</h3>
        
        <!-- Formula preview box -->
        <div class="formula-badge my-3 text-xs text-center text-slate-200 cursor-pointer" onclick="openCalcModal('${opt.id}')" id="formula-preview-${opt.id}">
          $$${opt.formula_latex}$$
        </div>

        <p class="text-xs text-slate-400 leading-relaxed line-clamp-2">${opt.desc_en}</p>
      </div>

      <div class="mt-4 pt-3 border-t border-white/5 flex items-center justify-between">
        <button onclick="openCalcModal('${opt.id}')" class="text-xs text-brand-400 hover:text-white font-medium flex items-center space-x-1">
          <i class="fa-solid fa-circle-info text-[11px]"></i>
          <span>Details &amp; Guide</span>
        </button>

        <button onclick="openCalcModal('${opt.id}')" class="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all flex items-center space-x-1.5 shadow-md shadow-emerald-600/30">
          <i class="fa-solid fa-play text-[10px]"></i>
          <span>Run Analysis</span>
        </button>
      </div>
    </div>
  `).join('');

  // Render KaTeX for all formula badges
  if (window.renderMathInElement) {
    renderMathInElement(grid, {
      delimiters: [
        {left: '$$', right: '$$', display: true},
        {left: '$', right: '$', display: false}
      ],
      throwOnError: false
    });
  }
}

// -----------------------------------------------------------------------------
// STATISTICAL CALCULATION WORKBENCH MODAL
// -----------------------------------------------------------------------------

function openCalcModal(optionId) {
  const opt = appState.options.find(o => o.id === optionId);
  if (!opt) return;

  appState.activeOption = opt;
  document.getElementById('modalOptionCategory').textContent = opt.category;
  document.getElementById('modalOptionNumber').textContent = `Option #${opt.number}`;
  document.getElementById('modalOptionTitle').textContent = opt.title;
  document.getElementById('modalDescEn').textContent = opt.desc_en;

  // Render Formula in KaTeX
  const formulaContainer = document.getElementById('modalFormulaLatex');
  try {
    katex.render(opt.formula_latex, formulaContainer, { displayMode: true, throwOnError: false });
  } catch (e) {
    formulaContainer.textContent = opt.formula_latex;
  }

  // Build inputs
  const inputsContainer = document.getElementById('modalInputsContainer');
  inputsContainer.innerHTML = '';

  if (opt.inputs && opt.inputs.length > 0) {
    opt.inputs.forEach(inp => {
      const wrapper = document.createElement('div');
      wrapper.className = 'flex flex-col space-y-1';

      const lbl = document.createElement('label');
      lbl.className = 'text-[11px] font-semibold text-slate-300';
      lbl.textContent = inp.label;
      wrapper.appendChild(lbl);

      if (inp.type === 'variable') {
        const sel = document.createElement('select');
        sel.id = `input_${inp.name}`;
        sel.className = 'px-3 py-1.5 bg-slate-950 border border-white/10 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-brand-500';
        appState.variables.forEach(v => {
          const optEl = document.createElement('option');
          optEl.value = v.key;
          optEl.textContent = `${v.label} (${v.type})`;
          if (v.key === inp.default) optEl.selected = true;
          sel.appendChild(optEl);
        });
        wrapper.appendChild(sel);
      } else if (inp.type === 'number') {
        const num = document.createElement('input');
        num.type = 'number';
        num.step = 'any';
        num.id = `input_${inp.name}`;
        num.value = inp.default;
        num.className = 'w-32 px-3 py-1.5 bg-slate-950 border border-white/10 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-brand-500';
        wrapper.appendChild(num);
      }
      inputsContainer.appendChild(wrapper);
    });
  } else {
    inputsContainer.innerHTML = `<span class="text-xs text-slate-400 italic"><i class="fa-solid fa-check text-emerald-400 mr-1.5"></i> Uses all 72 student responses across all 20 dimensions. Ready for instant execution.</span>`;
  }

  document.getElementById('modalResultsSection').classList.add('hidden');
  document.getElementById('calcModal').classList.remove('hidden');

  // Automatically execute for instant preview
  executeCurrentCalculation();
}

function closeCalcModal() {
  document.getElementById('calcModal').classList.add('hidden');
  if (appState.charts.modal) {
    appState.charts.modal.destroy();
    appState.charts.modal = null;
  }
}

async function executeCurrentCalculation() {
  if (!appState.activeOption) return;

  const opt = appState.activeOption;
  const params = {};

  if (opt.inputs) {
    opt.inputs.forEach(inp => {
      const el = document.getElementById(`input_${inp.name}`);
      if (el) {
        params[inp.name] = inp.type === 'number' ? parseFloat(el.value) : el.value;
      }
    });
  }

  const btn = document.getElementById('btnExecuteCalc');
  btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-1.5"></i> Running Analysis...`;
  btn.disabled = true;

  try {
    const res = await fetch('/api/calculate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ option_id: opt.id, params })
    });
    const json = await res.json();
    btn.innerHTML = `<i class="fa-solid fa-play mr-1.5"></i> Run Analysis on Live Dataset`;
    btn.disabled = false;

    if (json.success && json.data) {
      appState.currentModalResult = json.data;
      renderModalResults(json.data);
    }
  } catch (err) {
    btn.innerHTML = `<i class="fa-solid fa-play mr-1.5"></i> Run Analysis on Live Dataset`;
    btn.disabled = false;
    console.error('Calculation error:', err);
  }
}

function renderModalResults(data) {
  const section = document.getElementById('modalResultsSection');
  section.classList.remove('hidden');

  // Populate Step-by-Step Practical Calculation Guide
  const guideContainer = document.getElementById('modalHowToUseContainer');
  if (guideContainer && data.how_to_use) {
    guideContainer.innerHTML = `
      <div class="p-2.5 rounded-lg bg-black/40 border border-white/5">
        <span class="text-brand-400 font-bold block mb-1">Step 1: Input &amp; Hypotheses</span>
        <p class="text-slate-300 leading-relaxed">${data.how_to_use.step1}</p>
      </div>
      <div class="p-2.5 rounded-lg bg-black/40 border border-white/5">
        <span class="text-cyan-400 font-bold block mb-1">Step 2: Mathematical Steps</span>
        <p class="text-slate-300 leading-relaxed">${data.how_to_use.step2}</p>
      </div>
      <div class="p-2.5 rounded-lg bg-black/40 border border-white/5">
        <span class="text-amber-400 font-bold block mb-1">Step 3: Decision Criterion</span>
        <p class="text-slate-300 leading-relaxed">${data.how_to_use.step3}</p>
      </div>
      <div class="p-2.5 rounded-lg bg-black/40 border border-white/5">
        <span class="text-emerald-400 font-bold block mb-1">Step 4: Academic Conclusion</span>
        <p class="text-slate-300 leading-relaxed">${data.how_to_use.step4}</p>
      </div>
    `;
  }

  // Build Results Table
  const tbody = document.getElementById('modalResultsTableBody');
  tbody.innerHTML = '';

  if (data.results) {
    for (const [key, val] of Object.entries(data.results)) {
      if (typeof val === 'object' && val !== null && !Array.isArray(val)) continue;
      const row = document.createElement('tr');
      row.className = 'hover:bg-white/5 transition-colors';
      row.innerHTML = `
        <td class="py-2.5 px-4 font-semibold text-slate-300 w-1/2">${key}</td>
        <td class="py-2.5 px-4 font-mono text-brand-300 font-bold">${Array.isArray(val) ? val.join(', ') : val}</td>
      `;
      tbody.appendChild(row);
    }
  }

  // Interpretation Banner
  const interpText = document.getElementById('modalInterpretationText');
  interpText.textContent = data.interpretation || 'Computation completed with standard statistical significance thresholds.';

  // Draw Modal Chart
  renderModalChart(data);
}

function renderModalChart(data) {
  const canvas = document.getElementById('modalChartCanvas');
  if (!canvas) return;

  if (appState.charts.modal) {
    appState.charts.modal.destroy();
  }

  const ctx = canvas.getContext('2d');
  const type = data.chart_type || 'bar';
  const cData = data.chart_data;

  if (!cData) {
    document.getElementById('modalChartWrapper').classList.add('hidden');
    return;
  }
  document.getElementById('modalChartWrapper').classList.remove('hidden');

  if (type === 'bar' || type === 'box' || type === 'table' || type === 'matrix') {
    appState.charts.modal = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: cData.labels || ['Value'],
        datasets: [{
          label: 'Metric Value',
          data: cData.values || [0],
          backgroundColor: 'rgba(99, 102, 241, 0.75)',
          borderColor: '#6366f1',
          borderWidth: 1.5,
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#94a3b8' } },
          y: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#94a3b8' } }
        }
      }
    });
  } else if (type === 'line') {
    appState.charts.modal = new Chart(ctx, {
      type: 'line',
      data: {
        labels: cData.labels,
        datasets: [{
          label: 'Trend Line',
          data: cData.values,
          borderColor: '#38bdf8',
          backgroundColor: 'rgba(56, 189, 248, 0.15)',
          fill: true,
          tension: 0.35,
          pointRadius: 4.5
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#94a3b8' } },
          y: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#94a3b8' } }
        }
      }
    });
  } else if (type === 'scatter') {
    const pts = (cData.x || []).map((xVal, i) => ({ x: xVal, y: (cData.y || [])[i] }));
    appState.charts.modal = new Chart(ctx, {
      type: 'scatter',
      data: {
        datasets: [{
          label: 'Student Observations',
          data: pts,
          backgroundColor: '#38bdf8',
          borderColor: '#0284c7',
          pointRadius: 4.5
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { title: { display: true, text: cData.x_label || 'X', color: '#94a3b8' }, grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#94a3b8' } },
          y: { title: { display: true, text: cData.y_label || 'Y', color: '#94a3b8' }, grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#94a3b8' } }
        }
      }
    });
  } else if (type === 'regression') {
    const scatterPts = (cData.x || []).map((xVal, i) => ({ x: xVal, y: (cData.y || [])[i] }));
    const linePts = (cData.x || []).map((xVal, i) => ({ x: xVal, y: (cData.y_line || [])[i] })).sort((a,b) => a.x - b.x);
    appState.charts.modal = new Chart(ctx, {
      type: 'scatter',
      data: {
        datasets: [
          {
            label: 'Actual Students',
            data: scatterPts,
            backgroundColor: '#818cf8',
            pointRadius: 4
          },
          {
            type: 'line',
            label: 'OLS Fitted Line',
            data: linePts,
            borderColor: '#f43f5e',
            borderWidth: 2.5,
            fill: false,
            pointRadius: 0
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#94a3b8' } },
          y: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#94a3b8' } }
        }
      }
    });
  } else if (type === 'pie') {
    appState.charts.modal = new Chart(ctx, {
      type: 'pie',
      data: {
        labels: cData.labels,
        datasets: [{
          data: cData.values,
          backgroundColor: ['#6366f1', '#38bdf8', '#f59e0b', '#f43f5e', '#10b981'],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'right', labels: { color: '#94a3b8' } } }
      }
    });
  }
}

// -----------------------------------------------------------------------------
// FULL VIEW EXPANDED MODAL (FOR CHARTS & OPTIONS)
// -----------------------------------------------------------------------------

function openFullViewForModalChart() {
  if (!appState.currentModalResult) return;
  const data = appState.currentModalResult;
  openFullViewCommon(data.title || 'Expanded Chart', data.chart_type, data.chart_data, data.results);
}

function openFullViewForChart(chartKey, title) {
  let type = 'bar';
  let chartData = null;
  let breakdown = {};

  if (chartKey === 'dept') {
    type = 'bar';
    chartData = {
      labels: ['Computer Science (BCE)', 'Electronics (BEC)', 'Information Tech (BIT)', 'Artificial Intel (BAI)', 'Data Science (BDS)', 'Electrical (BEE)'],
      values: [28, 12, 7, 5, 4, 3]
    };
    breakdown = { 'Top Discipline': 'Computer Science (28 students)', 'Total Departments': 12, 'Dominant Branch Proportion': '38.9%' };
  } else if (chartKey === 'sleep') {
    type = 'scatter';
    chartData = {
      x: [4.5, 5.0, 5.5, 6.0, 7.0, 8.0, 8.5],
      y: [84.2, 78.5, 68.2, 61.0, 46.1, 38.0, 31.4],
      x_label: 'Sleep Hours',
      y_label: 'Mean Burnout Index (%)'
    };
    breakdown = { 'Correlation': '-0.42 (Inverse Linear)', 'Critical Threshold': '< 5.5 hours sleep elevates burnout past 70%', 'Sample Tested': '72 students' };
  } else if (chartKey === 'risk') {
    type = 'pie';
    chartData = {
      labels: ['Critical Risk Cohort', 'Moderate Risk Cohort', 'Low Risk Cohort'],
      values: [33, 30, 9]
    };
    breakdown = { 'Critical Risk Count': '33 students (45.8%)', 'Primary Driver': 'Severe sleep deficit + High FAT workload' };
  } else if (chartKey === 'radar') {
    type = 'bar';
    chartData = {
      labels: ['Workload Pressure', 'Assignment Deadlines', 'Sleep Deficit', 'Burnout Index', 'Study Hours', 'Coping Resilience'],
      values: [78, 82, 54, 65, 52, 58]
    };
    breakdown = { 'Highest Pressure Point': 'Assignment Deadlines (82%)', 'Buffer Strength': 'Coping Resilience (58%)' };
  } else if (chartKey === 'solution') {
    type = 'bar';
    const simBurnout = window._lastSimBurnout || 47.0;
    const simStress = window._lastSimStress || 2.43;
    const simCrit = window._lastSimCrit || 18;
    chartData = {
      labels: ['Mean Burnout Index (%)', 'Mean Stress Level (x20)', 'Critical Risk Cohort (Count)'],
      values: [simBurnout, Math.round(simStress * 20 * 10) / 10, simCrit]
    };
    breakdown = {
      'Simulated Burnout': `${simBurnout}% (down from 64.3%)`,
      'Simulated Stress Level': `${simStress} / 4.0 (down from 3.14)`,
      'Critical Students Recovered': `${33 - simCrit} students safe`,
      'Model Significance': 'p < 0.0001 (R² = 0.528)'
    };
  }

  openFullViewCommon(title, type, chartData, breakdown);
}

function openFullViewCommon(title, type, chartData, breakdown) {
  document.getElementById('fullViewTitle').textContent = title;
  const modal = document.getElementById('fullViewModal');
  modal.classList.remove('hidden');

  // Render Table
  const tableContainer = document.getElementById('fullViewBreakdownTable');
  if (breakdown) {
    let tHtml = `<table class="w-full text-left text-xs"><tbody class="divide-y divide-white/5">`;
    for (const [k, v] of Object.entries(breakdown)) {
      tHtml += `<tr><td class="py-2 px-3 font-semibold text-slate-300 w-1/3">${k}</td><td class="py-2 px-3 font-mono text-cyan-300 font-bold">${v}</td></tr>`;
    }
    tHtml += `</tbody></table>`;
    tableContainer.innerHTML = tHtml;
  }

  // Render High Res Chart
  const canvas = document.getElementById('fullViewCanvas');
  const ctx = canvas.getContext('2d');
  if (appState.charts.fullView) {
    appState.charts.fullView.destroy();
  }

  if (type === 'bar') {
    appState.charts.fullView = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: chartData.labels,
        datasets: [{
          label: 'Magnitude / Count',
          data: chartData.values,
          backgroundColor: 'rgba(99, 102, 241, 0.8)',
          borderColor: '#6366f1',
          borderWidth: 2,
          borderRadius: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#94a3b8', font: { size: 12 } } },
          y: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#94a3b8', font: { size: 12 } } }
        }
      }
    });
  } else if (type === 'scatter') {
    const pts = (chartData.x || []).map((xVal, i) => ({ x: xVal, y: (chartData.y || [])[i] }));
    appState.charts.fullView = new Chart(ctx, {
      type: 'scatter',
      data: {
        datasets: [{
          label: 'Observations',
          data: pts,
          backgroundColor: '#06b6d4',
          pointRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { title: { display: true, text: chartData.x_label || 'X', color: '#94a3b8' }, ticks: { color: '#94a3b8' } },
          y: { title: { display: true, text: chartData.y_label || 'Y', color: '#94a3b8' }, ticks: { color: '#94a3b8' } }
        }
      }
    });
  } else if (type === 'pie') {
    appState.charts.fullView = new Chart(ctx, {
      type: 'pie',
      data: {
        labels: chartData.labels,
        datasets: [{
          data: chartData.values,
          backgroundColor: ['#f43f5e', '#f59e0b', '#10b981', '#6366f1'],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { color: '#cbd5e1', font: { size: 12 } } } }
      }
    });
  }
}

function closeFullViewModal() {
  document.getElementById('fullViewModal').classList.add('hidden');
  if (appState.charts.fullView) {
    appState.charts.fullView.destroy();
    appState.charts.fullView = null;
  }
}

function downloadFullViewChartPNG() {
  const canvas = document.getElementById('fullViewCanvas');
  if (!canvas) return;
  const link = document.createElement('a');
  link.download = 'statistics_pro_analysis_chart.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
  showToast('Chart exported as high-resolution PNG image!');
}

// -----------------------------------------------------------------------------
// SCRIPT & CODE CONSOLE (<>)
// -----------------------------------------------------------------------------

function openScriptModal() {
  document.getElementById('scriptModal').classList.remove('hidden');
}

function closeScriptModal() {
  document.getElementById('scriptModal').classList.add('hidden');
}

function switchScriptTab(lang) {
  const langs = ['python', 'r', 'guide'];
  langs.forEach(l => {
    document.getElementById(`scontent-${l}`).classList.toggle('hidden', l !== lang);
    const tab = document.getElementById(`stab-${l}`);
    tab.classList.toggle('bg-brand-600', l === lang);
    tab.classList.toggle('text-white', l === lang);
    tab.classList.toggle('bg-slate-900', l !== lang);
    tab.classList.toggle('text-slate-400', l !== lang);
  });
}

function copyScriptCode(elementId) {
  const codeEl = document.getElementById(elementId);
  if (!codeEl) return;
  navigator.clipboard.writeText(codeEl.innerText).then(() => {
    showToast('Code snippet copied to clipboard!');
  });
}

// -----------------------------------------------------------------------------
// EXECUTIVE DASHBOARD CHARTS & KPIS
// -----------------------------------------------------------------------------

async function loadOverviewAndCharts() {
  try {
    const res = await fetch('/api/overview');
    const json = await res.json();
    if (json.success && json.data) {
      const d = json.data;
      document.getElementById('kpi-total').textContent = d.total_students;
      document.getElementById('headerStudentCount').textContent = `${d.total_students} Students`;
      document.getElementById('kpi-stress-pct').textContent = `${d.high_stress_pct}%`;
      document.getElementById('kpi-critical').textContent = d.critical_risk_count;
      document.getElementById('kpi-sleep').textContent = `${d.avg_sleep_hours}h`;
      document.getElementById('kpi-sleep-deficit').textContent = `${d.sleep_deficit_pct}%`;
      document.getElementById('kpi-burnout').textContent = `${d.avg_burnout_index}%`;

      renderDashboardCharts(d);
    }
  } catch (err) {
    console.error('Failed to load overview:', err);
  }
}

function renderDashboardCharts(overviewData) {
  // 1. Department Breakdown Bar Chart
  const deptCanvas = document.getElementById('deptChart');
  if (deptCanvas && overviewData.department_breakdown) {
    if (appState.charts.dept) appState.charts.dept.destroy();
    const depts = overviewData.department_breakdown.slice(0, 6);
    appState.charts.dept = new Chart(deptCanvas.getContext('2d'), {
      type: 'bar',
      data: {
        labels: depts.map(d => d.code),
        datasets: [{
          label: 'Enrolled Students',
          data: depts.map(d => d.count),
          backgroundColor: 'rgba(99, 102, 241, 0.75)',
          borderRadius: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { color: '#94a3b8' } },
          y: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#94a3b8' } }
        }
      }
    });
  }

  // 2. Sleep vs Burnout Trend
  const sleepCanvas = document.getElementById('sleepScatterChart');
  if (sleepCanvas) {
    if (appState.charts.sleep) appState.charts.sleep.destroy();
    appState.charts.sleep = new Chart(sleepCanvas.getContext('2d'), {
      type: 'bubble',
      data: {
        datasets: [{
          label: 'Sleep Cohorts',
          data: [
            { x: 4.5, y: 78.5, r: 12 },
            { x: 5.5, y: 68.2, r: 24 },
            { x: 7.0, y: 46.1, r: 20 },
            { x: 8.5, y: 31.4, r: 8 }
          ],
          backgroundColor: 'rgba(6, 182, 212, 0.7)'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { title: { display: true, text: 'Sleep Duration (Hours)', color: '#94a3b8' }, ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255, 255, 255, 0.05)' } },
          y: { title: { display: true, text: 'Mean Burnout Index (%)', color: '#94a3b8' }, ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255, 255, 255, 0.05)' } }
        }
      }
    });
  }

  // 3. Risk Doughnut Chart
  const riskCanvas = document.getElementById('riskDoughnutChart');
  if (riskCanvas) {
    if (appState.charts.risk) appState.charts.risk.destroy();
    const critical = overviewData.critical_risk_count || 33;
    const total = overviewData.total_students || 72;
    const moderate = Math.round(total * 0.42);
    const low = total - critical - moderate;
    appState.charts.risk = new Chart(riskCanvas.getContext('2d'), {
      type: 'doughnut',
      data: {
        labels: ['Critical Risk', 'Moderate Risk', 'Low Risk'],
        datasets: [{
          data: [critical, moderate, low],
          backgroundColor: ['#f43f5e', '#f59e0b', '#10b981'],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '68%',
        plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8', font: { size: 10 } } } }
      }
    });
  }

  // 4. Psychometric Radar
  const radarCanvas = document.getElementById('radarChart');
  if (radarCanvas) {
    if (appState.charts.radar) appState.charts.radar.destroy();
    appState.charts.radar = new Chart(radarCanvas.getContext('2d'), {
      type: 'radar',
      data: {
        labels: ['Workload Pressure', 'Assignment Deadlines', 'Sleep Deficit', 'Burnout Index', 'Study Hours', 'Coping Resilience'],
        datasets: [{
          label: 'Current College Cohort Profile',
          data: [78, 82, 54, 65, 52, 58],
          backgroundColor: 'rgba(139, 92, 246, 0.25)',
          borderColor: '#8b5cf6',
          borderWidth: 2,
          pointBackgroundColor: '#a855f7'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          r: {
            angleLines: { color: 'rgba(255, 255, 255, 0.1)' },
            grid: { color: 'rgba(255, 255, 255, 0.08)' },
            pointLabels: { color: '#cbd5e1', font: { size: 10 } },
            ticks: { display: false }
          }
        }
      }
    });
  }
}

// -----------------------------------------------------------------------------
// LIVE DATA TABLE MANAGEMENT (CRUD)
// -----------------------------------------------------------------------------

async function refreshTable(page = 1) {
  appState.currentPage = page;
  const search = document.getElementById('tableSearchInput')?.value || '';
  const branch = document.getElementById('tableBranchSelect')?.value || 'ALL';
  const risk = document.getElementById('tableRiskSelect')?.value || 'ALL';

  try {
    const url = `/api/dataset?page=${page}&page_size=${appState.pageSize}&search=${encodeURIComponent(search)}&branch=${encodeURIComponent(branch)}&risk=${encodeURIComponent(risk)}`;
    const res = await fetch(url);
    const json = await res.json();

    if (json.success) {
      renderTableRows(json.data);
      updatePagination(json.total, page, appState.pageSize);
      populateBranchDropdown(json.branches);
    }
  } catch (err) {
    console.error('Failed to load dataset rows:', err);
  }
}

function renderTableRows(records) {
  const tbody = document.getElementById('studentTableBody');
  if (!tbody) return;

  if (records.length === 0) {
    tbody.innerHTML = `<tr><td colspan="12" class="py-6 text-center text-slate-500">No matching student records found.</td></tr>`;
    return;
  }

  tbody.innerHTML = records.map(r => {
    const riskBadge = r.risk_level === 'Critical Risk' 
      ? `<span class="px-2 py-0.5 rounded-full text-[10px] bg-rose-500/20 text-rose-300 font-bold border border-rose-500/30">Critical</span>`
      : (r.risk_level === 'Moderate Risk'
        ? `<span class="px-2 py-0.5 rounded-full text-[10px] bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">Moderate</span>`
        : `<span class="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">Low Risk</span>`);

    return `
      <tr class="hover:bg-white/5 transition-colors">
        <td class="py-2.5 px-3 font-mono text-slate-500">${r.id}</td>
        <td class="py-2.5 px-3 font-semibold text-white whitespace-nowrap">${r.name}</td>
        <td class="py-2.5 px-3 font-mono text-brand-300">${r.reg_no}</td>
        <td class="py-2.5 px-3 whitespace-nowrap"><span class="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-slate-300 font-mono">${r.branch_code}</span> ${r.batch_year}</td>
        <td class="py-2.5 px-3">${r.workload}</td>
        <td class="py-2.5 px-3">${r.study_hours}</td>
        <td class="py-2.5 px-3">${r.sleep_hours}</td>
        <td class="py-2.5 px-3">${r.screen_time}</td>
        <td class="py-2.5 px-3 font-medium text-amber-300">${r.stress_level}</td>
        <td class="py-2.5 px-3 font-mono font-bold ${r.burnout_index >= 70 ? 'text-rose-400' : 'text-slate-300'}">${r.burnout_index}%</td>
        <td class="py-2.5 px-3 whitespace-nowrap">${riskBadge}</td>
        <td class="py-2.5 px-3 text-right whitespace-nowrap space-x-1.5">
          <button onclick="viewStudentSolution('${r.reg_no}')" title="View Personalized Stress Solution" class="p-1.5 text-amber-400 hover:text-amber-300 rounded hover:bg-amber-500/10 transition-colors">
            <i class="fa-solid fa-heart-pulse"></i>
          </button>
          <button onclick="editStudentRecord(${JSON.stringify(r).replace(/"/g, '&quot;')})" title="Edit Student" class="p-1.5 text-slate-400 hover:text-brand-400 rounded hover:bg-white/10 transition-colors">
            <i class="fa-solid fa-pen-to-square"></i>
          </button>
          <button onclick="deleteStudentRecord(${r.id})" title="Delete Student" class="p-1.5 text-slate-400 hover:text-rose-400 rounded hover:bg-white/10 transition-colors">
            <i class="fa-solid fa-trash"></i>
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

function updatePagination(total, page, pageSize) {
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  document.getElementById('paginationInfo').textContent = `Showing ${total > 0 ? start : 0} to ${end} of ${total} entries`;
  document.getElementById('currentPageBadge').textContent = page;
  document.getElementById('btnPrevPage').disabled = page <= 1;
  document.getElementById('btnNextPage').disabled = end >= total;
}

function changePage(delta) {
  refreshTable(appState.currentPage + delta);
}

function populateBranchDropdown(branches) {
  const sel = document.getElementById('tableBranchSelect');
  if (!sel || sel.children.length > 1) return;
  branches.forEach(b => {
    const opt = document.createElement('option');
    opt.value = b.code;
    opt.textContent = `${b.code} - ${b.name}`;
    sel.appendChild(opt);
  });
}

// -----------------------------------------------------------------------------
// STUDENT ADD & EDIT MODALS
// -----------------------------------------------------------------------------

function openAddStudentModal() {
  document.getElementById('studentModalTitle').textContent = 'Add New Student Survey Record';
  document.getElementById('studentFormId').value = '';
  document.getElementById('studentForm').reset();
  document.getElementById('studentModal').classList.remove('hidden');
}

function editStudentRecord(rec) {
  document.getElementById('studentModalTitle').textContent = `Edit Record: ${rec.name} (${rec.reg_no})`;
  document.getElementById('studentFormId').value = rec.id;
  document.getElementById('sf_name').value = rec.name;
  document.getElementById('sf_reg_no').value = rec.reg_no;
  document.getElementById('sf_email').value = rec.email || '';
  document.getElementById('sf_workload').value = rec.workload;
  document.getElementById('sf_study_hours').value = rec.study_hours;
  document.getElementById('sf_sleep_hours').value = rec.sleep_hours;
  document.getElementById('sf_screen_time').value = rec.screen_time;
  document.getElementById('sf_stress_level').value = rec.stress_level;
  document.getElementById('sf_burnout').value = rec.burnout;
  document.getElementById('sf_support_system').value = rec.support_system;
  document.getElementById('studentModal').classList.remove('hidden');
}

function closeStudentModal() {
  document.getElementById('studentModal').classList.add('hidden');
}

async function saveStudent(e) {
  e.preventDefault();
  const id = document.getElementById('studentFormId').value;
  const payload = {
    name: document.getElementById('sf_name').value,
    reg_no: document.getElementById('sf_reg_no').value,
    email: document.getElementById('sf_email').value,
    workload: document.getElementById('sf_workload').value,
    study_hours: document.getElementById('sf_study_hours').value,
    sleep_hours: document.getElementById('sf_sleep_hours').value,
    screen_time: document.getElementById('sf_screen_time').value,
    stress_level: document.getElementById('sf_stress_level').value,
    burnout: document.getElementById('sf_burnout').value,
    support_system: document.getElementById('sf_support_system').value,
    overwhelmed: document.getElementById('sf_overwhelmed').value
  };

  const isEdit = !!id;
  const url = isEdit ? `/api/dataset/row/${id}` : '/api/dataset/row';
  const method = isEdit ? 'PUT' : 'POST';

  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    if (json.success) {
      closeStudentModal();
      showToast(json.message || 'Dataset updated successfully!');
      await refreshTable(appState.currentPage);
      await loadOverviewAndCharts();
    }
  } catch (err) {
    showToast('Failed to save student record.', true);
  }
}

async function deleteStudentRecord(id) {
  if (!confirm(`Are you sure you want to delete student record #${id}?`)) return;

  try {
    const res = await fetch(`/api/dataset/row/${id}`, { method: 'DELETE' });
    const json = await res.json();
    if (json.success) {
      showToast(json.message || 'Record deleted.');
      await refreshTable(appState.currentPage);
      await loadOverviewAndCharts();
    }
  } catch (err) {
    showToast('Failed to delete student record.', true);
  }
}

async function resetDataset() {
  if (!confirm('Reset all student data back to the original 72 survey responses?')) return;

  try {
    const res = await fetch('/api/dataset/reset', { method: 'POST' });
    const json = await res.json();
    if (json.success) {
      showToast('Dataset restored to default 72 responses!');
      await refreshTable(1);
      await loadOverviewAndCharts();
    }
  } catch (err) {
    showToast('Failed to reset dataset.', true);
  }
}

// -----------------------------------------------------------------------------
// 20x20 CORRELATION HEATMAP
// -----------------------------------------------------------------------------

async function loadHeatmap() {
  const container = document.getElementById('heatmapContainer');
  if (!container) return;

  const method = document.getElementById('heatmapMethodSelect')?.value || 'pearson';
  container.innerHTML = `<div class="p-8 text-center text-slate-400"><i class="fa-solid fa-spinner fa-spin mr-2"></i> Generating 20x20 ${method.toUpperCase()} Correlation Matrix...</div>`;

  try {
    const res = await fetch(`/api/correlation_matrix?method=${method}`);
    const json = await res.json();
    if (json.success) {
      renderHeatmapGrid(json);
    }
  } catch (err) {
    container.innerHTML = `<div class="p-6 text-rose-400">Error loading correlation matrix.</div>`;
  }
}

function renderHeatmapGrid(data) {
  const container = document.getElementById('heatmapContainer');
  const keys = data.keys;
  const labels = data.labels;
  const matrix = data.matrix;

  let tableHtml = `<table class="border-collapse text-[11px] font-mono">`;

  // Header row
  tableHtml += `<tr><th class="p-2 text-slate-500 font-sans">Indicators</th>`;
  labels.forEach(l => {
    tableHtml += `<th class="p-1 text-slate-400 font-sans font-semibold text-center whitespace-nowrap" style="writing-mode: vertical-rl; transform: rotate(180deg); min-width: 32px; height: 110px;">${l}</th>`;
  });
  tableHtml += `</tr>`;

  // Rows
  keys.forEach((rowKey, i) => {
    tableHtml += `<tr><td class="p-2 text-slate-300 font-sans font-medium whitespace-nowrap">${labels[i]}</td>`;
    keys.forEach(colKey => {
      const val = matrix[rowKey] ? matrix[rowKey][colKey] : 0;
      const bg = getHeatmapColor(val);
      const textColor = Math.abs(val) > 0.4 ? '#ffffff' : '#94a3b8';
      tableHtml += `
        <td 
          class="heatmap-cell text-center p-1.5 font-bold" 
          style="background-color: ${bg}; color: ${textColor}; width: 34px; height: 34px;"
          title="${labels[i]} vs ${VARIABLE_INFO_LABEL(colKey)}: ${val}"
          onclick="inspectPair('${rowKey}', '${colKey}')"
        >
          ${val.toFixed(1)}
        </td>
      `;
    });
    tableHtml += `</tr>`;
  });

  tableHtml += `</table>`;
  container.innerHTML = tableHtml;
}

function getHeatmapColor(val) {
  if (val > 0) {
    const intensity = Math.min(1, val);
    return `rgba(225, 29, 72, ${0.15 + intensity * 0.75})`;
  } else if (val < 0) {
    const intensity = Math.min(1, Math.abs(val));
    return `rgba(37, 99, 235, ${0.15 + intensity * 0.75})`;
  } else {
    return 'rgba(15, 23, 42, 0.5)';
  }
}

function VARIABLE_INFO_LABEL(key) {
  const match = appState.variables.find(v => v.key === key);
  return match ? match.short : key;
}

function inspectPair(var1, var2) {
  openCalcModal('pearson_r');
  const sel1 = document.getElementById('input_var1');
  const sel2 = document.getElementById('input_var2');
  if (sel1 && sel2) {
    sel1.value = var1;
    sel2.value = var2;
    executeCurrentCalculation();
  }
}

// -----------------------------------------------------------------------------
// STUDENT EARLY-WARNING SCORECARD
// -----------------------------------------------------------------------------

async function loadScorecard() {
  const container = document.getElementById('riskScorecardList');
  if (!container) return;

  try {
    const res = await fetch('/api/dataset?page=1&page_size=50&risk=Critical Risk');
    const json = await res.json();
    if (json.success) {
      const criticalStudents = json.data;
      if (criticalStudents.length === 0) {
        container.innerHTML = `<div class="col-span-3 p-8 text-center text-emerald-400">Great news! No critical burnout risks currently detected in cohort.</div>`;
        return;
      }

      container.innerHTML = criticalStudents.map(s => `
        <div class="glass-panel p-5 border-l-4 border-l-rose-500 flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between mb-2">
              <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">Priority Counseling</span>
              <span class="text-xs font-mono text-slate-400">${s.reg_no}</span>
            </div>
            <h4 class="text-base font-bold text-white">${s.name}</h4>
            <p class="text-xs text-brand-300">${s.branch_name} &bull; Batch ${s.batch_year}</p>

            <div class="grid grid-cols-2 gap-2 my-3 text-xs bg-slate-900/60 p-2.5 rounded-lg border border-white/5">
              <div>
                <span class="text-slate-400 block text-[10px]">Burnout Index</span>
                <span class="text-rose-400 font-bold font-mono text-sm">${s.burnout_index}%</span>
              </div>
              <div>
                <span class="text-slate-400 block text-[10px]">Sleep Deficit</span>
                <span class="text-purple-300 font-bold font-mono text-sm">${s.sleep_hours}</span>
              </div>
              <div>
                <span class="text-slate-400 block text-[10px]">Current Stress</span>
                <span class="text-amber-300 font-bold">${s.stress_level}</span>
              </div>
              <div>
                <span class="text-slate-400 block text-[10px]">Study Load</span>
                <span class="text-slate-200 font-bold">${s.workload}</span>
              </div>
            </div>
          </div>

          <div class="pt-3 border-t border-white/5 flex items-center justify-between text-xs">
            <button onclick="viewStudentSolution('${s.reg_no}')" class="px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 font-bold text-xs flex items-center space-x-1.5 transition-colors">
              <i class="fa-solid fa-heart-pulse"></i>
              <span>View Solution &rarr;</span>
            </button>
            <button onclick="editStudentRecord(${JSON.stringify(s).replace(/"/g, '&quot;')})" class="text-slate-400 hover:text-white text-[11px]">
              Edit Record
            </button>
          </div>
        </div>
      `).join('');
    }
  } catch (err) {
    console.error('Failed to load scorecard:', err);
  }
}

// -----------------------------------------------------------------------------
// ENCYCLOPEDIA & FORMULAS MANUAL
// -----------------------------------------------------------------------------

function renderEncyclopedia() {
  const container = document.getElementById('encyclopediaAccordion');
  if (!container || container.children.length > 0) return;

  container.innerHTML = appState.options.map(opt => `
    <div class="glass-panel p-4 border border-white/10 rounded-xl">
      <div class="flex items-center justify-between cursor-pointer" onclick="this.nextElementSibling.classList.toggle('hidden')">
        <div class="flex items-center space-x-3">
          <span class="w-6 h-6 rounded-full bg-brand-500/20 text-brand-300 font-mono text-xs flex items-center justify-center font-bold">#${opt.number}</span>
          <div>
            <h4 class="text-sm font-bold text-white">${opt.title}</h4>
            <p class="text-xs text-brand-300">${opt.category}</p>
          </div>
        </div>
        <i class="fa-solid fa-chevron-down text-slate-500 text-xs"></i>
      </div>

      <div class="hidden mt-4 pt-3 border-t border-white/10 space-y-3">
        <div class="bg-black/30 p-3 rounded-lg text-center overflow-x-auto text-sm text-slate-100">
          $$${opt.formula_latex}$$
        </div>
        <div class="text-xs space-y-1.5">
          <p class="text-slate-300"><strong class="text-slate-400">Theoretical Purpose:</strong> ${opt.desc_en}</p>
        </div>
        <div class="pt-2 flex justify-end">
          <button onclick="openCalcModal('${opt.id}')" class="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center space-x-1.5 shadow-md shadow-emerald-600/25">
            <i class="fa-solid fa-play text-[10px]"></i>
            <span>Test on Dataset</span>
          </button>
        </div>
      </div>
    </div>
  `).join('');

  if (window.renderMathInElement) {
    renderMathInElement(container, {
      delimiters: [
        {left: '$$', right: '$$', display: true},
        {left: '$', right: '$', display: false}
      ],
      throwOnError: false
    });
  }
}

// Toast message
function showToast(msg, isError = false) {
  const toast = document.getElementById('toast');
  const icon = document.getElementById('toastIcon');
  const text = document.getElementById('toastMsg');
  if (!toast) return;

  text.textContent = msg;
  icon.className = isError ? 'fa-solid fa-circle-exclamation text-rose-400' : 'fa-solid fa-check text-emerald-400';
  toast.classList.remove('hidden');

  setTimeout(() => {
    toast.classList.add('hidden');
  }, 3500);
}

// -----------------------------------------------------------------------------
// DOWNWARD SLIDING GRAPH DRAWER & FULL VIEW INTEGRATION
// -----------------------------------------------------------------------------

function toggleGraphSlide(drawerId, btn) {
  const drawer = document.getElementById(drawerId);
  if (!drawer) return;
  const isOpen = drawer.classList.contains('open');

  if (isOpen) {
    drawer.classList.remove('open');
    if (btn) {
      const chevron = btn.querySelector('.chevron-downward');
      if (chevron) chevron.classList.remove('rotated');
      const textSpan = btn.querySelector('.slide-btn-text');
      if (textSpan) textSpan.textContent = 'Details';
    }
  } else {
    drawer.classList.add('open');
    if (btn) {
      const chevron = btn.querySelector('.chevron-downward');
      if (chevron) chevron.classList.add('rotated');
      const textSpan = btn.querySelector('.slide-btn-text');
      if (textSpan) textSpan.textContent = 'Close';
    }
  }
}

// -----------------------------------------------------------------------------
// STRESS & STRESS SOLUTIONS SIMULATION ENGINE (TAB & OPTION 73)
// -----------------------------------------------------------------------------

let stressSolutionChart = null;

function initStressSolutionsView() {
  onStressSliderChange();
  populateIndividualStudentDropdown();
  if (window.renderMathInElement) {
    const view = document.getElementById('view-solutions');
    if (view) {
      renderMathInElement(view, {
        delimiters: [
          {left: '$$', right: '$$', display: true},
          {left: '$', right: '$', display: false}
        ],
        throwOnError: false
      });
    }
  }
}

function onStressSliderChange() {
  const sleep = parseFloat(document.getElementById('sliderSleep')?.value || 1.0);
  const workload = parseFloat(document.getElementById('sliderWorkload')?.value || 0.5);
  const support = parseFloat(document.getElementById('sliderSupport')?.value || 1.0);

  const elSleep = document.getElementById('sliderSleepVal');
  const elWorkload = document.getElementById('sliderWorkloadVal');
  const elSupport = document.getElementById('sliderSupportVal');

  if (elSleep) elSleep.textContent = `+${sleep.toFixed(2)} hr / night`;
  if (elWorkload) elWorkload.textContent = `-${workload.toFixed(2)} Tiers`;
  if (elSupport) elSupport.textContent = `+${support.toFixed(2)} Tiers`;

  updateStressSolutionSimulation(sleep, workload, support);
}

function applyStressPreset(sleep, workload, support) {
  const sSleep = document.getElementById('sliderSleep');
  const sWorkload = document.getElementById('sliderWorkload');
  const sSupport = document.getElementById('sliderSupport');

  if (sSleep) sSleep.value = sleep;
  if (sWorkload) sWorkload.value = workload;
  if (sSupport) sSupport.value = support;

  onStressSliderChange();
  showToast(`Applied preset: +${sleep}h Sleep, -${workload} Workload, +${support} Support`);
}

function resetStressSliders() {
  applyStressPreset(1.0, 0.5, 1.0);
}

async function updateStressSolutionSimulation(sleep, workload, support) {
  // Baseline constants from cohort survey analysis
  const mBurnout = 64.3;
  const mStress = 3.14;
  const critCount = 33;

  // Multivariate regression beta equations:
  // delta_burnout = (7.22 * sleep) + (5.84 * support) + (8.45 * workload)
  const deltaBurnout = (7.22 * sleep) + (5.84 * support) + (8.45 * workload);
  const simBurnout = Math.max(15.0, Math.round((mBurnout - deltaBurnout) * 10) / 10);
  const burnoutDropPct = Math.round((deltaBurnout / mBurnout) * 1000) / 10;

  const deltaStress = (0.28 * sleep) + (0.24 * support) + (0.35 * workload);
  const simStress = Math.max(1.2, Math.round((mStress - deltaStress) * 100) / 100);
  const actualDeltaStress = Math.round((mStress - simStress) * 100) / 100;

  const simCritCount = Math.max(4, Math.round(critCount * (1.0 - (deltaBurnout / mBurnout) * 1.15)));
  const recoveredStudents = critCount - simCritCount;

  // Persist for Full View modal
  window._lastSimBurnout = simBurnout;
  window._lastSimStress = simStress;
  window._lastSimCrit = simCritCount;

  // Update UI Elements
  const elSimBurnout = document.getElementById('solSimBurnout');
  const elBurnoutDrop = document.getElementById('solBurnoutDropBadge');
  const elSimStress = document.getElementById('solSimStress');
  const elStressDrop = document.getElementById('solStressDropBadge');
  const elSimCrit = document.getElementById('solSimCritical');
  const elRecovered = document.getElementById('solCriticalRecovered');
  const elAlleviation = document.getElementById('solRelativeAlleviation');

  if (elSimBurnout) elSimBurnout.textContent = `${simBurnout}%`;
  if (elBurnoutDrop) elBurnoutDrop.textContent = `-${Math.round(deltaBurnout * 10) / 10}%`;
  if (elSimStress) elSimStress.textContent = `${simStress}`;
  if (elStressDrop) elStressDrop.textContent = `-${actualDeltaStress}`;
  if (elSimCrit) elSimCrit.textContent = `${simCritCount}`;
  if (elRecovered) elRecovered.textContent = `${recoveredStudents} Students Recovered`;
  if (elAlleviation) elAlleviation.textContent = `${burnoutDropPct}%`;

  // Update Solution Chart
  const canvas = document.getElementById('solutionChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const chartLabels = ['Burnout Index (%)', 'Stress Level (x20)', 'Critical Cohort (Count)'];
  const baselineData = [mBurnout, Math.round(mStress * 20 * 10) / 10, critCount];
  const simulatedData = [simBurnout, Math.round(simStress * 20 * 10) / 10, simCritCount];

  if (stressSolutionChart) {
    stressSolutionChart.data.datasets[1].data = simulatedData;
    stressSolutionChart.update('none');
  } else {
    stressSolutionChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: chartLabels,
        datasets: [
          {
            label: 'Baseline Cohort Strain',
            data: baselineData,
            backgroundColor: 'rgba(239, 68, 68, 0.75)',
            borderColor: '#ef4444',
            borderWidth: 1.5,
            borderRadius: 6
          },
          {
            label: 'Simulated Post-Intervention',
            data: simulatedData,
            backgroundColor: 'rgba(16, 185, 129, 0.85)',
            borderColor: '#10b981',
            borderWidth: 1.5,
            borderRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: { color: '#cbd5e1', font: { size: 11, family: 'Inter' } }
          },
          tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            borderColor: 'rgba(255, 255, 255, 0.1)',
            borderWidth: 1
          }
        },
        scales: {
          x: {
            ticks: { color: '#94a3b8', font: { size: 11 } },
            grid: { display: false }
          },
          y: {
            ticks: { color: '#94a3b8', font: { size: 11 } },
            grid: { color: 'rgba(255, 255, 255, 0.06)' },
            beginAtZero: true
          }
        }
      }
    });
  }
}

// -----------------------------------------------------------------------------
// INDIVIDUAL STUDENT PERSONALIZED STRESS DIAGNOSTIC & SOLUTION
// -----------------------------------------------------------------------------

let allCohortStudents = [];

async function fetchAllStudentsIfNeeded() {
  if (allCohortStudents.length > 0) return allCohortStudents;
  try {
    const res = await fetch('/api/dataset?page=1&page_size=200');
    const json = await res.json();
    if (json.success && json.data) {
      allCohortStudents = json.data;
    }
  } catch (e) {
    console.error('Error fetching cohort students:', e);
  }
  return allCohortStudents;
}

async function populateIndividualStudentDropdown() {
  const select = document.getElementById('individualStudentSelect');
  if (!select) return;
  const students = await fetchAllStudentsIfNeeded();
  if (!students || students.length === 0) return;

  const currentVal = select.value;
  select.innerHTML = students.map(s => `
    <option value="${s.reg_no}" ${s.reg_no === currentVal ? 'selected' : ''}>
      ${s.reg_no} - ${s.name} (${s.branch_code}) [${s.risk_level}]
    </option>
  `).join('');

  const targetReg = currentVal || (students.find(s => s.risk_level === 'Critical Risk')?.reg_no || students[0].reg_no);
  select.value = targetReg;
  onSelectIndividualStudent(targetReg);
}

async function onSelectIndividualStudent(regNo) {
  const students = await fetchAllStudentsIfNeeded();
  const s = students.find(st => st.reg_no === regNo);
  const container = document.getElementById('individualStudentResult');
  if (!container || !s) return;

  container.innerHTML = buildStudentSolutionHtml(s, false);
}

function getDifferentiatedPrescriptions(riskLevel, isSevereSleep, isHeavyWorkload, isLowSupport, isHighScreen, isHighCareerAnxiety) {
  if (riskLevel === 'Critical Risk') {
    return {
      protocolTitle: 'ACUTE CLINICAL & INSTITUTIONAL DE-ESCALATION PROTOCOL',
      protocolBadge: 'bg-rose-500/20 text-rose-300 border border-rose-500/30',
      protocolSummary: 'High-acuity institutional intervention required: emergency deadline buffer, clinical circadian rescue, and mandatory faculty counselor triage to arrest imminent burnout breakdown.',
      pillars: [
        {
          num: 1,
          color: 'rose',
          title: 'Emergency 5-Day Assessment Extension Buffer',
          desc: 'Submit immediate academic advisor petition for 5-day deadline buffering across continuous assessments and lab FAT modules to halt cognitive overload.'
        },
        {
          num: 2,
          color: 'indigo',
          title: 'Clinical Circadian Reset (7.5h Mandatory Sleep)',
          desc: 'Non-negotiable sleep rescue window from 11:00 PM to 6:30 AM. Cease all nocturnal study sessions and eliminate caffeine past 2:00 PM.'
        },
        {
          num: 3,
          color: 'purple',
          title: '1-on-1 Faculty Mentor & Counseling Triage',
          desc: 'Mandatory bi-weekly confidential triage session with designated departmental psychological counselor to defuse imposter syndrome and stress spikes.'
        },
        {
          num: 4,
          color: 'amber',
          title: 'Curriculum Workload De-escalation & Audit',
          desc: 'Temporarily pause non-essential campus societies, audit heavy laboratory modules, and establish strict 6-hour daily study ceilings.'
        }
      ],
      boosters: isSevereSleep 
        ? 'Priority Sleep Triage: Remove smartphone and laptop from the bedroom 45 minutes before sleep to restore suppressed melatonin levels.'
        : (isHeavyWorkload 
          ? 'Priority Workload Triage: Request course coordinator permission to submit modular project components incrementally.'
          : 'Priority Psychological Triage: Daily 20-minute guided relaxation or mindfulness to lower autonomic nervous system arousal.')
    };
  } else if (riskLevel === 'Moderate Risk') {
    return {
      protocolTitle: 'PREVENTATIVE OPTIMIZATION & STUDY-LIFE BALANCING PROTOCOL',
      protocolBadge: 'bg-amber-500/20 text-amber-300 border border-amber-500/30',
      protocolSummary: 'Proactive preventative balancing: structured time-boxing, peer study cohorts, caffeine sunset curfew, and early career roadmap demystification.',
      pillars: [
        {
          num: 1,
          color: 'amber',
          title: 'Pomodoro 25/5 Study Sprint Cadence',
          desc: 'Structure curriculum preparation into 25-minute focused study sprints followed by 5-minute offline screen breaks to eliminate mental fatigue.'
        },
        {
          num: 2,
          color: 'indigo',
          title: 'Sleep Cadence & Afternoon Caffeine Sunset',
          desc: 'Maintain a 6.5 - 7.5 hour regular sleep schedule. Enforce a strict caffeine/energy-drink cutoff at 3:30 PM to optimize REM sleep quality.'
        },
        {
          num: 3,
          color: 'cyan',
          title: 'Structured Peer Study Circles (3-Person Cohorts)',
          desc: 'Join a 3-person peer study circle in challenging analytical subjects to collaborate on problem-sets and eliminate study isolation.'
        },
        {
          num: 4,
          color: 'emerald',
          title: 'Career & Placement Roadmap Demystification',
          desc: 'Attend departmental alumni mentoring hours to demystify placement criteria and build targeted project portfolios instead of anxiety.'
        }
      ],
      boosters: isHighScreen 
        ? 'Priority Screen Balance: Enable greyscale display mode on your smartphone after 8:00 PM to cut mindless social media dopamine spikes.'
        : (isLowSupport 
          ? 'Priority Social Buffer: Attend weekly department open tea hours to foster casual connections with faculty and senior peers.'
          : 'Priority Wellness Routine: Dedicate Sunday afternoons strictly to non-academic hobbies and physical recuperation.')
    };
  } else {
    // Low Risk / Resilient Cohort
    return {
      protocolTitle: 'PEER LEADERSHIP & SUSTAINED HIGH-PERFORMANCE PROTOCOL',
      protocolBadge: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
      protocolSummary: 'Sustained resilience and leadership: peer mentoring, advanced elective deep-work, athletic conditioning, and healthy wellness boundaries.',
      pillars: [
        {
          num: 1,
          color: 'emerald',
          title: 'Peer Mentorship & Study Buddy Leadership',
          desc: 'Channel strong coping resilience into mentoring 1-2 junior or struggling classmates in high-strain subjects; enhances subject mastery and leadership.'
        },
        {
          num: 2,
          color: 'cyan',
          title: 'High-Impact Innovation & Research Deep Work',
          desc: 'Leverage low stress bandwidth to tackle competitive hackathons, open-source repositories, or co-author IEEE/conference papers with faculty.'
        },
        {
          num: 3,
          color: 'purple',
          title: 'Athletic Conditioning & Endurance Biohacking',
          desc: 'Maintain regular gym, sports, or aerobic endurance workouts to elevate baseline neurotrophic factors and cognitive stamina.'
        },
        {
          num: 4,
          color: 'indigo',
          title: 'Sustained Academic Boundaries & Burnout Immunity',
          desc: 'Protect personal creative boundaries, prioritize vacation breaks, and guard against over-committing to excessive elective projects.'
        }
      ],
      boosters: 'Priority Sustained Cadence: Maintain your balanced lifestyle routine and share effective time-management habits during departmental student council meetings.'
    };
  }
}

function buildStudentSolutionHtml(s, isModal = false) {
  const isSevereSleep = s.sleep_hours.includes('Less than 5') || s.sleep_hours.includes('5-6');
  const isHeavyWorkload = ['High', 'Very high', 'Extremely high', 'High or very high'].some(w => (s.workload || '').includes(w));
  const isLowSupport = ['Rarely', 'Never', 'Rarely or never', 'Sometimes'].some(w => (s.support_system || '').includes(w));
  const isHighScreen = (s.screen_time || '').includes('3-4') || (s.screen_time || '').includes('More than 4');
  const isHighCareerAnxiety = ['Often', 'Always', 'Often / Severe Concern'].some(w => (s.career_anxiety || '').includes(w));

  const plan = getDifferentiatedPrescriptions(s.risk_level, isSevereSleep, isHeavyWorkload, isLowSupport, isHighScreen, isHighCareerAnxiety);

  const currentBurnout = parseFloat(s.burnout_index) || 50.0;
  const simDrop = Math.round(( (isSevereSleep ? 10.8 : 5.4) + (isHeavyWorkload ? 8.5 : 4.2) + (isLowSupport ? 5.8 : 2.9) ) * 10) / 10;
  const simBurnout = Math.max(12.0, Math.round((currentBurnout - simDrop) * 10) / 10);

  const riskBadge = s.risk_level === 'Critical Risk'
    ? `<span class="px-2.5 py-1 rounded-full text-xs font-extrabold bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center space-x-1.5"><i class="fa-solid fa-triangle-exclamation"></i><span>Critical Risk Cohort</span></span>`
    : (s.risk_level === 'Moderate Risk'
      ? `<span class="px-2.5 py-1 rounded-full text-xs font-extrabold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center space-x-1.5"><i class="fa-solid fa-circle-exclamation"></i><span>Moderate Strain Cohort</span></span>`
      : `<span class="px-2.5 py-1 rounded-full text-xs font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center space-x-1.5"><i class="fa-solid fa-circle-check"></i><span>Low Risk / Resilient</span></span>`);

  const simRiskBadge = simBurnout < 40
    ? `<span class="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">Low Risk (Stabilized)</span>`
    : (simBurnout < 70
      ? `<span class="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">Moderate (De-escalated)</span>`
      : `<span class="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">Requires Clinical Follow-up</span>`);

  return `
    <div class="space-y-5 animate-pop-in">
      
      <!-- Student Header Profile Banner -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/90 p-4 rounded-xl border border-white/10">
        <div class="flex items-center space-x-3.5">
          <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-600 to-indigo-600 flex items-center justify-center text-white font-extrabold text-base shadow-lg shadow-cyan-600/20 shrink-0">
            ${(s.name || 'ST').substring(0, 2).toUpperCase()}
          </div>
          <div>
            <div class="flex items-center space-x-2">
              <h4 class="text-base font-extrabold text-white">${s.name}</h4>
              <span class="font-mono text-xs px-2 py-0.5 rounded bg-slate-800 text-cyan-300 border border-cyan-500/30 font-semibold">${s.reg_no}</span>
            </div>
            <p class="text-xs text-slate-400 mt-0.5">${s.branch_name} (${s.branch_code}) &bull; Batch Year ${s.batch_year}</p>
          </div>
        </div>
        <div>
          ${riskBadge}
        </div>
      </div>

      <!-- Current Measured Metrics vs Simulated Post-Intervention Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        <!-- Left: Current Baseline Measurements -->
        <div class="bg-slate-900/60 p-4 rounded-xl border border-white/5 space-y-3">
          <div class="flex items-center justify-between text-xs font-bold text-slate-300 border-b border-white/10 pb-2">
            <span class="flex items-center space-x-1.5 text-rose-400">
              <i class="fa-solid fa-chart-simple"></i>
              <span>Current Measured Strain</span>
            </span>
            <span class="font-mono text-rose-400 font-bold">Burnout: ${s.burnout_index}%</span>
          </div>
          <div class="grid grid-cols-2 gap-2.5 text-xs">
            <div class="bg-black/30 p-2 rounded-lg">
              <span class="text-slate-400 block text-[10px]">Sleep Hours</span>
              <span class="font-bold ${isSevereSleep ? 'text-rose-400' : 'text-slate-200'}">${s.sleep_hours}</span>
            </div>
            <div class="bg-black/30 p-2 rounded-lg">
              <span class="text-slate-400 block text-[10px]">Workload Level</span>
              <span class="font-bold ${isHeavyWorkload ? 'text-amber-400' : 'text-slate-200'}">${s.workload}</span>
            </div>
            <div class="bg-black/30 p-2 rounded-lg">
              <span class="text-slate-400 block text-[10px]">Stress Perception</span>
              <span class="font-bold text-amber-300">${s.stress_level}</span>
            </div>
            <div class="bg-black/30 p-2 rounded-lg">
              <span class="text-slate-400 block text-[10px]">Support Network</span>
              <span class="font-bold ${isLowSupport ? 'text-rose-300' : 'text-emerald-300'}">${s.support_system}</span>
            </div>
            <div class="bg-black/30 p-2 rounded-lg">
              <span class="text-slate-400 block text-[10px]">Screen Duration</span>
              <span class="font-bold text-slate-200">${s.screen_time}</span>
            </div>
            <div class="bg-black/30 p-2 rounded-lg">
              <span class="text-slate-400 block text-[10px]">Coping Resilience</span>
              <span class="font-bold font-mono text-cyan-300">${s.resilience_index}%</span>
            </div>
          </div>
        </div>

        <!-- Right: Statistical Projected Intervention Relief -->
        <div class="bg-gradient-to-br from-emerald-950/30 to-teal-950/20 p-4 rounded-xl border border-emerald-500/25 space-y-3 flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between text-xs font-bold text-slate-300 border-b border-emerald-500/20 pb-2">
              <span class="flex items-center space-x-1.5 text-emerald-400">
                <i class="fa-solid fa-wand-magic-sparkles"></i>
                <span>Projected Post-Intervention Recovery</span>
              </span>
              ${simRiskBadge}
            </div>

            <div class="mt-3 grid grid-cols-2 gap-3 text-center">
              <div class="bg-emerald-900/30 border border-emerald-500/20 p-2.5 rounded-xl">
                <span class="text-[10px] text-emerald-300 uppercase font-bold block">Projected Burnout</span>
                <div class="text-2xl font-black text-white mt-0.5">${simBurnout}%</div>
                <span class="text-[10px] font-bold text-emerald-400">-${simDrop}% Reduction</span>
              </div>
              <div class="bg-cyan-900/30 border border-cyan-500/20 p-2.5 rounded-xl">
                <span class="text-[10px] text-cyan-300 uppercase font-bold block">Status Transition</span>
                <div class="text-sm font-extrabold text-white mt-1.5">Recovered</div>
                <span class="text-[10px] text-slate-400">${s.risk_level.split(' ')[0]} &rarr; Safe</span>
              </div>
            </div>
          </div>

          <div class="p-2.5 rounded-lg bg-black/40 border border-white/5 text-[11px] text-slate-300 leading-relaxed">
            <span class="font-bold text-emerald-400"><i class="fa-solid fa-circle-check mr-1"></i> Statistical Feasibility:</span>
            Applying a +1.5h sleep window buffer and structured deadline spacing reduces ${s.name}'s burnout index by <strong class="text-white">${simDrop}%</strong>, stabilizing them within non-critical academic thresholds.
          </div>
        </div>

      </div>

      <!-- Root Cause Analysis -->
      <div class="bg-slate-900/80 p-4 rounded-xl border border-white/10 space-y-2">
        <h5 class="text-xs uppercase font-extrabold text-amber-400 tracking-wider flex items-center space-x-1.5">
          <i class="fa-solid fa-magnifying-glass-chart"></i>
          <span>Identified Primary Stress Drivers for ${s.name}</span>
        </h5>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          ${isSevereSleep ? `
            <div class="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300">
              <div class="font-bold flex items-center space-x-1.5 mb-0.5">
                <i class="fa-solid fa-bed"></i>
                <span>Sleep Deprivation Trigger (${s.sleep_hours})</span>
              </div>
              <p class="text-[11px] text-slate-400">Nightly sleep duration under 5-6 hours impairs cognitive recovery, driving over 50% of burnout vulnerability.</p>
            </div>
          ` : `
            <div class="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
              <div class="font-bold flex items-center space-x-1.5 mb-0.5">
                <i class="fa-solid fa-check"></i>
                <span>Adequate Sleep Baseline (${s.sleep_hours})</span>
              </div>
              <p class="text-[11px] text-slate-400">Sleep hours remain protective and provide resilience against curriculum stress.</p>
            </div>
          `}

          ${isHeavyWorkload ? `
            <div class="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300">
              <div class="font-bold flex items-center space-x-1.5 mb-0.5">
                <i class="fa-solid fa-calendar-xmark"></i>
                <span>Curriculum Workload Strain (${s.workload})</span>
              </div>
              <p class="text-[11px] text-slate-400">High volume of concurrent assessments and FAT preparations without sufficient buffer spacing.</p>
            </div>
          ` : `
            <div class="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
              <div class="font-bold flex items-center space-x-1.5 mb-0.5">
                <i class="fa-solid fa-check"></i>
                <span>Balanced Academic Load (${s.workload})</span>
              </div>
              <p class="text-[11px] text-slate-400">Course enrollment workload is within normal manageable bandwidth.</p>
            </div>
          `}
        </div>
      </div>

      <!-- Differentiated Personalized Action Prescription -->
      <div class="bg-slate-900/80 p-4 rounded-xl border border-white/10 space-y-3">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-2.5">
          <div>
            <span class="px-2.5 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider ${plan.protocolBadge}">
              ${plan.protocolTitle}
            </span>
            <p class="text-[11px] text-slate-300 mt-1">${plan.protocolSummary}</p>
          </div>
          <span class="text-[11px] text-slate-400 font-mono shrink-0">ID #${s.id}</span>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
          ${plan.pillars.map(p => `
            <div class="p-3 rounded-lg bg-slate-950/70 border border-white/5 space-y-1">
              <span class="font-bold text-white flex items-center space-x-2">
                <span class="w-5 h-5 rounded-full bg-${p.color}-500/20 text-${p.color}-400 flex items-center justify-center text-[10px] font-bold shrink-0">${p.num}</span>
                <span class="text-${p.color}-300">${p.title}</span>
              </span>
              <p class="text-[11px] text-slate-400 pl-7 leading-relaxed">${p.desc}</p>
            </div>
          `).join('')}
        </div>

        ${plan.boosters ? `
          <div class="mt-2 p-2.5 rounded-lg bg-black/40 border border-white/10 text-[11px] text-amber-300 flex items-center space-x-2">
            <i class="fa-solid fa-lightbulb text-amber-400"></i>
            <span>${plan.boosters}</span>
          </div>
        ` : ''}
      </div>

      <!-- Action Footer -->
      <div class="flex flex-wrap items-center justify-between gap-3 pt-2">
        <button onclick="window.print()" class="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold flex items-center space-x-1.5 transition-colors">
          <i class="fa-solid fa-print"></i>
          <span>Print / Save Student Prescription</span>
        </button>
        <button onclick="editStudentRecord(${JSON.stringify(s).replace(/"/g, '&quot;')})" class="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold shadow-md shadow-brand-500/20 transition-all flex items-center space-x-1.5">
          <i class="fa-solid fa-pen-to-square"></i>
          <span>Update This Student's Data</span>
        </button>
      </div>

    </div>
  `;
}

function fillSampleCritical() {
  document.getElementById('calc_cust_name').value = 'Sample High-Strain Student';
  document.getElementById('calc_cust_sleep').value = 'Less than 5 hours';
  document.getElementById('calc_cust_workload').value = 'Very high';
  document.getElementById('calc_cust_screen').value = 'More than 4 hours';
  document.getElementById('calc_cust_support').value = 'Rarely or never';
  document.getElementById('calc_cust_anxiety').value = 'Often';
  calculateCustomStudentStress();
}

function fillSampleLowRisk() {
  document.getElementById('calc_cust_name').value = 'Sample Resilient Student';
  document.getElementById('calc_cust_sleep').value = '7-8 hours';
  document.getElementById('calc_cust_workload').value = 'Low';
  document.getElementById('calc_cust_screen').value = '1-2 hours';
  document.getElementById('calc_cust_support').value = 'Always';
  document.getElementById('calc_cust_anxiety').value = 'Never';
  calculateCustomStudentStress();
}

function calculateCustomStudentStress() {
  const name = document.getElementById('calc_cust_name')?.value?.trim() || 'Custom Scenario Student';
  const sleepStr = document.getElementById('calc_cust_sleep')?.value || '5-6 hours';
  const workloadStr = document.getElementById('calc_cust_workload')?.value || 'High';
  const screenStr = document.getElementById('calc_cust_screen')?.value || '3-4 hours';
  const supportStr = document.getElementById('calc_cust_support')?.value || 'Sometimes';
  const anxietyStr = document.getElementById('calc_cust_anxiety')?.value || 'Often';

  // Numeric Mapping
  let sleepHours = 5.5;
  if (sleepStr.includes('Less than 5')) sleepHours = 4.5;
  else if (sleepStr.includes('5-6')) sleepHours = 5.5;
  else if (sleepStr.includes('7-8')) sleepHours = 7.5;
  else if (sleepStr.includes('More than 8')) sleepHours = 8.5;

  let workloadLvl = 3;
  if (workloadStr.includes('Very low')) workloadLvl = 1;
  else if (workloadStr.includes('Low')) workloadLvl = 2;
  else if (workloadStr.includes('Moderate')) workloadLvl = 3;
  else if (workloadStr.includes('Very high')) workloadLvl = 5;
  else if (workloadStr.includes('High')) workloadLvl = 4;

  let screenLvl = 3;
  if (screenStr.includes('Less than 1')) screenLvl = 1;
  else if (screenStr.includes('1-2')) screenLvl = 2;
  else if (screenStr.includes('More than 4')) screenLvl = 4;

  let supportLvl = 2;
  if (supportStr.includes('Rarely or never')) supportLvl = 1;
  else if (supportStr.includes('Sometimes')) supportLvl = 2;
  else if (supportStr.includes('Often')) supportLvl = 3;
  else if (supportStr.includes('Always')) supportLvl = 4;

  let anxietyLvl = 3;
  if (anxietyStr.includes('Never')) anxietyLvl = 1;
  else if (anxietyStr.includes('Rarely')) anxietyLvl = 2;
  else if (anxietyStr.includes('Sometimes')) anxietyLvl = 3;
  else if (anxietyStr.includes('Often')) anxietyLvl = 4;

  // Statistical Composite Calculations
  const sleepDef = sleepHours <= 5.0 ? 4.0 : (sleepHours <= 6.0 ? 3.0 : 1.5);
  const stressVal = Math.min(4.0, Math.max(1.0, Math.round((0.35 * workloadLvl + 0.30 * (5 - supportLvl) + 0.35 * (sleepHours <= 5.0 ? 4 : 2) + 0.25 * anxietyLvl - 0.4) * 100) / 100));
  const burnoutSum = stressVal + sleepDef + (workloadLvl * 0.6) + anxietyLvl;
  const burnoutIdx = Math.min(98.5, Math.max(8.0, Math.round(((burnoutSum - 4.0) / 12.0) * 1000) / 10));
  const resil = Math.min(100.0, Math.max(10.0, Math.round(((supportLvl * 2.0 + (sleepHours >= 7 ? 3.0 : 1.5) - 3.0) / 9.0) * 1000) / 10));

  let risk = 'Low Risk';
  if (burnoutIdx >= 70 || (stressVal >= 3.5 && sleepHours <= 5.0)) {
    risk = 'Critical Risk';
  } else if (burnoutIdx >= 50 || stressVal >= 2.8) {
    risk = 'Moderate Risk';
  }

  // Construct synthetic student record
  const student = {
    id: 'CUSTOM',
    name: name,
    reg_no: 'CUSTOM-INPUT',
    branch_code: 'SIM',
    branch_name: 'Custom Parameter Assessment',
    batch_year: '2026',
    risk_level: risk,
    burnout_index: burnoutIdx,
    stress_level: `${stressVal} / 4.0`,
    sleep_hours: sleepStr,
    workload: workloadStr,
    screen_time: screenStr,
    support_system: supportStr,
    career_anxiety: anxietyStr,
    resilience_index: resil
  };

  const container = document.getElementById('customCalcResults');
  if (container) {
    container.innerHTML = `
      <div class="mb-4 flex items-center justify-between border-b border-white/10 pb-2">
        <h4 class="text-xs font-extrabold text-emerald-400 uppercase tracking-wider flex items-center space-x-1.5">
          <i class="fa-solid fa-square-poll-vertical"></i>
          <span>Custom Statistical Calculation &amp; Personalized Plan for: ${name}</span>
        </h4>
        <span class="text-[11px] font-mono text-cyan-400">Live Multivariate Beta Engine</span>
      </div>
      ${buildStudentSolutionHtml(student, false)}
    `;
    container.classList.remove('hidden');
    container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  showToast(`Calculated: ${risk} (${burnoutIdx}% Burnout, ${stressVal} Stress)`);
}

async function viewStudentSolution(regNo) {
  const students = await fetchAllStudentsIfNeeded();
  const s = students.find(st => st.reg_no === regNo);
  if (!s) {
    showToast(`Student ${regNo} not found`, true);
    return;
  }

  const modal = document.getElementById('studentSolutionModal');
  const body = document.getElementById('studentSolutionModalBody');
  if (modal && body) {
    body.innerHTML = `
      <div class="mb-4 pr-8 border-b border-white/10 pb-3">
        <div class="flex items-center space-x-2 text-xs font-bold text-cyan-400 uppercase tracking-wider mb-1">
          <i class="fa-solid fa-user-doctor"></i>
          <span>Personalized Clinical Prescription</span>
        </div>
        <h3 class="text-xl font-extrabold text-white">Student Stress Diagnostic &amp; Solution</h3>
      </div>
      ${buildStudentSolutionHtml(s, true)}
    `;
    modal.classList.remove('hidden');
  }
}

function closeStudentSolutionModal() {
  const modal = document.getElementById('studentSolutionModal');
  if (modal) modal.classList.add('hidden');
}
