(function () {
  'use strict';

  function t(key, fallback, vars) {
    if (typeof window !== 'undefined' && typeof window.i18nT === 'function') {
      return window.i18nT(key, fallback || key, vars);
    }
    if (!vars || typeof fallback !== 'string') return fallback || key;
    return fallback.replace(/\{(\w+)\}/g, function (_, k) {
      return vars[k] != null ? String(vars[k]) : '{' + k + '}';
    });
  }

  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  window.setupAdminShowMore = function setupAdminShowMore() {
    document.querySelectorAll('.admin-show-more').forEach(function (btn) {
      if (btn.dataset.bound === '1') return;
      var id = btn.getAttribute('data-table');
      var table = id ? document.getElementById(id) : null;
      if (!table) return;
      var more = table.querySelectorAll('.admin-row-more');
      if (!more.length) {
        btn.hidden = true;
        return;
      }
      btn.hidden = false;
      if (!/\(\d+\)/.test(btn.textContent || '')) {
        btn.textContent = 'Показать ещё (' + more.length + ')';
      }
      btn.dataset.bound = '1';
      btn.addEventListener('click', function () {
        table.classList.add('is-expanded');
        btn.hidden = true;
      });
    });
  };

  ready(function () {
    window.setupAdminShowMore();

    var form = document.getElementById('adminGrantAlbaForm');
    var msg = document.getElementById('albaGrantMsg');
    var btn = document.getElementById('albaSubmitBtn');
    if (!form || !msg || !btn) return;

    function getCsrf() {
      var meta = document.querySelector('meta[name="csrf-token"]');
      var field = document.getElementById('albaCsrfField');
      return (meta && meta.getAttribute('content'))
        || (field && field.value)
        || (window.CSRF_TOKEN || '')
        || '';
    }

    function setMsg(text, color) {
      msg.textContent = text;
      msg.style.color = color || '#fff';
      msg.style.background = color === '#4caf50'
        ? 'rgba(76,175,80,0.15)'
        : (color === '#b00020' ? 'rgba(176,0,32,0.15)' : 'rgba(255,255,255,0.06)');
      msg.style.border = '1px solid rgba(255,255,255,0.12)';
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      e.stopPropagation();

      var username = String((document.getElementById('albaUsername') || {}).value || '').trim();
      var amountRaw = (document.getElementById('albaAmount') || {}).value || '';
      var comment = String((document.getElementById('albaComment') || {}).value || '').trim();
      var amount = Number(amountRaw);
      var csrf = getCsrf();

      if (!username || !amountRaw || !comment) {
        setMsg(t('fillAllFields', 'Fill in all fields'), '#b00020');
        return;
      }
      if (!isFinite(amount) || amount <= 0) {
        setMsg(t('positiveAmount', 'Amount must be a positive number'), '#b00020');
        return;
      }
      if (!csrf) {
        setMsg(t('csrfMissingShort', 'No CSRF token. Refresh the page.'), '#b00020');
        return;
      }

      btn.disabled = true;
      setMsg(t('granting', 'Granting…'), '#ccc');

      fetch('/api/p1/alba/grant-by-login', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-CSRF-Token': csrf
        },
        body: JSON.stringify({
          login: username,
          username: username,
          amount: amount,
          reason: 'admin_grant',
          comment: comment,
          _csrf: csrf
        })
      }).then(function (res) {
        return res.text().then(function (text) {
          var data = null;
          try {
            data = text ? JSON.parse(text) : null;
          } catch (err) {
            throw new Error(res.status === 403
              ? t('csrfForbidden', 'CSRF/access denied. Refresh the page.')
              : t('serverStatus', 'Server response: {status}', { status: res.status }));
          }
          return { res: res, data: data };
        });
      }).then(function (result) {
        if (result.res.ok && result.data && result.data.success) {
          var bal = result.data.user && result.data.user.albaBalance != null
            ? t('balanceSuffix', ' (balance: {balance})', { balance: result.data.user.albaBalance })
            : '';
          setMsg(t('albaGranted', 'Granted {amount} ALBA to {username}{balance}', {
            amount: amount,
            username: username,
            balance: bal
          }), '#4caf50');
          form.reset();
          var csrfField = document.getElementById('albaCsrfField');
          if (csrfField && csrf) csrfField.value = csrf;
          var reasonField = form.querySelector('input[name="reason"]');
          if (reasonField) reasonField.value = 'admin_grant';
          if (typeof window.loadAlbaHistory === 'function') window.loadAlbaHistory();
        } else {
          setMsg(t('error', 'Error') + ': ' + ((result.data && result.data.message) || ('HTTP ' + result.res.status)), '#b00020');
        }
      }).catch(function (err) {
        setMsg(t('error', 'Error') + ': ' + (err && err.message ? err.message : String(err)), '#b00020');
      }).then(function () {
        btn.disabled = false;
      });
    });

    function escapeHtml(value) {
      return String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    function formatDate(value) {
      if (!value) return '—';
      try {
        var loc = (window.__I18N__ && window.__I18N__.lang) || document.documentElement.lang || 'en';
        return new Date(value).toLocaleString(loc);
      } catch (e) {
        return String(value);
      }
    }

    window.loadAlbaHistory = function loadAlbaHistory() {
      var container = document.getElementById('albaTransactionsContainer');
      var btn = document.getElementById('loadTransactionsBtn');
      if (!container) return;
      if (btn) btn.disabled = true;
      fetch('/api/p1/alba/transactions-history?limit=40', {
        credentials: 'same-origin',
        headers: { 'Accept': 'application/json' }
      }).then(function (res) {
        return res.text().then(function (text) {
          var data = null;
          try { data = text ? JSON.parse(text) : null; } catch (e) { data = null; }
          return { res: res, data: data };
        });
      }).then(function (result) {
        if (!result.res.ok || !result.data || !result.data.success) {
          container.innerHTML = '<p class="empty-state">' + escapeHtml(t('historyLoadFail', 'Failed to load history')) +
            (result.data && result.data.message ? (': ' + escapeHtml(result.data.message)) : '') + '</p>';
          return;
        }
        var rows = result.data.transactions || [];
        if (!rows.length) {
          container.innerHTML = '<p class="empty-state">' + escapeHtml(t('noAlbaTx', 'No ALBA transactions yet')) + '</p>';
          return;
        }
        var colUser = escapeHtml(t('colUser', 'User'));
        var colType = escapeHtml(t('colType', 'Type'));
        var colReason = escapeHtml(t('colReason', 'Reason'));
        var colAmount = escapeHtml(t('colAmount', 'Amount'));
        var colComment = escapeHtml(t('colComment', 'Comment'));
        var colDate = escapeHtml(t('colDate', 'Date'));
        var html = '<div class="admin-table-wrap"><table class="admin-data-table admin-preview-table" id="albaHistoryTable" data-preview="5"><thead><tr>' +
          '<th>ID</th><th>' + colUser + '</th><th>' + colType + '</th>' +
          '<th>' + colReason + '</th><th>' + colAmount + '</th><th>' + colComment + '</th>' +
          '<th>' + colDate + '</th></tr></thead><tbody>';
        rows.forEach(function (tx, idx) {
          var user = tx.user || {};
          var meta = tx.meta && typeof tx.meta === 'object' ? tx.meta : {};
          html += '<tr class="' + (idx >= 5 ? 'admin-row-more' : '') + '">' +
            '<td data-label="ID" class="admin-col-secondary">' + escapeHtml(tx.id) + '</td>' +
            '<td data-label="' + colUser + '">' + escapeHtml(user.username || '—') + '</td>' +
            '<td data-label="' + colType + '" class="admin-col-secondary">' + escapeHtml(tx.type || '') + '</td>' +
            '<td data-label="' + colReason + '">' + escapeHtml(tx.reason || '') + '</td>' +
            '<td data-label="' + colAmount + '">' + escapeHtml(tx.amount) + '</td>' +
            '<td data-label="' + colComment + '" class="admin-col-secondary">' + escapeHtml(meta.comment || tx.comment || '—') + '</td>' +
            '<td data-label="' + colDate + '">' + escapeHtml(formatDate(tx.createdAt)) + '</td></tr>';
        });
        html += '</tbody></table></div>';
        if (rows.length > 5) {
          html += '<button type="button" class="btn small outline admin-show-more" data-table="albaHistoryTable">Показать ещё (' +
            (rows.length - 5) + ')</button>';
        }
        container.innerHTML = html;
        if (window.setupAdminShowMore) window.setupAdminShowMore();
      }).catch(function () {
        container.innerHTML = '<p class="empty-state">' + escapeHtml(t('historyNetworkError', 'Network error while loading history')) + '</p>';
      }).then(function () {
        if (btn) btn.disabled = false;
      });
    };

    var loadBtn = document.getElementById('loadTransactionsBtn');
    if (loadBtn) {
      loadBtn.addEventListener('click', function (e) {
        e.preventDefault();
        window.loadAlbaHistory();
      });
    }
  });
})();
