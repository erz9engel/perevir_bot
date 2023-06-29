const statusesKeyboard = async (requestId, viber, hideGPT) => {

    var arr = [
        [
            { text: '⛔ Фейк', callback_data: 'FS_-1_' + requestId },
            { text: '🟢 Правда', callback_data: 'FS_1_' + requestId }
        ],
        [
            { text: '🟠 Напівправда', callback_data: 'FS_-5_' + requestId },
            { text: '🔵 Бракує доказів', callback_data: 'FS_-4_' + requestId },
        ],
        [
            { text: '🟡 Відмова', callback_data: 'FS_-2_' + requestId },
            { text: '-->', callback_data: 'MORESTATUSES_' + requestId },
        ],
        [   
            { text: '✉️ Залишити коментар', callback_data: 'COMMENT_' + requestId }
        ]
    ]

    if (!hideGPT) {
        arr.push([
            { text: '🤖 Згенерувати AI відповідь', callback_data: 'AUTOANSWER_' + requestId }
        ])
    }

    if (!viber) {
        arr.push([
            { text: '📱 Діалог з ініціатором', callback_data: 'CHAT_' + requestId }
        ])
    }
    return arr;

};


const takeRequestKeyboard = async (requestId) => {
    return [
        [
            { text: '🤏 Взяти запит', callback_data: 'TAKEREQ_' + requestId }
        ]
    ];
};


module.exports = {
    statusesKeyboard,
    takeRequestKeyboard
}