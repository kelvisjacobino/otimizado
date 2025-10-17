// ---------------------------
// LOGIN / CADASTRO
const loginContainer = document.getElementById("loginContainer");
const registerContainer = document.getElementById("registerContainer");
const chatContainer = document.getElementById("chatContainer");
const goToRegister = document.getElementById("goToRegister");
const goToLogin = document.getElementById("goToLogin");
const loginError = document.getElementById("loginError");
const registerError = document.getElementById("registerError");

// Alternar telas
goToRegister.addEventListener("click", e => { e.preventDefault(); loginContainer.classList.add("hidden"); registerContainer.classList.remove("hidden"); });
goToLogin.addEventListener("click", e => { e.preventDefault(); registerContainer.classList.add("hidden"); loginContainer.classList.remove("hidden"); });

// ---------------------------
// SOCKET.IO
const socket = io();
const msgSound = document.getElementById("msgSound");
const messagesDiv = document.getElementById("messages");
const chatForm = document.getElementById("chatForm");
const messageInput = document.getElementById("messageInput");
const userSpan = document.getElementById("currentUser");
const logoutBtn = document.getElementById("logout");
const darkModeBtn = document.getElementById("darkModeBtn");
const usersList = document.getElementById("usersList");

let currentUser = null;
let currentAvatar = '/uploads/default.png';

// ---------------------------
// FUNÇÕES
function showChat(username) {
  loginContainer.classList.add("hidden");
  registerContainer.classList.add("hidden");
  chatContainer.classList.remove("hidden");
  currentUser = username;
  socket.emit("userOnline", username);

  fetch(`/user/${encodeURIComponent(username)}`)
    .then(res => res.json())
    .then(data => { currentAvatar = data.avatar || '/uploads/default.png'; });
}

function addMessage(data) {
  const div = document.createElement("div");
  div.classList.add("message");
  if (data.user === currentUser) div.classList.add("self");

  div.innerHTML = `<img src="${data.avatar}" alt="avatar">
                   <div class="message-content"><strong>${data.user}:</strong> ${data.text}</div>`;
  messagesDiv.appendChild(div);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
  void div.offsetWidth;
  msgSound.play();
}

function updateUsers(list) {
  usersList.innerHTML = '';
  list.forEach(user => {
    const li = document.createElement("li");
    li.innerHTML = `<span class="dot"></span>${user}`;
    if(user === currentUser) li.classList.add("active");
    usersList.appendChild(li);
  });
}

// ---------------------------
// LOGIN
async function loginUser() {
  loginError.textContent = '';
  const username = document.getElementById("login-username").value.trim();
  const password = document.getElementById("login-password").value.trim();

  const res = await fetch("/login", {
    method: "POST",
    headers: { "Content-Type":"application/json" },
    body: JSON.stringify({ username,password })
  });

  if(res.ok){
    const data = await res.json();
    showChat(data.username);
  } else {
    const text = await res.text();
    loginError.textContent = text;
  }
}

// ---------------------------
// CADASTRO
async function registerUser() {
  registerError.textContent = '';
  const username = document.getElementById("reg-username").value.trim();
  const password = document.getElementById("reg-password").value.trim();
  const avatar = document.getElementById("reg-avatar").files[0];
  const color = document.getElementById("reg-color").value;

  const formData = new FormData();
  formData.append("username",username);
  formData.append("password",password);
  formData.append("avatar",avatar);
  formData.append("color",color);

  const res = await fetch("/register",{method:"POST",body:formData});
  const text = await res.text();
  if(text==='OK'){ alert("Cadastro realizado! Faça login agora."); goToLogin.click(); }
  else { registerError.textContent = text; }
}

// ---------------------------
// EVENT LISTENERS
document.getElementById("loginForm").addEventListener("submit", e => { e.preventDefault(); loginUser(); });
document.getElementById("registerForm").addEventListener("submit", e => { e.preventDefault(); registerUser(); });
chatForm.addEventListener("submit", e => {
  e.preventDefault();
  const msg = messageInput.value.trim();
  if(msg && currentUser){
    socket.emit("sendMessage",{ user: currentUser, text: msg, avatar: currentAvatar });
    messageInput.value = '';
  }
});

// Logout
logoutBtn.addEventListener("click",()=>{
  currentUser=null;
  chatContainer.classList.add("hidden");
  loginContainer.classList.remove("hidden");
});

// Modo Escuro
darkModeBtn.addEventListener("click",()=>{
  document.body.classList.toggle("dark");
});

// Receber mensagens
socket.on("receiveMessage", data => { addMessage(data); });

// Atualizar usuários online
socket.on("updateUsers", list => { updateUsers(list); });
