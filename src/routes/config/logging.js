const winston = require('winston');
const fs = require('fs');
const path = require('path');

const { createLogger, format, transports } = winston;

const filename = path.join(__dirname, 'perevir_bot.log');

const logger = createLogger({
  format: format.combine(
    format.timestamp(),
    format.simple()
  ),
  transports: [
    new transports.Console({
      format: format.combine(
        format.timestamp(),
        format.colorize(),
        format.simple()
      )
    }),
    new transports.Stream({
      stream: fs.createWriteStream(filename)
    })
  ]
})

module.exports = { logger }
