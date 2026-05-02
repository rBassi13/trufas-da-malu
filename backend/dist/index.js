var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// node_modules/@pushforge/builder/dist/lib/crypto.js
if (!globalThis.crypto?.subtle) {
  throw new Error("Web Crypto API not available. Ensure you are using Node.js 20+ or a modern runtime with globalThis.crypto support.");
}
var isomorphicCrypto = globalThis.crypto;
var crypto = {
  /**
   * Fills the given typed array with cryptographically secure random values.
   *
   * @param {T} array - The typed array to fill with random values.
   * @returns {T} The filled typed array.
   * @template T - The type of the typed array (e.g., Uint8Array).
   */
  getRandomValues(array) {
    return isomorphicCrypto.getRandomValues(array);
  },
  /**
   * Provides access to subtle cryptographic operations.
   *
   * @type {SubtleCrypto} The subtle cryptographic interface.
   */
  subtle: isomorphicCrypto.subtle
};

// node_modules/@pushforge/builder/dist/lib/utils.js
var stringFromArrayBuffer = /* @__PURE__ */ __name((s) => {
  let result = "";
  for (const code of new Uint8Array(s))
    result += String.fromCharCode(code);
  return result;
}, "stringFromArrayBuffer");
var base64Decode = /* @__PURE__ */ __name((base64String) => {
  const paddedBase64 = base64String.padEnd(base64String.length + (4 - (base64String.length % 4 || 4)) % 4, "=");
  if (typeof Buffer !== "undefined") {
    return Buffer.from(paddedBase64, "base64").toString("binary");
  }
  if (typeof atob === "function") {
    return atob(paddedBase64);
  }
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
  let result = "";
  let i = 0;
  while (i < paddedBase64.length) {
    const enc1 = characters.indexOf(paddedBase64.charAt(i++));
    const enc2 = characters.indexOf(paddedBase64.charAt(i++));
    const enc3 = characters.indexOf(paddedBase64.charAt(i++));
    const enc4 = characters.indexOf(paddedBase64.charAt(i++));
    const char1 = enc1 << 2 | enc2 >> 4;
    const char2 = (enc2 & 15) << 4 | enc3 >> 2;
    const char3 = (enc3 & 3) << 6 | enc4;
    result += String.fromCharCode(char1);
    if (enc3 !== 64)
      result += String.fromCharCode(char2);
    if (enc4 !== 64)
      result += String.fromCharCode(char3);
  }
  return result;
}, "base64Decode");
var getPublicKeyFromJwk = /* @__PURE__ */ __name((jwk) => base64UrlEncode(`${base64Decode(base64UrlDecodeString(jwk.x))}${base64Decode(base64UrlDecodeString(jwk.y))}`), "getPublicKeyFromJwk");
var concatTypedArrays = /* @__PURE__ */ __name((arrays) => {
  const length = arrays.reduce((accumulator, current) => accumulator + current.byteLength, 0);
  let index = 0;
  const targetArray = new Uint8Array(length);
  for (const array of arrays) {
    targetArray.set(array, index);
    index += array.byteLength;
  }
  return targetArray;
}, "concatTypedArrays");

// node_modules/@pushforge/builder/dist/lib/base64.js
var base64UrlEncode = /* @__PURE__ */ __name((input) => {
  const text = typeof input === "string" ? input : stringFromArrayBuffer(input);
  let base64;
  if (typeof globalThis !== "undefined" && "btoa" in globalThis) {
    base64 = globalThis.btoa(text);
  } else {
    base64 = Buffer.from(text, "binary").toString("base64");
  }
  return base64.replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}, "base64UrlEncode");
var base64UrlDecodeString = /* @__PURE__ */ __name((s) => {
  if (!s)
    throw new Error("Invalid input");
  return s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - s.length % 4) % 4);
}, "base64UrlDecodeString");
var base64UrlDecode = /* @__PURE__ */ __name((input) => {
  const base64 = base64UrlDecodeString(input);
  if (typeof globalThis !== "undefined" && "atob" in globalThis) {
    const binaryString = globalThis.atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }
  return Buffer.from(base64, "base64").buffer;
}, "base64UrlDecode");

// node_modules/@pushforge/builder/dist/lib/shared-secret.js
var deriveSharedSecret = /* @__PURE__ */ __name(async (clientPublicKey, localPrivateKey) => {
  const sharedSecretBytes = await crypto.subtle.deriveBits({ name: "ECDH", public: clientPublicKey }, localPrivateKey, 256);
  return crypto.subtle.importKey("raw", sharedSecretBytes, { name: "HKDF" }, false, ["deriveBits", "deriveKey"]);
}, "deriveSharedSecret");

