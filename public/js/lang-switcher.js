(function () {
  'use strict';

  if (window.__langSwitcherInit) return;
  window.__langSwitcherInit = true;

  function closeAll() {
    document.querySelectorAll('[data-lang-switcher]').forEach(function (root) {
      var menu = root.querySelector('.lang-switcher__menu');
      var toggle = root.querySelector('.lang-switcher__toggle');
      if (menu) {
        menu.setAttribute('hidden', '');
        menu.classList.remove('open');
        menu.setAttribute('aria-hidden', 'true');
        menu.style.top = '';
        menu.style.right = '';
        menu.style.left = '';
      }
      if (toggle) toggle.setAttribute('aria-expanded', 'false');
    });
  }

  function positionMenu(toggle, menu) {
    var rect = toggle.getBoundingClientRect();
    var menuWidth = Math.max(menu.offsetWidth || 72, 72);
    var left = Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 8);
    left = Math.max(8, left);
    menu.style.position = 'fixed';
    menu.style.top = Math.round(rect.bottom + 6) + 'px';
    menu.style.left = Math.round(left) + 'px';
    menu.style.right = 'auto';
    menu.style.zIndex = '3000';
  }

  function openMenu(root) {
    var menu = root.querySelector('.lang-switcher__menu');
    var toggle = root.querySelector('.lang-switcher__toggle');
    if (!menu || !toggle) return;
    closeAll();
    menu.removeAttribute('hidden');
    menu.classList.add('open');
    menu.setAttribute('aria-hidden', 'false');
    toggle.setAttribute('aria-expanded', 'true');
    // measure after visible
    positionMenu(toggle, menu);
  }

  document.addEventListener('click', function (e) {
    var toggle = e.target.closest && e.target.closest('.lang-switcher__toggle');
    if (toggle) {
      e.preventDefault();
      e.stopPropagation();
      var root = toggle.closest('[data-lang-switcher]');
      if (!root) return;
      var menu = root.querySelector('.lang-switcher__menu');
      var isOpen = menu && !menu.hasAttribute('hidden');
      if (isOpen) closeAll();
      else openMenu(root);
      return;
    }

    if (!(e.target.closest && e.target.closest('[data-lang-switcher]'))) {
      closeAll();
    }
  }, true);

  window.addEventListener('resize', closeAll);
  window.addEventListener('scroll', closeAll, true);
})();
