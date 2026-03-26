$(function () {

  const STORAGE_KEY = 'financeTracker_v1';
  const PER_PAGE = 8;

  let transactions = loadTransactions();
  let currentPage = 1;
  let pendingDeleteId = null;

  const INCOME_CATS = new Set(['Salary', 'Freelance', 'Investment', 'Gift', 'Other Income']);

  setTodayDate();
  showCurrentDate();
  populateCategoryFilter();
  render();

  function loadTransactions() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch (_) {
      return [];
    }
  }

  function saveTransactions() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
  }

  function generateId() {
    return 'tx_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
  }

  function setTodayDate() {
    const today = new Date().toISOString().split('T')[0];
    $('#txDate').val(today);
  }

  function showCurrentDate() {
    const opts = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    $('#currentDate').text(new Date().toLocaleDateString(undefined, opts));
  }

  function formatDate(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function renderSummary() {
    let income = 0;
    let expense = 0;

    transactions.forEach(function (t) {
      if (t.type === 'income') income += t.amount;
      else expense += t.amount;
    });

    const balance = income - expense;

    animateValue('#totalIncome', income);
    animateValue('#totalExpense', expense);
    animateValue('#totalBalance', balance);

    if (balance < 0) $('#totalBalance').css('color', 'var(--red)');
    else if (balance > 0) $('#totalBalance').css('color', 'var(--green)');
    else $('#totalBalance').css('color', 'var(--text)');
  }

  function animateValue(selector, target) {
    const $el = $(selector);
    const current = parseFloat($el.data('raw') || 0);
    $el.data('raw', target);

    $({ val: current }).animate({ val: target }, {
      duration: 500,
      easing: 'swing',
      step: function () {
        $el.text(formatCurrency(this.val));
      },
      complete: function () {
        $el.text(formatCurrency(target));
      }
    });
  }

  function formatCurrency(n) {
    const abs = Math.abs(n);
    const str = abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return (n < 0 ? '-$' : '$') + str;
  }

  function getFiltered() {
    const typeFilter = $('#filterType').val();
    const catFilter = $('#filterCategory').val();

    return transactions.filter(function (t) {
      const typeOk = typeFilter === 'all' || t.type === typeFilter;
      const catOk = catFilter === 'all' || t.category === catFilter;
      return typeOk && catOk;
    });
  }

  function renderList() {
    const filtered = getFiltered();
    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

    if (currentPage > totalPages) currentPage = totalPages;

    const start = (currentPage - 1) * PER_PAGE;
    const page = filtered.slice(start, start + PER_PAGE);
    const $list = $('#txList').empty();

    if (total === 0) {
      $('#emptyState').show();
      $list.hide();
    } else {
      $('#emptyState').hide();
      $list.show();

      page.forEach(function (t, i) {
        $list.append(buildTxItem(t, i));
      });
    }

    renderPagination(totalPages);
  }

  function buildTxItem(t, delay) {
    const sign = t.type === 'income' ? '+' : '−';
    const $item = $('<li>', { class: 'tx-item', 'data-id': t.id });
    $item.css('animation-delay', (delay * 40) + 'ms');

    $item.html(`
      <span class="tx-dot tx-dot--${t.type}"></span>
      <div class="tx-info">
        <div class="tx-desc" title="${escapeHtml(t.description)}">${escapeHtml(t.description)}</div>
        <div class="tx-meta">${escapeHtml(t.category)} &middot; ${formatDate(t.date)}</div>
      </div>
      <span class="tx-amount tx-amount--${t.type}">${sign}${formatCurrency(t.amount).replace(/^-?\$/, '$')}</span>
      <div class="tx-actions">
        <button class="tx-btn tx-btn--edit"   data-id="${t.id}" title="Edit">✏</button>
        <button class="tx-btn tx-btn--delete" data-id="${t.id}" title="Delete">✕</button>
      </div>
    `);

    return $item;
  }

  function renderPagination(totalPages) {
    const $pg = $('#pagination').empty();
    if (totalPages <= 1) return;

    const $prev = $('<button>', { class: 'page-btn', text: '‹' });
    if (currentPage === 1) $prev.prop('disabled', true).css('opacity', .4);
    $prev.on('click', function () {
      if (currentPage > 1) { currentPage--; renderList(); }
    });
    $pg.append($prev);

    for (let i = 1; i <= totalPages; i++) {
      const $btn = $('<button>', { class: 'page-btn' + (i === currentPage ? ' active' : ''), text: i });
      (function (page) {
        $btn.on('click', function () { currentPage = page; renderList(); });
      })(i);
      $pg.append($btn);
    }

    const $next = $('<button>', { class: 'page-btn', text: '›' });
    if (currentPage === totalPages) $next.prop('disabled', true).css('opacity', .4);
    $next.on('click', function () {
      if (currentPage < totalPages) { currentPage++; renderList(); }
    });
    $pg.append($next);
  }

  function populateCategoryFilter() {
    const cats = [...new Set(transactions.map(function (t) { return t.category; }))].sort();
    const $sel = $('#filterCategory');
    $sel.find('option:not(:first)').remove();
    cats.forEach(function (c) {
      $sel.append($('<option>', { value: c, text: c }));
    });
  }

  function render() {
    renderSummary();
    renderList();
    populateCategoryFilter();
  }

  $(document).on('click', '.type-btn', function () {
    const type = $(this).data('type');
    $('#txType').val(type);
    $('.type-btn').removeClass('active');
    $(this).addClass('active');
  });

  $('#txCategory').on('change', function () {
    const cat = $(this).val();
    if (!cat) return;
    const type = INCOME_CATS.has(cat) ? 'income' : 'expense';
    $('#txType').val(type);
    $('.type-btn').removeClass('active');
    $(`.type-btn--${type}`).addClass('active');
  });

  function clearErrors() {
    $('.field-error').text('');
    $('.field-input').removeClass('field-input--error');
  }

  function showError(fieldId, errId, msg) {
    $('#' + fieldId).addClass('field-input--error');
    $('#' + errId).text(msg);
  }

  function validate() {
    clearErrors();
    let ok = true;

    const desc = $.trim($('#txDescription').val());
    const amount = parseFloat($('#txAmount').val());
    const cat = $('#txCategory').val();

    if (!desc) {
      showError('txDescription', 'errDescription', 'Description is required.');
      ok = false;
    }

    if (isNaN(amount) || amount <= 0) {
      showError('txAmount', 'errAmount', 'Enter a valid amount greater than 0.');
      ok = false;
    }

    if (!cat) {
      showError('txCategory', 'errCategory', 'Please select a category.');
      ok = false;
    }

    return ok;
  }

  $('#transactionForm').on('submit', function (e) {
    e.preventDefault();
    if (!validate()) return;

    const editId = $('#editId').val();
    const data = {
      description: $.trim($('#txDescription').val()),
      amount: parseFloat(parseFloat($('#txAmount').val()).toFixed(2)),
      category: $('#txCategory').val(),
      type: $('#txType').val(),
      date: $('#txDate').val()
    };

    if (editId) {
      const idx = transactions.findIndex(function (t) { return t.id === editId; });
      if (idx !== -1) {
        transactions[idx] = Object.assign({}, transactions[idx], data);
        showToast('Transaction updated!', 'success');
      }
      resetForm();
    } else {
      data.id = generateId();
      data.createdAt = new Date().toISOString();
      transactions.unshift(data);
      currentPage = 1;
      showToast('Transaction added!', 'success');
      resetForm();
    }

    saveTransactions();
    render();
  });

  $(document).on('click', '.tx-btn--edit', function () {
    const id = $(this).data('id');
    const t = transactions.find(function (tx) { return tx.id === id; });
    if (!t) return;

    $('#editId').val(t.id);
    $('#txDescription').val(t.description);
    $('#txAmount').val(t.amount);
    $('#txCategory').val(t.category);
    $('#txDate').val(t.date);
    $('#txType').val(t.type);

    $('.type-btn').removeClass('active');
    $(`.type-btn--${t.type}`).addClass('active');

    $('#formTitle').text('Edit Transaction');
    $('#submitBtn').text('Save Changes');
    $('#cancelEditBtn').show();

    $('html, body').animate({ scrollTop: $('#formPanel').offset().top - 80 }, 300);
  });

  $('#cancelEditBtn').on('click', function () {
    resetForm();
  });

  function resetForm() {
    $('#editId').val('');
    $('#transactionForm')[0].reset();
    setTodayDate();
    $('#txType').val('income');
    $('.type-btn').removeClass('active');
    $('#btnIncome').addClass('active');
    $('#formTitle').text('Add Transaction');
    $('#submitBtn').text('Add Transaction');
    $('#cancelEditBtn').hide();
    clearErrors();
  }

  $(document).on('click', '.tx-btn--delete', function () {
    pendingDeleteId = $(this).data('id');
    $('#modalOverlay').addClass('open');
  });

  $('#modalCancel').on('click', function () {
    pendingDeleteId = null;
    $('#modalOverlay').removeClass('open');
  });

  $('#modalConfirm').on('click', function () {
    if (!pendingDeleteId) return;
    transactions = transactions.filter(function (t) { return t.id !== pendingDeleteId; });
    saveTransactions();
    pendingDeleteId = null;
    $('#modalOverlay').removeClass('open');
    showToast('Transaction deleted.', 'error');

    const totalPages = Math.max(1, Math.ceil(getFiltered().length / PER_PAGE));
    if (currentPage > totalPages) currentPage = totalPages;

    render();
  });

  $('#modalOverlay').on('click', function (e) {
    if ($(e.target).is('#modalOverlay')) {
      pendingDeleteId = null;
      $(this).removeClass('open');
    }
  });

  $('#clearAllBtn').on('click', function () {
    if (transactions.length === 0) {
      showToast('No transactions to clear.', 'error');
      return;
    }
    if (!confirm('Clear ALL transactions? This cannot be undone.')) return;
    transactions = [];
    currentPage = 1;
    saveTransactions();
    render();
    showToast('All transactions cleared.', 'error');
  });

  $('#filterType, #filterCategory').on('change', function () {
    currentPage = 1;
    renderList();
  });

  let toastTimer = null;

  function showToast(msg, type) {
    const $t = $('#toast');
    $t.removeClass('toast--success toast--error show').text(msg);
    if (type) $t.addClass('toast--' + type);
    void $t[0].offsetWidth;
    $t.addClass('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      $t.removeClass('show');
    }, 2800);
  }

  function escapeHtml(str) {
    return $('<div>').text(str).html();
  }

});