// node_modules/@pushforge/builder/dist/lib/payload.js
var importClientKeys = /* @__PURE__ */ __name(async (keys) => {
  const auth = base64UrlDecode(keys.auth);
  if (auth.byteLength !== 16) {
    throw new Error(`Incorrect auth length, expected 16 bytes but got ${auth.byteLength}`);
  }
  let decodedKey;
  const base64Key = base64UrlDecodeString(keys.p256dh);
  if (typeof globalThis !== "undefined" && "atob" in globalThis) {
    const binaryStr = globalThis.atob(base64Key);
    decodedKey = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      decodedKey[i] = binaryStr.charCodeAt(i);
    }
  } else {
    decodedKey = new Uint8Array(Buffer.from(base64Key, "base64"));
  }
  if (decodedKey.byteLength !== 65) {
    throw new Error(`Invalid p256dh key: expected 65 bytes but got ${decodedKey.byteLength} bytes`);
  }
  if (decodedKey[0] !== 4) {
    throw new Error(`Invalid p256dh key: expected uncompressed point format (0x04 prefix) but got 0x${decodedKey[0].toString(16).padStart(2, "0")}`);
  }
  const p256 = await crypto.subtle.importKey("jwk", {
    kty: "EC",
    crv: "P-256",
    x: base64UrlEncode(decodedKey.slice(1, 33)),
    y: base64UrlEncode(decodedKey.slice(33, 65)),
    ext: true
  }, { name: "ECDH", namedCurve: "P-256" }, true, []);
  return { auth, p256 };
}, "importClientKeys");
var derivePseudoRandomKey = /* @__PURE__ */ __name(async (auth, sharedSecret) => {
  const pseudoRandomKeyBytes = await crypto.subtle.deriveBits({
    name: "HKDF",
    hash: "SHA-256",
    salt: auth,
    // Adding Content-Encoding data info here is required by the Web Push API
    info: new TextEncoder().encode("Content-Encoding: auth\0")
  }, sharedSecret, 256);
  return crypto.subtle.importKey("raw", pseudoRandomKeyBytes, "HKDF", false, [
    "deriveBits"
  ]);
}, "derivePseudoRandomKey");
var createContext = /* @__PURE__ */ __name(async (clientPublicKey, localPublicKey) => {
  const [clientKeyBytes, localKeyBytes] = await Promise.all([
    crypto.subtle.exportKey("raw", clientPublicKey),
    crypto.subtle.exportKey("raw", localPublicKey)
  ]);
  return concatTypedArrays([
    new TextEncoder().encode("P-256\0"),
    new Uint8Array([0, clientKeyBytes.byteLength]),
    new Uint8Array(clientKeyBytes),
    new Uint8Array([0, localKeyBytes.byteLength]),
    new Uint8Array(localKeyBytes)
  ]);
}, "createContext");
var deriveNonce = /* @__PURE__ */ __name(async (pseudoRandomKey, salt, context) => {
  const nonceInfo = concatTypedArrays([
    new TextEncoder().encode("Content-Encoding: nonce\0"),
    context
  ]);
  return crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info: nonceInfo }, pseudoRandomKey, 12 * 8);
}, "deriveNonce");
var deriveContentEncryptionKey = /* @__PURE__ */ __name(async (pseudoRandomKey, salt, context) => {
  const info = concatTypedArrays([
    new TextEncoder().encode("Content-Encoding: aesgcm\0"),
    context
  ]);
  const bits = await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, pseudoRandomKey, 16 * 8);
  return crypto.subtle.importKey("raw", bits, "AES-GCM", false, ["encrypt"]);
}, "deriveContentEncryptionKey");
var MAX_PAYLOAD_SIZE = 4078;
var PADDING_LENGTH_PREFIX_SIZE = 2;
var padPayload = /* @__PURE__ */ __name((payload) => {
  const maxPayloadContentSize = MAX_PAYLOAD_SIZE - PADDING_LENGTH_PREFIX_SIZE;
  if (payload.byteLength > maxPayloadContentSize) {
    throw new Error(`Payload too large. Maximum size is ${maxPayloadContentSize} bytes, but received ${payload.byteLength} bytes`);
  }
  const availableSpace = MAX_PAYLOAD_SIZE - PADDING_LENGTH_PREFIX_SIZE - payload.byteLength;
  const maxRandomPadding = Math.min(100, availableSpace);
  const paddingSize = maxRandomPadding > 0 ? Math.floor(Math.random() * (maxRandomPadding + 1)) : 0;
  const paddingArray = new ArrayBuffer(PADDING_LENGTH_PREFIX_SIZE + paddingSize);
  new DataView(paddingArray).setUint16(0, paddingSize);
  return concatTypedArrays([new Uint8Array(paddingArray), payload]);
}, "padPayload");
var encryptPayload = /* @__PURE__ */ __name(async (localKeys, salt, payload, target) => {
  const clientKeys = await importClientKeys(target.keys);
  const sharedSecret = await deriveSharedSecret(clientKeys.p256, localKeys.privateKey);
  const pseudoRandomKey = await derivePseudoRandomKey(clientKeys.auth, sharedSecret);
  const context = await createContext(clientKeys.p256, localKeys.publicKey);
  const nonce = await deriveNonce(pseudoRandomKey, salt, context);
  const contentEncryptionKey = await deriveContentEncryptionKey(pseudoRandomKey, salt, context);
  const encodedPayload = new TextEncoder().encode(payload);
  const paddedPayload = padPayload(encodedPayload);
  return crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, contentEncryptionKey, paddedPayload);
}, "encryptPayload");

