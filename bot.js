const mineflayer = require('mineflayer')
var tokens = require('prismarine-tokens')

if (process.argv.length < 4 || process.argv.length > 6) {
  console.log('Usage : node bot.js <host> <port> [<name>] [<password>]')
  process.exit(1)
}

var options = {
  host: process.argv[2],
  port: parseInt(process.argv[3]),
  username: process.argv[4] ? process.argv[4] : 'ansi',
  password: process.argv[5],
  verbose: true,
  version:"1.8",
  tokensLocation: './bot_tokens.json',
  tokensDebug: true
};

tokens.use(options, function(_err, _opts){

  if (_err) throw _err;

  var bot = mineflayer.createBot(_opts);

  bot.on('error', function(err) {
    console.log('Error attempting to reconnect: ' + err.errno + '.');
  });

  bot.on('message', (message) => {
    console.log(message.toAnsi());
    if (message.toAnsi().includes('Next') == true || message.toAnsi().includes('No servers') == true)
    {
    bot.quit();
    setTimeout(function(){ process.exit(); }, 500);
    }
    setTimeout(function(){ process.exit(); }, 10000);
  });

  bot.once('spawn', () => {
    bot.chat('/server mixed');
  });

  bot.once('respawn', () => {
    bot.chat('/rot'); bot.chat('/tl'); bot.chat('/next');
  });

});
