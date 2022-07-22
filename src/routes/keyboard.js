
const statusesKeyboard = async (requestId, viber) => {

    const arr = [
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
            { text: '⁉️ Ескалація', callback_data: 'ESCALATE_' + requestId },
        ],
        [   
            { text: '✉️ Залишити коментар', callback_data: 'COMMENT_' + requestId }
        ]
    ]

    if (!viber) {
        arr.push([
            { text: '📱 Діалог з ініціатором', callback_data: 'CHAT_' + requestId }
        ])
    }

    return arr;

};


module.exports = {
    statusesKeyboard
}