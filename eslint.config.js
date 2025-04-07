import js from '@eslint/js';

export default [
  js.configs.recommended,
  {
    rules: {
      "no-unused-vars": "warn",
      "no-undef": "error"
    },
    ignores: ["**/node_modules/", "**/coverage/"]
  }
];