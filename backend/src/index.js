export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const method = request.method;

    // 🛠️ Pílula da Liia: Limpando a URL para evitar o bug da barra dupla/trailing slash
    const cleanPath = url.pathname.replace(/\/+$/, "") || "/";

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
      if (cleanPath === "/api/products" && method === "GET") {
        const { results } = await env.DB.prepare(
          "SELECT * FROM products ORDER BY name ASC",
        ).all();
        return new Response(JSON.stringify(results), { headers });
      }

      if (cleanPath === "/api/products" && method === "POST") {
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

      if (cleanPath.startsWith("/api/products/") && method === "PATCH") {
        if (!checkAuth(request, env))
          return new Response("Unauthorized", { status: 401, headers });
        const productId = cleanPath.split("/").pop();
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

      if (cleanPath === "/api/orders" && method === "POST") {
        return await handleCreateOrder(request, env, headers);
      }

      if (cleanPath === "/api/orders" && method === "GET") {
        // Protected route
        if (!checkAuth(request, env))
          return new Response("Unauthorized", { status: 401, headers });
          
        const { results } = await env.DB.prepare(
          `
          SELECT 
            o.*, 
            c.name as customer_name, 
            c.phone as customer_phone,
            (
              SELECT json_group_array(json_object('name', p.name, 'quantity', oi.quantity))
              FROM order_items oi
              JOIN products p ON oi.product_id = p.id
              WHERE oi.order_id = o.id
            ) as items_json
          FROM orders o
          JOIN customers c ON o.customer_id = c.id
          ORDER BY o.created_at DESC
        `
        ).all();

        // O banco de dados devolve o array de itens como uma string (texto).
        // Vamos converter (parse) de volta para um array de verdade para o Front-end ler fácil!
        const ordersWithItems = results.map(o => ({
            ...o,
            items: JSON.parse(o.items_json || '[]')
        }));

        return new Response(JSON.stringify(ordersWithItems), { headers });
      }

      if (cleanPath.startsWith("/api/orders/") && method === "PATCH") {
        if (!checkAuth(request, env))
          return new Response("Unauthorized", { status: 401, headers });
        const orderId = cleanPath.split("/").pop();
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

          // 🛠️ LÓGICA INJETADA: Devolver ao estoque se CANCELADO
          if (data.status === "CANCELED") {
            // 1. Resgata todos os produtos que estavam nesse pedido
            const { results: orderItems } = await env.DB.prepare(
                `SELECT product_id, quantity FROM order_items WHERE order_id = ?`
            ).bind(orderId).all();

            // 2. Cria um loop e devolve cada quantidade para a prateleira correta
            for (const item of orderItems) {
                await env.DB.prepare(
                    `UPDATE products SET stock = stock + ? WHERE id = ?`
                ).bind(item.quantity, item.product_id).run();
            }
          }
        }
        return new Response(JSON.stringify({ success: true }), { headers });
      }

      // 🛠️ Pílula da Liia: O Boss final do seu erro tava aqui. normalizedPath arrumado!
      if (cleanPath === "/api/admin/login" && method === "POST") {
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

  return new Response(JSON.stringify({ success: true, orderId, customerId }), {
    headers,
  });
}
