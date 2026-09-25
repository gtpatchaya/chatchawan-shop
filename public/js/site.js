(function () {
  'use strict';
  document.documentElement.classList.add('js');

  // Header shadow when scrolled
  var header = document.querySelector('.site-header');
  function onScroll() {
    if (header) header.classList.toggle('scrolled', window.scrollY > 8);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Fade-in cards as they enter the viewport
  var revealObserver =
    'IntersectionObserver' in window
      ? new IntersectionObserver(
          function (entries) {
            entries.forEach(function (entry) {
              if (entry.isIntersecting) {
                entry.target.classList.add('is-visible');
                revealObserver.unobserve(entry.target);
              }
            });
          },
          { rootMargin: '0px 0px -40px 0px' },
        )
      : null;

  function observeReveals(root) {
    var items = (root || document).querySelectorAll('.reveal:not(.is-visible)');
    items.forEach(function (el, i) {
      if (!revealObserver) return el.classList.add('is-visible');
      el.style.transitionDelay = Math.min(i % 4, 3) * 60 + 'ms';
      revealObserver.observe(el);
    });
  }
  observeReveals();

  // Infinite scroll
  document.querySelectorAll('[data-infinite]').forEach(function (grid) {
    var box = grid.nextElementSibling;
    if (!box || !box.hasAttribute('data-load-more')) return;
    var button = box.querySelector('button');
    var page = parseInt(grid.dataset.nextPage, 10) || 2;
    var hasMore = grid.dataset.hasMore === 'true';
    var loading = false;

    function load() {
      if (loading || !hasMore) return;
      loading = true;
      box.classList.add('loading');
      var qs = grid.dataset.query ? grid.dataset.query + '&' : '';
      fetch('/api/products?' + qs + 'page=' + page, { headers: { Accept: 'application/json' } })
        .then(function (res) {
          if (!res.ok) throw new Error('HTTP ' + res.status);
          return res.json();
        })
        .then(function (data) {
          var tmp = document.createElement('div');
          tmp.innerHTML = data.html;
          var added = Array.prototype.slice.call(tmp.children);
          added.forEach(function (el) {
            grid.appendChild(el);
          });
          observeReveals(grid);
          hasMore = data.hasMore;
          page = data.nextPage;
          if (!hasMore) {
            box.hidden = true;
            if (observer) observer.disconnect();
          }
        })
        .catch(function () {
          // Leave the button visible so the visitor can retry
        })
        .then(function () {
          loading = false;
          box.classList.remove('loading');
        });
    }

    button.addEventListener('click', load);
    var observer =
      'IntersectionObserver' in window
        ? new IntersectionObserver(
            function (entries) {
              if (entries[0].isIntersecting) load();
            },
            { rootMargin: '600px 0px' },
          )
        : null;
    if (observer && hasMore) observer.observe(box);
  });

  // Horizontal rails
  document.querySelectorAll('[data-rail]').forEach(function (rail) {
    var head = rail.previousElementSibling;
    if (!head) return;
    var prev = head.querySelector('[data-rail-prev]');
    var next = head.querySelector('[data-rail-next]');
    function step(dir) {
      rail.scrollBy({ left: dir * rail.clientWidth * 0.8, behavior: 'smooth' });
    }
    if (prev) prev.addEventListener('click', function () { step(-1); });
    if (next) next.addEventListener('click', function () { step(1); });
  });

  // Product gallery
  document.querySelectorAll('[data-gallery]').forEach(function (gallery) {
    var track = gallery.querySelector('[data-gallery-track]');
    if (!track) return;
    var slides = track.children;
    var thumbs = gallery.querySelectorAll('[data-gallery-thumb]');
    var indexLabel = gallery.querySelector('[data-gallery-index]');
    var current = 0;

    function goTo(i) {
      i = Math.max(0, Math.min(slides.length - 1, i));
      track.scrollTo({ left: i * track.clientWidth, behavior: 'smooth' });
    }

    function update() {
      var i = Math.round(track.scrollLeft / track.clientWidth);
      if (i === current) return;
      current = i;
      if (indexLabel) indexLabel.textContent = i + 1;
      thumbs.forEach(function (t, n) {
        t.classList.toggle('active', n === i);
        if (n === i) t.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
      });
    }

    track.addEventListener('scroll', function () {
      window.requestAnimationFrame(update);
    }, { passive: true });
    thumbs.forEach(function (t) {
      t.addEventListener('click', function () { goTo(parseInt(t.dataset.galleryThumb, 10)); });
    });
    var prev = gallery.querySelector('[data-gallery-prev]');
    var next = gallery.querySelector('[data-gallery-next]');
    if (prev) prev.addEventListener('click', function () { goTo(current - 1); });
    if (next) next.addEventListener('click', function () { goTo(current + 1); });
    gallery.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') goTo(current - 1);
      if (e.key === 'ArrowRight') goTo(current + 1);
    });
  });

  // Mobile buy bar appears after scrolling past the main buttons
  var buybar = document.querySelector('.mobile-buybar');
  var actions = document.querySelector('.detail-actions');
  if (buybar && actions && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      var e = entries[0];
      buybar.classList.toggle('show', !e.isIntersecting && e.boundingClientRect.top < 0);
    }).observe(actions);
  }

  // Copy an enquiry message for LINE
  document.querySelectorAll('[data-copy]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var text = btn.dataset.copy + '\n' + window.location.href;
      if (!navigator.clipboard) return;
      navigator.clipboard.writeText(text).then(function () {
        var label = btn.lastChild;
        var original = label.textContent;
        btn.classList.add('copied');
        label.textContent = 'คัดลอกแล้ว นำไปวางในแชทได้เลย';
        setTimeout(function () {
          btn.classList.remove('copied');
          label.textContent = original;
        }, 2500);
      });
    });
  });

  // Submit sort form on change
  document.querySelectorAll('form[data-auto-submit] select').forEach(function (select) {
    select.addEventListener('change', function () { select.form.submit(); });
  });
})();
