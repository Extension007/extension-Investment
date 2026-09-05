(function (global) {
  function resolvePath(obj, path) {
    if (!obj || !path) return undefined;
    if (Object.prototype.hasOwnProperty.call(obj, path)) return obj[path];
    var parts = String(path).split(".");
    var cur = obj;
    for (var i = 0; i < parts.length; i++) {
      if (cur == null || typeof cur !== "object") return undefined;
      if (!Object.prototype.hasOwnProperty.call(cur, parts[i])) return undefined;
      cur = cur[parts[i]];
    }
    return cur;
  }

  function interpolate(text, vars) {
    if (!vars || typeof text !== "string") return text;
    return text.replace(/\{(\w+)\}/g, function (_, key) {
      return vars[key] != null ? String(vars[key]) : "{" + key + "}";
    });
  }

  function t(key, fallback, vars) {
    var bundle = global.__I18N__ || {};
    var js = bundle.js || {};
    var value;

    if (Object.prototype.hasOwnProperty.call(js, key)) value = js[key];
    if (value == null) value = resolvePath(js, key);
    if (value == null) value = resolvePath(bundle.common, key);

    if (value == null && key.indexOf("js.") === 0) {
      var jsKey = key.slice(3);
      if (Object.prototype.hasOwnProperty.call(js, jsKey)) value = js[jsKey];
    }

    if (value == null) {
      var fromCategories = resolvePath(bundle.categories, key);
      if (typeof fromCategories === "string") value = fromCategories;
      else if (bundle.categories && Object.prototype.hasOwnProperty.call(bundle.categories, key)) {
        value = bundle.categories[key];
      }
    }

    if (typeof value !== "string") value = fallback || key;
    return interpolate(value, vars);
  }

  global.i18nT = t;
})(typeof window !== "undefined" ? window : globalThis);
