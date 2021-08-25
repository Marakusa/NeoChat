class Client {
    constructor(id, username, socket, lastActivity) {
        this.id = id;
        this.username = username;
        this.socket = socket;
        this.lastActivity = lastActivity;
    }
}

function newClient(id, username, socket, lastActivity) {
    return new Client(id, username, socket, lastActivity);
}

module.exports = { newClient };
