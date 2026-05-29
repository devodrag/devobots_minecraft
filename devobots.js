const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const readline = require('readline');
const fs = require('fs');

const P = '\x1b[38;2;160;32;240m';
const W = '\x1b[38;2;255;255;255m';
const R = '\x1b[0m';

const CONFIG = {
    version: '1.8.9',
    connectDelay: 0.5,
    telegramToken: 'YOUR_TELEGRAM_BOT_TOKEN',
    adminId: 123456789
};

const ACCOUNTS_FILE = './accounts.json';
let accounts = [];
let activeBots = [];

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

if (fs.existsSync(ACCOUNTS_FILE)) {
    accounts = JSON.parse(fs.readFileSync(ACCOUNTS_FILE, 'utf8'));
} else {
    fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify([]));
}

function saveAccounts() {
    fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(accounts, null, 2));
}

let tgBot = null;
if (CONFIG.telegramToken && CONFIG.telegramToken !== 'YOUR_TELEGRAM_BOT_TOKEN') {
    const TelegramBot = require('node-telegram-bot-api');
    tgBot = new TelegramBot(CONFIG.telegramToken, { polling: true });
    setupTelegramHandlers();
}

function drawHeader() {
    console.clear();
    console.log(`${P}==========================================${R}`);
    console.log(`${W}   DevoBots v1.5 [Terminal + Telegram]    ${R}`);
    console.log(`${P}==========================================${R}\n`);
}

function showMenu() {
    drawHeader();
    console.log(`${W}Текущая версия: ${P}${CONFIG.version}${R} | Задержка подключения: ${P}${CONFIG.connectDelay} сек.${R}`);
    console.log(`${W}Всего аккаунтов: ${P}${accounts.length}${R}`);
    console.log(`${W}Активных ботов на сервере: ${P}${activeBots.length}${R}\n`);
    
    console.log(`${P}1.${R} ${W}Добавить аккаунт${R}`);
    console.log(`${P}2.${R} ${W}Удалить аккаунт${R}`);
    console.log(`${P}3.${R} ${W}Запустить всех ботов${R}`);
    console.log(`${P}4.${R} ${W}Остановить всех ботов${R}`);
    console.log(`${P}5.${R} ${W}Написать в чат / Команды DevoClient (со ВСЕХ)${R}`);
    console.log(`${P}6.${R} ${W}Написать в чат / Команды DevoClient (с ОДНОГО)${R}`);
    console.log(`${P}7.${R} ${W}Изменить версию ботов${R}`);
    console.log(`${P}8.${R} ${W}Изменить задержку подключения${R}`);
    console.log(`${P}9.${R} ${W}Выйти из программы${R}\n`);
    
    rl.question(`${W}Выбери действие: ${P}`, (answer) => {
        handleMenu(answer.trim());
    });
}

