var mineflayer = require('mineflayer')
var tokens = require('prismarine-tokens')
var readline = require('readline');
var fs = require('fs');

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

var rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

tokens.use(options, function(_err, _opts){
    if (_err) throw _err;
    var bot = mineflayer.createBot(_opts);
    bindEvents(bot, rl);
    connect(bot);
    recursiveAsyncReadLine(bot, rl);
});

function bindEvents(bot, rl) {

    bot.on('error', function(err) {
        console.log('Error attempting to reconnect: ' + err.errno + '.');
        if (err.code == undefined) {
            console.log('Invalid credentials OR bot needs to wait because it relogged too quickly.');
            console.log('Will retry to connect in 30 seconds. ');
            setTimeout(relog, 30000);
        }
    });

    bot.on('end', function() {
        console.log("Bot has ended");
        rl.write('exit\n');
        setTimeout(relog, 30000);  
    });
}

function relog() {
    console.log("Attempting to reconnect...");
    tokens.use(options, function(_err, _opts){
        if (_err) throw _err;
        var bot = mineflayer.createBot(_opts);
        var rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        bindEvents(bot, rl);
        connect(bot);
        recursiveAsyncReadLine(bot, rl);
    });
}

function connect(bot) {
    bot.on('message', (message) => {
        if (message.toAnsi().includes('No servers') == true || message.toAnsi().includes('Could not connect') == true)
        {
            setTimeout(function(){ bot.chat('/server mixed'); }, 10000);
        }
        var text = message.toAnsi() + '\r\n';
        fs.appendFile('log', text);
    });
    bot.on('spawn', () => {
        bot.chat('/server mixed');
    });
    bot.on('respawn', () => {
        bot.chat('/server mixed');
    });
}

function getinfo(bot)
{
    bot.chat('/rot'); bot.chat('/tl'); bot.chat('/servers'); bot.chat('/next');
}

var recursiveAsyncReadLine = function (bot, rl) {
    rl.question('', function (answer) {
    if (answer == 'exit')
        return rl.close();
    if (answer == 'info')
    {
        getinfo(bot);
    }
    recursiveAsyncReadLine(bot, rl);
    });
};