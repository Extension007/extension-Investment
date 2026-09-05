(function () {
  'use strict';

  function qs(sel, root) {
    return (root || document).querySelector(sel);
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function fillSelect(select, items, placeholder, selected) {
    if (!select) return;
    select.innerHTML = '';
    const ph = document.createElement('option');
    ph.value = '';
    ph.textContent = placeholder;
    select.appendChild(ph);
    items.forEach(function (item) {
      const opt = document.createElement('option');
      const value = item.value || item.name || item;
      const label = item.label || item.name || item.value || item;
      opt.value = value;
      opt.textContent = label;
      if (selected && selected === value) opt.selected = true;
      select.appendChild(opt);
    });
    select.disabled = false;
  }

  function clearSelect(select, placeholder) {
    if (!select) return;
    select.innerHTML = '<option value="">' + placeholder + '</option>';
    select.disabled = true;
  }

  function initLocationCascade(root) {
    const countrySelect = qs('#countrySelect', root) || qs('#filterCountry', root);
    const citySelect = qs('#citySelect', root) || qs('#filterCity', root);
    if (!countrySelect || !citySelect) return;

    const isFilter = countrySelect.id === 'filterCountry';
    function lt(key, fallback) {
      if (typeof window.i18nT === 'function') return window.i18nT(key, fallback);
      return fallback;
    }
    const countryPh = countrySelect.getAttribute('data-ph-all') || countrySelect.getAttribute('data-ph') || (isFilter ? lt('search.allCountries', 'All countries') : lt('search.selectCountry', 'Select country'));
    const cityPh = citySelect.getAttribute('data-ph-all') || citySelect.getAttribute('data-ph') || (isFilter ? lt('search.allCities', 'All cities') : lt('search.selectCity', 'Select city'));

    function loadCitiesLocal() {
      const country = countrySelect.value;
      if (!country) {
        clearSelect(citySelect, cityPh);
        return Promise.resolve();
      }
      return fetch('/api/locations/cities?country=' + encodeURIComponent(country))
        .then(function (r) { return r.json(); })
        .then(function (data) {
          fillSelect(citySelect, data.cities || [], cityPh, citySelect.getAttribute('data-selected') || '');
        });
    }

    fetch('/api/locations/countries')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        fillSelect(countrySelect, data.countries || [], countryPh, countrySelect.getAttribute('data-selected') || '');
        if (countrySelect.value) {
          return loadCitiesLocal();
        }
      })
      .catch(function () {});

    countrySelect.addEventListener('change', function () {
      citySelect.removeAttribute('data-selected');
      loadCitiesLocal();
    });
  }

  function parseInitialTags(hidden) {
    if (!hidden || !hidden.value) return [];
    try {
      const parsed = JSON.parse(hidden.value);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return String(hidden.value).split(/[,\s]+/).filter(Boolean);
    }
  }

  function lt(key, fallback) {
    if (typeof window.i18nT === 'function') return window.i18nT(key, fallback);
    return fallback;
  }

  function normalizeTag(raw) {
    return String(raw || '')
      .trim()
      .replace(/^#+/, '')
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-zа-яёәіңғүұқөһ0-9\u4e00-\u9fff\-_]/gi, '')
      .slice(0, 40);
  }

  function initTagsInput(root) {
    const hidden = qs('#tagsHidden', root);
    const input = qs('#tagsInput', root);
    const chips = qs('#tagsChips', root);
    const suggest = qs('#tagsSuggest', root);
    const addBtn = qs('#tagsAddBtn', root);
    const status = qs('#tagsStatus', root);
    if (!hidden || !input || !chips) return;

    let tags = parseInitialTags(hidden);

    function setStatus(text) {
      if (!status) return;
      if (!text) {
        status.hidden = true;
        status.textContent = '';
        return;
      }
      status.hidden = false;
      status.textContent = text;
    }

    function sync() {
      hidden.value = JSON.stringify(tags);
      chips.innerHTML = '';
      if (!tags.length) {
        const empty = document.createElement('span');
        empty.className = 'tags-empty';
        empty.textContent = lt('search.tagEmptyHint', 'Пока нет хештегов — добавьте хотя бы один');
        chips.appendChild(empty);
      }
      tags.forEach(function (tag, idx) {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'tag-chip';
        chip.textContent = '#' + tag + ' ×';
        chip.setAttribute('aria-label', lt('search.tagRemove', 'Удалить тег') + ' ' + tag);
        chip.addEventListener('click', function () {
          tags.splice(idx, 1);
          sync();
        });
        chips.appendChild(chip);
      });
    }

    function addTag(raw, { silent } = {}) {
      const value = String(raw || '').trim();
      if (!value) {
        if (!silent) setStatus(lt('search.tagTooShort', 'Напишите тег от 2 символов, например ремонт'));
        return false;
      }
      const tag = normalizeTag(value);
      if (!tag || tag.length < 2) {
        if (!silent) setStatus(lt('search.tagTooShort', 'Напишите тег от 2 символов, например ремонт'));
        return false;
      }
      if (tags.indexOf(tag) !== -1) {
        input.value = '';
        setStatus('');
        return true;
      }
      if (tags.length >= 15) {
        if (!silent) setStatus(lt('search.tagLimit', 'Можно добавить не больше 15 хештегов'));
        return false;
      }
      tags.push(tag);
      sync();
      input.value = '';
      setStatus('');
      if (suggest) {
        suggest.hidden = true;
        suggest.innerHTML = '';
      }
      return true;
    }

    function commitPending(options) {
      const chunks = String(input.value || '')
        .split(/[,#\n]+/)
        .map(function (part) { return part.trim(); })
        .filter(Boolean);
      if (!chunks.length) return tags.length > 0;
      let added = false;
      chunks.forEach(function (chunk) {
        if (addTag(chunk, options || {})) added = true;
      });
      return added || tags.length > 0;
    }

    input.addEventListener('keydown', function (e) {
      if (e.isComposing) return;
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        addTag(input.value);
      }
    });

    input.addEventListener('blur', function (e) {
      const next = e.relatedTarget;
      if (next && next.closest && next.closest('#tagsFields')) return;
      if (input.value.trim()) commitPending({ silent: true });
    });

    if (addBtn) {
      addBtn.addEventListener('mousedown', function (e) {
        e.preventDefault();
      });
      addBtn.addEventListener('click', function () {
        addTag(input.value);
        input.focus();
      });
    }

    window.AlbamountLocationTags = window.AlbamountLocationTags || {};
    window.AlbamountLocationTags.commitPending = function () {
      return commitPending({ silent: true });
    };
    window.AlbamountLocationTags.getTags = function () {
      commitPending({ silent: true });
      return tags.slice();
    };

    let timer = null;
    input.addEventListener('input', function () {
      const q = input.value.trim().replace(/^#/, '');
      if (!suggest) return;
      clearTimeout(timer);
      if (q.length < 1) {
        suggest.hidden = true;
        return;
      }
      timer = setTimeout(async function () {
        try {
          const res = await fetch('/api/locations/suggest-tags?q=' + encodeURIComponent(q));
          const data = await res.json();
          const list = data.tags || [];
          if (!list.length) {
            suggest.hidden = true;
            return;
          }
          suggest.innerHTML = list.map(function (t) {
            var tag = String(t == null ? '' : t);
            return '<button type="button" class="catalog-suggest__item" data-tag="' +
              escapeHtml(tag) + '">#' + escapeHtml(tag) + '</button>';
          }).join('');
          suggest.hidden = false;
        } catch (_) {
          suggest.hidden = true;
        }
      }, 200);
    });

    if (suggest) {
      suggest.addEventListener('click', function (e) {
        const btn = e.target.closest('[data-tag]');
        if (!btn) return;
        addTag(btn.getAttribute('data-tag'));
      });
    }

    sync();
  }

  function initCatalogSearch() {
    const form = qs('#catalogSearchForm');
    if (!form) return;

    initLocationCascade(form);

    const panel = qs('#catalogFiltersPanel', form);
    const toggle = qs('#toggleCatalogFilters', form);
    if (toggle && panel) {
      const hasActive = Array.from(form.querySelectorAll('select, input[type="number"], input[type="date"], #filterTag'))
        .some(function (el) { return el.name !== 'q' && el.value; });
      if (hasActive) {
        panel.hidden = false;
        toggle.setAttribute('aria-expanded', 'true');
      }
      toggle.addEventListener('click', function () {
        panel.hidden = !panel.hidden;
        toggle.setAttribute('aria-expanded', panel.hidden ? 'false' : 'true');
      });
    }

    const input = qs('#catalogSearchInput', form);
    const suggest = qs('#catalogSuggest', form);
    if (!input || !suggest) return;

    let timer = null;
    input.addEventListener('input', function () {
      const q = input.value.trim();
      clearTimeout(timer);
      if (q.length < 2) {
        suggest.hidden = true;
        suggest.innerHTML = '';
        return;
      }
      timer = setTimeout(async function () {
        try {
          const res = await fetch('/api/search/suggest?q=' + encodeURIComponent(q));
          const data = await res.json();
          const items = data.suggestions || [];
          if (!items.length) {
            suggest.hidden = true;
            return;
          }
          suggest.innerHTML = items.map(function (s) {
            var value = String(s.value == null ? '' : s.value);
            var type = String(s.type == null ? '' : s.type);
            var label = String(s.label || s.value || '');
            return '<button type="button" class="catalog-suggest__item" data-value="' +
              escapeHtml(value) + '" data-type="' + escapeHtml(type) + '">' +
              escapeHtml(label) + '</button>';
          }).join('');
          suggest.hidden = false;
        } catch (_) {
          suggest.hidden = true;
        }
      }, 220);
    });

    suggest.addEventListener('click', function (e) {
      const btn = e.target.closest('[data-value]');
      if (!btn) return;
      const type = btn.getAttribute('data-type');
      const value = btn.getAttribute('data-value');
      if (type === 'tag') {
        const tagInput = qs('#filterTag', form);
        if (tagInput) tagInput.value = value;
        if (panel) panel.hidden = false;
        input.value = '';
      } else {
        input.value = value;
      }
      suggest.hidden = true;
      form.requestSubmit();
    });

    document.addEventListener('click', function (e) {
      if (!form.contains(e.target)) suggest.hidden = true;
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    initLocationCascade(document);
    initTagsInput(document);
    initCatalogSearch();
  });

  window.AlbamountLocationTags = Object.assign(window.AlbamountLocationTags || {}, {
    initLocationCascade: initLocationCascade,
    initTagsInput: initTagsInput
  });
})();
