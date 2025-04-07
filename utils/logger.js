// logger.js

const chalk = require('chalk');  // Optional, for colored logs

const logger = {
  info: (message) => {
    const timestamp = new Date().toISOString();
    console.log(`${chalk.blue('[INFO]')} ${timestamp} - ${message}`);
  },
  // You can add more log levels like warn, error, debug, etc.
  error: (message) => {
    const timestamp = new Date().toISOString();
    console.error(`${chalk.red('[ERROR]')} ${timestamp} - ${message}`);
  }
};

module.exports = logger;
