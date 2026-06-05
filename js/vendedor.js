let carrito = [];
let tipoPagoSeleccionado = "Efectivo";
let productosCache = [];
let usuario = "";
let esCapacitacion = false;

document.addEventListener("DOMContentLoaded", () => {
  usuario = sessionStorage.getItem("usuario");
  const rol = sessionStorage.getItem("rol");
  esCapacitacion = sessionStorage.getItem("capacitacion") === "true";

  if (!usuario) { window.location.href = "index.html"; return; }
  if (rol === "admin") { window.location.href = "admin.html"; return; }

  document.getElementById("topbar-user").textContent = usuario;
  if (esCapacitacion) document.getElementById("badge-cap").style.display = "inline-block";

  cargarProductos();
  actualizarCorrelativo();
  cargarUltimasVentas();

  setTimeout(() => {
    if (!sessionStorage.getItem("sesion_inicio")) {
      sessionStorage.setItem("sesion_inicio", Date.now());
    }
    setInterval(verificarInactividad, 60000);
  }, 100);
});

function verificarInactividad() {
  const inicio = parseInt(sessionStorage.getItem("sesion_inicio") || "0");
  if (Date.now() - inicio > 15 * 60 * 1000) cerrarSesion();
}

document.addEventListener("click", () => {
  sessionStorage.setItem("sesion_inicio", Date.now());
});

