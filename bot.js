var mineflayer = require('mineflayer')
var tokens = require('prismarine-tokens')
var readline = require('readline');
var fs = require('fs');
var cleverbot = require("cleverbot.io");
cbot = new cleverbot(process.env.cleverAPIUser, process.env.cleverAPIKey);

var countreconnect = 0;

var options = {
    host: process.argv[2],
    port: parseInt(process.argv[3]),
    username: process.argv[4] ? process.argv[4] : 'ansi',
    password: process.argv[5],
    verbose: true,
    version: "1.12.2",
    tokensLocation: './bot_tokens.json',
    tokensDebug: true
};

var rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

tokens.use(options, function (_err, _opts) {
    if (_err) throw _err;
    var bot = mineflayer.createBot(_opts);
    bindEvents(bot, rl);
    connect(bot);
    recursiveAsyncReadLine(bot, rl);
});

function bindEvents(bot, rl) {

    bot.on('error', function (err) {
        console.log('Error attempting to reconnect: ' + err.errno + '.');
        if (err.code == undefined) {
            console.log('Invalid credentials OR bot needs to wait because it relogged too quickly.');
            process.exit();
        };
    });

    bot.on('end', function () {
        console.log("Bot has ended");
        rl.write('exit\n');
        setTimeout(relog, 30000);
    });
}

