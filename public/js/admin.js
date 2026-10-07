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

  // ย่อรูปในเบราว์เซอร์ก่อนอัปโหลด: รูปจากมือถือ (เช่น iPhone) มักใหญ่ 3-6MB
  // แต่โฮสต์ (Vercel) รับข้อมูลได้ไม่เกินประมาณ 4.5MB ต่อครั้ง จึงย่อให้เหลือรูปละไม่กี่ร้อย KB
  var TOTAL_BUDGET = 4 * 1024 * 1024;

  function loadImage(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('decode failed')); };
      img.src = url;
    });
  }

  function toBlob(canvas, quality) {
    return new Promise(function (resolve) { canvas.toBlob(resolve, 'image/jpeg', quality); });
  }

  // คืนไฟล์ JPEG ด้านยาวไม่เกิน maxSide และพยายามให้ไม่เกิน maxBytes
  function compressImage(file, maxSide, maxBytes) {
    return loadImage(file)
      .then(function (img) {
        var scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
        var canvas = document.createElement('canvas');
        canvas.width = Math.round(img.naturalWidth * scale);
        canvas.height = Math.round(img.naturalHeight * scale);
        var ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        var quality = 0.85;
        function attempt() {
          return toBlob(canvas, quality).then(function (blob) {
            if (!blob) throw new Error('encode failed');
            if (blob.size > maxBytes && quality > 0.45) {
              quality -= 0.1;
              return attempt();
            }
            return blob;
          });
        }
        return attempt();
      })
      .then(function (blob) {
        // ถ้าย่อแล้วไม่เล็กลง ใช้ไฟล์เดิม
        if (blob.size >= file.size && file.size <= maxBytes) return file;
        var name = (file.name || 'photo').replace(/\.[^.]+$/, '') + '.jpg';
        return new File([blob], name, { type: 'image/jpeg', lastModified: Date.now() });
      })
      .catch(function () {
        return file; // ย่อไม่ได้ (เช่นเบราว์เซอร์เปิดไฟล์ชนิดนี้ไม่ได้) ส่งไฟล์เดิมให้เซิร์ฟเวอร์จัดการ
      });
  }

  function formatSize(bytes) {
    return bytes >= 1024 * 1024 ? (bytes / 1024 / 1024).toFixed(1) + 'MB' : Math.round(bytes / 1024) + 'KB';
  }

  // Image picker: keep adding files, drag & drop, preview and remove before upload
  document.querySelectorAll('form').forEach(function (form) {
    var input = form.querySelector('[data-file-input]');
    if (!input) return;
    var zone = form.querySelector('[data-dropzone]');
    var preview = form.querySelector('[data-preview]');
    var multiple = input.multiple;
    var MAX_FILES = multiple ? 12 : 1;
    var maxSide = parseInt(input.dataset.maxSide, 10) || (multiple ? 1280 : 1920);
    var maxBytes = multiple ? 330 * 1024 : 1200 * 1024;
    var files = [];
    var pending = 0;
    var waitingSubmit = false;
    var supportsDT = typeof DataTransfer !== 'undefined';

    function sync() {
      if (!supportsDT) return;
      var dt = new DataTransfer();
      files.forEach(function (f) { dt.items.add(f); });
      input.files = dt.files;
    }

    function render() {
      if (!preview) return;
      preview.innerHTML = '';
      files.forEach(function (file, index) {
        var tile = document.createElement('div');
        tile.className = 'image-tile';
        var img = document.createElement('img');
        img.alt = '';
        img.src = URL.createObjectURL(file);
        img.onload = function () { URL.revokeObjectURL(img.src); };
        var size = document.createElement('span');
        size.className = 'tag tag-muted size-tag';
        size.textContent = formatSize(file.size);
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
        tile.appendChild(size);
        tile.appendChild(remove);
        preview.appendChild(tile);
      });
      if (pending) {
        var busy = document.createElement('div');
        busy.className = 'image-tile image-tile-busy';
        busy.textContent = 'กำลังย่อรูป ' + pending + ' รูป...';
        preview.appendChild(busy);
      }
    }

    function finishIfWaiting() {
      if (waitingSubmit && pending === 0) {
        waitingSubmit = false;
        submitForm();
      }
    }

    function addFiles(list) {
      var incoming = Array.prototype.filter.call(list, function (file) {
        return /^image\//.test(file.type) || /\.(heic|heif)$/i.test(file.name || '');
      });
      if (!multiple) files = [];
      incoming.slice(0, Math.max(0, MAX_FILES - files.length - pending)).forEach(function (file) {
        pending += 1;
        compressImage(file, maxSide, maxBytes).then(function (small) {
          pending -= 1;
          if (files.length < MAX_FILES) files.push(small);
          sync();
          render();
          finishIfWaiting();
        });
      });
      render();
    }

    if (supportsDT) {
      input.addEventListener('change', function () {
        var picked = Array.prototype.slice.call(input.files);
        sync(); // คืนค่ารายการเดิมไว้ก่อน รูปใหม่จะถูกเพิ่มเมื่อย่อเสร็จ
        addFiles(picked);
      });
    }

    if (zone) {
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
        if (supportsDT && e.dataTransfer && e.dataTransfer.files) addFiles(e.dataTransfer.files);
      });
    }

    var btn = form.querySelector('[data-submit]') || form.querySelector('button[type=submit]');
    function setBusy(text) {
      if (!btn) return;
      btn.disabled = true;
      var label = btn.lastChild;
      if (label && label.nodeType === 3) label.textContent = text;
    }

    function submitForm() {
      var total = files.reduce(function (sum, f) { return sum + f.size; }, 0);
      if (total > TOTAL_BUDGET) {
        window.alert(
          'รูปรวมกันใหญ่เกินไป (' + formatSize(total) + ') กรุณาลดจำนวนรูปลง แล้วบันทึก จากนั้นค่อยเพิ่มรูปที่เหลือในการแก้ไขครั้งถัดไป',
        );
        if (btn) btn.disabled = false;
        return;
      }
      setBusy(files.length ? 'กำลังอัปโหลดรูป...' : 'กำลังบันทึก...');
      HTMLFormElement.prototype.submit.call(form);
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (pending > 0) {
        waitingSubmit = true;
        setBusy('กำลังย่อรูป...');
        return;
      }
      submitForm();
    });
  });
})();
