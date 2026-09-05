const { FLAT_CATEGORIES, HIERARCHICAL_CATEGORIES } = require('../config/categories');

const LABEL_TO_KEY = {};
for (const [key, label] of Object.entries(FLAT_CATEGORIES)) {
  LABEL_TO_KEY[label] = key;
}

function translateLabel(label, t) {
  if (!label) return label;
  const key = LABEL_TO_KEY[label];
  if (!key) return label;
  return t(`categories:${key}`, { defaultValue: label, keySeparator: false });
}

function translateCategoryNode(node, t) {
  if (!node) return node;
  const out = { ...node, name: translateLabel(node.name, t) };
  if (Array.isArray(node.children)) {
    out.children = node.children.map((c) => translateCategoryNode(c, t));
  }
  return out;
}

function translateTree(tree, t) {
  return (tree || []).map((n) => translateCategoryNode(n, t));
}

function localizeHierarchicalCategories(t, node = HIERARCHICAL_CATEGORIES, prefix = '') {
  const out = {};
  for (const [key, value] of Object.entries(node || {})) {
    const full = prefix ? `${prefix}.${key}` : key;
    out[key] = {
      label: t(`categories:${full}`, { defaultValue: value.label, keySeparator: false }),
      ...(value.children
        ? { children: localizeHierarchicalCategories(t, value.children, full) }
        : {})
    };
  }
  return out;
}

module.exports = {
  LABEL_TO_KEY,
  translateLabel,
  translateCategoryNode,
  translateTree,
  localizeHierarchicalCategories
};
