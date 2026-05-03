// Configurações
const API_URL = "https://trufas-da-malu-api.alan-ricardo.workers.dev/api/products'; // Será relativo se hospedado junto, ou precisa alterar p/ URL do worker

let products = [];
let cart = [];
let customerId = null;

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    loadProducts();
    loadCartFromStorage();
    renderCart();
    registerServiceWorker();
});

// Carregar Produtos
async function loadProducts() {
    try {
        const response = await fetch(`${API_URL}/products`);
        if (!response.ok) throw new Error('Erro na rede');
        products = await response.json();
        renderProducts();
    } catch (error) {
        console.error("Erro ao carregar produtos:", error);
        document.getElementById('products-grid').innerHTML = '<p class="error">Oops! Não foi possível carregar as trufas. Tente novamente.</p>';
    }
}

// Renderizar Produtos
function renderProducts() {
    const grid = document.getElementById('products-grid');
    grid.innerHTML = '';

    products.forEach(p => {
        // Usando um emoji placeholder caso não tenha imagem gerada
        const img = p.image_url || '🍫';

        const card = document.createElement('div');
        card.className = 'product-card';
        card.innerHTML = `
            ${p.image_url ? `<img src="${p.image_url}" alt="${p.name}">` : `<div style="font-size:3rem; margin-bottom:10px">${img}</div>`}
            <h3>${p.name}</h3>
            <p>${p.description}</p>
            <button class="add-to-cart-btn" onclick="addToCart(${p.id})">Adicionar</button>
        `;
        grid.appendChild(card);
    });
}

// Lógica de Carrinho e Promoção
function addToCart(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    const cartItem = cart.find(item => item.product_id === productId);
    if (cartItem) {
        cartItem.quantity++;
    } else {
        cart.push({ product_id: productId, name: product.name, price: product.price, quantity: 1 });
    }

    saveCart();
    renderCart();
}

function removeFromCart(productId) {
    const itemIndex = cart.findIndex(item => item.product_id === productId);
    if (itemIndex > -1) {
        if (cart[itemIndex].quantity > 1) {
            cart[itemIndex].quantity--;
        } else {
            cart.splice(itemIndex, 1);
        }
    }
    saveCart();
    renderCart();
}

function calculateTotal() {
    // Regra da promoção: 1 por 4, 2 por 7, 3 por 10
    // Isso significa que a cada 3 trufas, pagamos R$ 10.
    // O resto que não completar 3: se sobrar 2 = R$ 7, se sobrar 1 = R$ 4

    let totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    let total = 0;

    const combosDeTres = Math.floor(totalItems / 3);
    const sobra = totalItems % 3;

    total += combosDeTres * 10;

    if (sobra === 2) total += 7;
    if (sobra === 1) total += 4;

    return total;
}

function renderCart() {
    const cartItemsEl = document.getElementById('cart-items');
    const cartCountEl = document.getElementById('cart-count');
    const cartTotalEl = document.getElementById('cart-total-value');

    cartItemsEl.innerHTML = '';
    let totalItems = 0;

    cart.forEach(item => {
        totalItems += item.quantity;
        const div = document.createElement('div');
        div.className = 'cart-item';
        div.innerHTML = `
            <div class="cart-item-info">
                <h4>${item.name}</h4>
                <span>Qtd: ${item.quantity}</span>
            </div>
            <div class="cart-item-controls">
                <button onclick="removeFromCart(${item.product_id})">-</button>
                <span>${item.quantity}</span>
                <button onclick="addToCart(${item.product_id})">+</button>
            </div>
        `;
        cartItemsEl.appendChild(div);
    });

    cartCountEl.innerText = totalItems;
    const totalAmount = calculateTotal();
    cartTotalEl.innerText = `R$ ${totalAmount.toFixed(2).replace('.', ',')}`;
}

function saveCart() {
    localStorage.setItem('malu_cart', JSON.stringify(cart));
}

function loadCartFromStorage() {
    const saved = localStorage.getItem('malu_cart');
    if (saved) cart = JSON.parse(saved);
}

// UI Controls
function toggleCart() {
    document.getElementById('cart-sidebar').classList.toggle('open');
}

function openCheckout() {
    if (cart.length === 0) {
        alert("Seu carrinho está vazio!");
        return;
    }
    toggleCart();
    document.getElementById('checkout-modal').classList.add('active');

    // Tentar carregar dados do usuário
    const savedPhone = localStorage.getItem('malu_user_phone');
    const savedName = localStorage.getItem('malu_user_name');
    if(savedPhone) document.getElementById('cust-phone').value = savedPhone;
    if(savedName) document.getElementById('cust-name').value = savedName;
}

function closeCheckout() {
    document.getElementById('checkout-modal').classList.remove('active');
}

// Finalizar Pedido
async function submitOrder(e) {
    e.preventDefault();
    const btn = document.getElementById('submit-btn');
    btn.disabled = true;
    btn.innerText = "Enviando...";

    const name = document.getElementById('cust-name').value;
    const phone = document.getElementById('cust-phone').value.replace(/\D/g, ''); // Apenas números
    const payment_method = document.getElementById('payment-method').value;
    const total_amount = calculateTotal();

    const orderData = {
        customer: { name, phone },
        items: cart,
        total_amount,
        payment_method
    };

    try {
        const response = await fetch(`${API_URL}/orders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(orderData)
        });

        if (!response.ok) throw new Error('Falha ao enviar pedido');

        // Salvar dados do usuário para as próximas compras e pra push
        localStorage.setItem('malu_user_phone', phone);
        localStorage.setItem('malu_user_name', name);

        alert("Pedido enviado com sucesso! A Malu já recebeu seu pedido. 💕");

        // Limpar
        cart = [];
        saveCart();
        renderCart();
        closeCheckout();

        // Mostrar prompt de push notification
        setTimeout(() => {
            document.getElementById('push-prompt').classList.remove('hidden');
        }, 1500);

    } catch (error) {
        console.error(error);
        alert("Ocorreu um erro ao enviar o pedido. Tente novamente!");
    } finally {
        btn.disabled = false;
        btn.innerText = "Enviar Pedido para a Malu!";
    }
}

// Push Notifications
function closePushPrompt() {
    document.getElementById('push-prompt').classList.add('hidden');
}

async function subscribeToPush() {
    try {
        const registration = await navigator.serviceWorker.ready;

        // Nota: Substituir public VAPID key pela chave gerada no Cloudflare
        // Esta é uma chave de testes genérica (dummy) pra não quebrar a compilação
        const VAPID_PUBLIC_KEY = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuB23zS2e5TdbR9U8y_A4lB780';
        const convertedVapidKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);

        const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: convertedVapidKey
        });

        const phone = localStorage.getItem('malu_user_phone');

        // Enviar para o backend
        await fetch(`${API_URL}/push/subscribe`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                endpoint: subscription.endpoint,
                keys: {
                    p256dh: arrayBufferToBase64(subscription.getKey('p256dh')),
                    auth: arrayBufferToBase64(subscription.getKey('auth'))
                },
                userType: 'customer',
                customerPhone: phone
            })
        });

        alert("Notificações ativadas! Avisaremos quando estiver pronto. 🔔");
        closePushPrompt();

    } catch (error) {
        console.error("Erro ao assinar push:", error);
        alert("Não foi possível ativar as notificações.");
        closePushPrompt();
    }
}

// Service Worker Setup
async function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        try {
            await navigator.serviceWorker.register('/sw.js');
            console.log('SW registrado com sucesso');
        } catch (e) {
            console.error('Falha no SW', e);
        }
    }
}

// Utilitários de conversão Web Push
function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

function arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
}
