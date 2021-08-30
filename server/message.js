class Message {
    constructor(id, username, avatar, message, time) {
        this.id = id;
        this.username = username;
        this.avatar = avatar;
        this.message = message;
        this.time = time;
    }
}

function newMessage(id, username, avatar, message, time) {
    return new Message(id, username, avatar, message, time);
}

module.exports = { newMessage };
