const API_URL = "https://script.google.com/macros/s/AKfycbwUNe11yYTB_XO4Pj4g6AC3AiiLV5kkXhPIJY2nmpv99dIi_XC8AuLP7T_dSnBs7uqw/exec";
const TOKEN = "gyc2026secret$GYC";
const ORIGEN = window.location.hostname;

let intentosFallidos = 0;
let modoCapacitacion = false;

function toggleCapacitacion() {
  modoCapacitacion = document.getElementById('modo-cap').checked;
}

async function iniciarSesion() {
  if (intentosFallidos >= 3) {
    mostrarError("Acceso bloqueado. Recarga la pagina.");
    return;
  }
  const usuario = document.getElementById('usuario').value.trim();
  const password = document.getElementById('password').value.trim();
  if (!usuario || !password) {
    mostrarError("Completa todos los campos.");
    return;
  }
  const btn = document.getElementById('btn-login');
  btn.disabled = true;
  btn.textContent = "Verificando...";
  if (modoCapacitacion) {
    sessionStorage.setItem('usuario', usuario);
    sessionStorage.setItem('rol', 'vendedor');
    sessionStorage.setItem('capacitacion', 'true');
    window.location.href = 'vendedor.html';
    return;
  }
  try {
    const url = API_URL + "?accion=login&token=" + TOKEN + "&origen=" + ORIGEN + "&usuario=" + usuario + "&password=" + password;
    const res = await fetch(url);
    const data = await res.json();
    if (data.ok) {
      sessionStorage.setItem('usuario', data.usuario);
      sessionStorage.setItem('rol', data.rol);
      sessionStorage.setItem('capacitacion', 'false');
      intentosFallidos = 0;
      if (data.rol === 'admin') {
        window.location.href = 'admin.html';
      } else {
        window.location.href = 'vendedor.html';
      }
    } else {
      intentosFallidos++;
      const restantes = 3 - intentosFallidos;
      if (restantes > 0) {
        mostrarError("Usuario o contrasena incorrectos. Intentos restantes: " + restantes);
      } else {
        mostrarError("Acceso bloqueado tras 3 intentos.");
      }
      btn.disabled = false;
      btn.textContent = "Ingresar";
    }
  } catch (err) {
    mostrarError("Error de conexion.");
    btn.disabled = false;
    btn.textContent = "Ingresar";
  }
}

function mostrarError(msg) {
  const el = document.getElementById('error-msg');
  el.textContent = msg;
  el.style.display = 'block';
}

document.addEventListener('keydown', function(e) {
  if (e.key === 'Enter') iniciarSesion();
});