// node_modules/@pushforge/builder/dist/lib/jwt.js
var createJwt = /* @__PURE__ */ __name(async (jwk, jwtData) => {
  const jwtInfo = {
    typ: "JWT",
    // Type of the token
    alg: "ES256"
    // Algorithm used for signing
  };
  const base64JwtInfo = base64UrlEncode(JSON.stringify(jwtInfo));
  const base64JwtData = base64UrlEncode(JSON.stringify(jwtData));
  const unsignedToken = `${base64JwtInfo}.${base64JwtData}`;
  const privateKey = await crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, true, ["sign"]);
  const signature = await crypto.subtle.sign({ name: "ECDSA", hash: { name: "SHA-256" } }, privateKey, new TextEncoder().encode(unsignedToken)).then((token) => base64UrlEncode(token));
  return `${base64JwtInfo}.${base64JwtData}.${signature}`;
}, "createJwt");

// node_modules/@pushforge/builder/dist/lib/vapid.js
var vapidHeaders = /* @__PURE__ */ __name(async (options, payloadLength, salt, localPublicKey) => {
  const localPublicKeyBase64 = await crypto.subtle.exportKey("raw", localPublicKey).then((bytes) => base64UrlEncode(bytes));
  const serverPublicKey = getPublicKeyFromJwk(options.jwk);
  const jwt = await createJwt(options.jwk, options.jwt);
  const headerValues = {
    Encryption: `salt=${base64UrlEncode(salt)}`,
    "Crypto-Key": `dh=${localPublicKeyBase64}`,
    "Content-Length": payloadLength.toString(),
    "Content-Type": "application/octet-stream",
    "Content-Encoding": "aesgcm",
    Authorization: `vapid t=${jwt}, k=${serverPublicKey}`
  };
  let headers;
  if (options.ttl !== void 0)
    headerValues.TTL = options.ttl.toString();
  if (options.topic !== void 0)
    headerValues.Topic = options.topic;
  if (options.urgency !== void 0)
    headerValues.Urgency = options.urgency;
  if (typeof Headers !== "undefined") {
    headers = new Headers(headerValues);
  } else {
    headers = headerValues;
  }
  return headers;
}, "vapidHeaders");

