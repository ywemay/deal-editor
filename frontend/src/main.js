/* Deal Editor — Frontend logic */

var appState = {
    directory: '',
    filename: '',
    deal: null,
    modified: false,
    filepath: '',
    activeTab: 'order',
};

function getState() { return appState; }

function setState(partial) {
    Object.assign(appState, partial);
    render();
}

function init() {
    bindEvents();
    // Check if launched with a file argument
    var launchParam = window.location.search ? window.location.search.substring(1).split('&').reduce(function(acc, p) { var kv = p.split('='); acc[kv[0]] = decodeURIComponent(kv[1] || ''); return acc; }, {}).launch || '' : '';
fetch('/api/open' + (launchParam ? '?launch=' + encodeURIComponent(launchParam) : '')).then(function(r) { return r.json(); }).then(function(data) {
        if (data.ok && data.data && data.data.deal) {
            var d = data.data;
            appState.deal = d.deal;
            appState.directory = d.directory;
            appState.filename = d.deal.filename || '';
            appState.filepath = d.filepath || '';
            appState.modified = false;
            appState.activeTab = 'order';
            render();
        }
    }).catch(function() {
        // No launch file — show start page
        render();
    });
}

// ========== RENDER ==========

function render() {
    var startPage = document.getElementById('start-page');
    var editorView = document.getElementById('editor-view');
    var isOpen = appState.deal !== null;
    startPage.style.display = isOpen ? 'none' : 'flex';
    editorView.style.display = isOpen ? 'flex' : 'none';

    if (!isOpen) return;

    document.getElementById('editor-icon').textContent = '📋';
    document.getElementById('editor-filename').textContent = appState.filename || 'Untitled';
    document.getElementById('editor-modified').style.display = appState.modified ? '' : 'none';

    renderTabs();
    renderTabContent();
}

function renderTabs() {
    var tabsEl = document.getElementById('tabs');
    tabsEl.innerHTML = '';
    ['order', 'warehouse'].forEach(function(tab) {
        var btn = document.createElement('button');
        btn.className = 'tab-btn' + (appState.activeTab === tab ? ' active' : '');
        btn.dataset.tab = tab;
        var label = tab === 'order' ? '📦 Order' : '📥 Warehouse';
        btn.textContent = label;
        btn.addEventListener('click', function() {
            appState.activeTab = tab;
            render();
        });
        tabsEl.appendChild(btn);
    });
}

function renderTabContent() {
    var container = document.getElementById('tab-content');
    if (appState.activeTab === 'order') {
        renderOrderTab(container);
    } else {
        renderWarehouseTab(container);
    }
}

// ========== ORDER TAB ==========

