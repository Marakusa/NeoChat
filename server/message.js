class Message {
    constructor(id, username, avatar, mid, message, time) {
        this.id = id;
        this.username = username;
        this.avatar = avatar;
        this.mid = mid;
        this.message = message;
        this.time = time;
    }
}

function newMessage(id, username, avatar, mid, message, time) {
    return new Message(id, username, avatar, mid, message, time);
}

module.exports = { newMessage };
