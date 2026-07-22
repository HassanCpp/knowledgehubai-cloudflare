require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

const checkUsers = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('Error: MONGODB_URI is not defined in backend/.env.');
    process.exit(1);
  }

  try {
    await mongoose.connect(uri);
    console.log('MongoDB Connected.');

    const users = await User.find();
    console.log('----------------------------------------------------');
    console.log(`Registered Users (${users.length} found):`);
    users.forEach((u) => {
      console.log(`- ID:       ${u._id}`);
      console.log(`  Username: ${u.username}`);
      console.log(`  Email:    ${u.email}`);
      console.log(`  Role:     ${u.role}`);
      console.log('---------------------------------');
    });
    process.exit(0);
  } catch (error) {
    console.error('Failed to query users:', error.message);
    process.exit(1);
  }
};

checkUsers();