function handleMenu(choice) {
    switch(choice) {
        case '1':
            rl.question(`${W}Введи ник для нового бота: ${P}`, (name) => {
                if(name && !accounts.includes(name)) {
                    accounts.push(name);
                    saveAccounts();
                    console.log(`${P}[+] ${W}Аккаунт ${name} добавлен.${R}`);
                }
                setTimeout(showMenu, 1000);
            });
            break;
        case '2':
            console.log(`${W}Список аккаунтов:${R}`);
            accounts.forEach((acc, i) => console.log(`${P}${i + 1}.${R} ${W}${acc}${R}`));
            rl.question(`${W}Введи номер аккаунта для удаления: ${P}`, (num) => {
                const index = parseInt(num) - 1;
                if (index >= 0 && index < accounts.length) {
                    const removed = accounts.splice(index, 1);
                    saveAccounts();
                    console.log(`${P}[-] ${W}Аккаунт ${removed} удален.${R}`);
                }
                setTimeout(showMenu, 1500);
            });
            break;
        case '3':
            if (accounts.length === 0) {
                console.log(`${P}[!] ${W}Нет аккаунтов для запуска!${R}`);
                setTimeout(showMenu, 1500);
                return;
            }
            rl.question(`${W}Введи IP сервера (например, localhost): ${P}`, (ipInput) => {
                let [host, port] = ipInput.split(':');
                port = port ? parseInt(port) : 25565;
                startAllBots(host, port);
            });
            break;
        case '4':
            stopAllBots();
            console.log(`${P}[!] ${W}Все боты остановлены.${R}`);
            setTimeout(showMenu, 1500);
            break;
        case '5':
            if (activeBots.length === 0) {
                console.log(`${P}[!] ${W}Нет активных ботов на сервере!${R}`);
                setTimeout(showMenu, 1500);
                return;
            }
            rl.question(`${W}Сообщение или команда (!devo / #baritone): ${P}`, (msg) => {
                processCommand(msg, null);
                setTimeout(showMenu, 2000);
            });
            break;
        case '6':
            if (activeBots.length === 0) {
                console.log(`${P}[!] ${W}Сначала запусти ботов!${R}`);
                setTimeout(showMenu, 1500);
                return;
            }
            activeBots.forEach((b, i) => console.log(`${P}${i + 1}.${R} ${W}${b.username}${R}`));
            rl.question(`${W}Выбери номер бота: ${P}`, (num) => {
                const idx = parseInt(num) - 1;
                if (idx >= 0 && idx < activeBots.length) {
                    rl.question(`${W}Сообщение от ${activeBots[idx].username}: ${P}`, (msg) => {
                        processCommand(msg, activeBots[idx]);
                        setTimeout(showMenu, 2000);
                    });
                } else {
                    setTimeout(showMenu, 1000);
                }
            });
            break;
        case '7':
            rl.question(`${W}Введи новую версию (например, 1.16.5): ${P}`, (ver) => {
                if (ver.trim()) {
                    CONFIG.version = ver.trim();
                    console.log(`${P}[*] ${W}Версия ботов изменена на: ${CONFIG.version}${R}`);
                }
                setTimeout(showMenu, 1500);
            });
            break;
        case '8':
            rl.question(`${W}Введи задержку подключения в сек (например, 3): ${P}`, (delay) => {
                const parsedDelay = parseFloat(delay);
                if (!isNaN(parsedDelay) && parsedDelay >= 0) {
                    CONFIG.connectDelay = parsedDelay;
                    console.log(`${P}[*] ${W}Задержка изменена на: ${CONFIG.connectDelay} сек.${R}`);
                }
                setTimeout(showMenu, 1500);
            });
            break;
        case '9':
            stopAllBots();
            console.log(`${P}Выход из DevoBots...${R}`);
            process.exit(0);
            break;
        default:
            showMenu();
    }
}

function startAllBots(host, port) {
    console.log(`${P}[*] ${W}Запуск ботов на ${host}:${port}...${R}`);
    sendTgNotification(`🚀 Запуск ботов на ${host}:${port} (Версия: ${CONFIG.version})`);
    
    accounts.forEach((username, index) => {
        setTimeout(() => {
            if (activeBots.some(b => b.username === username)) return;

            const bot = mineflayer.createBot({
                host: host,
                port: port,
                username: username,
                auth: 'offline',
                version: CONFIG.version,
                connectTimeout: 15000
            });

            bot.loadPlugin(pathfinder);

            bot.on('spawn', () => {
                if (!activeBots.some(b => b.username === bot.username)) {
                    activeBots.push(bot);
                    console.log(`${P}[+] ${W}Бот ${bot.username} зашел на сервер!${R}`);
                    sendTgNotification(`✅ Бот ${bot.username} успешно зашел!`);
                }
            });

            bot.on('error', (err) => {
                console.log(`${P}[ERROR] ${W}${username}: ${err.message}${R}`);
                sendTgNotification(`❌ Ошибка ${username}: ${err.message}`);
                destroyBot(bot, username);
            });

            bot.on('kicked', (reason) => {
                console.log(`${P}[KICK] ${W}${username} кикнут: ${reason}${R}`);
                sendTgNotification(`🚪 Бот ${username} кикнут сервером.`);
                destroyBot(bot, username);
            });
            
        }, index * (CONFIG.connectDelay * 1000));
    });

    setTimeout(showMenu, 1500);
}

function destroyBot(bot, username) {
    if (bot) {
        try { bot.quit(); } catch(e) {}
        bot.removeAllListeners();
    }
    activeBots = activeBots.filter(b => b.username !== username);
}

function stopAllBots() {
    activeBots.forEach(bot => {
        try { bot.quit(); } catch(e) {}
        bot.removeAllListeners();
    });
    activeBots = [];
    sendTgNotification(`🛑 Все боты принудительно отключены.`);
}

