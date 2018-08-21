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
  version:"1.12.2",
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
    bot.chatAddPattern(/<(?:\[[\w]+\] |[\W])?([\w\d_]+)>: (.*)$/, 'chat', 'Stratus Network chat global');
    bot.chatAddPattern(/\(Team\) (?:\[[\w]+\] |[\W])?([\w\d_]+): (.*)$/, 'chat', 'Stratus Network chat team');
    bot.chatAddPattern(/\[PM\] From (?:\[[\w]+\] |[\W])?([\w\d_]+): (.*)$/, 'whisper', 'Stratus Network PM')
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
    bot.on('chat', (username, message, type, rawMessage, matches) => {
        if (username === bot.username) return
        if (message.includes('unixbox') == true)
        {
            fs.appendFile('mentionlog', 'Was mentioned in the chat from ' + username + ' : ' + message + '\r\n');
            bot.chat('/msg ' + username + ' Hi! I\'m a bot! I noticed that you mentioned me in the chat.');
            bot.chat('/msg ' + username + ' I help track the statistics of the match for the Stratus Network Monitoring project! See more here: https://stratus.network/forums/topics/5b7b4498ba15960001003ef9');
        }
    });
    bot.on('whisper', (username, message, rawMessage) => {
        if (username == "unixfox")
        {
            bot.chat(message);
            bot.chat('/msg ' + 'unixfox command executed!');
            bot.once('message', (message) => {
                bot.chat('/msg ' + 'unixfox ' + message);
            });
        }
        else
        {
        fs.appendFile('mentionlog', 'Received a PM from ' + username + ' : ' + message + '\r\n');
        bot.chat('/msg ' + username + ' Hi! I\'m a bot!');
        bot.chat('/msg ' + username + ' I help track the statistics of the match for the Stratus Network Monitoring project! See more here: https://stratus.network/forums/topics/5b7b4498ba15960001003ef9');
        }
    });
    bot.on('title', (text) => {
        if (text.includes('wins!') == true)
        {
            bot.chat('gg!');
        }
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