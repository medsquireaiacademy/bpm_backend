const mongoose = require('mongoose');
const { MONGODB_URI, MONGODB_DB_NAME } = require('./env');

const connectDatabase = async () => {
  try {
    mongoose.set('strictQuery', true);
    const options = {
      serverSelectionTimeoutMS: 15000,
      autoIndex: true
    };
    if (MONGODB_DB_NAME) {
      options.dbName = MONGODB_DB_NAME;
    }
    await mongoose.connect(MONGODB_URI, options);
    console.log(`[Database] MongoDB connected successfully to database: "${mongoose.connection.name}"`);
  } catch (error) {
    console.error('[Database] MongoDB connection failed:', error.message);
    process.exit(1);
  }
};

module.exports = { connectDatabase };

