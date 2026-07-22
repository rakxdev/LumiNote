import { onRequest as __api_token_js_onRequest } from "/home/ubuntu/rakxdev/LumiNote/functions/api/token.js"

export const routes = [
    {
      routePath: "/api/token",
      mountPath: "/api",
      method: "",
      middlewares: [],
      modules: [__api_token_js_onRequest],
    },
  ]