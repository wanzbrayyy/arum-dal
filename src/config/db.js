const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`Atlas connection failed: ${error.message}`);
    global.useMemoryStore = true;
    console.log('Using local in-memory store instead of MongoDB.');
    return null;
  }
};

module.exports = connectDB;
