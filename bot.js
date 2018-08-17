const mineflayer = require('mineflayer')

if (process.argv.length < 4 || process.argv.length > 6) {
  console.log('Usage : node bot.js <host> <port> [<name>] [<password>]')
  process.exit(1)
}

const bot = mineflayer.createBot({
  host: process.argv[2],
  port: parseInt(process.argv[3]),
  username: process.argv[4] ? process.argv[4] : 'ansi',
  password: process.argv[5],
  verbose: true,
  version:"1.8"
})

process.on('uncaughtException', function(err) {
    console.log('error');
});

bot.on('message', (message) => {
  console.log(message.toAnsi());
  if (message.toAnsi().includes('Rotation') == true || message.toAnsi().includes('No servers') == true)
  {
  bot.quit();
  setTimeout(function(){ process.exit(); }, 500);
  }
})

bot.once('spawn', () => {
  bot.chat('/server mixed');
  setTimeout(function(){ bot.chat('/rot');}, 500);
})
