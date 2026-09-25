(function () {
  'use strict';

  // Confirm destructive actions
  document.querySelectorAll('form[data-confirm]').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      if (!window.confirm(form.dataset.confirm)) e.preventDefault();
    });
  });

  // Status dropdown saves immediately
  document.querySelectorAll('select[data-auto-submit]').forEach(function (select) {
    select.addEventListener('change', function () {
      select.form.submit();
    });
  });

  // Auto-hide flash message
  var alert = document.querySelector('[data-dismissable]');
  if (alert) {
    setTimeout(function () {
      alert.style.transition = 'opacity .4s';
      alert.style.opacity = '0';
      setTimeout(function () { alert.remove(); }, 400);
    }, 3500);
  }

  // Image picker: keep adding files, drag & drop, preview and remove before upload
  var form = document.querySelector('[data-product-form]');
  if (!form) return;
  var input = form.querySelector('[data-file-input]');
  var zone = form.querySelector('[data-dropzone]');
  var preview = form.querySelector('[data-preview]');
  var MAX_FILES = 12;
  var files = [];

  function sync() {
    if (typeof DataTransfer === 'undefined') return;
    var dt = new DataTransfer();
    files.forEach(function (f) { dt.items.add(f); });
    input.files = dt.files;
  }

  function render() {
    preview.innerHTML = '';
    files.forEach(function (file, index) {
      var tile = document.createElement('div');
      tile.className = 'image-tile';
      var img = document.createElement('img');
      img.alt = '';
      img.src = URL.createObjectURL(file);
      img.onload = function () { URL.revokeObjectURL(img.src); };
      var remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'icon-btn remove-preview';
      remove.setAttribute('aria-label', 'เอารูปนี้ออก');
      remove.innerHTML =
        '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';
      remove.addEventListener('click', function () {
        files.splice(index, 1);
        sync();
        render();
      });
      tile.appendChild(img);
      tile.appendChild(remove);
      preview.appendChild(tile);
    });
  }

  function addFiles(list) {
    Array.prototype.forEach.call(list, function (file) {
      if (!/^image\//.test(file.type)) return;
      if (files.length >= MAX_FILES) return;
      files.push(file);
    });
    sync();
    render();
  }

  input.addEventListener('change', function () {
    // Browsers without DataTransfer support just use the native selection
    if (typeof DataTransfer === 'undefined') return;
    addFiles(input.files);
  });

  ['dragenter', 'dragover'].forEach(function (type) {
    zone.addEventListener(type, function (e) {
      e.preventDefault();
      zone.classList.add('dragover');
    });
  });
  ['dragleave', 'drop'].forEach(function (type) {
    zone.addEventListener(type, function () { zone.classList.remove('dragover'); });
  });
  zone.addEventListener('drop', function (e) {
    e.preventDefault();
    if (e.dataTransfer && e.dataTransfer.files) addFiles(e.dataTransfer.files);
  });

  form.addEventListener('submit', function () {
    var btn = form.querySelector('[data-submit]');
    if (btn) {
      btn.disabled = true;
      btn.lastChild.textContent = files.length ? 'กำลังอัปโหลดรูป...' : 'กำลังบันทึก...';
    }
  });
})();