async function cargarProductos() {
  if (esCapacitacion) {
    productosCache = [
      { SKU: "GYC-001", nombre: "Camiseta Oversize Negra", precio: 15.00 },
      { SKU: "GYC-002", nombre: "Camiseta Regular Blanca", precio: 12.00 },
      { SKU: "GYC-003", nombre: "Camiseta Oversize Gris",  precio: 15.00 }
    ];
    return;
  }
  try {
    const url = `${API_URL}?accion=getProductos&token=${TOKEN}&origen=${ORIGEN}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.ok) productosCache = data.productos;
  } catch (e) { console.error("Error cargando productos", e); }
}

function actualizarCorrelativo() {
  const hoy = new Date();
  const fecha = hoy.toLocaleDateString("es-SV", { weekday:"long", day:"2-digit", month:"2-digit", year:"numeric" });
  document.getElementById("correlativo-info").textContent = `${fecha}`;
}

function buscarSKU() {
  const sku = document.getElementById("sku-input").value.trim().toUpperCase();
  if (!sku) { mostrarToast("Ingresa un SKU", "error"); return; }
  const producto = productosCache.find(p => p.SKU === sku || p.sku === sku);
  const infoDiv = document.getElementById("producto-info");
  if (producto) {
    const nombre = producto.nombre || producto.SKU;
    const precio = producto.precio || 0;
    document.getElementById("monto-input").value = Number(precio).toFixed(2);
    infoDiv.innerHTML = `
      <div>
        <p class="producto-info-nombre">${nombre}</p>
        <p class="producto-info-precio">Precio referencia: $${Number(precio).toFixed(2)}</p>
      </div>
      <span class="producto-info-check">✓</span>
    `;
    infoDiv.style.display = "flex";
  } else {
    infoDiv.innerHTML = `<p style="color:#A32D2D;font-size:13px;">SKU no encontrado</p>`;
    infoDiv.style.display = "flex";
    infoDiv.style.background = "#FCEBEB";
  }
}

function agregarAlCarrito() {
  const sku      = document.getElementById("sku-input").value.trim().toUpperCase();
  const cantidad = parseInt(document.getElementById("cantidad-input").value) || 1;
  const monto    = parseFloat(document.getElementById("monto-input").value);
  const producto = productosCache.find(p => p.SKU === sku || p.sku === sku);

  if (!sku) { mostrarToast("Ingresa un SKU", "error"); return; }
  if (!monto || monto <= 0) { mostrarToast("Ingresa un monto válido", "error"); return; }

  const nombre = producto ? (producto.nombre || sku) : sku;
  const montoTotal = parseFloat((monto * cantidad).toFixed(2));

  carrito.push({ sku, nombre, cantidad, monto: montoTotal });

  document.getElementById("sku-input").value = "";
  document.getElementById("monto-input").value = "";
  document.getElementById("cantidad-input").value = "1";
  document.getElementById("producto-info").style.display = "none";

  renderCarrito();
  mostrarToast("Producto agregado", "success");
}

function renderCarrito() {
  const container = document.getElementById("carrito-items");
  const carritoCard = document.getElementById("carrito-card");
  const pagoCard = document.getElementById("pago-card");

  if (carrito.length === 0) {
    carritoCard.style.display = "none";
    pagoCard.style.display = "none";
    return;
  }

  carritoCard.style.display = "block";
  pagoCard.style.display = "block";

  document.getElementById("carrito-count").textContent = `${carrito.length} producto${carrito.length > 1 ? "s" : ""}`;

  container.innerHTML = carrito.map((item, i) => `
    <div class="carrito-item">
      <div class="carrito-item-info">
        <p class="carrito-item-nombre">${item.nombre}</p>
        <p class="carrito-item-sku">${item.sku} · x${item.cantidad}</p>
      </div>
      <span class="carrito-item-monto">$${item.monto.toFixed(2)}</span>
      <button class="btn-eliminar-item" onclick="eliminarItem(${i})">×</button>
    </div>
  `).join("");

  const total = carrito.reduce((s, i) => s + i.monto, 0);
  document.getElementById("total-amount").textContent = `$${total.toFixed(2)}`;
}

function eliminarItem(index) {
  carrito.splice(index, 1);
  renderCarrito();
}

function seleccionarPago(tipo, btn) {
  tipoPagoSeleccionado = tipo;
  document.querySelectorAll(".btn-pago").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
}

async function registrarVenta() {
  if (carrito.length === 0) { mostrarToast("El carrito está vacío", "error"); return; }

  const notas = document.getElementById("notas-input").value.trim();
  const btn = document.querySelector(".btn-registrar");
  btn.disabled = true;
  btn.textContent = "Registrando...";

  if (esCapacitacion) {
    mostrarToast("Venta simulada en modo capacitación", "success");
    cancelarVenta();
    btn.disabled = false;
    btn.textContent = "Registrar venta";
    return;
  }

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({
        accion: "registrarVenta",
        token: TOKEN,
        origen: ORIGEN,
        items: carrito,
        tipo_pago: tipoPagoSeleccionado,
        notas,
        usuario
      })
    });
    const data = await res.json();
    if (data.ok) {
      mostrarToast(`Venta #${data.correlativo} registrada — $${data.total}`, "success");
      cancelarVenta();
      cargarUltimasVentas();
    } else {
      mostrarToast("Error al registrar venta", "error");
    }
  } catch (e) {
    mostrarToast("Error de conexión", "error");
  }

  btn.disabled = false;
  btn.textContent = "Registrar venta";
}

function cancelarVenta() {
  carrito = [];
  document.getElementById("sku-input").value = "";
  document.getElementById("monto-input").value = "";
  document.getElementById("cantidad-input").value = "1";
  document.getElementById("notas-input").value = "";
  document.getElementById("producto-info").style.display = "none";
  renderCarrito();
}

