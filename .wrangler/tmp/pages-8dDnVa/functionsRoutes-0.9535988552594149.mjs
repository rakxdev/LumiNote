import { onRequest as __api_grammar_js_onRequest } from "/home/ubuntu/rakxdev/LumiNote/functions/api/grammar.js"
import { onRequest as __api_token_js_onRequest } from "/home/ubuntu/rakxdev/LumiNote/functions/api/token.js"

export const routes = [
    {
      routePath: "/api/grammar",
      mountPath: "/api",
      method: "",
      middlewares: [],
      modules: [__api_grammar_js_onRequest],
    },
  {
      routePath: "/api/token",
      mountPath: "/api",
      method: "",
      middlewares: [],
      modules: [__api_token_js_onRequest],
    },
  ]