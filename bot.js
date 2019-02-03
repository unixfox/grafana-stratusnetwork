const mineflayer = require('mineflayer')
const tokens = require('prismarine-tokens')
const readline = require('readline');
const fs = require('fs');
const mysql = require('mysql2');
const Cooldown = require('cooldown');
const request = require('request');
const Pusher = require('pusher');
const JefNode = require('json-easy-filter').JefNode;
const yaml = require('js-yaml');
const express = require("express");
const app = express();
const schedule = require('node-schedule');
const mcstatus = require('minecraft-pinger');
const stripAnsi = require('strip-ansi');
const { parse, parseLines, stringify } = require('dot-properties');
const namedRegExp = require('named-regexp-groups');
const recastai = require('sapcai').default;
const build = new recastai.build(process.env.RECASTAI_TOKEN, 'en');
require('dotenv').config();

const Sentry = require('@sentry/node');
if (!process.env.dev)
    Sentry.init({ dsn: process.env.SENTRY_DNS });

var countreconnect = 0;
var cd = new Cooldown(20000);

var pusher = new Pusher({
    appId: process.env.pusher_appid,
    key: process.env.pusher_key,
    secret: process.env.pusher_secret,
    cluster: 'eu',
    encrypted: true
});

var options = {
    host: (process.env.MC_IP || process.argv[2]),
    port: (parseInt(process.env.MC_PORT) || parseInt(process.argv[3])),
    username: process.env.mc_user,
    password: process.env.mc_passwd,
    verbose: true,
    version: "1.12.2",
    tokensLocation: './bot_tokens.json',
    tokensDebug: true
};

const connection = mysql.createConnection({
    host: (process.env.mysql_host || 'localhost'),
    user: (process.env.mysql_user || 'grafana'),
    password: process.env.mysql_passwd,
    database: (process.env.mysql_database || 'stratusgraph'),
    port: (process.env.mysql_port || 3306),
    multipleStatements: true
});

var rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

var PGMDeathMessages;
request.get('https://github.com/StratusNetwork/projectares/raw/master/Commons/core/src/main/i18n/templates/pgm/PGMDeath.properties', function (error, response, body) {
    if (!error && response.statusCode == 200)
        PGMDeathMessages = parseLines(body);
});

tokens.use(options, function (_err, _opts) {
    if (_err) throw _err;
    var teams = {};
    var bot = mineflayer.createBot(_opts);
    var server = app.listen((process.env.PORT || 8080), function () {
        app.get("/teams", (req, res, next) => {
            res.json(teams);
        });
    });
    try {
        connect(bot, teams);
    }
    catch (err) {
        Sentry.captureException(err);
    }
    bot.on('error', function (err) {
        if (err.code == undefined) {
            console.log('Invalid credentials OR bot needs to wait because it relogged too quickly.');
        };
        process.exit();
    });
    bot.on('end', function () {
        console.log("Bot has ended");
        server.close();
        process.exit();
    });
});