// node_modules/@pushforge/builder/dist/lib/request.js
var validatePrivateJWK = /* @__PURE__ */ __name((jwk) => {
  if (jwk.kty !== "EC") {
    throw new Error(`Invalid JWK: 'kty' must be 'EC', received '${jwk.kty ?? "undefined"}'`);
  }
  if (jwk.crv !== "P-256") {
    throw new Error(`Invalid JWK: 'crv' must be 'P-256', received '${jwk.crv ?? "undefined"}'`);
  }
  if (!jwk.x || typeof jwk.x !== "string") {
    throw new Error("Invalid JWK: missing or invalid 'x' coordinate");
  }
  if (!jwk.y || typeof jwk.y !== "string") {
    throw new Error("Invalid JWK: missing or invalid 'y' coordinate");
  }
  if (!jwk.d || typeof jwk.d !== "string") {
    throw new Error("Invalid JWK: missing or invalid 'd' (private key)");
  }
}, "validatePrivateJWK");
var validateEndpoint = /* @__PURE__ */ __name((endpoint) => {
  let url;
  try {
    url = new URL(endpoint);
  } catch {
    throw new Error(`Invalid subscription endpoint: '${endpoint}' is not a valid URL`);
  }
  if (url.protocol !== "https:") {
    throw new Error(`Invalid subscription endpoint: push endpoints must use HTTPS, received '${url.protocol}'`);
  }
}, "validateEndpoint");
async function buildPushHTTPRequest({ privateJWK, message, subscription }) {
  let jwk;
  try {
    jwk = typeof privateJWK === "string" ? JSON.parse(privateJWK) : privateJWK;
  } catch {
    throw new Error("Invalid privateJWK: failed to parse JSON string");
  }
  validatePrivateJWK(jwk);
  validateEndpoint(subscription.endpoint);
  const MAX_TTL = 24 * 60 * 60;
  if (message.options?.ttl && message.options.ttl > MAX_TTL) {
    throw new Error("TTL must be less than 24 hours");
  }
  const ttl = message.options?.ttl && message.options.ttl > 0 ? message.options.ttl : MAX_TTL;
  const jwt = {
    aud: new URL(subscription.endpoint).origin,
    exp: Math.floor(Date.now() / 1e3) + ttl,
    sub: message.adminContact
  };
  const options = {
    jwk,
    jwt,
    payload: JSON.stringify(message.payload),
    ttl,
    ...message.options?.urgency && {
      urgency: message.options.urgency
    },
    ...message.options?.topic && {
      topic: message.options.topic
    }
  };
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const localKeys = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const body = await encryptPayload(localKeys, salt, options.payload, subscription);
  const headers = await vapidHeaders(options, body.byteLength, salt, localKeys.publicKey);
  return { endpoint: subscription.endpoint, body, headers };
}
__name(buildPushHTTPRequest, "buildPushHTTPRequest");