async function cargarUltimasVentas() {
  const container = document.getElementById("ultimas-ventas");
  const hoy = new Date();
  const dia = String(hoy.getDate()).padStart(2, "0");
  const mes = String(hoy.getMonth() + 1).padStart(2, "0");
  const anio = hoy.getFullYear();
  const fecha = `${dia}/${mes}/${anio}`;

  if (esCapacitacion) {
    container.innerHTML = `<p class="empty-msg">Modo capacitación — sin ventas reales</p>`;
    return;
  }

  try {
    const url = `${API_URL}?accion=getVentas&token=${TOKEN}&origen=${ORIGEN}&fecha=${fecha}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.ok && data.ventas.length > 0) {
      const ultimas = data.ventas.slice(-5).reverse();
      container.innerHTML = ultimas.map(v => `
        <div class="venta-row">
          <div class="venta-row-info">
            <p>#${v.correlativo} — ${v.SKUs || v.sku}</p>
            <p>${v.hora} · ${v.tipo_pago}</p>
          </div>
          <div class="venta-row-right">
            <p class="venta-row-monto">$${Number(v.monto_total || v.monto).toFixed(2)}</p>
            <span class="badge badge-${v.estado}">${v.estado}</span>
            ${v.estado === "activa" ? `<br><button class="btn-anular" onclick="abrirAnulacion('${v.correlativo}')">Anular</button>` : ""}
          </div>
        </div>
      `).join("");
    } else {
      container.innerHTML = `<p class="empty-msg">Sin ventas hoy</p>`;
    }
  } catch (e) {
    container.innerHTML = `<p class="empty-msg">Error cargando ventas</p>`;
  }
}

function abrirAnulacion(correlativo) {
  const motivo = prompt(`Motivo de anulación para venta #${correlativo}:`);
  if (!motivo) return;
  anularVenta(correlativo, motivo);
}

async function anularVenta(correlativo, motivo) {
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({
        accion: "anularVenta",
        token: TOKEN,
        origen: ORIGEN,
        correlativo,
        motivo,
        usuario
      })
    });
    const data = await res.json();
    if (data.ok) {
      mostrarToast(`Venta #${correlativo} anulada`, "success");
      cargarUltimasVentas();
    } else {
      mostrarToast("Error al anular", "error");
    }
  } catch (e) {
    mostrarToast("Error de conexión", "error");
  }
}

async function filtrarVentas() {
  const fecha = document.getElementById("filtro-fecha").value;
  const mes   = document.getElementById("filtro-mes").value;
  const container = document.getElementById("historial-resultado");
  container.innerHTML = `<p class="empty-msg">Buscando...</p>`;

  let params = `accion=getVentas&token=${TOKEN}&origen=${ORIGEN}`;

  if (fecha) {
    const [y, m, d] = fecha.split("-");
    params += `&fecha=${d}/${m}/${y}`;
  } else if (mes) {
    const [y, m] = mes.split("-");
    params += `&mes=${m}&anio=${y}`;
  }

  try {
    const res = await fetch(`${API_URL}?${params}`);
    const data = await res.json();
    if (data.ok && data.ventas.length > 0) {
      const total = data.ventas.reduce((s, v) => s + Number(v.monto_total || 0), 0);
      container.innerHTML = `
        <div class="card" style="margin-bottom:8px;">
          <p style="font-size:13px;color:#555;">Total: <strong style="color:#1a1a1a;">$${total.toFixed(2)}</strong> en ${data.ventas.length} venta(s)</p>
        </div>
        ${data.ventas.map(v => `
          <div class="historial-venta">
            <div class="historial-venta-header">
              <span style="font-size:13px;font-weight:500;">#${v.correlativo}</span>
              <span class="badge badge-${v.estado}">${v.estado}</span>
            </div>
            <p class="historial-skus">SKUs: ${v.SKUs || v.sku}</p>
            <p class="historial-meta">${v.fecha} ${v.hora} · ${v.tipo_pago} · $${Number(v.monto_total || 0).toFixed(2)}</p>
            ${v.notas ? `<p class="historial-meta">Nota: ${v.notas}</p>` : ""}
          </div>
        `).join("")}
      `;
    } else {
      container.innerHTML = `<p class="empty-msg">Sin resultados</p>`;
    }
  } catch (e) {
    container.innerHTML = `<p class="empty-msg">Error de conexión</p>`;
  }
}

