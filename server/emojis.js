var fs = require("fs");

var emojis;

// Load emojis
function loadEmojis() {
    emojis = new Array();

    fs.readFile("server/data/full-emoji-list.json", "utf-8", function (emoji_error, emoji_pgres) {
        if (emoji_error) {
            console.error("Failed to load emojis: " + emoji_error.message);
        }
        else {
            var data = JSON.parse(emoji_pgres);

            Object.keys(data).forEach(function(k){
                Object.keys(data[k]["emojis"]).forEach(function(e){
                    emojis.push(data[k]["emojis"][e]);
                });
            });

            console.log("Emojis loaded");
        }
    });
}
// Find emojis
function findEmoji(emoji) {
    return emojis.find(f => f["shortname"] == emoji)["char"];
}

module.exports = { loadEmojis, findEmoji };
