const User = require('../models/user');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { memoryStore, initializeMemoryStore } = require('../store/memoryStore');
const { v4: uuidv4 } = require('uuid');

function signToken(user) {
  const payload = {
    user: {
      id: user.id || user._id,
      role: user.role,
      name: user.name,
    },
  };

  return new Promise((resolve, reject) => {
    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: '12h' },
      (err, token) => {
        if (err) reject(err);
        else resolve(token);
      }
    );
  });
}

exports.register = async (req, res) => {
  const { name, email, password, role } = req.body;

  try {
    if (global.useMemoryStore) {
      await initializeMemoryStore();

      const existingUser = memoryStore.users.find((user) => user.email === email);
      if (existingUser) {
        return res.status(400).json({ msg: 'User already exists' });
      }

      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
      const newUser = {
        _id: uuidv4(),
        id: undefined,
        name,
        email,
        password: hashedPassword,
        role: role || 'cashier',
        createdAt: new Date(),
      };

      newUser.id = newUser._id;
      memoryStore.users.push(newUser);
      const token = await signToken(newUser);
      return res.json({ token });
    }

    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ msg: 'User already exists' });
    }

    user = new User({
      name,
      email,
      password,
      role: role || 'cashier',
    });

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);

    await user.save();
    const token = await signToken(user);
    res.json({ token });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

exports.login = async (req, res) => {
  const { email, password } = req.body;

  try {
    if (global.useMemoryStore) {
      await initializeMemoryStore();

      const user = memoryStore.users.find((item) => item.email === email);
      if (!user) {
        return res.status(400).json({ msg: 'Invalid Credentials' });
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(400).json({ msg: 'Invalid Credentials' });
      }

      const token = await signToken(user);
      return res.json({ token });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ msg: 'Invalid Credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ msg: 'Invalid Credentials' });
    }

    const token = await signToken(user);
    res.json({ token });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

exports.getMe = async (req, res) => {
  try {
    if (global.useMemoryStore) {
      await initializeMemoryStore();
      const user = memoryStore.users.find((item) => (item.id || item._id) === req.user.id);
      if (!user) {
        return res.status(404).json({ msg: 'User not found' });
      }

      const { password, ...safeUser } = user;
      return res.json(safeUser);
    }

    const user = await User.findById(req.user.id).select('-password');
    res.json(user);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};