async function generarReporte() {
  const fecha = document.getElementById("reporte-fecha").value;
  const mes   = document.getElementById("reporte-mes").value;

  if (!fecha && !mes) { mostrarToast("Selecciona un filtro", "error"); return; }

  let params = `accion=getVentas&token=${TOKEN}&origen=${ORIGEN}`;
  let filtroLabel = "";

  if (fecha) {
    const [y, m, d] = fecha.split("-");
    params += `&fecha=${d}/${m}/${y}`;
    filtroLabel = `${d}/${m}/${y}`;
  } else if (mes) {
    const [y, m] = mes.split("-");
    params += `&mes=${m}&anio=${y}`;
    filtroLabel = `${m}/${y}`;
  }

  mostrarToast("Generando PDF...", "success");

  try {
    const res = await fetch(`${API_URL}?${params}`);
    const data = await res.json();
    if (!data.ok) { mostrarToast("Error obteniendo datos", "error"); return; }

    const ventas = data.ventas;
    const total = ventas.reduce((s, v) => s + Number(v.monto_total || 0), 0);
    const efectivo = ventas.filter(v => v.tipo_pago === "Efectivo").reduce((s, v) => s + Number(v.monto_total || 0), 0);
    const transferencia = ventas.filter(v => v.tipo_pago === "Transferencia").reduce((s, v) => s + Number(v.monto_total || 0), 0);
    const tarjeta = ventas.filter(v => v.tipo_pago === "Tarjeta").reduce((s, v) => s + Number(v.monto_total || 0), 0);

    const filas = ventas.map(v =>
      `<tr><td>#${v.correlativo}</td><td>${v.fecha}</td><td>${v.hora}</td><td>${v.SKUs||v.sku}</td><td>${v.tipo_pago}</td><td>$${Number(v.monto_total||0).toFixed(2)}</td><td>${v.estado}</td></tr>`
    ).join("");

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
    <style>
      body{font-family:Arial,sans-serif;padding:30px;color:#1a1a1a;}
      h1{font-size:20px;margin-bottom:4px;}
      p{font-size:13px;color:#555;margin:0 0 20px;}
      table{width:100%;border-collapse:collapse;font-size:12px;}
      th{background:#534AB7;color:#fff;padding:8px;text-align:left;}
      td{padding:7px 8px;border-bottom:0.5px solid #e0e0da;}
      tr:nth-child(even)td{background:#f9f9f7;}
      .resumen{margin-top:20px;background:#f5f5f3;padding:14px;border-radius:8px;}
      .resumen p{margin:4px 0;font-size:13px;color:#1a1a1a;}
    </style></head><body>
    <h1>GyC Store — Reporte de ventas</h1>
    <p>Período: ${filtroLabel} · Generado por: ${usuario}</p>
    <table>
      <thead><tr><th>#</th><th>Fecha</th><th>Hora</th><th>SKUs</th><th>Pago</th><th>Total</th><th>Estado</th></tr></thead>
      <tbody>${filas}</tbody>
    </table>
    <div class="resumen">
      <p><strong>Total ventas:</strong> ${ventas.length}</p>
      <p><strong>Monto total:</strong> $${total.toFixed(2)}</p>
      <p><strong>Efectivo:</strong> $${efectivo.toFixed(2)}</p>
      <p><strong>Transferencia:</strong> $${transferencia.toFixed(2)}</p>
      <p><strong>Tarjeta:</strong> $${tarjeta.toFixed(2)}</p>
    </div>
    </body></html>`;

    const blob = new Blob([html], { type: "text/html" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url;
    a.download = `reporte-gyc-${filtroLabel.replace(/\//g,"-")}.html`;
    a.click();
    URL.revokeObjectURL(url);

    await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({
        accion: "reporteEmail", token: TOKEN, origen: ORIGEN,
        usuario, filtro: filtroLabel,
        total_ventas: ventas.length,
        monto_total: total.toFixed(2),
        efectivo: efectivo.toFixed(2),
        transferencia: transferencia.toFixed(2),
        tarjeta: tarjeta.toFixed(2)
      })
    });

    mostrarToast("Reporte descargado", "success");
  } catch (e) {
    mostrarToast("Error generando reporte", "error");
  }
}

function mostrarTab(tab, btn) {
  document.querySelectorAll(".tab-content").forEach(t => t.style.display = "none");
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
  document.getElementById(`tab-${tab}`).style.display = "flex";
  btn.classList.add("active");
  if (tab === "historial") filtrarVentas();
}

function mostrarToast(msg, tipo) {
  const toast = document.getElementById("toast");
  toast.textContent = msg;
  toast.className = `toast ${tipo}`;
  toast.style.display = "block";
  setTimeout(() => toast.style.display = "none", 3000);
}

function cerrarSesion() {
  sessionStorage.clear();
  window.location.href = "index.html";
}