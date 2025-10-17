const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const fs = require('fs');
const multer = require('multer');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const PORT = 8080;

// ---------------------------
// BANCO DE DADOS
// ---------------------------
const db = new sqlite3.Database('./chat.db', err => {
  if(err) console.error('Erro ao abrir o banco', err);
  else console.log('✅ Banco de dados aberto.');
});

// Cria tabela de usuários
db.run(`CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE,
  password TEXT,
  color TEXT,
  avatar TEXT,
  role TEXT DEFAULT 'user'
)`, err=>{
  if(err) console.error('Erro ao criar tabela users:',err);
  else console.log('✅ Tabela users pronta.');
});

// Cria tabela de mensagens
db.run(`CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user TEXT,
  text TEXT,
  avatar TEXT,
  color TEXT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
)`, err=>{
  if(err) console.error('Erro ao criar tabela messages:',err);
  else console.log('✅ Tabela messages pronta.');
});

// ---------------------------
// FUNÇÃO AUXILIAR ADMIN
// ---------------------------
function isAdmin(username, cb){
  db.get(`SELECT role FROM users WHERE username=?`, [username], (err,row)=>{
    if(err || !row) return cb(false);
    cb(row.role === 'admin');
  });
}

// ---------------------------
// MIDDLEWARES
// ---------------------------
const publicDir = path.join(__dirname,'public');
const uploadDir = path.join(__dirname,'uploads');

app.use(express.static(publicDir));
app.use(express.json());
app.use(express.urlencoded({extended:true}));

if(!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir,{recursive:true});

