const API_URL = '[https://trufas-da-malu-api.alan-ricardo.workers.dev/api]';

let adminToken = localStorage.getItem('malu_admin_token') || null;

document.addEventListener('DOMContentLoaded', () => {
    if (adminToken) {
        showDashboard();
    }
});

async function login() {
    const pass = document.getElementById('admin-pass').value;
    try {
        const response = await fetch(`${API_URL}/admin/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: pass })
        });

        if (response.ok) {
            adminToken = pass; // Salvamos a senha como token simples
            localStorage.setItem('malu_admin_token', adminToken);
            showDashboard();
        } else {
            document.getElementById('login-error').innerText = "Senha incorreta!";
        }
    } catch (e) {
        document.getElementById('login-error').innerText = "Erro ao conectar.";
    }
}

function showDashboard() {
    document.getElementById('login-section').classList.add('hidden');
    document.getElementById('dashboard-section').classList.remove('hidden');
    loadOrders();
}

async function loadOrders() {
    try {
        const response = await fetch(`${API_URL}/orders`, {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });

        if (response.status === 401) {
            localStorage.removeItem('malu_admin_token');
            location.reload();
            return;
        }

        const orders = await response.json();
        renderOrders(orders);
    } catch (error) {
        console.error("Erro", error);
    }
}

function renderOrders(orders) {
    const container = document.getElementById('orders-container');
    container.innerHTML = '';

    if (orders.length === 0) {
        container.innerHTML = '<p>Nenhum pedido encontrado.</p>';
        return;
    }

    orders.forEach(o => {
        const div = document.createElement('div');
        div.className = `order-card status-${o.status}`;

        const date = new Date(o.created_at).toLocaleString('pt-BR');

        div.innerHTML = `
            <h3>Pedido #${o.id}</h3>
            <p><strong>Cliente:</strong> ${o.customer_name} (${o.customer_phone})</p>
            <p><strong>Total:</strong> R$ ${o.total_amount.toFixed(2).replace('.',',')}</p>
            <p><strong>Pagamento:</strong> ${o.payment_method.toUpperCase()} - <strong>${o.payment_status}</strong></p>
            <p><small>${date}</small></p>

            <div class="order-actions">
                <select onchange="updateOrderStatus(${o.id}, this.value, 'status')">
                    <option value="NEW" ${o.status === 'NEW' ? 'selected' : ''}>Novo</option>
                    <option value="PREPARING" ${o.status === 'PREPARING' ? 'selected' : ''}>Em preparo</option>
                    <option value="READY" ${o.status === 'READY' ? 'selected' : ''}>Pronto</option>
                    <option value="DELIVERED" ${o.status === 'DELIVERED' ? 'selected' : ''}>Entregue</option>
                </select>

                <select onchange="updateOrderStatus(${o.id}, this.value, 'payment_status')">
                    <option value="PENDING" ${o.payment_status === 'PENDING' ? 'selected' : ''}>Pagamento Pendente</option>
                    <option value="PAID" ${o.payment_status === 'PAID' ? 'selected' : ''}>Pago</option>
                </select>
            </div>
        `;
        container.appendChild(div);
    });
}

async function updateOrderStatus(orderId, newValue, field) {
    const payload = {};
    payload[field] = newValue;

    try {
        const response = await fetch(`${API_URL}/orders/${orderId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            // Recarregar pra garantir a cor
            loadOrders();
        } else {
            alert('Erro ao atualizar!');
        }
    } catch(e) {
        alert('Erro ao atualizar pedido');
    }
}

// Push para Admin
async function subscribeAdminPush() {
    if ('serviceWorker' in navigator) {
        try {
            const registration = await navigator.serviceWorker.register('/sw.js');
            const VAPID_PUBLIC_KEY = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuB23zS2e5TdbR9U8y_A4lB780';
            const convertedVapidKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);

            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: convertedVapidKey
            });

            await fetch(`${API_URL}/push/subscribe`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    endpoint: subscription.endpoint,
                    keys: {
                        p256dh: arrayBufferToBase64(subscription.getKey('p256dh')),
                        auth: arrayBufferToBase64(subscription.getKey('auth'))
                    },
                    userType: 'admin'
                })
            });

            alert("Notificações de admin ativadas! 🔔");
        } catch (error) {
            console.error("Erro admin push", error);
        }
    }
}

function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) { outputArray[i] = rawData.charCodeAt(i); }
    return outputArray;
}
function arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) { binary += String.fromCharCode(bytes[i]); }
    return window.btoa(binary);
}
