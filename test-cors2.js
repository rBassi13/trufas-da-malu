fetch("https://trufas-da-malu-api.alan-ricardo.workers.dev/api/products", {
    method: "OPTIONS",
    headers: {
        "Origin": "http://localhost:3000",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "Content-Type, Authorization"
    }
}).then(res => {
    console.log("Status:", res.status);
    console.log("Headers:", Object.fromEntries(res.headers.entries()));
});
