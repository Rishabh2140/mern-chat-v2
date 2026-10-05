// index.js
const express = require('express');
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const Message = require('./models/Message');
const ws = require('ws');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');

const MAX_MEDIA_SIZE_BYTES = 1024 * 1024;
const TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;

dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';
const jwtSecret = process.env.JWT_SECRET;
if (!process.env.MONGO_URL || !jwtSecret || !process.env.CLIENT_URL) {
  throw new Error('MONGO_URL, JWT_SECRET, and CLIENT_URL must be configured.');
}
if (isProduction && Buffer.byteLength(jwtSecret) < 32) {
  throw new Error('JWT_SECRET must be at least 32 bytes in production.');
}

const allowedClientOrigins = new Set(process.env.CLIENT_URL.split(',').map(value => {
  const origin = value.trim();
  const parsedOrigin = new URL(origin);
  if (!['http:', 'https:'].includes(parsedOrigin.protocol) || parsedOrigin.origin !== origin) {
    throw new Error('CLIENT_URL must contain comma-separated origins without paths.');
  }
  if (isProduction && parsedOrigin.protocol !== 'https:') {
    throw new Error('CLIENT_URL origins must use HTTPS in production.');
  }
  return parsedOrigin.origin;
}));

const connectToMongoDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URL);
    console.log("Connected to MongoDB");
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
    process.exit(1);
  }
};
connectToMongoDB();

const app = express();
app.disable('x-powered-by');
app.use(helmet());
app.use(express.json({ limit: '16kb' }));
app.use(cookieParser());

app.use(cors({
  origin(origin, callback) {
    callback(null, !origin || allowedClientOrigins.has(origin));
  },
  credentials: true,
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type'],
}));

app.use(express.static(path.join(__dirname, '..', 'client', 'dist')));

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 200,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please try again later.' },
});
const registrationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many registration attempts. Please try again later.' },
});

function requireTrustedOrigin(req, res, next) {
  if (!allowedClientOrigins.has(req.get('origin'))) {
    return res.status(403).json({ error: 'Untrusted request origin.' });
  }
  next();
}

function requireAuth(req, res, next) {
  jwt.verify(req.cookies?.token, jwtSecret, { algorithms: ['HS256'] }, (err, userData) => {
    if (err) return res.status(401).json({ error: 'Unauthorized' });
    req.userData = userData;
    next();
  });
}

// Routes
app.get('/test', (req, res) => res.json('test ok'));

app.get('/messages/:userId', requireAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    if (!mongoose.isValidObjectId(userId)) return res.status(400).json({ error: 'Invalid user ID.' });
    const ourUserId = req.userData.userId;

    const messages = await Message.find({
      sender: { $in: [userId, ourUserId] },
      recipient: { $in: [userId, ourUserId] },
    }).sort({ createdAt: -1 }).limit(500).lean();

    res.json(messages.reverse());
  } catch (err) {
    console.error('Failed to load messages:', err);
    res.status(500).json({ error: 'Could not load messages.' });
  }
});

app.get('/people', requireAuth, async (req, res) => {
  try {
    const users = await User.find({}, { '_id': 1, username: 1 }).limit(1000).lean();
    res.json(users);
  } catch (err) {
    console.error('Failed to load people:', err);
    res.status(500).json({ error: 'Could not load people.' });
  }
});

app.get('/profile', requireAuth, (req, res) => {
  res.json(req.userData);
});

app.get('/uploads/:filename', requireAuth, async (req, res) => {
  const { filename } = req.params;
  if (!/^[a-f0-9]{32}\.[a-z0-9]{1,10}$/i.test(filename)) return res.sendStatus(404);

  try {
    const attachment = await Message.findOne({
      file: filename,
      $or: [{ sender: req.userData.userId }, { recipient: req.userData.userId }],
    }).select('_id').lean();
    if (!attachment) return res.sendStatus(404);

    res.download(path.join(__dirname, 'uploads', filename), filename, err => {
      if (err && !res.headersSent) res.sendStatus(404);
    });
  } catch (err) {
    console.error('Failed to load attachment:', err);
    res.status(500).json({ error: 'Could not load attachment.' });
  }
});

