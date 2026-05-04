import { buildPushHTTPRequest } from "@pushforge/builder";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const method = request.method;

    // 1. Centralizando os Headers de CORS para não repetir código
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };

    // 2. Ajustando o Preflight (OPTIONS) com status correto e cache (Max-Age)
    if (method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          ...corsHeaders,
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    // 3. Injetando os headers do CORS nas respostas padrão da API
    const headers = {
      ...corsHeaders,
      "Content-Type": "application/json",
    };

    try {
      if (url.pathname === "/api/products" && method === "GET") {
        const { results } = await env.DB.prepare(
          "SELECT * FROM products ORDER BY name ASC",
        ).all();
        return new Response(JSON.stringify(results), { headers });
      }

      if (url.pathname === "/api/products" && method === "POST") {
        if (!checkAuth(request, env))
          return new Response("Unauthorized", { status: 401, headers });
        const data = await request.json();
        const info = await env.DB.prepare(
          "INSERT INTO products (name, description, price, stock, image_url, is_gourmet) VALUES (?, ?, ?, ?, ?, ?)"
        )
          .bind(data.name, data.description, data.price, data.stock, data.image_url, data.is_gourmet ? 1 : 0)
          .run();
        return new Response(JSON.stringify({ success: true, id: info.meta.last_row_id }), { headers });
      }

      if (url.pathname.startsWith("/api/products/") && method === "PATCH") {
        if (!checkAuth(request, env))
          return new Response("Unauthorized", { status: 401, headers });
        const productId = url.pathname.split("/").pop();
        const data = await request.json();

        const updates = [];
        const params = [];

        if (data.stock !== undefined) {
          updates.push("stock = ?");
          params.push(data.stock);
        }
        if (data.price !== undefined) {
          updates.push("price = ?");
          params.push(data.price);
        }
        if (data.description !== undefined) {
          updates.push("description = ?");
          params.push(data.description);
        }

        if (updates.length > 0) {
          params.push(productId);
          await env.DB.prepare(`UPDATE products SET ${updates.join(", ")} WHERE id = ?`)
            .bind(...params)
            .run();
        }
        return new Response(JSON.stringify({ success: true }), { headers });
      }

      if (url.pathname === "/api/orders" && method === "POST") {
        return await handleCreateOrder(request, env, headers);
      }

      if (url.pathname === "/api/orders" && method === "GET") {
        // Protected route
        if (!checkAuth(request, env))
          return new Response("Unauthorized", { status: 401, headers });
        const { results } = await env.DB.prepare(
          `
          SELECT o.*, c.name as customer_name, c.phone as customer_phone
          FROM orders o
          JOIN customers c ON o.customer_id = c.id
          ORDER BY o.created_at DESC
        `,
        ).all();
        return new Response(JSON.stringify(results), { headers });
      }

      if (url.pathname.startsWith("/api/orders/") && method === "PATCH") {
        if (!checkAuth(request, env))
          return new Response("Unauthorized", { status: 401, headers });
        const orderId = url.pathname.split("/").pop();
        const data = await request.json();

        const updates = [];
        const params = [];
        if (data.status) {
          updates.push("status = ?");
          params.push(data.status);
        }
        if (data.payment_status) {
          updates.push("payment_status = ?");
          params.push(data.payment_status);
        }

        if (updates.length > 0) {
          params.push(orderId);
          await env.DB.prepare(
            `UPDATE orders SET ${updates.join(", ")} WHERE id = ?`,
          )
            .bind(...params)
            .run();

          // Se o status mudou para READY, tentar notificar o cliente
          if (data.status === "READY") {
            ctx.waitUntil(notifyCustomer(orderId, env));
          }
        }
        return new Response(JSON.stringify({ success: true }), { headers });
      }

      if (url.pathname === "/api/push/subscribe" && method === "POST") {
        const data = await request.json();
        const { endpoint, keys, userType, customerPhone } = data;
        let customerId = null;

        if (customerPhone) {
          const customer = await env.DB.prepare(
            "SELECT id FROM customers WHERE phone = ?",
          )
            .bind(customerPhone)
            .first();
          if (customer) customerId = customer.id;
        }

        await env.DB.prepare(
          `
          INSERT INTO push_subscriptions (endpoint, p256dh, auth, user_type, customer_id)
          VALUES (?, ?, ?, ?, ?)
        `,
        )
          .bind(endpoint, keys.p256dh, keys.auth, userType, customerId)
          .run();

        return new Response(JSON.stringify({ success: true }), { headers });
      }

      // Validação de admin via endpoint simples
      if (normalizedPath === "/api/admin/login" && method === "POST") {
        const { password } = await request.json();
        if (password === env.ADMIN_PASSWORD) {
          return new Response(JSON.stringify({ success: true }), { headers });
        }
        return new Response("Unauthorized", { status: 401, headers });
      }

      return new Response("Not found", { status: 404, headers });
    } catch (error) {
      console.error(error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers,
      });
    }
  },
};

function checkAuth(request, env) {
  const authHeader = request.headers.get("Authorization");
  return authHeader === `Bearer ${env.ADMIN_PASSWORD}`;
}