// src/index.js
var index_default = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const method = request.method;
    if (method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization"
        }
      });
    }
    const headers = {
      "Access-Control-Allow-Origin": "*",
      "Content-Type": "application/json"
    };
    try {
      if (url.pathname === "/api/products" && method === "GET") {
        const { results } = await env.DB.prepare("SELECT * FROM products").all();
        return new Response(JSON.stringify(results), { headers });
      }
      if (url.pathname === "/api/orders" && method === "POST") {
        return await handleCreateOrder(request, env, headers);
      }
      if (url.pathname === "/api/orders" && method === "GET") {
        if (!checkAuth(request, env)) return new Response("Unauthorized", { status: 401, headers });
        const { results } = await env.DB.prepare(`
          SELECT o.*, c.name as customer_name, c.phone as customer_phone
          FROM orders o
          JOIN customers c ON o.customer_id = c.id
          ORDER BY o.created_at DESC
        `).all();
        return new Response(JSON.stringify(results), { headers });
      }
      if (url.pathname.startsWith("/api/orders/") && method === "PATCH") {
        if (!checkAuth(request, env)) return new Response("Unauthorized", { status: 401, headers });
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
          await env.DB.prepare(`UPDATE orders SET ${updates.join(", ")} WHERE id = ?`).bind(...params).run();
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
          const customer = await env.DB.prepare("SELECT id FROM customers WHERE phone = ?").bind(customerPhone).first();
          if (customer) customerId = customer.id;
        }
        await env.DB.prepare(`
          INSERT INTO push_subscriptions (endpoint, p256dh, auth, user_type, customer_id)
          VALUES (?, ?, ?, ?, ?)
        `).bind(endpoint, keys.p256dh, keys.auth, userType, customerId).run();
        return new Response(JSON.stringify({ success: true }), { headers });
      }
      if (url.pathname === "/api/admin/login" && method === "POST") {
        const { password } = await request.json();
        if (password === env.ADMIN_PASSWORD) {
          return new Response(JSON.stringify({ success: true }), { headers });
        }
        return new Response("Unauthorized", { status: 401, headers });
      }
      return new Response("Not found", { status: 404, headers });
    } catch (error) {
      console.error(error);
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers });
    }
  }
};
function checkAuth(request, env) {
  const authHeader = request.headers.get("Authorization");
  return authHeader === `Bearer ${env.ADMIN_PASSWORD}`;
}
__name(checkAuth, "checkAuth");
async function handleCreateOrder(request, env, headers) {
  const data = await request.json();
  const { customer, items, payment_method } = data;
  let totalItems = 0;
  const dbItems = [];
  for (const item of items) {
    const dbProduct = await env.DB.prepare("SELECT id, price FROM products WHERE id = ?").bind(item.product_id).first();
    if (!dbProduct) throw new Error(`Product ${item.product_id} not found`);
    totalItems += item.quantity;
    dbItems.push({
      product_id: item.product_id,
      quantity: item.quantity,
      price: dbProduct.price
    });
  }
  const combosDeTres = Math.floor(totalItems / 3);
  const sobra = totalItems % 3;
  let calculatedTotal = combosDeTres * 10;
  if (sobra === 2) calculatedTotal += 7;
  if (sobra === 1) calculatedTotal += 4;
  let customerId;
  let existingCustomer = await env.DB.prepare("SELECT id FROM customers WHERE phone = ?").bind(customer.phone).first();
  if (existingCustomer) {
    customerId = existingCustomer.id;
    await env.DB.prepare("UPDATE customers SET name = ? WHERE id = ?").bind(customer.name, customerId).run();
  } else {
    const info = await env.DB.prepare("INSERT INTO customers (phone, name) VALUES (?, ?) RETURNING id").bind(customer.phone, customer.name).first();
    customerId = info.id;
  }
  const orderInfo = await env.DB.prepare(`
    INSERT INTO orders (customer_id, total_amount, payment_method)
    VALUES (?, ?, ?) RETURNING id
  `).bind(customerId, calculatedTotal, payment_method).first();
  const orderId = orderInfo.id;
  const stmts = [];
  for (const item of dbItems) {
    stmts.push(
      env.DB.prepare("INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)").bind(orderId, item.product_id, item.quantity, item.price)
    );
    stmts.push(
      env.DB.prepare("UPDATE products SET stock = stock - ? WHERE id = ?").bind(item.quantity, item.product_id)
    );
  }
  await env.DB.batch(stmts);
  try {
    await notifyAdmin(customer.name, calculatedTotal, env);
  } catch (e) {
    console.error("Push notification to admin failed", e);
  }
  return new Response(JSON.stringify({ success: true, orderId, customerId }), { headers });
}
__name(handleCreateOrder, "handleCreateOrder");
async function notifyAdmin(customerName, totalAmount, env) {
  const { results } = await env.DB.prepare("SELECT * FROM push_subscriptions WHERE user_type = 'admin'").all();
  if (results.length === 0) return;
  const payload = JSON.stringify({
    title: "Novo pedido recebido \u{1F36C}",
    body: `Cliente: ${customerName} | Valor: R$ ${totalAmount.toFixed(2)}`,
    url: "/admin.html"
  });
  await sendPushNotifications(results, payload, env);
}
__name(notifyAdmin, "notifyAdmin");
async function notifyCustomer(orderId, env) {
  const order = await env.DB.prepare("SELECT customer_id FROM orders WHERE id = ?").bind(orderId).first();
  if (!order) return;
  const { results } = await env.DB.prepare("SELECT * FROM push_subscriptions WHERE customer_id = ?").bind(order.customer_id).all();
  if (results.length === 0) return;
  const payload = JSON.stringify({
    title: "Seu pedido est\xE1 pronto! \u2728",
    body: "Suas trufas deliciosas j\xE1 est\xE3o prontas para retirada/entrega.",
    url: "/"
  });
  await sendPushNotifications(results, payload, env);
}
__name(notifyCustomer, "notifyCustomer");
async function sendPushNotifications(subscriptions, payload, env) {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) {
    console.error("VAPID Keys n\xE3o configuradas. Pulando notifica\xE7\xE3o.");
    return;
  }
  const vapidDetails = {
    subject: env.VAPID_SUBJECT || "mailto:admin@trufasdamalu.com.br",
    publicKey: env.VAPID_PUBLIC_KEY,
    privateKey: env.VAPID_PRIVATE_KEY
  };
  for (const sub of subscriptions) {
    const pushSubscription = {
      endpoint: sub.endpoint,
      keys: {
        auth: sub.auth,
        p256dh: sub.p256dh
      }
    };
    try {
      const requestDetails = await buildPushHTTPRequest(pushSubscription, payload, vapidDetails);
      const pushResponse = await fetch(requestDetails.endpoint, {
        method: requestDetails.method,
        headers: requestDetails.headers,
        body: requestDetails.body
      });
      if (!pushResponse.ok) {
        console.error("Erro ao enviar push:", pushResponse.status, await pushResponse.text());
        if (pushResponse.status === 410 || pushResponse.status === 404) {
          await env.DB.prepare("DELETE FROM push_subscriptions WHERE id = ?").bind(sub.id).run();
        }
      }
    } catch (err) {
      console.error("Erro interno ao montar push:", err);
    }
  }
}
__name(sendPushNotifications, "sendPushNotifications");
export {
  index_default as default
};
//# sourceMappingURL=index.js.map
