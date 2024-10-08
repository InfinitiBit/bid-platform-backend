module.exports = {
    env: {
      node: true,
      commonjs: true,
      es2023: true,
    },
    extends: ['airbnb-base', 'prettier'],
    plugins: ['prettier'],
    parserOptions: {
      ecmaVersion: 'latest',
    },
    rules: {
      'prettier/prettier': 'error',
    },
};
  