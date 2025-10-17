function toggleForms() {
  document.getElementById("login-form").classList.toggle("hidden");
  document.getElementById("register-form").classList.toggle("hidden");
  document.getElementById("msg").textContent = "";
}

async function registerUser() {
  const username = document.getElementById("reg-username").value.trim();
  const password = document.getElementById("reg-password").value.trim();
  const avatar = document.getElementById("reg-avatar").files[0];
  const color = document.getElementById("reg-color").value;

  if (!username || !password) {
    alert("Preencha todos os campos!");
    return;
  }

  const formData = new FormData();
  formData.append("username", username);
  formData.append("password", password);
  formData.append("avatar", avatar);
  formData.append("color", color);

  const res = await fetch("/register", { method: "POST", body: formData });
  const text = await res.text();

  if (text === "OK") {
    alert("Cadastro realizado! Faça login agora.");
    toggleForms();
  } else {
    alert(text);
  }
}

async function login() {
  const username = document.getElementById("login-username").value.trim();
  const password = document.getElementById("login-password").value.trim();

  const res = await fetch("/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });

  if (res.ok) {
    const data = await res.json();
    localStorage.setItem("user", JSON.stringify({ username, ...data }));
    window.location.href = "/chat";
  } else {
    const text = await res.text();
    alert(text);
  }
}