// LOGIN
app.post('/login', requireTrustedOrigin, loginLimiter, async (req, res) => {
  const { username, password } = req.body;
  if (typeof username !== 'string' || typeof password !== 'string'
    || username.length < 3 || username.length > 32
    || Buffer.byteLength(password, 'utf8') > 72) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  try {
    const foundUser = await User.findOne({ username });
    if (!foundUser) return res.status(401).json({ error: 'Invalid username or password' });

    const passOk = await bcrypt.compare(password, foundUser.password);
    if (!passOk) return res.status(401).json({ error: 'Invalid username or password' });

    const token = jwt.sign({ userId: String(foundUser._id), username: foundUser.username }, jwtSecret, {
      algorithm: 'HS256',
      expiresIn: TOKEN_TTL_SECONDS,
    });

    res.cookie('token', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProduction,
      maxAge: TOKEN_TTL_SECONDS * 1000,
      path: '/',
    }).json({ id: foundUser._id });
  } catch (err) {
    console.error("Login Error:", err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// LOGOUT
app.post('/logout', requireTrustedOrigin, (req, res) => {
  res.cookie('token', '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction,
    expires: new Date(0),
    path: '/',
  }).json('ok');
});

// REGISTER
app.post('/register', requireTrustedOrigin, registrationLimiter, async (req, res) => {
  const { username, password } = req.body;
  if (typeof username !== 'string' || typeof password !== 'string'
    || username.trim().length < 3 || username.trim().length > 32
    || Buffer.byteLength(password, 'utf8') < 12
    || Buffer.byteLength(password, 'utf8') > 72) {
    return res.status(400).json({ error: 'Username must be 3-32 characters and password must be 12-72 bytes.' });
  }

  try {
    const normalizedUsername = username.trim();
    const hashedPassword = await bcrypt.hash(password, 12);
    const createdUser = await User.create({ username: normalizedUsername, password: hashedPassword });

    const token = jwt.sign({ userId: String(createdUser._id), username: normalizedUsername }, jwtSecret, {
      algorithm: 'HS256',
      expiresIn: TOKEN_TTL_SECONDS,
    });

    res.cookie('token', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProduction,
      maxAge: TOKEN_TTL_SECONDS * 1000,
      path: '/',
    }).status(201).json({ id: createdUser._id });
  } catch (err) {
    if (err.code === 11000) {
      console.error("Duplicate Key Error:", err);
      res.status(409).json({ error: 'Username already exists' });
    } else {
      console.error("Registration Error:", err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// Server + WebSocket
const port = Number(process.env.PORT) || 4040;
const server = app.listen(port, () => console.log(`Server is listening on port ${port}`));

const wss = new ws.WebSocketServer({
  noServer: true,
  maxPayload: 2 * 1024 * 1024,
});

server.on('upgrade', (request, socket, head) => {
  const requestUrl = new URL(request.url, 'http://localhost');
  const origin = request.headers.origin;
  const tokenCookie = request.headers.cookie
    ?.split(';')
    .map(cookie => cookie.trim())
    .find(cookie => cookie.startsWith('token='));
  const token = tokenCookie?.slice('token='.length);

  if (requestUrl.pathname !== '/' || !allowedClientOrigins.has(origin) || !token) {
    socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
    socket.destroy();
    return;
  }

  jwt.verify(token, jwtSecret, { algorithms: ['HS256'] }, (err, userData) => {
    if (err || !mongoose.isValidObjectId(userData?.userId)) {
      socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, connection => {
      connection.userId = userData.userId;
      connection.username = userData.username;
      wss.emit('connection', connection, request);
    });
  });
});

wss.on('connection', (connection, req) => {
  function notifyAboutOnlinePeople() {
    const online = [...wss.clients]
      .filter(client => client.readyState === ws.OPEN)
      .map(client => ({ userId: client.userId, username: client.username }));
    [...wss.clients].forEach(client => {
      if (client.readyState !== ws.OPEN) return;
      client.send(JSON.stringify({
        online,
      }));
    });
  }

  let isAlive = true;
  const heartbeat = setInterval(() => {
    if (!isAlive) {
      connection.terminate();
      return;
    }
    isAlive = false;
    connection.ping();
  }, 30000);
  connection.on('pong', () => { isAlive = true; });
  connection.on('close', () => {
    clearInterval(heartbeat);
    notifyAboutOnlinePeople();
  });
  connection.on('error', err => console.error('WebSocket error:', err.message));

  connection.on('message', async (message) => {
    try {
      const messageData = JSON.parse(message.toString());
      if (!messageData || typeof messageData !== 'object' || Array.isArray(messageData)) {
        connection.send(JSON.stringify({ error: 'Invalid message.' }));
        return;
      }

      const { recipient, text, file } = messageData;
      let filename = null;
      const hasText = typeof text === 'string' && text.length > 0;
      const hasFile = Boolean(file);

      if (!mongoose.isValidObjectId(recipient) || (!hasText && !hasFile)
        || (hasText && text.length > 4000)) {
        connection.send(JSON.stringify({ error: 'Invalid message or recipient.' }));
        return;
      }

      if (!await User.exists({ _id: recipient })) {
        connection.send(JSON.stringify({ error: 'Recipient not found.' }));
        return;
      }

      if (file) {
        if (typeof file.name !== 'string' || typeof file.data !== 'string') {
          connection.send(JSON.stringify({ error: 'Invalid file attachment.' }));
          return;
        }

        const dataUrl = file.data.match(/^data:[^,]{1,128};base64,([A-Za-z0-9+/]*={0,2})$/i);
        if (!dataUrl || dataUrl[1].length % 4 !== 0) {
          connection.send(JSON.stringify({ error: 'Invalid file attachment.' }));
          return;
        }

        const encodedData = dataUrl[1];
        const maxBase64Length = 4 * Math.ceil(MAX_MEDIA_SIZE_BYTES / 3);
        if (encodedData.length > maxBase64Length) {
          connection.send(JSON.stringify({ error: 'Files must be 1 MB or smaller.' }));
          return;
        }

        const bufferData = Buffer.from(encodedData, 'base64');
        if (bufferData.length > MAX_MEDIA_SIZE_BYTES) {
          connection.send(JSON.stringify({ error: 'Files must be 1 MB or smaller.' }));
          return;
        }

        const ext = path.extname(file.name).slice(1).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 10) || 'bin';
        filename = `${crypto.randomBytes(16).toString('hex')}.${ext}`;
        await fs.promises.writeFile(path.join(__dirname, 'uploads', filename), bufferData, { flag: 'wx' });
      }

      const messageDoc = await Message.create({
        sender: connection.userId,
        recipient,
        text: hasText ? text : '',
        file: filename,
      });

      [...wss.clients]
        .filter(client => client.userId === recipient && client.readyState === ws.OPEN)
        .forEach(client => client.send(JSON.stringify({
          text: hasText ? text : '',
          sender: connection.userId,
          recipient,
          file: filename,
          _id: messageDoc._id,
        })));
    } catch (err) {
      console.error('Error handling WebSocket message:', err.message);
      if (connection.readyState === ws.OPEN) {
        connection.send(JSON.stringify({ error: 'Could not send message.' }));
      }
    }
  });

  notifyAboutOnlinePeople();
});