function renderOrderTab(container) {
    var deal = appState.deal;
    if (!deal) { container.innerHTML = '<div class="empty-tab">Deal not loaded.</div>'; return; }

    var html = '';

    // Deal metadata
    html += '<div class="form-row">';
    html += '<div class="form-group" style="flex:2"><label>Title</label><input type="text" id="deal-title-input" value="' + escapeHtml(deal.title) + '" /></div>';
    if (deal.filename) {
        html += '<div class="form-group" style="flex:1"><label>Filename</label><input type="text" id="deal-filename-input" value="' + escapeHtml(deal.filename) + '" style="font-size:11px" /></div>';
    }
    html += '<div class="form-group" style="flex:1"><label>Date</label><input type="date" id="deal-date-input" value="' + escapeHtml(deal.date || '') + '" /></div>';
    html += '<div class="form-group" style="flex:1"><label>Status</label>';
    html += '<select id="deal-status-select" style="width:100%;padding:6px 8px;border:1px solid var(--border);border-radius:var(--radius);background:var(--bg-input);color:var(--text-primary);font-size:13px">';
    ['pending','confirmed','shipped','completed','cancelled'].forEach(function(s) {
        html += '<option value="' + s + '"' + (deal.status === s ? ' selected' : '') + '>' + s.charAt(0).toUpperCase() + s.slice(1) + '</option>';
    });
    html += '</select></div>';
    html += '</div>';

    html += '<div class="form-row">';
    html += '<div class="form-group" style="flex:1"><label>Default Currency</label><input type="text" id="deal-currency-input" value="' + escapeHtml(deal.currency || 'USD') + '" maxlength="3" /></div>';
    html += '<div class="form-group" style="flex:1"><label>Additional Costs</label><input type="number" step="0.01" id="deal-extra-costs" value="' + (deal.additional_costs || 0) + '" /></div>';
    html += '<div class="form-group" style="flex:1"><label>Costs Currency</label><input type="text" id="deal-extra-currency" value="' + escapeHtml(deal.additional_costs_currency || '') + '" maxlength="3" /></div>';
    html += '</div>';

    html += '<div class="form-group"><label>Notes</label><textarea id="deal-notes-input" rows="2" style="width:100%;padding:6px;resize:vertical">' + escapeHtml(deal.notes || '') + '</textarea></div>';

    html += '<div style="margin:12px 0;border-top:1px solid var(--border);padding-top:12px">';

    // Order items
    html += '<div class="section-header" style="display:flex;justify-content:space-between;align-items:center">';
    html += '<span>📦 Order Items</span>';
    html += '<div><button class="btn btn-sm" data-action="browse-products" style="margin-right:6px">📂 Browse Products</button><button class="btn btn-sm btn-primary" data-action="add-order-item">➕ Add Item</button></div>';
    html += '</div>';

    var order = deal.order || [];
    if (order.length === 0) {
        html += '<div class="empty-tab" style="padding:8px;font-size:13px">No items in this order yet.</div>';
    } else {
        html += '<div style="overflow-x:auto">';
        html += '<table class="deal-table">';
        html += '<thead><tr>';
        html += '<th style="width:200px">Product</th><th>Min</th><th>Qty</th><th>Unit Price</th><th>Cur</th><th>Total</th><th>Notes</th><th>Photo</th><th></th>';
        html += '</tr></thead><tbody>';
        order.forEach(function(item, idx) {
            var thumbHtml = item._photo
                ? '<img src="' + item._photo + '" class="deal-thumb" />'
                : '<span style="font-size:16px">📦</span>';
            var titleText = item.product_title || (item.product ? item.product.split('/').pop().replace(/\.prod$/, '') : '');
            var codeText = item._code || '';
            html += '<tr data-order-idx="' + idx + '">';
            html += '<td><div class="deal-product-cell"><div class="deal-thumb-cell">' + thumbHtml + '</div><div><div class="deal-order-title">' + escapeHtml(titleText) + '</div>' + (codeText ? '<div class="deal-order-code">' + escapeHtml(codeText) + '</div>' : '') + '</div></div></td>';
            html += '<td><input type="number" class="deal-order-minqty" value="' + (item.min_qty || 0) + '" /></td>';
            html += '<td><input type="number" class="deal-order-qty" value="' + (item.quantity || 0) + '" /></td>';
            html += '<td><input type="number" step="0.01" class="deal-order-price" value="' + (item.unit_price || 0) + '" /></td>';
            html += '<td><input type="text" class="deal-order-currency" value="' + escapeHtml(item.currency || '') + '" maxlength="3" /></td>';
            html += '<td><input type="number" step="0.01" class="deal-order-total" value="' + (item.total || 0) + '" /></td>';
            html += '<td><input type="text" class="deal-order-notes" value="' + escapeHtml(item.notes || '') + '" /></td>';
            html += '<td class="deal-photo-cell">' + thumbHtml + '</td>';
            html += '<td><button class="btn btn-xs btn-danger" data-action="remove-order" data-idx="' + idx + '">✕</button></td>';
            html += '</tr>';
        });
        html += '</tbody></table>';
        html += '</div>';
    }
    html += '</div>';

    container.innerHTML = html;

    // Wire product picker
    var browseBtn = document.querySelector('[data-action="browse-products"]');
    if (browseBtn) browseBtn.addEventListener('click', function() { showProductPicker(); });

    var addBtn = document.querySelector('[data-action="add-order-item"]');
    if (addBtn) addBtn.addEventListener('click', function() {
        deal.order.push({
            product: '', product_title: '', min_qty: 0,
            quantity: 0, unit_price: 0, currency: '',
            total: 0, notes: ''
        });
        appState.modified = true;
        render();
    });

    container.querySelectorAll('[data-action="remove-order"]').forEach(function(btn) {
        btn.addEventListener('click', function() {
            var idx = parseInt(btn.dataset.idx);
            deal.order.splice(idx, 1);
            appState.modified = true;
            render();
        });
    });

    // Input change = modified
    container.querySelectorAll('input, select, textarea').forEach(function(el) {
        el.addEventListener('input', function() { appState.modified = true; });
    });

    // Resolve product thumbnails
    resolveProductThumbnails(deal);
}


