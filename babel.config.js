module.exports = {
  presets: [
    ['@babel/preset-env', {
      targets: { node: 'current' },
      modules: 'auto',
      useBuiltIns: 'usage',
      corejs: 3
    }]
  ],
  sourceType: 'unambiguous'
};