function relog() {
    console.log("Attempting to reconnect...");
    tokens.use(options, function (_err, _opts) {
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
    if (countreconnect >= 20) process.exit();
    countreconnect++;
}

function connect(bot) {
    bot.chatAddPattern(/<(?:\[[\w]+\] |[\W])?([\w\d_]+)>: unixbox (.*)$/, 'cleverg', 'Stratus Network Cleverbot Global');
    bot.chatAddPattern(/\(Team\) (?:\[[\w]+\] |[\W])?([\w\d_]+): unixbox (.*)$/, 'clevert', 'Stratus Network Cleverbot Team');
    bot.chatAddPattern(/<(?:\[[\w]+\] |[\W])?([\w\d_]+)>: (.*)$/, 'chat', 'Stratus Network chat global');
    bot.chatAddPattern(/\(Team\) (?:\[[\w]+\] |[\W])?([\w\d_]+): (.*)$/, 'chat', 'Stratus Network chat team');
    bot.chatAddPattern(/\[PM\] From (?:\[[\w]+\] |[\W])?([\w\d_]+): (.*)$/, 'whisper', 'Stratus Network PM');
    bot.on('message', (message) => {
        if (message.toAnsi().includes('No servers') == true || message.toAnsi().includes('Could not connect') == true) {
            setTimeout(function () { bot.chat('/server mixed'); }, 10000);
        }
        var text = message.toAnsi() + '\r\n';
        fs.appendFile('log', text);
    });
    bot.on('spawn', () => {
        bot.chat('/server mixed');
    });
    bot.on('respawn', () => {
        bot.chat('/server mixed');
        bot.clearControlStates();
        setTimeout(function () { bot.setControlState('back', true); setTimeout(function () { bot.setControlState('back', false); }, 1000); }, 5000);
    });
    bot.on('clevert', (username, message) => {
        if (username === bot.username) return
        var datetime = new Date();
        fs.appendFile('mentionlog', '[' + datetime + ']' + username + ' triggered cleverbot with: ' + message + '\r\n');
        cbot.setNick(username);
        cbot.create(function (err, session) {
            cbot.ask(message, function (err, response) {
                var datetime = new Date();
                bot.chat(username + ' ' + response);
                fs.appendFile('mentionlog', '[' + datetime + ']Cleverbot response for ' + username + ' : ' + response + '\r\n');
            });
        });
    });
    bot.on('cleverg', (username, message) => {
        if (username === bot.username) return
        var datetime = new Date();
        fs.appendFile('mentionlog', '[' + datetime + ']' + username + ' triggered cleverbot with: ' + message + '\r\n');
        cbot.setNick(username);
        cbot.create(function (err, session) {
            cbot.ask(message, function (err, response) {
                var datetime = new Date();
                bot.chat('/g ' + username + ' ' + response);
                fs.appendFile('mentionlog', '[' + datetime + ']Cleverbot response for ' + username + ' : ' + response + '\r\n');
            });
        });
    });
    bot.on('chat', (username, message) => {
        if (username === bot.username) return
        if (message.includes('unixbox') == true && !message.match(/^unixbox (.*)$/)) {
            var datetime = new Date();
            fs.appendFile('mentionlog', '[' + datetime + ']' + username + ' mentioned me in the chat: ' + message + '\r\n');
            bot.chat('/msg ' + username + ' Hi! I\'m a bot! I noticed that you mentioned me in the chat.');
            setTimeout(function () { bot.chat('/msg ' + username + ' I help track the statistics of the match for the Stratus Network Monitoring project! See more here: https://stratus.network/forums/topics/5b7b4498ba15960001003ef9'); }, 500);
        }
        else if (!message.match(/^unixbox (.*)$/))
        {
            fs.readFile('ignore', 'utf8', function (err, data) {
                if (err) throw err;
                if (data.includes(username) == false) {
                    bot.clearControlStates();
                    if (bot.blockAt(bot.entity.position.offset(0, -2, 0)) != null)
                        if (bot.blockAt(bot.entity.position.offset(0, -2, 0)).name)
                            if (bot.blockAt(bot.entity.position.offset(0, -2, 0)).name == "air" || bot.canDigBlock(bot.blockAt(bot.entity.position.offset(0, -1, 0))) == false)
                                bot.chat('/tp ' + username);
                    bot.activateItem();
                    bot.setControlState('forward', true);
                    bot.setControlState('jump', true);
                    bot.setControlState('sprint', true);
                    if (bot.players[username]) {
                        target = bot.players[username].entity;
                        let entity;
                        entity = nearestEntity();
                        function nearestEntity(type) {
                            let id
                            let entity
                            let dist
                            let best = null
                            let bestDistance = null
                            for (id in bot.entities) {
                                entity = bot.entities[id]
                                if (type && entity.type !== type) continue
                                if (entity === bot.entity) continue
                                dist = bot.entity.position.distanceTo(entity.position)
                                if (!best || dist < bestDistance) {
                                    best = entity
                                    bestDistance = dist
                                }
                            }
                            return best
                        };
                        setInterval(watchTarget, 50);
                        function watchTarget() {
                            if (!target) return
                            bot.lookAt(target.position.offset(0, target.height, 0));
                        };
                    }
                }
            });
        }
    });
    bot.on('whisper', (username, message, rawMessage) => {
        if (username === bot.username) return
        if (username == "unixfox") {
            switch (message) {
                case 'forward':
                    bot.setControlState('forward', true)
                    break
                case 'back':
                    bot.setControlState('back', true)
                    break
                case 'left':
                    bot.setControlState('left', true)
                    break
                case 'right':
                    bot.setControlState('right', true)
                    break
                case 'sprint':
                    bot.setControlState('sprint', true)
                    break
                case 'stop':
                    bot.clearControlStates()
                    break
                case 'jump':
                    bot.setControlState('jump', true)
                    bot.setControlState('jump', false)
                    break
                case 'jump a lot':
                    bot.setControlState('jump', true)
                    break
                case 'stop jumping':
                    bot.setControlState('jump', false)
                    break
                case 'attack':
                    entity = nearestEntity()
                    if (entity) {
                        bot.attack(entity, true)
                    } else {
                        bot.chat('/msg ' + 'unixfox no nearby entities');
                    }
                    break
                case 'tp':
                    bot.entity.position.y += 10
                    break
                case 'pos':
                    bot.chat(bot.entity.position.toString())
                    break
                case 'yp':
                    bot.chat(`Yaw ${bot.entity.yaw}, pitch: ${bot.entity.pitch}`)
                    break
                default:
                    bot.chat(message);
                    bot.chat('/msg ' + 'unixfox command executed!');
                    bot.once('message', (message) => {
                        bot.chat('/msg ' + 'unixfox ' + message);
                    });
            }
        }
        else if (message.includes('stop') == true || message.includes('ignore') == true) {
            bot.clearControlStates();
            fs.appendFile('ignore', username + '\r\n');
            bot.chat('/msg ' + username + ' Hi, I\'m just a bot... I\'m sorry. I will never bother you again.');
        }
        else {
            var datetime = new Date();
            fs.appendFile('mentionlog', '[' + datetime + ']Received a PM from ' + username + ' : ' + message + '\r\n');
            bot.chat('/msg ' + username + ' Hi! I\'m a bot!');
            setTimeout(function () { bot.chat('/msg ' + username + ' I help track the statistics of the match for the Stratus Network Monitoring project! See more here: https://stratus.network/forums/topics/5b7b4498ba15960001003ef9'); }, 500);
        }
    });
    bot.on('title', (text) => {
        if (text.includes('wins!') == true) {
            var sentenses = ['Good job!', 'gg!', 'Great match!', 'Good game!', 'Nice match guys!', 'Great game!', 'Well played!', 'Nice job!'];
            var randomsentense = sentenses[Math.floor(Math.random() * sentenses.length)];
            setTimeout(function () { bot.chat(randomsentense); }, 3000);
        }
    });
    bot.on('kicked', (reason, loggedIn) => {
        console.log(reason);
        console.log(loggedIn);
    });
}

function getinfo(bot) {
    bot.chat('/rot'); bot.chat('/tl'); bot.chat('/servers'); bot.chat('/next');
}

var recursiveAsyncReadLine = function (bot, rl) {
    rl.question('', function (answer) {
        if (answer == 'exit')
            return rl.close();
        if (answer == 'info') {
            getinfo(bot);
        }
        recursiveAsyncReadLine(bot, rl);
    });
};