async function handleCreateOrder(request, env, headers) {
  const data = await request.json();
  const { customer, items, payment_method } = data;

  // Validar itens e calcular total pelo banco de dados
  let totalItems = 0;
  const dbItems = [];

  for (const item of items) {
    const dbProduct = await env.DB.prepare(
      "SELECT id, price FROM products WHERE id = ?",
    )
      .bind(item.product_id)
      .first();
    if (!dbProduct) throw new Error(`Product ${item.product_id} not found`);

    totalItems += item.quantity;
    dbItems.push({
      product_id: item.product_id,
      quantity: item.quantity,
      price: dbProduct.price,
    });
  }

  // Regra da promoção: 1 por 4, 2 por 7, 3 por 10
  const combosDeTres = Math.floor(totalItems / 3);
  const sobra = totalItems % 3;

  let calculatedTotal = combosDeTres * 10;
  if (sobra === 2) calculatedTotal += 7;
  if (sobra === 1) calculatedTotal += 4;

  // 1. Verificar/Criar cliente
  let customerId;
  let existingCustomer = await env.DB.prepare(
    "SELECT id FROM customers WHERE phone = ?",
  )
    .bind(customer.phone)
    .first();
  if (existingCustomer) {
    customerId = existingCustomer.id;
    // Atualizar nome do cliente
    await env.DB.prepare("UPDATE customers SET name = ? WHERE id = ?")
      .bind(customer.name, customerId)
      .run();
  } else {
    const info = await env.DB.prepare(
      "INSERT INTO customers (phone, name) VALUES (?, ?) RETURNING id",
    )
      .bind(customer.phone, customer.name)
      .first();
    customerId = info.id;
  }

  // 2. Criar pedido
  const orderInfo = await env.DB.prepare(
    `
    INSERT INTO orders (customer_id, total_amount, payment_method)
    VALUES (?, ?, ?) RETURNING id
  `,
  )
    .bind(customerId, calculatedTotal, payment_method)
    .first();
  const orderId = orderInfo.id;

  // 3. Inserir itens e reduzir estoque (usando batch do D1)
  const stmts = [];
  for (const item of dbItems) {
    stmts.push(
      env.DB.prepare(
        "INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)",
      ).bind(orderId, item.product_id, item.quantity, item.price),
    );
    stmts.push(
      env.DB.prepare("UPDATE products SET stock = stock - ? WHERE id = ?").bind(
        item.quantity,
        item.product_id,
      ),
    );
  }
  await env.DB.batch(stmts);

  // 4. Notificar Admin sobre o novo pedido
  try {
    await notifyAdmin(customer.name, calculatedTotal, env);
  } catch (e) {
    console.error("Push notification to admin failed", e);
  }

  return new Response(JSON.stringify({ success: true, orderId, customerId }), {
    headers,
  });
}

// -----------------------------------------------------
// PUSH NOTIFICATIONS LOGIC (VAPID)
// Utiliza a biblioteca web-push instalada no Worker
// -----------------------------------------------------

async function notifyAdmin(customerName, totalAmount, env) {
  const { results } = await env.DB.prepare(
    "SELECT * FROM push_subscriptions WHERE user_type = 'admin'",
  ).all();
  if (results.length === 0) return;

  const payload = JSON.stringify({
    title: "Novo pedido recebido \uD83C\uDF6C",
    body: `Cliente: ${customerName} | Valor: R$ ${totalAmount.toFixed(2)}`,
    url: "/admin.html",
  });

  await sendPushNotifications(results, payload, env);
}

async function notifyCustomer(orderId, env) {
  const order = await env.DB.prepare(
    "SELECT customer_id FROM orders WHERE id = ?",
  )
    .bind(orderId)
    .first();
  if (!order) return;

  const { results } = await env.DB.prepare(
    "SELECT * FROM push_subscriptions WHERE customer_id = ?",
  )
    .bind(order.customer_id)
    .all();
  if (results.length === 0) return;

  const payload = JSON.stringify({
    title: "Seu pedido está pronto! \u2728",
    body: "Suas trufas deliciosas já estão prontas para retirada/entrega.",
    url: "/",
  });

  await sendPushNotifications(results, payload, env);
}

async function sendPushNotifications(subscriptions, payload, env) {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) {
    console.error("VAPID Keys não configuradas. Pulando notificação.");
    return;
  }

  const vapidDetails = {
    subject: env.VAPID_SUBJECT || "mailto:admin@trufasdamalu.com.br",
    publicKey: env.VAPID_PUBLIC_KEY,
    privateKey: env.VAPID_PRIVATE_KEY,
  };

  for (const sub of subscriptions) {
    const pushSubscription = {
      endpoint: sub.endpoint,
      keys: {
        auth: sub.auth,
        p256dh: sub.p256dh,
      },
    };

    try {
      const requestDetails = await buildPushHTTPRequest(
        pushSubscription,
        payload,
        vapidDetails,
      );
      const pushResponse = await fetch(requestDetails.endpoint, {
        method: requestDetails.method,
        headers: requestDetails.headers,
        body: requestDetails.body,
      });

      if (!pushResponse.ok) {
        console.error(
          "Erro ao enviar push:",
          pushResponse.status,
          await pushResponse.text(),
        );
        if (pushResponse.status === 410 || pushResponse.status === 404) {
          await env.DB.prepare("DELETE FROM push_subscriptions WHERE id = ?")
            .bind(sub.id)
            .run();
        }
      }
    } catch (err) {
      console.error("Erro interno ao montar push:", err);
    }
  }
}
