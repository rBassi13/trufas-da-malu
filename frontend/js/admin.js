/* FORCE */
const API_URL = "https://trufas-da-malu-api.alan-ricardo.workers.dev/api";

let adminToken = localStorage.getItem('malu_admin_token') || null;
let globalProducts = []; // Array global para o filtro de pesquisa do estoque

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
            adminToken = pass;
            localStorage.setItem('malu_admin_token', adminToken);
            showDashboard();
        } else {
            document.getElementById('login-error').innerText = "Senha incorreta!";
        }
    } catch (e) {
        document.getElementById('login-error').innerText = "Erro ao conectar.";
    }
}

function logout() {
    localStorage.removeItem('malu_admin_token');
    adminToken = null;
    location.reload();
}

function showDashboard() {
    document.getElementById('login-section').classList.add('hidden');
    document.getElementById('dashboard-section').classList.remove('hidden');
    loadOrders();
}

function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));

    document.getElementById(tabId).classList.remove('hidden');
    document.querySelector(`button[onclick="switchTab('${tabId}')"]`).classList.add('active');

    if (tabId === 'orders-tab') loadOrders();
    if (tabId === 'inventory-tab') loadInventory();
    if (tabId === 'reports-tab') loadReports();
}

// ==========================================
// MÓDULO DE PEDIDOS
// ==========================================

let globalOrders = []; // Array que vai guardar os pedidos na memória

async function loadOrders() {
    try {
        const response = await fetch(`${API_URL}/orders`, {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });

        if (response.status === 401) {
            logout();
            return;
        }

        globalOrders = await response.json();
        filterOrders(); // Aplica os filtros na mesma hora que carregar
    } catch (error) {
        console.error("Erro", error);
    }
}

function filterOrders() {
    const customerFilter = document.getElementById('filter-customer').value.toLowerCase();
    const statusFilter = document.getElementById('filter-status').value;
    const paymentFilter = document.getElementById('filter-payment').value;
    const dateFilter = document.getElementById('filter-date').value;

    const filtrados = globalOrders.filter(o => {
        // Filtro 1: Cliente ou Telefone
        const matchCustomer = o.customer_name.toLowerCase().includes(customerFilter) || o.customer_phone.includes(customerFilter);
        
        // Filtro 2: Status do Pedido
        const matchStatus = statusFilter === 'ALL' || o.status === statusFilter;
        
        // Filtro 3: Status do Pagamento
        const matchPayment = paymentFilter === 'ALL' || o.payment_status === paymentFilter;
        
        // Filtro 4: Data Exata
        let matchDate = true;
        if (dateFilter) {
            // Converte a data do banco para YYYY-MM-DD local
            const orderDate = new Date(o.created_at).toLocaleDateString('en-CA'); 
            matchDate = orderDate === dateFilter;
        }

        return matchCustomer && matchStatus && matchPayment && matchDate;
    });

    renderOrders(filtrados);
}

