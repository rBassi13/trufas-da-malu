export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Rotas de API: encaminha para o Worker de backend
    if (url.pathname.startsWith("/api/")) {
      const backendUrl = "https://trufas-da-malu-api.alan-ricardo.workers.dev";
      const newUrl = backendUrl + url.pathname + url.search;
      return fetch(new Request(newUrl, request));
    }

    // Todo o resto: serve os arquivos estáticos do frontend
    return env.ASSETS.fetch(request);
  }
};