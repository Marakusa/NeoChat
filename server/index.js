var Server = require('./server.js');

var fs = require('fs');

var configLoadSuccess = true;
var config = JSON.parse("{}");

var appServerInstance;

// Load configuration file
fs.readFile("./server/serverconfig.json", "utf-8", function (err, res) {
    configLoadSuccess = true;
    if (err) {
        configLoadSuccess = false;
        console.log("Failed to load config file... " + err.message);
        process.exit(1);
    }
    else {
        config = JSON.parse(res);

        getConfigValue("port");
        getConfigValue("web-folder");
        getConfigValue("rethinkdb");
        getConfigValue("rethinkdb-port");
        
        if (configLoadSuccess) {
            console.log("Config loaded successfully!");
            
            appServerInstance = new Server(config);
        }
        else {
            console.log("Config load failed.");
        }
    }
});

function getConfigValue(key) {
    if (config[key]) {
        console.error("Config loaded key \"" + key + "\" with value \"" + config[key] + "\".");
        return config[key];
    }
    else {
        console.error("Config value \"" + key + "\" not found.");
        configLoadSuccess = false;
        return null;
    }
}
