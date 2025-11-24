const express = require('express');
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: 'clave-secreta',
  resave: false,
  saveUninitialized: false,
}));

app.use(passport.initialize());
app.use(passport.session());

const users = [
  { id: 1, username: 'juan', password: '1234' },
  { id: 2, username: 'maria', password: 'abcd' },
];

passport.use(new LocalStrategy((username, password, done) => {
  const user = users.find(u => u.username === username && u.password === password);
  if (!user) return done(null, false, { message: 'Usuario o contraseña incorrectos' });
  return done(null, user);
}));

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser((id, done) => {
  const user = users.find(u => u.id === id);
  done(null, user);
});

function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.redirect('/login');
}

app.get('/login', (req, res) => {
  res.send(`
    <h1>Login</h1>
    <form method="post" action="/login">
      <input name="username" placeholder="Usuario" required>
      <input name="password" type="password" placeholder="Contraseña" required>
      <button type="submit">Entrar</button>
    </form>
  `);
});

app.post('/login',
  passport.authenticate('local', {
    successRedirect: '/',
    failureRedirect: '/login'
  })
);

app.get('/', ensureAuthenticated, (req, res) => {
  res.send(`
    <h1>Chat</h1>
    <p>Bienvenido, ${req.user.username} | <a href="/logout">Salir</a></p>
    <div id="chat"></div>
    <form id="form">
      <input id="input" autocomplete="off" /><button>Enviar</button>
    </form>
    
    <script src="/socket.io/socket.io.js"></script>
    <script>
      const socket = io();

      const form = document.getElementById('form');
      const input = document.getElementById('input');
      const chat = document.getElementById('chat');

      socket.on('chat history', (msgs) => {
        chat.innerHTML = '';
        msgs.forEach(m => {
          const item = document.createElement('div');
          item.textContent = m.username + ': ' + m.message;
          chat.appendChild(item);
        });
      });

      socket.on('chat message', (msg) => {
        const item = document.createElement('div');
        item.textContent = msg.username + ': ' + msg.message;
        chat.appendChild(item);
      });

      form.addEventListener('submit', (e) => {
        e.preventDefault();
        if (input.value) {
          socket.emit('chat message', input.value);
          input.value = '';
        }
      });
    </script>
  `);
});

app.get('/logout', (req, res) => {
  req.logout(() => {
    res.redirect('/login');
  });
});

const chatHistory = [];
const MAX_HISTORY = 20;

io.use((socket, next) => {
  let handshake = socket.request;
  sessionMiddleware(handshake, {}, () => {
    if (handshake.session.passport && handshake.session.passport.user) {
      return next();
    } else {
      return next(new Error('No autenticado'));
    }
  });
});

const sessionMiddleware = session({
  secret: 'clave-secreta',
  resave: false,
  saveUninitialized: false,
});

app.use(sessionMiddleware);

io.use((socket, next) => {
  sessionMiddleware(socket.request, socket.request.res || {}, next);
});

io.on('connection', (socket) => {
  const userId = socket.request.session.passport.user;
  const user = users.find(u => u.id === userId);

  socket.emit('chat history', chatHistory);

  socket.on('chat message', (msg) => {
    const message = { username: user.username, message: msg };
    chatHistory.push(message);
    if (chatHistory.length > MAX_HISTORY) chatHistory.shift();

    io.emit('chat message', message);
  });
});

server.listen(3000, () => {
  console.log('Servidor iniciado en http://localhost:3000');
});
