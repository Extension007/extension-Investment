const mongoose = require("mongoose");

// Модель для универсального дерева категорий
const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  parentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    default: null
  },
  type: {
    type: String,
    enum: ['product', 'service', 'banner', 'all'],
    default: 'all'
  },
  icon: {
    type: String,
    default: '',
    maxlength: 50
  },
  description: {
    type: String,
    default: '',
    maxlength: 500
  },
  order: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  }
}, { timestamps: true });

// Индексы для оптимизации
categorySchema.index({ parentId: 1 });
categorySchema.index({ type: 1 });
categorySchema.index({ isActive: 1 });
categorySchema.index({ parentId: 1, type: 1 });
categorySchema.index({ order: 1 });

// Виртуальное поле для полного пути
categorySchema.virtual('path').get(function() {
  return this._path || this._id.toString();
});

// Метод для получения дерева категорий
categorySchema.statics.getTree = async function(type = 'all', includeInactive = false) {
  const filter = includeInactive ? {} : { isActive: true };

  if (type !== 'all') {
    filter.$or = [
      { type: type },
      { type: 'all' }
    ];
  }

  const categories = await this.find(filter)
    .sort({ order: 1, name: 1 })
    .lean();

  // Строим дерево
  const categoryMap = new Map();
  const roots = [];

  // Сначала создаем карту всех категорий
  categories.forEach(cat => {
    categoryMap.set(cat._id.toString(), {
      ...cat,
      children: [],
      path: cat._id.toString()
    });
  });

  // Затем строим дерево
  categories.forEach(cat => {
    const catWithChildren = categoryMap.get(cat._id.toString());

    if (cat.parentId) {
      const parentId = cat.parentId.toString();
      const parent = categoryMap.get(parentId);
      if (parent) {
        parent.children.push(catWithChildren);
        catWithChildren.path = `${parent.path}.${cat._id.toString()}`;
      }
    } else {
      roots.push(catWithChildren);
    }
  });

  return roots;
};

// Метод для получения плоского списка с путями
categorySchema.statics.getFlatList = async function(type = 'all', includeInactive = false) {
  const tree = await this.getTree(type, includeInactive);

  const result = {};

  function flatten(categories, prefix = '') {
    categories.forEach(cat => {
      const fullPath = prefix ? `${prefix}.${cat._id.toString()}` : cat._id.toString();
      result[fullPath] = {
        _id: cat._id,
        name: cat.name,
        icon: cat.icon,
        type: cat.type,
        path: fullPath
      };

      if (cat.children && cat.children.length > 0) {
        flatten(cat.children, fullPath);
      }
    });
  }

  flatten(tree);
  return result;
};

// Метод для поиска категории по пути
categorySchema.statics.findByPath = async function(path, type = 'all') {
  if (!path) return null;

  const parts = path.split('.');
  let currentCategory = null;

  for (const part of parts) {
    const filter = { _id: part };
    if (type !== 'all') {
      filter.$or = [
        { type: type },
        { type: 'all' }
      ];
    }

    currentCategory = await this.findOne(filter);
    if (!currentCategory) break;
  }

  return currentCategory;
};

module.exports = mongoose.model('Category', categorySchema);
