# Perevir_bot
Це телеграм бот для фактчекінгу.
Використовує Node.js v16.13.0 та MongoDB.

Для запуску необхідно встановити модулі: *npm i*

Також, необхідно додати файл *.env*, з параметрами:

*TGTOKEN=*Токен Телеграм Бота*

*DB_URL=*URL підключення до MongoDB*

*TGMAINCHAT=*ID чату модераторрів*

*TGENGLISHCHAT=*ID англійського чату модераторрів*

*TGCOMMENTSGROUP=*ID групи для бази коментарів*

*TGESCALATIONGROUP=*ID групи для ескалації запитів*

*ADMINS=*ID адмінів через кому (для \forbidrequests i \allowrequests)*

*VIBER_PUBLIC_ACCOUNT_ACCESS_TOKEN_KEY=*VIBER BOT TOKEN*

*VIBER_WEBHOOK_SERVER_URL=*VIBER WEBHOOK URL*

*VIBER_WEBHOOK_SERVER_PORT=*PORT FOR VIBER WEBHOOK*


Для того, щоб бот коректно міг зберігати коментарі до бази його треба додати до відповідної групи, а також через Botfather вимкнути Group Privacy в Bot Settings
Для роботи в inline режимі слід включити цю опцію через /setinlinemode в https://t.me/BotFather

Крім того слід додати у колекцію 'datas', об'єкт {name: "requestStatus", value: "true"}

Логіка бота - ../src/routes/bot.js