function processCommand(message, specificBot, viaTelegram = false) {
    const msgTrimmed = message.trim();

    if (msgTrimmed.startsWith('!devo')) {
        handleDevoCommand(msgTrimmed, viaTelegram);
        return; 
    }

    const botsToUse = specificBot ? [specificBot] : activeBots;

    botsToUse.forEach(bot => {
        if (msgTrimmed.startsWith('#baritone ') || msgTrimmed.startsWith('.baritone ')) {
            const args = msgTrimmed.split(' ').slice(1);
            const cmd = args[0].toLowerCase();

            if (cmd === 'goto' && args.length === 4) {
                const x = parseInt(args[1]);
                const y = parseInt(args[2]);
                const z = parseInt(args[3]);
                const defaultMove = new Movements(bot);
                bot.pathfinder.setMovements(defaultMove);
                bot.pathfinder.setGoal(new goals.GoalBlock(x, y, z));
                const txt = `[Baritone] ${bot.username} идет на координаты ${x} ${y} ${z}`;
                console.log(`${P}${txt}${R}`);
                if (viaTelegram) sendTgNotification(txt);
            } 
            else if (cmd === 'stop') {
                bot.pathfinder.setGoal(null);
                const txt = `[Baritone] ${bot.username} остановился.`;
                console.log(`${P}${txt}${R}`);
                if (viaTelegram) sendTgNotification(txt);
            }
        } else {
            bot.chat(msgTrimmed);
            console.log(`${P}[CHAT] ${W}${bot.username} -> ${msgTrimmed}${R}`);
        }
    });
}

function handleDevoCommand(message, viaTelegram = false) {
    const args = message.split(/\s+/);
    
    if (args.length === 1) {
        if (viaTelegram) {
            sendTgNotification(`ℹ️ Доступные команды спама:\n!devo spam all (кол-во) (текст)\n!devo spam (номер_бота) (кол-во) (текст)`);
        } else {
            printDevoHelp();
        }
        return;
    }

    const subCmd = args[1].toLowerCase();

    if (subCmd === 'spam') {
        const target = args[2]; 
        const count = parseInt(args[3]);
        const spamMessage = args.slice(4).join(' ');

        if (!target || isNaN(count) || count <= 0 || !spamMessage) {
            const err = `❌ Ошибка! Пример: !devo spam all 5 ку`;
            if (viaTelegram) sendTgNotification(err); else console.log(err);
            return;
        }

        if (target.toLowerCase() === 'all') {
            executeSpamFlow(activeBots, count, spamMessage, viaTelegram);
        } else {
            const idx = parseInt(target) - 1;
            if (idx >= 0 && idx < activeBots.length) {
                executeSpamFlow([activeBots[idx]], count, spamMessage, viaTelegram);
            } else {
                const err = `❌ Активный бот №${target} не найден!`;
                if (viaTelegram) sendTgNotification(err); else console.log(err);
            }
        }
    }
}

function executeSpamFlow(botsArray, totalCount, text, viaTelegram) {
    let currentIteration = 0;
    const startTxt = `⚡ Запущен спам-поток (${totalCount} сообщений)...`;
    if (viaTelegram) sendTgNotification(startTxt); else console.log(startTxt);
    
    const stream = setInterval(() => {
        if (currentIteration >= totalCount || activeBots.length === 0) {
            clearInterval(stream);
            const endTxt = `🏁 Спам-поток успешно завершен.`;
            if (viaTelegram) sendTgNotification(endTxt); else console.log(endTxt);
            return;
        }

        botsArray.forEach(bot => {
            if (activeBots.some(b => b.username === bot.username)) {
                bot.chat(text);
            }
        });

        currentIteration++;
    }, 100);
}

function printDevoHelp() {
    console.log(`\n${P}================ DEVOCLIENT HELP MENU ================${R}`);
    console.log(`${P}!devo${R}                                   ${W}- Открыть это меню хелпа в консоли${R}`);
    console.log(`${P}!devo spam all (кол-во) (текст)${R}         ${W}- Запустить спам со ВСЕХ запущенных ботов${R}`);
    console.log(`${P}!devo spam (номер_бота) (кол-во) (текст)${R} ${W}- Запустить спам только с указанного бота${R}`);
    console.log(`${P}======================================================${R}\n`);
}

