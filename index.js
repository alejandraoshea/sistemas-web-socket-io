const express = require('express');
const session = require('express-session');
const path = require('path');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));

const sessionMiddleware = session({
  secret: 'clave-secreta',
  resave: false,
  saveUninitialized: false,
});
app.use(sessionMiddleware);

app.use(passport.initialize());
app.use(passport.session());

const users = [
  { id: 1, username: 'juan', password: '1234' },
  { id: 2, username: 'maria', password: 'abcd' },
];

passport.use(new LocalStrategy({
  usernameField: 'user',
  passwordField: 'pass',
}, (username, password, done) => {
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

// Rutas
app.get('/', (req, res) => {
  res.render('index', {
    logged: req.isAuthenticated(),
    items: [  
      { title: 'Max 1', img: '/images/mv1-1.jpg' },
      { title: 'Max 2', img: '/images/mv1-2.jpg' },
      { title: 'Max 3', img: '/images/mv1-3.jpg' },
      { title: 'Max 4', img: '/images/mv1-4.jpg' },
      { title: 'Max 5', img: '/images/mv1-5.jpg' },
    ]
  });
});

app.get('/login', (req, res) => {
  res.render('login', { error: null });
});

app.post('/login',
  passport.authenticate('local', {
    failureRedirect: '/login-fail',
    successRedirect: '/'
  })
);

app.get('/login-fail', (req, res) => {
  res.render('login', { error: 'Usuario o contraseña incorrectos' });
});

app.get('/private', ensureAuthenticated, (req, res) => {
  res.render('private', { user: req.user.username });
});

app.get('/logout', (req, res) => {
  req.logout(() => {
    res.redirect('/');
  });
});

io.use((socket, next) => {
  sessionMiddleware(socket.request, {}, next);
});

io.use((socket, next) => {
  const req = socket.request;
  if (req.session && req.session.passport && req.session.passport.user) {
    return next();
  }
  next(new Error('No autenticado'));
});

const chatHistory = [];
const MAX_HISTORY = 20;

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
  console.log('Servidor escuchando en http://localhost:3000');
});