function resolveProductThumbnails(deal) {
    var order = deal.order || [];
    order.forEach(function(item, idx) {
        if (item._photo) return; // already resolved
        var productPath = item.product;
        if (!productPath) return;
        api.getProduct(productPath).then(function(prod) {
            if (prod.photos && prod.photos.length > 0) {
                item._photo = prod.photos[0];
                item._code = prod.code || '';
                item.product_title = prod.title || item.product_title;
                var row = document.querySelector('tr[data-order-idx="' + idx + '"]');
                if (row) {
                    var thumbCell = row.querySelector('.deal-thumb-cell');
                    var photoCell = row.querySelector('.deal-photo-cell');
                    var imgHtml = '<img src="' + prod.photos[0] + '" class="deal-thumb" />';
                    if (thumbCell) thumbCell.innerHTML = imgHtml;
                    if (photoCell) photoCell.innerHTML = imgHtml;
                    var codeEl = row.querySelector('.deal-order-code');
                    if (codeEl && prod.code) codeEl.textContent = prod.code;
                    var titleEl = row.querySelector('.deal-order-title');
                    if (titleEl && prod.title) titleEl.textContent = prod.title;
                }
            }
        }).catch(function() {});
    });
}

// ========== WAREHOUSE TAB ==========

function renderWarehouseTab(container) {
    var deal = appState.deal;
    if (!deal) { container.innerHTML = '<div class="empty-tab">Deal not loaded.</div>'; return; }

    var html = '';

    html += '<div class="section-header" style="display:flex;justify-content:space-between;align-items:center">';
    html += '<span>📥 Warehouse Receipts</span>';
    html += '<button class="btn btn-sm btn-primary" data-action="add-warehouse">➕ Add Receipt</button>';
    html += '</div>';

    var warehouse = deal.warehouse || [];
    if (warehouse.length === 0) {
        html += '<div class="empty-tab" style="padding:8px;font-size:13px">No warehouse receipts yet.</div>';
    } else {
        warehouse.forEach(function(wr, wrIdx) {
            html += '<div class="warehouse-record" data-wr-idx="' + wrIdx + '" style="margin-top:8px;padding:10px;background:var(--bg-hover);border:1px solid var(--border);border-radius:var(--radius)">';
            html += '<div style="display:flex;justify-content:space-between;align-items:center">';
            html += '<label>Receipt Date: <input type="date" class="wr-date" value="' + escapeHtml(wr.date || '') + '" style="font-size:12px" /></label>';
            html += '<button class="btn btn-xs btn-danger" data-action="remove-warehouse-record" data-idx="' + wrIdx + '">✕ Remove</button>';
            html += '</div>';
            html += '<div style="margin-top:8px">';
            html += '<table class="deal-table">';
            html += '<thead><tr><th>Product</th><th>Qty</th><th></th></tr></thead><tbody>';
            var items = wr.items || [];
            items.forEach(function(item, itemIdx) {
                html += '<tr>';
                html += '<td><input type="text" class="wr-product" value="' + escapeHtml(item.product || '') + '" placeholder="path/to/prod" style="width:250px" /></td>';
                html += '<td><input type="number" class="wr-qty" value="' + (item.quantity || 0) + '" /></td>';
                html += '<td><button class="btn btn-xs btn-danger" data-action="remove-wh-item" data-wr="' + wrIdx + '" data-idx="' + itemIdx + '">✕</button></td>';
                html += '</tr>';
            });
            html += '</tbody></table>';
            html += '<button class="btn btn-xs" data-action="add-wh-item" data-idx="' + wrIdx + '" style="margin-top:4px">➕ Add Item</button>';
            html += '</div></div>';
        });
    }

    container.innerHTML = html;

    var addBtn = document.querySelector('[data-action="add-warehouse"]');
    if (addBtn) addBtn.addEventListener('click', function() {
        deal.warehouse.push({ date: '', items: [] });
        appState.modified = true;
        render();
    });

    container.querySelectorAll('[data-action="remove-warehouse-record"]').forEach(function(btn) {
        btn.addEventListener('click', function() {
            var idx = parseInt(btn.dataset.idx);
            deal.warehouse.splice(idx, 1);
            appState.modified = true;
            render();
        });
    });

    container.querySelectorAll('[data-action="remove-wh-item"]').forEach(function(btn) {
        btn.addEventListener('click', function() {
            var wrIdx = parseInt(btn.dataset.wr);
            var idx = parseInt(btn.dataset.idx);
            if (deal.warehouse[wrIdx]) {
                deal.warehouse[wrIdx].items.splice(idx, 1);
                appState.modified = true;
                render();
            }
        });
    });

    container.querySelectorAll('[data-action="add-wh-item"]').forEach(function(btn) {
        btn.addEventListener('click', function() {
            var wrIdx = parseInt(btn.dataset.idx);
            if (deal.warehouse[wrIdx]) {
                deal.warehouse[wrIdx].items.push({ product: '', product_title: '', quantity: 0 });
                appState.modified = true;
                render();
            }
        });
    });

    container.querySelectorAll('input').forEach(function(el) {
        el.addEventListener('input', function() { appState.modified = true; });
    });
}