function hmsToSecondsOnly(str) {
    var p = str.split(':'),
        s = 0, m = 1;

    while (p.length > 0) {
        s += m * parseInt(p.pop(), 10);
        m *= 60;
    }

    return s;
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

function sendToChat(bot, message) {
    if (process.env.dev)
        console.log("CHATLOG: " + message);
    else
        bot.chat(message);
}

function removeArray(arr) {
    var what, a = arguments, L = a.length, ax;
    while (L > 1 && arr.length) {
        what = a[--L];
        while ((ax = arr.indexOf(what)) !== -1) {
            arr.splice(ax, 1);
        }
    }
    return arr;
}

function removeSectionSign(string) {
    const codes = [
        '§0',
        '§1',
        '§2',
        '§3',
        '§4',
        '§5',
        '§6',
        '§7',
        '§8',
        '§9',
        '§a',
        '§b',
        '§c',
        '§d',
        '§e',
        '§f',
        '§l',
        '§o',
        '§n',
        '§m',
        '§k',
        '§r',
    ];

    let message = string;
    for (i in codes) {
        message = message.replace(new RegExp(codes[i], 'g'), '');
    }
    return message;
}

function PGMDeathMessagesMatchKill(message) {
    for (var i = 0; j = PGMDeathMessages.length, i < j; i++) {
        if (PGMDeathMessages[i][1] && !PGMDeathMessages[i][0].includes('#'))
            if (!PGMDeathMessages[i][1].includes('{3}') && !PGMDeathMessages[i][1].includes('predicted')) {
                regex = new namedRegExp(RegExp(PGMDeathMessages[i][1].replace('{0}', '(:<victimName>[\\w\\d_]+)').replace('{1}', '(:<killerName>[\\w\\d_]+)').replace('{2}', '(:<weapon>.+)').replace('{4}', '(:<distanceBlocks>[\\d]+)')));
                if (regex.exec(message))
                    return (regex.exec(message));
            }
    }
}

setInterval(function () {
    mcstatus.ping('play.stratus.network', 25565, (error, result) => {
        if (error) return
        connection.query("UPDATE serverinfo SET Value = '" + result.players.online + "/" + result.players.max + "' WHERE id='1';");
    });
}, 5000);

function connect(bot, teams) {
    bot.chatAddPattern(/^<(?:\[[\w]+\] |[\W]|[\W]\[[\w]+\])?([\w\d_]+)>: (.*)$/, 'chat', 'chat global');
    bot.chatAddPattern(/^\(Team\) (?:\[[\w]+\] |[\W]|[\W]\[[\w]+\])?([\w\d_]+): (.*)$/, 'chat', 'chat team');
    bot.chatAddPattern(/^\[PM\] From (?:\[[\w]+\] |[\W]|[\W]\[[\w]+\])?([\w\d_]+): (.*)$/, 'whisper', 'Private Message');
    bot.chatAddPattern(/Current Rotation \(([a-zA-Z]+)\)/, 'rotcmd', 'Rotation');
    bot.chatAddPattern(/^The time limit is (.+) with the result(?:.*?)/, 'tlcmd', 'Time limit');
    bot.chatAddPattern(/\[Mixed\] (.+) \((.*?)/, 'playerscmd', 'Players playing on Mixed');
    bot.chatAddPattern(/^(?:[\w\d_]+) was(?:.*)by ([\w\d_]+) from ([\d]+) blocks$/, 'shotblocks', 'shot kill');
    bot.chatAddPattern(/^Time: ([\d:]+).(?:[\d]+)$/, 'lengthmatch', 'length match');
    bot.chatAddPattern(/\(Team\) (?:\[[\w]+\] |[\W]|[\W]\[[\w]+\])?([\w\d_]+): alexa (.*)$/, 'alexacmd', 'alexa');
    bot.chatAddPattern(/^Current: ([\w]+)$/, 'rotationchange', 'rotation change');
    bot.chatAddPattern(/^\+(?:[\d]) Droplet(?:.*)$/, 'droplet', 'someone gave droplet');
    bot.chatAddPattern(/^You are currently on \[Lobby\]$/, 'connectedlobby', 'bot currently on Lobby');
    bot.chatAddPattern(/^The match has started!$/, 'matchstarted', 'the match just started');
    bot.chatAddPattern(/^Game over!$/, 'tiematch', 'tie match');
    bot.chatAddPattern(/^(?:\[[\w]+\] |[\W]|[\W]\[[\w]+\])?([\w\d_]+) (?:wins|win|winners)!$/, 'matchwin', 'end of the match');
    bot.chatAddPattern(/^Server restarting!$/, 'serverrestart', 'Server is restarting');
    bot._client.on('success', (packet) => {
        bot.chatAddPattern(RegExp("^<(?:\\[[\\w]+\\] |[\\W]|[\\W]\\[[\\w]+\\])?([\\w\\d_]+)>: (?:username (.+)|(.+) username)$".replace(/username/g, bot.username)), 'askg', 'Ask Global');
        bot.chatAddPattern(RegExp("^\\(Team\\) (?:\\[[\\w]+\\] |[\\W]|[\\W]\\[[\\w]+\\])?([\\w\\d_]+): (?:username (.+)|(.+) username)$".replace(/username/g, bot.username)), 'askt', 'Ask Team');
    });

    cdPing = new Cooldown(5000);
    cdDroplet = new Cooldown(30000);

    bot.on('droplet', () => {
        if (cd.fire())
            sendToChat(bot, 'Thank you for the droplet(s) <3!');
    });

    bot.once('serverrestart', () => {
        setTimeout(function () { sendToChat(bot, 'TIP: To avoid the lag spike during the restart do /lobby before the restart of the server!'); }, 5000);
    });

    bot.on('windowOpen', (window) => {
        if (window.title.includes('Navigator')) {
            const windowSlotsFiltered = window.slots.filter(function (el) {
                return el != null;
            });
            if (windowSlotsFiltered.filter(slots => slots.name === "spectral_arrow")[0]) {
                const windowSlotsArrowDisplayValuesFiltered = windowSlotsFiltered.filter(slots => slots.name === "spectral_arrow")[0].
                    nbt.value.display.value.Lore.value.value.filter(function (el) {
                        return el != "";
                    });
                windowSlotsArrowDisplayValuesFiltered.forEach(element => {
                    if (element.includes('Map'))
                        connection.query('UPDATE currentmap SET Value = "' + removeSectionSign(element).match(RegExp(/^Map: (.*)$/))[1] + '" WHERE id="1";');
                    else if (element.includes('Next'))
                        connection.query('UPDATE currentmap SET Value = "' + removeSectionSign(element).match(RegExp(/^Next: (.*)$/))[1] + '" WHERE id="5";');
                });
            }
        }
        bot.setQuickBarSlot('0');
    });

    bot.on('matchwin', (username) => {
        if (username)
            connection.query("UPDATE currentmap SET Value = '" + username + "' WHERE id='7';");
        if (!process.env.dev)
            pusher.trigger('stratusgraphchannel', 'endmatch', {
                "message": "end"
            });
        var sentenses = ['Good job!', 'gg!', 'Great match!', 'Good game!', 'Nice match guys!', 'Great game!', 'Well played!', 'Nice job!'];
        var randomsentense = sentenses[Math.floor(Math.random() * sentenses.length)];
        connection.query(
            "SELECT Value FROM matchfacts WHERE id IN ('1','2');" +
            "SELECT player, kills FROM matchkillsdeaths ORDER BY kills DESC LIMIT 1;" +
            "SELECT player, deaths FROM matchkillsdeaths ORDER BY deaths DESC LIMIT 1;",
            function (err, result, fields) {
                setTimeout(function () {
                    if (Number(result[0][0]['Value']) > 0)
                        sendToChat(bot, randomsentense + " Longest kill shot by " + result[0][1]['Value'] + " from " + result[0][0]['Value'] + " blocks! " +
                            "The top killer is " + result[1][0]['player'] + " with " + result[1][0]['kills'] + " kills! " +
                            result[2][0]['player'] + " died the most with " + result[2][0]['deaths'] + " deaths.");
                    else if (result[1][0] || result[2][0])
                        sendToChat(bot, randomsentense + " " + "The top killer is " + result[1][0]['player'] + " with " + result[1][0]['kills'] + " kills! " +
                            result[2][0]['player'] + " died the most with " + result[2][0]['deaths'] + " deaths.");
                    connection.query("UPDATE matchfacts SET Value = '0' WHERE id='1';");
                }, 4000);
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
    });

    bot.on('tiematch', () => {
        connection.query("UPDATE currentmap SET Value = 'Tie match' WHERE id='7';");
        if (!process.env.dev)
            pusher.trigger('stratusgraphchannel', 'endmatch', {
                "message": "end"
            });
        connection.query(
            "SELECT Value FROM matchfacts WHERE id IN ('1','2');" +
            "SELECT player, kills FROM matchkillsdeaths ORDER BY kills DESC LIMIT 1;" +
            "SELECT player, deaths FROM matchkillsdeaths ORDER BY deaths DESC LIMIT 1;",
            function (err, result, fields) {
                setTimeout(function () {
                    if (Number(result[0][0]['Value']) > 0)
                        sendToChat(bot, "What a tie! Longest kill shot by " + result[0][1]['Value'] + " from " + result[0][0]['Value'] + " blocks! " +
                            "The top killer is " + result[1][0]['player'] + " with " + result[1][0]['kills'] + " kills! " +
                            result[2][0]['player'] + " died the most with " + result[2][0]['deaths'] + " deaths.");
                    else if (result[1][0] || result[2][0])
                        sendToChat(bot, "What a tie! The top killer is " + result[1][0]['player'] + " with " + result[1][0]['kills'] + " kills! " +
                            result[2][0]['player'] + " died the most with " + result[2][0]['deaths'] + " deaths.");
                    connection.query("UPDATE matchfacts SET Value = '0' WHERE id='1';");
                }, 4000);
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
    });

    bot.on('matchstarted', () => {
        connection.query("TRUNCATE matchkillsdeaths;");
        connection.query("UPDATE currentmap SET Value = 'Computing...' WHERE id=7;");
    });

    bot.on('message', (jsonMsg) => {
        const deathMessage = PGMDeathMessagesMatchKill(stripAnsi(jsonMsg.toAnsi()));
        if (deathMessage) {
            if (deathMessage.groups.killerName)
                connection.query(
                    "SELECT kills FROM matchkillsdeaths WHERE player = '" + deathMessage.groups.killerName + "'",
                    function (err, result, fields) {
                        if (result[0]) {
                            connection.query("UPDATE matchkillsdeaths SET kills = '" + (result[0]['kills'] + 1) + "' WHERE player='" + deathMessage.groups.killerName + "';");
                        }
                        else if (!result[0]) {
                            connection.query('INSERT INTO matchkillsdeaths (player) VALUES (\"' + deathMessage.groups.killerName + '\");');
                            connection.query("UPDATE matchkillsdeaths SET kills = '1' WHERE player='" + deathMessage.groups.killerName + "';");
                        }
                    }
                );
            if (deathMessage.groups.victimName)
                connection.query(
                    "SELECT deaths FROM matchkillsdeaths WHERE player = '" + deathMessage.groups.victimName + "'",
                    function (err, result, fields) {
                        if (result[0]) {
                            connection.query("UPDATE matchkillsdeaths SET deaths = '" + (result[0]['deaths'] + 1) + "' WHERE player='" + deathMessage.groups.victimName + "';");
                        }
                        else if (!result[0]) {
                            connection.query('INSERT INTO matchkillsdeaths (player) VALUES (\"' + deathMessage.groups.victimName + '\");');
                            connection.query("UPDATE matchkillsdeaths SET deaths = '1' WHERE player='" + deathMessage.groups.victimName + "';");
                        }
                    }
                );
        }
    });

    const cron = schedule.scheduleJob('0 0 * * *', function () {
        factsday(bot);
    });

    bot.on('connectedlobby', (username) => {
        console.log('Attempting to reconnect to mixed server...');
        bot.chat('/server mixed');
        setTimeout(function () { bot.chat('/server'); }, 5000);
    });
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
    setInterval(function () {
        numberOfPlayers = 0;
        numberOfObservers = 0;
        Object.keys(teams).forEach(function (k) {
            if (k != "Observers")
                numberOfPlayers += teams[k].length;
            else {
                numberOfObservers += teams[k].length;
            }
        });
        connection.query("UPDATE currentmap SET Value = '" + numberOfPlayers + "(" + numberOfObservers + ")' WHERE id='8';");
    }, 5000);
    bot.on('alexacmd', (username, message) => {
        if (message.includes('prediction') == true && (cd.fire() || username == "unixfox")) {
            connection.query(
                "SELECT Value FROM currentmap WHERE id='7'",
                function (err, result, fields) {
                    sendToChat(bot, 'The prediction of the match: ' + result[0]['Value'] + ' will probably win.');
                }
            );
        }
    });
    bot.on('shotblocks', (username, message) => {
        if (Number(message) > 100)
            sendToChat(bot, '/g Holy shot! What a lovely long shot ' + username + " (" + message + " blocks)!");
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
    //bot.on('message', (message) => {
    //    var text = message.toAnsi() + '\r\n';
    //    console.log(text);
    //});
    bot.on('spawn', () => {
        connection.query('UPDATE currentmap SET Value = "' + "Default" + '" WHERE id="6";');
        updateRotation('default');
        bot.chat('/server mixed');
        setTimeout(function () { bot.chat('/server'); }, 5000);
    });
    bot.on('respawn', () => {
        setTimeout(function () { bot.setQuickBarSlot('7'); bot.activateItem(); }, 5000); // 5 seconds because we are too quick for the server
        connection.query("UPDATE currentmap SET Value = '" + "No time limit" + "' WHERE `id` IN ('3','4');");
        bot.chat('/server mixed'); bot.chat('/rot'); bot.chat('/tl'); bot.chat('/next');
        setTimeout(function () { bot.chat('/server'); }, 5000);
        bot.clearControlStates();
        setTimeout(function () { bot.setControlState('back', true); setTimeout(function () { bot.setControlState('back', false); }, 1000); }, 5000);
    });
    bot.on('askt', (username, match1, message = match1) => {
        if (username === bot.username) return
        var blacklistUsernames = fs.readFileSync('blacklist', 'utf8');
        if (blacklistUsernames.includes(username)) return
        var datetime = new Date();
        fs.appendFile('mentionlog', '[' + datetime + ']' + username + ' asked: ' + message + '\r\n');
        build.dialog({ type: 'text', content: message }, { conversationId: username })
            .then(function (res) {
                datetime = new Date();
                fs.appendFile('mentionlog', '[' + datetime + '] response for ' + username + ' : ' + res.messages[0].content + '\r\n');
                sendToChat(bot, username + ' ' + res.messages[0].content);
            });
    });
    bot.on('askg', (username, match1, message = match1) => {
        if (username === bot.username) return
        var blacklistUsernames = fs.readFileSync('blacklist', 'utf8');
        if (blacklistUsernames.includes(username)) return
        var datetime = new Date();
        fs.appendFile('mentionlog', '[' + datetime + ']' + username + ' asked: ' + message + '\r\n');
        build.dialog({ type: 'text', content: message }, { conversationId: username })
            .then(function (res) {
                datetime = new Date();
                fs.appendFile('mentionlog', '[' + datetime + '] response for ' + username + ' : ' + res.messages[0].content + '\r\n');
                if (!teams.Observers || teams.Observers.includes(username) == true)
                    sendToChat(bot, username + ' ' + res.messages[0].content);
                else
                    sendToChat(bot, '/g ' + username + ' ' + res.messages[0].content);
            });
    });
    bot.on('chat', (username, message) => {
        if (username === bot.username) return
        if (message.match(RegExp("(?:.*) username (?:.*)".replace(/username/g, bot.username)))) {
            var datetime = new Date();
            fs.appendFile('mentionlog', '[' + datetime + ']' + username + ' mentioned me in the chat: ' + message + '\r\n');
            sendToChat(bot, '/msg ' + username + ' Hi! I\'m a bot! I noticed that you mentioned me in the chat.');
            setTimeout(function () { sendToChat(bot, '/msg ' + username + ' I help track the statistics of the match for the Stratus Network Monitoring project! See more here: https://stratus.network/forums/topics/5b7b4498ba15960001003ef9'); }, 500);
        }
        else if (!message.includes(bot.username)) {
            bot.clearControlStates();
            if (bot.blockAt(bot.entity.position.offset(0, -2, 0)) != null)
                if (bot.blockAt(bot.entity.position.offset(0, -2, 0)).name)
                    if (!teams.Observers || (bot.blockAt(bot.entity.position.offset(0, -2, 0)).name == "air" || bot.canDigBlock(bot.blockAt(bot.entity.position.offset(0, -1, 0))) == false) && teams.Observers.includes(username) == false)
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
                    if (!target || !target.position) return
                    bot.lookAt(target.position.offset(0, target.height, 0));
                };
            }
        }
    });
    bot._client.on('game_state_change', (packet) => {
        if (packet.reason == 3 && packet.gameMode == 0)
            bot.chat('/join obs');
    });
    bot._client.on('boss_bar', (packet) => {
        if (packet.health < 1)
            if (JSON.parse(packet.title).extra[0].extra[0].extra[0].text.includes('Remaining'))
                connection.query("UPDATE currentmap SET Value = '" + JSON.parse(packet.title).extra[0].extra[0].extra[1].extra[0].text + "' WHERE id='3';");
    });
    bot._client.on('playerlist_header', (packet) => {
        if (JSON.parse(packet.header).extra[0].color)
            connection.query("UPDATE currentmap SET Value = '" + JSON.parse(packet.footer).extra[0].extra[3].extra[0].text + "' WHERE id='2';");
    });
    bot._client.on('teams', (packet) => {
        new JefNode(packet).filter(function (node) {
            if (node.has('team'))
                if (node.value.team.includes('TabView') == false && node.value.team.includes('pgm') == false && node.value.team.includes('Participants') == false) {
                    if (node.value.mode == 0)
                        teams[node.value.team] = node.value.players;
                    else if (node.value.mode == 1)
                        delete teams[node.value.team];
                    else if (node.value.mode == 3)
                        teams[node.value.team].push(node.value.players[0]);
                    else if (node.value.mode == 4 && Object.keys(teams).length > 0)
                        removeArray(teams[node.value.team], node.value.players[0]);
                }
        });
    });
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
        else {
            var datetime = new Date();
            fs.appendFile('mentionlog', '[' + datetime + ']Received a PM from ' + username + ' : ' + message + '\r\n');
            bot.chat('/msg ' + username + ' Hi! I\'m a bot!');
            setTimeout(function () { bot.chat('/msg ' + username + ' I help track the statistics of the match for the Stratus Network Monitoring project! See more here: https://stratus.network/forums/topics/5b7b4498ba15960001003ef9'); }, 500);
        }
    });
    bot.on('kicked', (reason, loggedIn) => {
        console.log(reason);
        console.log(loggedIn);
    });
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
                connection.query("UPDATE facts SET value = '1';");
            }
        );
    }, 5000);
}