function setupTelegramHandlers() {
    tgBot.on('message', (msg) => {
        if (msg.from.id !== CONFIG.adminId) {
            tgBot.sendMessage(msg.chat.id, `🔒 Доступ заблокирован для вашего ID (${msg.from.id}).`);
            return;
        }

        const text = msg.text ? msg.text.trim() : '';
        if (!text) return;

        if (text.startsWith('/add ')) {
            const name = text.replace('/add ', '').trim();
            if (name && !accounts.includes(name)) {
                accounts.push(name);
                saveAccounts();
                tgBot.sendMessage(msg.chat.id, `➕ Аккаунт **${name}** добавлен.`);
            }
        }
        else if (text.startsWith('/del ')) {
            const idx = parseInt(text.replace('/del ', '').trim()) - 1;
            if (idx >= 0 && idx < accounts.length) {
                const removed = accounts.splice(idx, 1);
                saveAccounts();
                tgBot.sendMessage(msg.chat.id, `➖ Аккаунт **${removed}** удален.`);
            } else {
                tgBot.sendMessage(msg.chat.id, `❌ Неверный номер.`);
            }
        }
        else if (text.startsWith('/version ')) {
            CONFIG.version = text.replace('/version ', '').trim();
            tgBot.sendMessage(msg.chat.id, `⚙️ Версия ботов изменена на: **${CONFIG.version}**`);
        }
        else if (text.startsWith('/delay ')) {
            const delay = parseFloat(text.replace('/delay ', '').trim());
            if (!isNaN(delay) && delay >= 0) {
                CONFIG.connectDelay = delay;
                tgBot.sendMessage(msg.chat.id, `⏳ Задержка изменена на: **${CONFIG.connectDelay}** сек.`);
            }
        }
        else if (text.startsWith('/startall ')) {
            const ip = text.replace('/startall ', '').trim();
            let [host, port] = ip.split(':');
            port = port ? parseInt(port) : 25565;
            startAllBots(host, port);
        }
        else if (text.startsWith('/msg ')) {
            const cmdText = text.replace('/msg ', '').trim();
            if (activeBots.length === 0) return tgBot.sendMessage(msg.chat.id, `❌ Нет активных ботов.`);
            processCommand(cmdText, null, true);
        }
        else if (text.startsWith('/msgone ')) {
            if (activeBots.length === 0) return tgBot.sendMessage(msg.chat.id, `❌ Нет active ботов.`);
            const raw = text.replace('/msgone ', '').trim().split(' ');
            const idx = parseInt(raw[0]) - 1;
            const cmdText = raw.slice(1).join(' ');
            if (idx >= 0 && idx < activeBots.length && cmdText) {
                processCommand(cmdText, activeBots[idx], true);
            } else {
                tgBot.sendMessage(msg.chat.id, `❌ Ошибка ввода или неверный номер бота.`);
            }
        }
    });

    tgBot.onText(/\/start|\/menu/, (msg) => {
        if (msg.from.id !== CONFIG.adminId) return;
        sendTgMenu(msg.chat.id);
    });

    tgBot.on('callback_query', (query) => {
        if (query.from.id !== CONFIG.adminId) return;
        const chatId = query.message.chat.id;

        if (query.data === 'status') {
            let list = `📋 **Статус DevoBots:**\n`;
            list += `• Версия: \`${CONFIG.version}\`\n`;
            list += `• Задержка: \`${CONFIG.connectDelay} сек.\`\n`;
            list += `• Всего ников в базе: \`${accounts.length}\`\n`;
            list += `• Онлайн ботов: \`${activeBots.length}\`\n\n`;
            if (activeBots.length > 0) {
                list += `🟢 **Боты в сети:**\n`;
                activeBots.forEach((b, i) => list += `${i + 1}. \`${b.username}\`\n`);
            }
            tgBot.sendMessage(chatId, list, { parse_mode: 'Markdown' });
        }
        else if (query.data === 'stop_all') {
            stopAllBots();
        }
        
        tgBot.answerCallbackQuery(query.id);
    });
}

function sendTgMenu(chatId) {
    const opts = {
        reply_markup: {
            inline_keyboard: [
                [{ text: '📊 Показать статус и инфо', callback_data: 'status' }],
                [{ text: '🛑 Отключить всех ботов', callback_data: 'stop_all' }]
            ]
        },
        parse_mode: 'Markdown'
    };

    let text = `🟣 **Управление DevoBots v1.5** 🟣\n\n`;
    text += `📝 **Команды настройки (отправь текстом):**\n`;
    text += `• \`/add Ник\` — добавить аккаунт\n`;
    text += `• \`/del Номер\` — удалить аккаунт\n`;
    text += `• \`/version 1.8.9\` — сменить версию\n`;
    text += `• \`/delay 0.5\` — сменить задержку\n\n`;
    text += `🚀 **Команды запуска и чата:**\n`;
    text += `• \`/startall localhost\` — запустить всех ботов на IP\n`;
    text += `• \`/msg Текст\` — отправить со всех (работает #baritone и !devo)\n`;
    text += `• \`/msgone Номер Текст\` — отправить с одного бота\n`;

    tgBot.sendMessage(chatId, text, opts);
}

function sendTgNotification(text) {
    if (tgBot) {
        try { tgBot.sendMessage(CONFIG.adminId, text); } catch(e) {}
    }
}

showMenu();