function renderOrders(orders) {
    const container = document.getElementById('orders-container');
    container.innerHTML = '';

    if (orders.length === 0) {
        container.innerHTML = '<p style="text-align:center; padding: 20px; color: #888;">Nenhum pedido encontrado nos filtros atuais. 🔍</p>';
        return;
    }

    const statusMap = {
        'NEW': 'Novo',
        'PREPARING': 'Em Preparo',
        'READY': 'Pronto',
        'DELIVERED': 'Entregue',
        'CANCELED': 'Cancelado'
    };
    
    const paymentMap = {
        'PENDING': 'Pendente',
        'PAID': 'Pago'
    };

    orders.forEach(o => {
        const div = document.createElement('div');
        div.className = `order-card ${o.status === 'CANCELED' ? 'canceled-card' : ''}`;

        const date = new Date(o.created_at).toLocaleString('pt-BR');
        const badgeStatusClass = `badge-${o.status.toLowerCase()}`;
        const badgePaymentClass = `badge-${o.payment_status.toLowerCase()}`;

        // 🛠️ NOVO: Montando a listinha de trufas do pedido!
        let itemsHtml = '';
        if (o.items && o.items.length > 0) {
            const lis = o.items.map(item => `<li>🍫 <strong style="color: var(--primary-color);">${item.quantity}x</strong> ${item.name}</li>`).join('');
            itemsHtml = `
                <div style="background: #f8fafc; padding: 10px 15px; border-radius: 8px; margin: 12px 0; border: 1px dashed #cbd5e1;">
                    <strong style="font-size: 0.85em; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Itens do Pedido:</strong>
                    <ul style="list-style: none; padding: 0; margin: 5px 0 0 0; font-size: 0.95em; color: #333;">
                        ${lis}
                    </ul>
                </div>
            `;
        }

        div.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
                <h3 style="margin: 0; color: #333; ${o.status === 'CANCELED' ? 'text-decoration: line-through; color: #ef4444;' : ''}">Pedido #${o.id}</h3>
                <span class="badge ${badgeStatusClass}">${statusMap[o.status] || o.status}</span>
            </div>
            
            <p style="margin: 4px 0;"><strong>Cliente:</strong> ${o.customer_name} (${o.customer_phone})</p>
            <p style="margin: 4px 0;"><strong>Total:</strong> R$ ${parseFloat(o.total_amount).toFixed(2).replace('.',',')}</p>
            
            ${itemsHtml} <div style="margin: 8px 0; display: flex; align-items: center; gap: 8px;">
                <strong>Pagamento:</strong> ${o.payment_method.toUpperCase()} 
                <span class="badge ${badgePaymentClass}">${paymentMap[o.payment_status] || o.payment_status}</span>
            </div>
            
            <p style="color: #888; font-size: 0.85em; margin-top: 10px;">📅 ${date}</p>

            <div class="order-actions">
                <select onchange="updateOrderStatus(${o.id}, this.value, 'status')" ${o.status === 'CANCELED' ? 'disabled' : ''}>
                    <option value="NEW" ${o.status === 'NEW' ? 'selected' : ''}>Status: Novo</option>
                    <option value="PREPARING" ${o.status === 'PREPARING' ? 'selected' : ''}>Status: Em preparo</option>
                    <option value="READY" ${o.status === 'READY' ? 'selected' : ''}>Status: Pronto</option>
                    <option value="DELIVERED" ${o.status === 'DELIVERED' ? 'selected' : ''}>Status: Entregue</option>
                    <option value="CANCELED" ${o.status === 'CANCELED' ? 'selected' : ''}>Status: Cancelar Pedido</option>
                </select>

                <select onchange="updateOrderStatus(${o.id}, this.value, 'payment_status')">
                    <option value="PENDING" ${o.payment_status === 'PENDING' ? 'selected' : ''}>Pagamento: Pendente</option>
                    <option value="PAID" ${o.payment_status === 'PAID' ? 'selected' : ''}>Pagamento: Pago</option>
                </select>
            </div>
        `;
        container.appendChild(div);
    });
}

async function updateOrderStatus(orderId, newValue, field) {
    // Alerta de Segurança Anti-Dedo Gordo
    if (field === 'status' && newValue === 'CANCELED') {
        const confirmar = confirm("🚨 Tem certeza que deseja CANCELAR este pedido? As trufas serão devolvidas para o estoque!");
        if (!confirmar) {
            filterOrders(); // Recarrega a tela para voltar o select pro que estava antes
            return;
        }
    }

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
            // Se cancelou com sucesso, recarrega também o estoque para atualizar a UI lá atrás
            if (newValue === 'CANCELED') loadInventory();
            loadOrders(); // Atualiza a lista e filtra de novo
        } else {
            alert('Erro ao atualizar!');
        }
    } catch(e) {
        alert('Erro ao atualizar pedido');
    }
}


// 🎨 LIIA'S BUILD: RENDERIZAÇÃO DE PEDIDOS PREMIUM COM BADGES
function renderOrders(orders) {
    const container = document.getElementById('orders-container');
    container.innerHTML = '';

    if (orders.length === 0) {
        container.innerHTML = '<p style="text-align:center; padding: 20px; color: #888;">Nenhum pedido encontrado. 😴</p>';
        return;
    }

    // Dicionários para traduzir o status do banco para a Badge visual
    const statusMap = {
        'NEW': 'Novo',
        'PREPARING': 'Em Preparo',
        'READY': 'Pronto',
        'DELIVERED': 'Entregue'
    };
    
    const paymentMap = {
        'PENDING': 'Pendente',
        'PAID': 'Pago'
    };

    orders.forEach(o => {
        const div = document.createElement('div');
        div.className = `order-card`;

        const date = new Date(o.created_at).toLocaleString('pt-BR');

        // Puxamos a cor da badge dinamicamente
        const badgeStatusClass = `badge-${o.status.toLowerCase()}`;
        const badgePaymentClass = `badge-${o.payment_status.toLowerCase()}`;

        div.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
                <h3 style="margin: 0; color: #333;">Pedido #${o.id}</h3>
                <span class="badge ${badgeStatusClass}">${statusMap[o.status] || o.status}</span>
            </div>
            
            <p style="margin: 4px 0;"><strong>Cliente:</strong> ${o.customer_name} (${o.customer_phone})</p>
            <p style="margin: 4px 0;"><strong>Total:</strong> R$ ${o.total_amount.toFixed(2).replace('.',',')}</p>
            
            <div style="margin: 8px 0; display: flex; align-items: center; gap: 8px;">
                <strong>Pagamento:</strong> ${o.payment_method.toUpperCase()} 
                <span class="badge ${badgePaymentClass}">${paymentMap[o.payment_status] || o.payment_status}</span>
            </div>
            
            <p style="color: #888; font-size: 0.85em; margin-top: 10px;">📅 ${date}</p>

            <div class="order-actions">
                <select onchange="updateOrderStatus(${o.id}, this.value, 'status')">
                    <option value="NEW" ${o.status === 'NEW' ? 'selected' : ''}>Status: Novo</option>
                    <option value="PREPARING" ${o.status === 'PREPARING' ? 'selected' : ''}>Status: Em preparo</option>
                    <option value="READY" ${o.status === 'READY' ? 'selected' : ''}>Status: Pronto</option>
                    <option value="DELIVERED" ${o.status === 'DELIVERED' ? 'selected' : ''}>Status: Entregue</option>
                </select>

                <select onchange="updateOrderStatus(${o.id}, this.value, 'payment_status')">
                    <option value="PENDING" ${o.payment_status === 'PENDING' ? 'selected' : ''}>Pagamento: Pendente</option>
                    <option value="PAID" ${o.payment_status === 'PAID' ? 'selected' : ''}>Pagamento: Pago</option>
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
            loadOrders();
        } else {
            alert('Erro ao atualizar!');
        }
    } catch(e) {
        alert('Erro ao atualizar pedido');
    }
}

// ==========================================
// MÓDULO DE ESTOQUE (INVENTORY)
// ==========================================

async function loadInventory() {
    try {
        const response = await fetch(`${API_URL}/products`);
        globalProducts = await response.json(); 
        
        const searchInput = document.getElementById('search-inventory');
        if (searchInput && searchInput.value) {
            filterInventory();
        } else {
            renderInventory(globalProducts);
        }
    } catch (e) {
        console.error("Erro ao carregar estoque", e);
    }
}

function filterInventory() {
    const termo = document.getElementById('search-inventory').value.toLowerCase();
    const filtrados = globalProducts.filter(p => p.name.toLowerCase().includes(termo));
    renderInventory(filtrados);
}

function toggleAddForm() {
    const form = document.getElementById('add-product-section');
    form.classList.toggle('hidden');
}

function renderInventory(products) {
    const container = document.getElementById('inventory-container');
    container.innerHTML = '';

    if (products.length === 0) {
        container.innerHTML = '<p style="text-align:center;">Nenhuma trufa encontrada.</p>';
        return;
    }

    products.forEach(p => {
        const div = document.createElement('div');
        div.className = 'inventory-item card';
        div.style.display = 'flex';
        div.style.gap = '15px';
        div.style.alignItems = 'center';

        const imgSrc = p.image_url || '/assets/icon-192.png';
        
        // Garante que o número sempre tenha duas casas decimais (ex: 4.00)
        const formattedPrice = parseFloat(p.price).toFixed(2);

        div.innerHTML = `
            <img src="${imgSrc}" alt="${p.name}" style="width: 80px; height: 80px; border-radius: 8px; object-fit: cover; border: 1px solid #eee; flex-shrink: 0;">
            
            <div style="flex: 1; display: flex; flex-direction: column; gap: 4px; min-width: 0;">
                <h4 style="margin: 0; font-size: 1.2em; color: #333; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${p.name} ${p.is_gourmet ? '🌟' : ''}</h4>
                
                <textarea id="desc-${p.id}" disabled class="inventory-input-readonly" style="resize: none; overflow: hidden; height: 42px; font-size: 0.85em; color: #666 !important;">${p.description || ''}</textarea>
                
                <div style="display: flex; gap: 15px; align-items: center; margin-top: 4px;">
                    <div style="display: flex; align-items: center; gap: 4px;">
                        <span style="font-size: 0.9em; font-weight: bold; color: #555;">R$</span>
                        <input type="number" step="0.01" id="price-${p.id}" value="${formattedPrice}" disabled class="inventory-input-readonly" style="width: 60px; font-weight: bold;" />
                    </div>
                    <div style="display: flex; align-items: center; gap: 4px;">
                        <span style="font-size: 0.9em; font-weight: bold; color: #555;">Estoque:</span>
                        <input type="number" id="stock-${p.id}" value="${p.stock}" disabled class="inventory-input-readonly" style="width: 50px; font-weight: bold;" />
                    </div>
                </div>

                <button id="btn-edit-${p.id}" onclick="toggleEditProduct(${p.id})" style="align-self: flex-start; margin-top: 8px; padding: 6px 16px; font-size: 0.9em; background-color: #f8fafc; color: #333; border: 1px solid #e2e8f0; border-radius: 20px; cursor: pointer; font-weight: bold;">Editar ✏️</button>
            </div>
        `;
        container.appendChild(div);
    });
}

function toggleEditProduct(id) {
    const descInput = document.getElementById(`desc-${id}`);
    const priceInput = document.getElementById(`price-${id}`);
    const stockInput = document.getElementById(`stock-${id}`);
    const btn = document.getElementById(`btn-edit-${id}`);

    if (descInput.disabled) {
        [descInput, priceInput, stockInput].forEach(input => {
            input.disabled = false;
            input.classList.remove('inventory-input-readonly');
            input.classList.add('inventory-input-editing');
        });

        btn.innerHTML = "Salvar 💾";
        btn.style.backgroundColor = "#ff4d4d";
        btn.style.color = "white";
        btn.style.borderColor = "#ff4d4d";
    } else {
        updateProduct(id);
    }
}

async function updateProduct(productId) {
    const newStock = document.getElementById(`stock-${productId}`).value;
    const newPrice = document.getElementById(`price-${productId}`).value;
    const newDesc = document.getElementById(`desc-${productId}`).value;

    try {
        const response = await fetch(`${API_URL}/products/${productId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify({
                stock: parseInt(newStock),
                price: parseFloat(newPrice),
                description: newDesc
            })
        });
        if (response.ok) {
            alert('Produto atualizado!');
            loadInventory(); 
        } else {
            alert('Erro ao atualizar produto!');
        }
    } catch (e) {
        console.error(e);
        alert('Erro ao atualizar produto!');
    }
}

