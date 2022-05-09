# Perevir_bot
Це телеграм бот для фактчекінгу.
Використовує Node.js v16.13.0 та MongoDB.

Для запуску необхідно встановити модулі: *npm i*

Також, необхідно додати файл *.env*, з параметрами:

*TGTOKEN=*Токен Телеграм Бота*

*DB_URL=*URL підключення до MongoDB*

*TGMAINCHAT=*ID чату модераторрів*

*TGCOMMENTSGROUP=*ID групи для бази коментарів*

*ADMINS=*ID адмінів через кому (для \forbidrequests i \allowrequests)*

Для того, щоб бот коректно міг зберігати коментарі до бази його треба додати до відповідної групи, а також через Botfather вимкнути Group Privacy в Bot Settings

Крім того слід додати у колекцію 'datas', об'єкт {name: "requestStatus", value: "true"}

Логіка бота - ../src/routes/bot.js