// ========== PRODUCT PICKER ==========

var _pickerProducts = [];

function showProductPicker() {
    var overlay = document.getElementById('product-picker-overlay');
    overlay.style.display = 'flex';
    document.getElementById('picker-list').innerHTML = '<div class="empty-tab">Enter a directory path and click Load, or browse.</div>';
    document.getElementById('picker-dir-input').value = '';
    document.getElementById('picker-filter').style.display = 'none';
    _pickerProducts = [];

    document.getElementById('picker-browse-btn').onclick = async function() {
        try {
            var result = await api.browseDir();
            if (result && result.path) {
                document.getElementById('picker-dir-input').value = result.path;
                loadPickerProducts(result.path);
            }
        } catch (err) {
            alert('Browse failed: ' + err.message);
        }
    };

    document.getElementById('picker-load-btn').onclick = function() {
        var dir = document.getElementById('picker-dir-input').value.trim();
        if (dir) loadPickerProducts(dir);
    };

    document.getElementById('picker-close-btn').onclick = closePicker;
    document.getElementById('picker-cancel-btn').onclick = closePicker;

    document.getElementById('picker-add-btn').onclick = function() {
        var cbs = document.querySelectorAll('.picker-item-cb:checked');
        var added = 0;
        cbs.forEach(function(cb) {
            var filePath = cb.value;
            var displayName = filePath.split('/').pop().replace(/\.prod$/, '');
            var deal = appState.deal;
            if (deal.order.some(function(o) { return o.product === filePath; })) return;
            deal.order.push({
                product: filePath,
                product_title: displayName,
                quantity: 1,
                min_qty: 0,
                unit_price: 0,
                currency: (deal.currency || 'USD'),
                total: 0,
                notes: ''
            });
            added++;
        });
        if (added > 0) {
            appState.modified = true;
            closePicker();
            render();
        } else {
            alert('No new products selected.');
        }
    };
}

function closePicker() {
    document.getElementById('product-picker-overlay').style.display = 'none';
}

