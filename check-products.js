require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('./models/Product');

async function checkProducts() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const total = await Product.countDocuments();
    const approved = await Product.countDocuments({ status: 'approved' });
    const pending = await Product.countDocuments({ status: 'pending' });

    console.log(`Total products: ${total}`);
    console.log(`Approved products: ${approved}`);
    console.log(`Pending products: ${pending}`);

    if (approved > 0) {
      console.log('\nFirst approved product:');
      const product = await Product.findOne({ status: 'approved' });
      console.log(JSON.stringify(product, null, 2));
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkProducts();