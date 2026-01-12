const mongoose = require('mongoose');
const Category = require('./models/Category');

async function checkCategories() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/exto');
    const categories = await Category.find({}, 'name _id parentId').lean();
    console.log('Categories in DB:');
    categories.forEach(cat => {
      console.log(`ID: ${cat._id}, Name: '${cat.name}', Parent: ${cat.parentId || 'null'}`);
    });
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await mongoose.disconnect();
  }
}

checkCategories();