async function loadPickerProducts(dir) {
    var listEl = document.getElementById('picker-list');
    var filterEl = document.getElementById('picker-filter');
    try {
        var files = await api.listProducts(dir);
        _pickerProducts = files;
        if (files.length === 0) {
            listEl.innerHTML = '<div class="empty-tab">No .prod files found in this directory.</div>';
            filterEl.style.display = 'none';
            return;
        }
        filterEl.style.display = '';
        filterEl.value = '';
        renderPickerList(files);
        filterEl.oninput = function() {
            var q = this.value.toLowerCase();
            var filtered = files.filter(function(f) {
                return f.toLowerCase().indexOf(q) >= 0;
            });
            renderPickerList(filtered);
        };
    } catch (err) {
        listEl.innerHTML = '<div class="error-state">Error: ' + escapeHtml(err.message) + '</div>';
    }
}

function renderPickerList(files) {
    var listEl = document.getElementById('picker-list');
    var existingProducts = (appState.deal && appState.deal.order || []).map(function(o) { return o.product; });
    var html = '';
    files.forEach(function(file) {
        var displayName = file.split('/').pop().replace(/\.prod$/, '');
        var disabled = existingProducts.indexOf(file) >= 0;
        html += '<label style="display:flex;align-items:center;padding:6px 0;border-bottom:1px solid var(--border);cursor:pointer;' + (disabled ? 'opacity:0.5' : '') + '">';
        html += '<input type="checkbox" class="picker-item-cb" value="' + escapeHtml(file) + '" ' + (disabled ? 'disabled' : '') + ' style="margin-right:10px" />';
        html += '<span>' + escapeHtml(displayName) + '</span>';
        html += '<span style="margin-left:auto;font-size:11px;color:var(--text-muted)">' + escapeHtml(file) + '</span>';
        html += '</label>';
    });
    listEl.innerHTML = html;
}

// ========== EVENT BINDING ==========

function bindEvents() {
    document.getElementById('btn-open-file').addEventListener('click', handleOpenFile);
    var dialogBtn = document.getElementById('btn-open-file-dialog');
    if (dialogBtn) dialogBtn.addEventListener('click', handleOpenFile);
    document.getElementById('btn-new-deal').addEventListener('click', handleNewDeal);
    document.getElementById('btn-close-file').addEventListener('click', handleCloseFile);
    document.getElementById('btn-save').addEventListener('click', handleSave);

    // Drag and drop
    document.body.addEventListener('dragover', function(e) { e.preventDefault(); });
    document.body.addEventListener('drop', function(e) {
        e.preventDefault();
        var files = e.dataTransfer.files;
        if (files && files.length > 0) {
            var path = files[0].path || files[0].name;
            if (path.endsWith('.deal')) {
                handleOpenPath(path);
            }
        }
    });
}

// ========== HANDLERS ==========

async function handleOpenFile() {
    try {
        var result = await api.openFileDialog();
        if (result && result.path) {
            await handleOpenPath(result.path);
        }
    } catch (err) {
        alert('Error: ' + err.message);
    }
}

async function handleOpenPath(path) {
    try {
        var data = await api.open(path);
        appState.deal = data.deal;
        appState.directory = data.directory;
        appState.filename = data.deal.filename;
        appState.filepath = data.filepath;
        appState.modified = false;
        appState.activeTab = 'order';
        render();
    } catch (err) {
        alert('Error opening file: ' + err.message);
    }
}

function handleNewDeal() {
    var today = new Date().toISOString().slice(0, 10);
    appState.deal = {
        title: '', filename: '', date: today,
        status: 'pending', currency: 'USD',
        additional_costs: 0, additional_costs_currency: '',
        notes: '', order: [], warehouse: [],
        order_count: 0, warehouse_records: 0
    };
    appState.directory = '';
    appState.filename = '';
    appState.filepath = '';
    appState.modified = false;
    appState.activeTab = 'order';

    // Show directory picker for new deal
    var dir = prompt('Enter directory path where the .deal file will be saved:');
    if (dir && dir.trim()) {
        appState.directory = dir.trim();
        render();
    } else {
        appState.deal = null;
    }
}

