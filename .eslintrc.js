export default {
    env: {
      node: true,
      es2021: true,
      jest: true,
    },
    extends: ['eslint:recommended', 'plugin:jest/recommended'],
    parserOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
    rules: {
      // Either disable console warnings or make them errors based on your preference
      'no-console': process.env.NODE_ENV === 'production' ? 'error' : 'warn',
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_|next|error' }],
    },
  };