function normalizeName(name) {
    return name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '-');
}

async function addProduct(e) {
    e.preventDefault();
    const name = document.getElementById('new-name').value;
    const description = document.getElementById('new-desc').value;
    const price = parseFloat(document.getElementById('new-price').value);
    const stock = parseInt(document.getElementById('new-stock').value);
    const isGourmet = document.getElementById('new-gourmet').checked;

    let baseFilename = normalizeName(name);
    let imageUrl = `/assets/trufa-${baseFilename}${isGourmet ? '-g' : ''}.png`;

    try {
        const response = await fetch(`${API_URL}/products`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify({
                name,
                description,
                price,
                stock,
                image_url: imageUrl,
                is_gourmet: isGourmet
            })
        });

        if (response.ok) {
            alert('Trufa cadastrada com sucesso!');
            document.getElementById('add-product-form').reset();
            toggleAddForm();
            loadInventory();
        } else {
            alert('Erro ao cadastrar trufa!');
        }
    } catch (e) {
        console.error(e);
        alert('Erro ao cadastrar trufa!');
    }
}

// ==========================================
// MÓDULO DE RELATÓRIOS E PUSH
// ==========================================

async function loadReports() {
    try {
        const response = await fetch(`${API_URL}/orders`, {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });

        if (!response.ok) return;

        const orders = await response.json();

        const pendingPayment = orders.filter(o => o.payment_status === 'PENDING');
        const pendingDelivery = orders.filter(o => ['NEW', 'PREPARING', 'READY'].includes(o.status));

        document.getElementById('report-pending-payment').innerHTML = pendingPayment.length > 0
            ? pendingPayment.map(o => `<p>Pedido #${o.id} - ${o.customer_name} - R$ ${o.total_amount.toFixed(2)}</p>`).join('')
            : '<p>Nenhum pagamento pendente.</p>';

        document.getElementById('report-pending-delivery').innerHTML = pendingDelivery.length > 0
            ? pendingDelivery.map(o => `<p>Pedido #${o.id} - ${o.customer_name} - Status: ${o.status}</p>`).join('')
            : '<p>Nenhuma entrega pendente.</p>';

    } catch (error) {
        console.error("Erro ao carregar relatórios", error);
    }
}

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
