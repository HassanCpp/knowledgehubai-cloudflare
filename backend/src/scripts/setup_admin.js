require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

const email = 'hassanwaqar475@gmail.com';
const username = 'hassanwaqar475';
const defaultPassword = 'HassanAdmin123!'; // Temporary secure password

const setupAdmin = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('Error: MONGODB_URI is not defined in the backend/.env file.');
    process.exit(1);
  }

  try {
    console.log('Connecting to MongoDB Atlas...');
    await mongoose.connect(uri);
    console.log('MongoDB Atlas Connected successfully.');

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      console.log(`User with email "${email}" already exists.`);
      console.log(`Setting user role to Admin...`);
      existingUser.role = 'Admin';
      await existingUser.save();
      console.log(`[✓] SUCCESS: User role updated to Admin successfully.`);
      process.exit(0);
    }

    // Hash password
    console.log('Generating secure bcrypt hash for password...');
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(defaultPassword, salt);

    // Create Admin User
    console.log('Registering Admin user in database...');
    const user = await User.create({
      username,
      email,
      passwordHash,
      role: 'Admin',
    });

    console.log('----------------------------------------------------');
    console.log('[✓] SUCCESS: Admin User created in MongoDB Atlas!');
    console.log(`    Username: ${user.username}`);
    console.log(`    Email:    ${user.email}`);
    console.log(`    Password: ${defaultPassword}`);
    console.log('----------------------------------------------------');
    console.log('You can now log in using these credentials.');
    process.exit(0);
  } catch (error) {
    console.error('Failed to create Admin user:', error.message);
    process.exit(1);
  }
};

setupAdmin();
