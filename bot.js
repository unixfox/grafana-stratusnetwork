var mineflayer = require('mineflayer')
var tokens = require('prismarine-tokens')
var readline = require('readline');
var fs = require('fs');
const mysql = require('mysql2');
var Cooldown = require('cooldown');
var request = require('request');
var libxmljs = require("libxmljs");
var Pusher = require('pusher');
var JefNode = require('json-easy-filter').JefNode;
var yaml = require('js-yaml');

var countreconnect = 0;
var cd = new Cooldown(600000);

var pusher = new Pusher({
    appId: '607142',
    key: 'c07cc5767c749dddb0b3',
    secret: process.env.pusher,
    cluster: 'eu',
    encrypted: true
});

var options = {
    host: process.argv[2],
    port: parseInt(process.argv[3]),
    username: process.env.mc_user,
    password: process.env.mc_passwd,
    verbose: true,
    version: "1.12.2",
    tokensLocation: './bot_tokens.json',
    tokensDebug: true
};

const connection = mysql.createConnection({
    host: 'localhost',
    user: process.env.mysql_user,
    password: process.env.mysql_passwd,
    database: 'stratusgraph',
    port: (process.env.mysql_port || 3306)
});

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

function hmsToSecondsOnly(str) {
    var p = str.split(':'),
        s = 0, m = 1;

    while (p.length > 0) {
        s += m * parseInt(p.pop(), 10);
        m *= 60;
    }

    return s;
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

function updateRotation(rotationName) {
    request.get('https://github.com/StratusNetwork/data/raw/master/rotations/beta/' + rotationName.toLowerCase() + '.yml', function (error, response, body) {
        if (!error && response.statusCode == 200) {
            connection.query('TRUNCATE currentrot;');
            var rotation = yaml.safeLoad(body);
            rotation.maps.forEach(function (value) {
                connection.query('INSERT INTO currentrot (map_name) VALUES (\"' + value + '\");');
            });
        }
    });
}

function connect(bot) {
    bot.chatAddPattern(/<(?:\[[\w]+\] |[\W])?([\w\d_]+)>: (?:unixbox (.+)|(.+) unixbox)$/, 'cleverg', 'Cleverbot Global');
    bot.chatAddPattern(/\(Team\) (?:\[[\w]+\] |[\W])?([\w\d_]+): (?:unixbox (.+)|(.+) unixbox)$/, 'clevert', 'Cleverbot Team');
    bot.chatAddPattern(/<(?:\[[\w]+\] |[\W])?([\w\d_]+)>: (.*)$/, 'chat', 'chat global');
    bot.chatAddPattern(/\(Team\) (?:\[[\w]+\] |[\W])?([\w\d_]+): (.*)$/, 'chat', 'chat team');
    bot.chatAddPattern(/\[PM\] From (?:\[[\w]+\] |[\W])?([\w\d_]+): (.*)$/, 'whisper', 'Private Message');
    bot.chatAddPattern(/Current Rotation \(([a-zA-Z]+)\)/, 'rotcmd', 'Rotation');
    bot.chatAddPattern(/The time limit is (.+) with the result(?:.*?)/, 'tlcmd', 'Time limit');
    bot.chatAddPattern(/Next map: ([\w\d' :]+) by/, 'nextmapcmd', 'Next map');
    bot.chatAddPattern(/\[Mixed\] (.+) \((.*?)/, 'playerscmd', 'Players playing on Mixed');
    bot.chatAddPattern(/(?:[\w\d_]+) was(?:.*)by ([\w\d_]+) from ([\d]+) blocks$/, 'shotblocks', 'shot kill');
    bot.chatAddPattern(/Time: ([\d:]+).(?:[\d]+)$/, 'lengthmatch', 'length match');
    bot.chatAddPattern(/\(Team\) (?:\[[\w]+\] |[\W])?([\w\d_]+): alexa (.*)$/, 'alexacmd', 'alexa');
    bot.chatAddPattern(/Current: ([\w]+)$/, 'rotationchange', 'rotation change');

    bot.on('rotationchange', (username) => {
        connection.query("UPDATE currentmap SET Value = '" + username + "' WHERE id='6';");
        updateRotation(username);
    });
    bot.on('rotcmd', (username) => {
        connection.query("UPDATE currentmap SET Value = '" + username + "' WHERE id='6';");
        updateRotation(username);
    });
    bot.on('tlcmd', (username) => {
        connection.query("UPDATE currentmap SET Value = '" + username + "' WHERE id='4';");
    });
    bot.on('nextmapcmd', (username) => {
        connection.query('UPDATE currentmap SET Value = "' + username + '" WHERE id="5";');
    });
    bot.on('playerscmd', (username) => {
        connection.query("UPDATE currentmap SET Value = '" + username + "' WHERE id='8';");
    });
    setInterval(function () { bot.chat('/servers'); }, 5000);
    bot.on('alexacmd', (username, message) => {
        if (message.includes('prediction') == true && (cd.fire() || username == "unixfox")) {
            connection.query(
                "SELECT Value FROM currentmap WHERE id='7'",
                function (err, result, fields) {
                    bot.chat('The prediction of the match: ' + result[0]['Value'] + ' will probably win.');
                }
            );
        }
        else if (message.includes('despacito') == true && (cd.fire() || username == "unixfox"))
            bot.chat('ɴᴏᴡ ᴘʟᴀʏɪɴɢ: Luis Fonsi - Despacito ft. Daddy Yankee ─────────⚪───── ◄◄⠀▶⠀►►⠀ 1:35 / 4:41 ⠀ ───○ 🔊 ᴴᴰ ⚙️');
    });
    bot.on('shotblocks', (username, message) => {
        if (Number(message) > 100)
            bot.chat('/g Holy shot! What a long shot ' + username + " (" + message + " blocks)!");
        connection.query(
            "SELECT Value FROM facts WHERE id='2'",
            function (err, result, fields) {
                if (Number(message) > Number(result[0]['Value'])) {
                    connection.query(
                        "UPDATE `facts` SET `value`='" + message + "' WHERE  `id`=2;"
                    );
                    connection.query(
                        "UPDATE `facts` SET `value`='" + username + "' WHERE  `id`=3;"
                    );
                }
            }
        );
        connection.query(
            "SELECT Value FROM matchfacts WHERE id='1'",
            function (err, result, fields) {
                if (Number(message) > Number(result[0]['Value'])) {
                    connection.query(
                        "UPDATE `matchfacts` SET `value`='" + message + "' WHERE  `id`=1;"
                    );
                    connection.query(
                        "UPDATE `matchfacts` SET `value`='" + username + "' WHERE  `id`=2;"
                    );
                }
            }
        );
    });
    bot.on('message', (message) => {
        if (message.toAnsi().includes('No servers') == true || message.toAnsi().includes('Could not connect') == true) {
            setTimeout(function () { bot.chat('/server mixed'); }, 10000);
        }
        var text = message.toAnsi() + '\r\n';
        fs.appendFile('log', text);
    });
    bot.on('spawn', () => {
        connection.query('UPDATE currentmap SET Value = "' + "Default" + '" WHERE id="6";');
        updateRotation('default');
        bot.chat('/server mixed');
    });
    bot.on('respawn', () => {
        connection.query("UPDATE currentmap SET Value = '" + "No time limit" + "' WHERE `id` IN ('3','4');");
        bot.chat('/server mixed'); bot.chat('/rot'); bot.chat('/tl'); bot.chat('/next');
        bot.clearControlStates();
        setTimeout(function () { bot.setControlState('back', true); setTimeout(function () { bot.setControlState('back', false); }, 1000); }, 5000);
        bot._client.once('playerlist_header', (packet) => {
            if (JSON.parse(packet.header).extra[0].color)
                connection.query('UPDATE currentmap SET Value = "' + JSON.parse(packet.header).extra[0].extra[0].extra[0].extra[0].text + '" WHERE id="1";');
            else {
                bot._client.once('playerlist_header', (packet) => {
                    if (JSON.parse(packet.header).extra[0].color)
                        connection.query('UPDATE currentmap SET Value = "' + JSON.parse(packet.header).extra[0].extra[0].extra[0].extra[0].text + '" WHERE id="1";');
                });
            }
        });
    });
    bot.on('clevert', (username, match1, message = match1) => {
        if (username === bot.username) return
        var datetime = new Date();
        fs.appendFile('mentionlog', '[' + datetime + ']' + username + ' triggered cleverbot with: ' + message + '\r\n');
        request.post({
            headers: { 'content-type': 'application/x-www-form-urlencoded' },
            url: 'http://app.cleverbot.com/webservicexml_ais_AYA',
            body: "stimulus=" + message + "&sessionid=" + username + "&vtext8=&vtext6=&vtext5=&vtext4=%3F&vtext3=&vtext2=&icognoCheck=6fa999ff37ebaec6a5adddc5ecf96fb5&icognoID=cleverandroid"
        }, function (error, response, body) {
            if (!error && response.statusCode == 200) {
                var datetime = new Date();
                fs.appendFile('mentionlog', '[' + datetime + ']Cleverbot response for ' + username + ' : ' + libxmljs.parseXml(body).get('//response').text() + '\r\n');
                bot.chat(username + ' ' + libxmljs.parseXml(body).get('//response').text());
            }
        });
    });
    bot.on('cleverg', (username, match1, message = match1) => {
        if (username === bot.username) return
        var datetime = new Date();
        fs.appendFile('mentionlog', '[' + datetime + ']' + username + ' triggered cleverbot with: ' + message + '\r\n');
        request.post({
            headers: { 'content-type': 'application/x-www-form-urlencoded' },
            url: 'http://app.cleverbot.com/webservicexml_ais_AYA',
            body: "stimulus=" + message + "&sessionid=" + username + "&vtext8=&vtext6=&vtext5=&vtext4=%3F&vtext3=&vtext2=&icognoCheck=6fa999ff37ebaec6a5adddc5ecf96fb5&icognoID=cleverandroid"
        }, function (error, response, body) {
            if (!error && response.statusCode == 200) {
                var datetime = new Date();
                fs.appendFile('mentionlog', '[' + datetime + ']Cleverbot response for ' + username + ' : ' + libxmljs.parseXml(body).get('//response').text() + '\r\n');
                bot.chat('/g ' + username + ' ' + libxmljs.parseXml(body).get('//response').text());
            }
        });
    });
    bot.on('chat', (username, message) => {
        if (username === bot.username) return
        if (message.match(/(?:.*) unixbox (?:.*)/)) {
            var datetime = new Date();
            fs.appendFile('mentionlog', '[' + datetime + ']' + username + ' mentioned me in the chat: ' + message + '\r\n');
            bot.chat('/msg ' + username + ' Hi! I\'m a bot! I noticed that you mentioned me in the chat.');
            setTimeout(function () { bot.chat('/msg ' + username + ' I help track the statistics of the match for the Stratus Network Monitoring project! See more here: https://stratus.network/forums/topics/5b7b4498ba15960001003ef9'); }, 500);
        }
        else if (!message.includes('unixbox')) {
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
    bot._client.on('boss_bar', (packet) => {
        if (packet.health < 1)
            if (JSON.parse(packet.title).extra[0].extra[0].extra[0].text.includes('Remaining'))
                connection.query("UPDATE currentmap SET Value = '" + JSON.parse(packet.title).extra[0].extra[0].extra[1].extra[0].text + "' WHERE id='3';");
    });
    bot._client.on('playerlist_header', (packet) => {
        if (JSON.parse(packet.header).extra[0].color)
        {
            if (JSON.parse(packet.footer).extra[0].extra[3].extra[0].text == "00:00")
                connection.query("UPDATE currentmap SET Value = 'Computing...' WHERE id=7;");
            connection.query("UPDATE currentmap SET Value = '" + JSON.parse(packet.footer).extra[0].extra[3].extra[0].text + "' WHERE id='2';");
        }
    });
    /* bot._client.on('teams', (packet) => {
        new JefNode(packet).filter(function(node) {
            if (node.has('friendlyFire') && node.value.friendlyFire == 2 && node.value.mode == 0) {
                console.log(node.value);
                console.log('----------------------------------------------');
            }
        });
    }); */
    bot.on('whisper', (username, message, rawMessage) => {
        if (username === bot.username) return
        /* var res = new JefNode(bot.players).filter(function(node) {
            if (node.has('ping') && node.value.ping < 9999) {
                return node.value.username;
            }
        });
        console.log(res); */
        //console.log(bot.players['unixfox'].entity);
        //console.log(bot._client.players);
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
            connection.query("UPDATE currentmap SET Value = '" + JSON.parse(text).extra[0].extra[0].extra[0].text + "' WHERE id='7';");
            pusher.trigger('stratusgraphchannel', 'endmatch', {
                "message": "end"
            });
            var sentenses = ['Good job!', 'gg!', 'Great match!', 'Good game!', 'Nice match guys!', 'Great game!', 'Well played!', 'Nice job!'];
            var randomsentense = sentenses[Math.floor(Math.random() * sentenses.length)];
            connection.query(
                "SELECT Value FROM matchfacts WHERE id IN ('1','2')",
                function (err, result, fields) {
                    setTimeout(function () {
                        if (Number(result[0]['Value']) > 0)
                            bot.chat(randomsentense + " Best shot of the match by " + result[1]['Value'] + " from " + result[0]['Value'] + " blocks!");
                        connection.query("UPDATE matchfacts SET Value = '0' WHERE id='1';");
                    }, 3000);
                }
            );
            bot.chat('/match');
            bot.once('lengthmatch', (username) => {
                connection.query(
                    "SELECT Value FROM facts WHERE id='1'",
                    function (err, result, fields) {
                        if (Number(hmsToSecondsOnly(username)) > Number(result[0]['Value'])) {
                            connection.query(
                                "UPDATE `facts` SET `value`='" + hmsToSecondsOnly(username) + "' WHERE  `id`=1;"
                            );
                        }
                    }
                );
            });
        };
    });
    bot.on('kicked', (reason, loggedIn) => {
        console.log(reason);
        console.log(loggedIn);
    });
}

function getinfo(bot) {
    bot.chat('/rot'); bot.chat('/tl'); bot.chat('/servers'); bot.chat('/next');
}

function factsday(bot) {
    bot.chat('/g It\'s midnight (UTC), it\'s time for the facts of the last 24 hours everyone!');
    setTimeout(function () {
        connection.query(
            "SELECT Value FROM facts WHERE id IN ('1','2','3')",
            function (err, result, fields) {
                totalSeconds = Number(result[0]['Value']);
                hours = Math.floor(totalSeconds / 3600);
                totalSeconds %= 3600;
                minutes = Math.floor(totalSeconds / 60);
                seconds = totalSeconds % 60;
                if (hours == 0)
                    bot.chat('/g The length of the last 24 hours longest match was ' + minutes + " minute(s) and " + seconds + " second(s)" + "!");
                else
                    bot.chat('/g The length of the last 24 hours longest match was ' + hours + " hour(s), " + minutes + " minute(s) and " + seconds + " second(s)" + "!");
                bot.chat('/g The longest shot of the last 24 hours is awarded to ' + result[2]['Value'] + " with " + result[1]['Value'] + " blocks!");
            }
        );
    }, 5000);
}

var recursiveAsyncReadLine = function (bot, rl) {
    rl.question('', function (answer) {
        if (answer == 'exit')
            return rl.close();
        if (answer == 'info')
            getinfo(bot);
        if (answer == 'facts')
            factsday(bot);
        recursiveAsyncReadLine(bot, rl);
    });
};
