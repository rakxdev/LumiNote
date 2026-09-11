module.exports = {
  env: {
    browser: true,
    commonjs: true,
    es2021: true,
  },
  extends: "eslint:recommended",
  // Vendored third-party libraries are not linted.
  ignorePatterns: ["public/vendor/"],
  rules: {
    // Teardown paths intentionally swallow cleanup errors (stop streams, close sockets).
    "no-empty": ["error", { allowEmptyCatch: true }],
  },
  overrides: [
    {
      env: {
        node: true,
      },
      files: [".eslintrc.{js,cjs}"],
      parserOptions: {
        sourceType: "script",
      },
    },
    {
      files: ["functions/**/*.js"],
      parserOptions: {
        sourceType: "module",
        ecmaVersion: "latest",
      },
    },
    {
      files: ["public/**/*.js", "worker/**/*.js", "tests/**/*.js"],
      parserOptions: {
        sourceType: "module",
        ecmaVersion: "latest",
      },
    },
    {
      files: ["worker/**/*.js"],
      globals: {
        WebSocketPair: "readonly",
        WebSocketRequestResponsePair: "readonly",
      },
    },
  ],
  parserOptions: {
    ecmaVersion: "latest",
  },
};
