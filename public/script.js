const loginContainer = document.getElementById("loginContainer");
const registerContainer = document.getElementById("registerContainer");
const chatContainer = document.getElementById("chatContainer");

const goToRegister = document.getElementById("goToRegister");
const goToLogin = document.getElementById("goToLogin");

const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");

const socket = io();
const messagesDiv = document.getElementById("messages");
const chatForm = document.getElementById("chatForm");
const messageInput = document.getElementById("messageInput");
const onlineUsersList = document.querySelector("#onlineUsers ul");
const darkModeBtn = document.getElementById("darkModeBtn");
const logoutBtn = document.getElementById("logout");
const userSpan = document.getElementById("currentUser");
const msgSound = document.getElementById("msgSound");

let currentUser = '';
let currentAvatar = '/uploads/default.png';
let currentRole = 'user';

// ------------------------- LOGIN / CADASTRO -------------------------
goToRegister.addEventListener("click", e=>{
  e.preventDefault();
  loginContainer.classList.add("d-none");
  registerContainer.classList.remove("d-none");
});

goToLogin.addEventListener("click", e=>{
  e.preventDefault();
  registerContainer.classList.add("d-none");
  loginContainer.classList.remove("d-none");
});

// Login
loginForm.addEventListener("submit", async e=>{
  e.preventDefault();
  const username = document.getElementById("login-username").value.trim();
  const password = document.getElementById("login-password").value.trim();

  const res = await fetch("/login", {
    method:"POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({ username, password })
  });

  if(res.ok){
    const data = await res.json();
    currentUser = data.username;
    currentAvatar = data.avatar;
    currentRole = data.role;
    localStorage.setItem("user", JSON.stringify({ username: data.username }));
    showChat(data.username, data.avatar, data.role);
  } else alert(await res.text());
});

// Cadastro
registerForm.addEventListener("submit", async e=>{
  e.preventDefault();
  const username = document.getElementById("reg-username").value.trim();
  const password = document.getElementById("reg-password").value.trim();
  const avatar = document.getElementById("reg-avatar").files[0];
  const color = document.getElementById("reg-color").value;

  const formData = new FormData();
  formData.append("username", username);
  formData.append("password", password);
  formData.append("avatar", avatar);
  formData.append("color", color);

  const res = await fetch("/register", { method:"POST", body: formData });
  const text = await res.text();

  if(text==="OK"){
    alert("Cadastro realizado! Faça login.");
    goToLogin.click();
  } else alert(text);
});

// ------------------------- MOSTRAR CHAT -------------------------
function showChat(username, avatar, role){
  userSpan.textContent = username;
  loginContainer.classList.add("d-none");
  registerContainer.classList.add("d-none");
  chatContainer.classList.remove("d-none");

  socket.emit("setUsername", username);

  if(role==='admin') document.getElementById("adminPanel").classList.remove("d-none");
}

// ------------------------- MENSAGENS -------------------------
chatForm.addEventListener("submit", e=>{
  e.preventDefault();
  const msg = messageInput.value.trim();
  if(msg && currentUser){
    socket.emit("sendMessage", { user: currentUser, text: msg, avatar: currentAvatar });
    messageInput.value = "";
  }
});

socket.on("chatHistory", messages=>{
  messagesDiv.innerHTML="";
  messages.forEach(data=> renderMessage(data));
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
});

socket.on("newMessage", data=>{
  renderMessage(data);
  if(msgSound){ msgSound.currentTime=0; msgSound.play().catch(()=>{}); }
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
});

function renderMessage(data){
  const div = document.createElement("div");
  div.classList.add("message");
  if(data.user === currentUser) div.classList.add("self");

  div.innerHTML = `
    <img src="${data.avatar||'/uploads/default.png'}" alt="avatar">
    <div class="message-content"><strong>${data.user}:</strong> ${data.text}</div>
  `;

  messagesDiv.appendChild(div);
}

// ------------------------- USUÁRIOS ONLINE / OFFLINE -------------------------
socket.on("updateUsers", onlineUsers => updateOnlineUsersList(onlineUsers));

async function updateOnlineUsersList(onlineUsers){
  try{
    const res = await fetch("/allUsers");
    const allUsers = await res.json();

    const sortedUsers = allUsers.sort((a,b)=>{
      if(onlineUsers.includes(a) && !onlineUsers.includes(b)) return -1;
      if(!onlineUsers.includes(a) && onlineUsers.includes(b)) return 1;
      return a.localeCompare(b);
    });

    onlineUsersList.innerHTML = '';

    sortedUsers.forEach(u=>{
      const li = document.createElement("li");
      li.classList.add("d-flex","align-items-center","mb-1");

      const status = document.createElement("span");
      status.classList.add("status-dot");
      status.style.backgroundColor = onlineUsers.includes(u) ? "green" : "red";
      li.appendChild(status);

      const usernameText = document.createElement("span");
      usernameText.textContent = u;
      usernameText.style.marginLeft = "6px";
      li.appendChild(usernameText);

      // Botão excluir apenas para admin
      if(currentRole==='admin' && u!==currentUser){
        const btn = document.createElement("button");
        btn.textContent = "Excluir";
        btn.style.marginLeft = "10px";
        btn.onclick = ()=> deleteUser(u);
        li.appendChild(btn);
      }

      onlineUsersList.appendChild(li);
    });
  } catch(err){
    console.error("Erro ao atualizar lista de usuários:", err);
  }
}

async function deleteUser(username){
  if(!confirm(`Deseja excluir ${username}?`)) return;

  const res = await fetch(`/user/${username}`, {
    method:'DELETE',
    headers:{ 'Content-Type':'application/json' },
    body: JSON.stringify({ requester: currentUser })
  });

  if(res.ok) alert('Usuário excluído com sucesso');
  else alert(await res.text());
}

// ------------------------- DARK MODE -------------------------
darkModeBtn.addEventListener("click", ()=>{
  document.body.classList.toggle("dark");
});

// ------------------------- LOGOUT -------------------------
logoutBtn.addEventListener("click", ()=>{
  localStorage.removeItem("user");
  currentUser = '';
  chatContainer.classList.add("d-none");
  loginContainer.classList.remove("d-none");
  socket.emit("leaveUser");
});