// ---------------------------
// MULTER PARA AVATAR
// ---------------------------
const storage = multer.diskStorage({
  destination: (req,file,cb) => cb(null, uploadDir),
  filename: (req,file,cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

// Pasta de uploads
const uploadDir = path.join(__dirname,'uploads');
if(!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, {recursive:true});

// Multer para arquivos do chat
const chatStorage = multer.diskStorage({
  destination: (req,file,cb)=> cb(null, uploadDir),
  filename: (req,file,cb)=> cb(null, Date.now() + path.extname(file.originalname))
});
const chatUpload = multer({ storage: chatStorage });

// ---------------------------
// REGISTRO
// ---------------------------
app.post('/register', upload.single('avatar'), (req,res)=>{
  const { username, password, color } = req.body;
  const avatar = req.file ? `/uploads/${req.file.filename}` : '/uploads/default.png';

  if(!username || !password) return res.status(400).send('Usuário e senha obrigatórios');

  const stmt = db.prepare(`INSERT INTO users(username,password,color,avatar) VALUES(?,?,?,?)`);
  stmt.run(username,password,color,avatar,function(err){
    if(err){
      if(err.code==='SQLITE_CONSTRAINT') return res.status(400).send('Usuário já existe.');
      return res.status(500).send('Erro ao cadastrar usuário.');
    }
    res.send('OK');
  });
  stmt.finalize();
});
app.post('/upload', chatUpload.single('file'), (req,res)=>{
  if(!req.file) return res.status(400).send('Arquivo não enviado');

  // Podemos enviar a URL do arquivo e o nome original
  const fileUrl = `/uploads/${req.file.filename}`;
  const originalName = req.file.originalname;

  res.json({ fileUrl, originalName });
});


// ---------------------------
// LOGIN
// ---------------------------
app.post('/login',(req,res)=>{
  const { username, password } = req.body;

  db.get(`SELECT * FROM users WHERE username=? AND password=?`, [username,password], (err,row)=>{
    if(err) return res.status(500).send('Erro no login');
    if(!row) return res.status(401).send('Usuário ou senha incorretos');
    res.json({ username: row.username, avatar: row.avatar, color: row.color, role: row.role });
  });
});

// ---------------------------
// SOCKET.IO
// ---------------------------
let onlineUsers = [];

io.on('connection', socket => {
  console.log('🟢 Novo cliente conectado.');

  // Envia últimas 50 mensagens
  db.all(`SELECT * FROM messages ORDER BY id DESC LIMIT 50`, [], (err, rows)=>{
    if(!err && rows) socket.emit('chatHistory', rows.reverse());
  });

  // Recebe username
  socket.on('setUsername', username=>{
    socket.username = username;
    if(!onlineUsers.includes(username)) onlineUsers.push(username);
    io.emit('updateUsers', onlineUsers);

    socket.broadcast.emit('newMessage', {
      user:'Bot 🤖',
      text:`${username} entrou no chat!`,
      avatar:'/uploads/default.png'
    });
  });

  // Recebe mensagem
  socket.on('sendMessage', data=>{
    io.emit('newMessage', data);

    const stmt = db.prepare(`INSERT INTO messages(user,text,avatar,color) VALUES(?,?,?,?)`);
    stmt.run(data.user,data.text,data.avatar,data.color, err=>{
      if(err) console.error('Erro ao salvar mensagem:', err);
    });
    stmt.finalize();
  });

  // Logout ou desconexão
  const leave = ()=>{
    if(socket.username){
      onlineUsers = onlineUsers.filter(u=>u!==socket.username);
      io.emit('updateUsers', onlineUsers);
      socket.broadcast.emit('newMessage',{
        user:'Bot 🤖',
        text:`${socket.username} saiu do chat.`,
        avatar:'/uploads/default.png'
      });
    }
  }

  socket.on('leaveUser', leave);
  socket.on('disconnect', leave);
});

// ---------------------------
// TODOS USUÁRIOS
// ---------------------------
app.get('/allUsers',(req,res)=>{
  db.all(`SELECT username FROM users`, [], (err, rows)=>{
    if(err) return res.status(500).send([]);
    res.json(rows.map(r=>r.username));
  });
});

// ---------------------------
// EXCLUSÃO (APENAS ADMIN)
// ---------------------------
app.delete('/user/:username', (req,res)=>{
  const usernameToDelete = req.params.username;
  const requester = req.body.requester;

  isAdmin(requester, ok=>{
    if(!ok) return res.status(403).send('Apenas admin pode excluir usuários');

    db.run(`DELETE FROM users WHERE username=?`, [usernameToDelete], function(err){
      if(err) return res.status(500).send('Erro ao excluir usuário');
      if(this.changes === 0) return res.status(404).send('Usuário não encontrado');

      onlineUsers = onlineUsers.filter(u=>u!==usernameToDelete);
      io.emit('updateUsers', onlineUsers);
      res.send('Usuário excluído com sucesso');
    });
  });
});

app.delete('/deleteMessage/:id', (req,res)=>{
  const { admin } = req.body;
  const msgId = req.params.id;

  db.get(`SELECT role FROM users WHERE username=?`, [admin], (err,row)=>{
    if(err || !row) return res.status(403).send('Solicitante inválido');
    if(row.role !== 'admin') return res.status(403).send('Apenas admin pode excluir mensagens');

    db.run(`DELETE FROM messages WHERE id=?`, [msgId], err=>{
      if(err) return res.status(500).send('Erro ao excluir mensagem');
      res.send(`Mensagem ${msgId} excluída com sucesso.`);
    });
  });
});

// ---------------------------
// CRIAR ADMIN SE NÃO EXISTIR
// ---------------------------
const adminUser = 'admin';
const adminPassword = '123456';
db.get(`SELECT * FROM users WHERE username=?`, [adminUser], (err,row)=>{
  if(!row){
    const stmt = db.prepare(`INSERT INTO users(username,password,color,avatar,role) VALUES(?,?,?,?,?)`);
    stmt.run(adminUser, adminPassword, '#FF0000', '/uploads/default.png', 'admin');
    stmt.finalize();
    console.log('✅ Usuário admin criado');
  } else console.log('✅ Usuário admin já existe');
});

// ---------------------------
// SERVIR UPLOADS
// ---------------------------
app.use('/uploads', express.static(uploadDir));

// ---------------------------
// INICIAR SERVIDOR
// ---------------------------
http.listen(PORT, ()=>console.log(`💬 Servidor rodando em http://localhost:${PORT}`));
