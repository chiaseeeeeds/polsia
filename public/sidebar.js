/**
 * Runloop Sidebar Enhancement
 * - Company switcher dropdown in sidebar header
 * - Auto-loads user + companies on any page
 * - Company creation modal
 */
(function() {
  'use strict';

  let currentCompanies = [];
  let activeCompanyId = null;

  // ─── Inject company switcher after logo ──────────────────
  function injectCompanySwitcher() {
    const sidebarHeader = document.querySelector('.sidebar-header');
    if (!sidebarHeader) return;

    // Add company switcher element right after existing logo
    const switcher = document.createElement('div');
    switcher.id = 'companySwitcher';
    switcher.innerHTML = `
      <div class="company-switcher" onclick="toggleCompanyDropdown(event)">
        <div class="company-switcher-current">
          <div class="company-avatar" id="companyAvatar">R</div>
          <div class="company-info">
            <div class="company-name" id="companyName">Loading...</div>
            <div class="company-role" id="companyRole">owner</div>
          </div>
          <svg class="company-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg>
        </div>
        <div class="company-dropdown" id="companyDropdown">
          <div class="company-dropdown-label">Your Companies</div>
          <div id="companyList"></div>
          <div class="company-dropdown-divider"></div>
          <button class="company-dropdown-add" onclick="openNewCompanyModal(event)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            New Company
          </button>
        </div>
      </div>
    `;
    sidebarHeader.appendChild(switcher);

    // Add modal for new company
    const modal = document.createElement('div');
    modal.id = 'newCompanyModal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-card">
        <div class="modal-header">
          <h3>Create New Company</h3>
          <button class="modal-close" onclick="closeNewCompanyModal()">&times;</button>
        </div>
        <form id="newCompanyForm" onsubmit="handleCreateCompany(event)">
          <div class="modal-body">
            <div class="form-group">
              <label class="form-label">Company Name</label>
              <input type="text" class="form-input" id="newCompanyName" placeholder="Acme Inc." required>
            </div>
            <div class="form-group">
              <label class="form-label">One-liner</label>
              <input type="text" class="form-input" id="newCompanyDesc" placeholder="We build the future of X">
            </div>
            <div class="form-group">
              <label class="form-label">Industry</label>
              <input type="text" class="form-input" id="newCompanyIndustry" placeholder="SaaS, E-commerce, etc.">
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" onclick="closeNewCompanyModal()">Cancel</button>
            <button type="submit" class="btn btn-primary" id="createCompanyBtn">Create Company</button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(modal);
  }

  // ─── Inject CSS ──────────────────
  function injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .company-switcher{position:relative;margin-top:12px;cursor:pointer}
      .company-switcher-current{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:10px;background:var(--surface-2);border:1px solid var(--border);transition:all 0.15s}
      .company-switcher-current:hover{border-color:var(--border-light);background:var(--surface-3)}
      .company-avatar{width:28px;height:28px;border-radius:7px;background:var(--accent-dim);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:var(--accent);flex-shrink:0}
      .company-info{flex:1;min-width:0}
      .company-name{font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .company-role{font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px}
      .company-chevron{flex-shrink:0;color:var(--text-muted);transition:transform 0.2s}
      .company-switcher.open .company-chevron{transform:rotate(180deg)}
      .company-dropdown{display:none;position:absolute;top:calc(100% + 6px);left:0;right:0;background:var(--surface-2);border:1px solid var(--border-light);border-radius:10px;padding:6px;z-index:100;box-shadow:0 8px 32px rgba(0,0,0,0.4);max-height:300px;overflow-y:auto}
      .company-switcher.open .company-dropdown{display:block}
      .company-dropdown-label{font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:1px;color:var(--text-muted);padding:8px 10px 4px}
      .company-dropdown-item{display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:6px;cursor:pointer;transition:all 0.12s;font-size:13px;color:var(--text-dim);border:none;background:none;width:100%;text-align:left}
      .company-dropdown-item:hover{background:var(--surface-3);color:var(--text)}
      .company-dropdown-item.active{color:var(--accent);background:var(--accent-dim)}
      .company-dropdown-item .item-avatar{width:24px;height:24px;border-radius:6px;background:var(--surface-3);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0}
      .company-dropdown-item.active .item-avatar{background:var(--accent-dim);color:var(--accent)}
      .company-dropdown-divider{height:1px;background:var(--border);margin:4px 0}
      .company-dropdown-add{display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:6px;cursor:pointer;transition:all 0.12s;font-size:13px;color:var(--text-dim);border:none;background:none;width:100%;text-align:left}
      .company-dropdown-add:hover{background:var(--surface-3);color:var(--accent)}

      /* Modal */
      .modal-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:200;align-items:center;justify-content:center;backdrop-filter:blur(4px)}
      .modal-overlay.open{display:flex}
      .modal-card{background:var(--surface);border:1px solid var(--border-light);border-radius:16px;width:min(440px,90vw);overflow:hidden;animation:modalIn 0.2s ease}
      @keyframes modalIn{from{opacity:0;transform:scale(0.95)}to{opacity:1;transform:scale(1)}}
      .modal-header{display:flex;align-items:center;justify-content:space-between;padding:20px 24px 16px}
      .modal-header h3{font-family:'Space Grotesk',sans-serif;font-size:1.1rem;font-weight:700}
      .modal-close{background:none;border:none;color:var(--text-dim);font-size:20px;cursor:pointer;padding:4px 8px;border-radius:6px}
      .modal-close:hover{background:var(--surface-2);color:var(--text)}
      .modal-body{padding:0 24px 16px}
      .modal-body .form-group{margin-bottom:14px}
      .modal-body .form-label{display:block;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.8px;color:var(--text-dim);margin-bottom:6px}
      .modal-body .form-input{width:100%;padding:10px 14px;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:14px;outline:none;transition:border-color 0.2s}
      .modal-body .form-input:focus{border-color:var(--accent)}
      .modal-footer{display:flex;gap:10px;justify-content:flex-end;padding:16px 24px;border-top:1px solid var(--border)}
      .modal-footer .btn{padding:9px 20px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;border:none;transition:all 0.15s}
      .modal-footer .btn-secondary{background:var(--surface-2);color:var(--text);border:1px solid var(--border)}
      .modal-footer .btn-primary{background:var(--accent);color:#08090d}
      .modal-footer .btn-primary:hover{opacity:0.9}
      .modal-footer .btn-primary:disabled{opacity:0.5;cursor:not-allowed}
    `;
    document.head.appendChild(style);
  }

  // ─── Load companies ──────────────────
  async function loadCompanies() {
    try {
      const res = await fetch('/api/companies');
      if (!res.ok) return;
      const data = await res.json();
      currentCompanies = data.companies || [];
      activeCompanyId = data.active_company_id;
      renderCompanyList();
      updateActiveCompanyDisplay();
    } catch (e) {
      console.warn('Failed to load companies:', e);
    }
  }

  function renderCompanyList() {
    const list = document.getElementById('companyList');
    if (!list) return;
    list.innerHTML = currentCompanies.map(c => `
      <button class="company-dropdown-item ${String(c.id) === String(activeCompanyId) ? 'active' : ''}"
              onclick="switchCompany(event, ${c.id})">
        <span class="item-avatar">${(c.name || 'C')[0].toUpperCase()}</span>
        <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(c.name)}</span>
        ${String(c.id) === String(activeCompanyId) ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M20 6L9 17l-5-5"/></svg>' : ''}
      </button>
    `).join('');
  }

  function updateActiveCompanyDisplay() {
    const active = currentCompanies.find(c => String(c.id) === String(activeCompanyId));
    if (!active) return;
    const nameEl = document.getElementById('companyName');
    const avatarEl = document.getElementById('companyAvatar');
    const roleEl = document.getElementById('companyRole');
    if (nameEl) nameEl.textContent = active.name || 'Company';
    if (avatarEl) avatarEl.textContent = (active.name || 'C')[0].toUpperCase();
    if (roleEl) roleEl.textContent = active.role || 'owner';
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ─── Global functions ──────────────────
  window.toggleCompanyDropdown = function(e) {
    e.stopPropagation();
    document.querySelector('.company-switcher')?.classList.toggle('open');
  };

  window.switchCompany = async function(e, companyId) {
    e.stopPropagation();
    if (String(companyId) === String(activeCompanyId)) {
      document.querySelector('.company-switcher')?.classList.remove('open');
      return;
    }
    try {
      const res = await fetch('/api/companies/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_id: companyId })
      });
      if (res.ok) {
        window.location.reload();
      }
    } catch (e) {
      console.error('Switch company error:', e);
    }
  };

  window.openNewCompanyModal = function(e) {
    e.stopPropagation();
    document.querySelector('.company-switcher')?.classList.remove('open');
    document.getElementById('newCompanyModal')?.classList.add('open');
  };

  window.closeNewCompanyModal = function() {
    document.getElementById('newCompanyModal')?.classList.remove('open');
  };

  window.handleCreateCompany = async function(e) {
    e.preventDefault();
    const btn = document.getElementById('createCompanyBtn');
    btn.disabled = true;
    btn.textContent = 'Creating...';
    try {
      const res = await fetch('/api/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: document.getElementById('newCompanyName').value,
          description: document.getElementById('newCompanyDesc').value,
          industry: document.getElementById('newCompanyIndustry').value
        })
      });
      if (res.ok) {
        window.location.href = '/onboarding';
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to create company');
        btn.disabled = false;
        btn.textContent = 'Create Company';
      }
    } catch (err) {
      alert('Failed to create company');
      btn.disabled = false;
      btn.textContent = 'Create Company';
    }
  };

  // Close dropdown on outside click
  document.addEventListener('click', function(e) {
    if (!e.target.closest('.company-switcher')) {
      document.querySelector('.company-switcher')?.classList.remove('open');
    }
  });

  // ─── Initialize ──────────────────
  function init() {
    injectStyles();
    injectCompanySwitcher();
    loadCompanies();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