function handleCloseFile() {
    if (appState.modified) {
        if (!confirm('Discard unsaved changes?')) return;
    }
    appState.deal = null;
    appState.modified = false;
    render();
}

async function handleSave() {
    gatherFormData();

    if (!appState.directory) {
        var dir = prompt('Enter directory path to save the .deal file:');
        if (!dir || !dir.trim()) return;
        appState.directory = dir.trim();
    }

    try {
        var result = await api.save(appState.directory, appState.deal);
        appState.deal = result.deal;
        appState.filename = result.deal.filename;
        appState.filepath = result.filepath;
        appState.directory = result.directory;
        appState.modified = false;
        render();
        alert('✅ Deal saved successfully!');
    } catch (err) {
        alert('❌ Error saving: ' + err.message);
    }
}

function gatherFormData() {
    var deal = appState.deal;

    var titleEl = document.getElementById('deal-title-input');
    if (titleEl) deal.title = titleEl.value.trim();

    var dateEl = document.getElementById('deal-date-input');
    if (dateEl) deal.date = dateEl.value;

    var statusEl = document.getElementById('deal-status-select');
    if (statusEl) deal.status = statusEl.value;

    var fnEl = document.getElementById('deal-filename-input');
    if (fnEl) deal.filename = fnEl.value.trim();

    var curEl = document.getElementById('deal-currency-input');
    if (curEl) deal.currency = curEl.value.trim().toUpperCase();

    var costsEl = document.getElementById('deal-extra-costs');
    if (costsEl) deal.additional_costs = parseFloat(costsEl.value) || 0;

    var costsCurEl = document.getElementById('deal-extra-currency');
    if (costsCurEl) deal.additional_costs_currency = costsCurEl.value.trim().toUpperCase();

    var notesEl = document.getElementById('deal-notes-input');
    if (notesEl) deal.notes = notesEl.value.trim();

    // Gather order items from table
    deal.order = [];
    var rows = document.querySelectorAll('#tab-content tbody tr');
    rows.forEach(function(row) {
        var item = {
            product: '',
            product_title: '',
            quantity: 0,
            min_qty: 0,
            unit_price: 0,
            currency: '',
            total: 0,
            notes: ''
        };
        var productEl = row.querySelector('.deal-order-product');
        if (productEl) item.product = productEl.value || '';
        var qtyEl = row.querySelector('.deal-order-qty');
        if (qtyEl) item.quantity = parseInt(qtyEl.value) || 0;
        var minQtyEl = row.querySelector('.deal-order-minqty');
        if (minQtyEl) item.min_qty = parseInt(minQtyEl.value) || 0;
        var priceEl = row.querySelector('.deal-order-price');
        if (priceEl) item.unit_price = parseFloat(priceEl.value) || 0;
        var curEl2 = row.querySelector('.deal-order-currency');
        if (curEl2) item.currency = curEl2.value || '';
        var totalEl = row.querySelector('.deal-order-total');
        if (totalEl) item.total = parseFloat(totalEl.value) || 0;
        var notesEl2 = row.querySelector('.deal-order-notes');
        if (notesEl2) item.notes = notesEl2.value || '';
        if (item.product) deal.order.push(item);
    });

    // Gather warehouse records
    deal.warehouse = [];
    document.querySelectorAll('.warehouse-record').forEach(function(rec) {
        var wr = { date: '', items: [] };
        var dateEl = rec.querySelector('.wr-date');
        if (dateEl) wr.date = dateEl.value || '';
        rec.querySelectorAll('tbody tr').forEach(function(row) {
            var product = (row.querySelector('.wr-product') || {}).value || '';
            var qty = parseInt((row.querySelector('.wr-qty') || {}).value) || 0;
            if (product) {
                wr.items.push({ product: product, product_title: '', quantity: qty });
            }
        });
        if (wr.items.length > 0) deal.warehouse.push(wr);
    });
}

// ========== UTILITY ==========

function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

document.addEventListener('DOMContentLoaded', init);
