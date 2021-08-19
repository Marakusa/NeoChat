var http = require('http');
var fs = require('fs');
var path = require('path');
var qs = require('qs');
var entities = require('html-entities');

var port = 80;
var webFolder = "./web";

var theyBubble = `<div class="bubble bubbleLeft">_</div>`;
var meBubble = `<div class="bubble bubbleRight">_</div>`;

// Load emojis
var emojis = new Array();

fs.readFile("./web/full-emoji-list.json", "utf-8", function (emoji_error, emoji_pgres) {
    if (emoji_error) {
        console.log("Contents you are looking are Not Found\n" + url);
    }
    else {
        var data = JSON.parse(emoji_pgres);

        Object.keys(data).forEach(function(k){
            Object.keys(data[k]["emojis"]).forEach(function(e){
                emojis.push(data[k]["emojis"][e]);
            });
        });
    }
});

function findEmoji(emoji) {
    return emojis.find(f => f["shortname"] == emoji)["char"];
}

// Server
var server = http.createServer(function (req, res) {
    var url = req.url;

    if (url == "/") {
        url = "/index.html";
    }

    var headers = {
        "Access-Control-Allow-Origin": "http://localhost",
        "Access-Control-Allow-Methods": "POST, GET",
        "Access-Control-Max-Age": 2592000,
        "Content-Type": getMIMEType(path.extname(url)) + "; charset=UTF-8",
    };
    
    console.log(webFolder + url + ": " + req.method);

    if (req.method == "GET")
    {
        fs.readFile(webFolder + url, "utf-8", function (error, pgres) {
            if (error) {
                res.writeHead(404);
                res.write("Contents you are looking are Not Found\n" + url);
            } else {
                res.writeHead(200, headers);

                if (url == "/index.html") {
                    fs.readFile("./server/chats/test.chh", "utf-8", function (chat_error, chat_pgres) {
                        if (chat_error) {
                            res.write(pgres);
                            res.end();
                        }
                        else {
                            var msghistory = "";
        
                            chat_pgres.split("\n").forEach(element => {
                                var m_user = element.split("&")[0];
                                var m_message = element.split("&")[1];

                                if (m_user == "1") {
                                    msghistory += meBubble.replace("_", m_message);
                                }
                                else {
                                    msghistory += theyBubble.replace("_", m_message);
                                }
                            });
    
                            var emojiarray = new Array(msghistory.match(/:[^:\s]*(?:::[^:\s])*:/g));

                            if (emojiarray[0] != null)
                            {
                                for (i = 0; i < emojiarray[0].length; i++) {
                                    msghistory = msghistory.replace(emojiarray[0][i], findEmoji(emojiarray[0][i]));
                                }
                            }

                            res.write(pgres.replace("MESSAGEHISTORYSTARTSHERE", msghistory));
                            res.end();
                        }
                    });
                }
                else {
                    res.write(pgres);
            
                    res.end();
                }
            }
        });
    }
    else if (req.method == "POST")
    {
        if (url == "/sendmessage")
        {
            var body = "";

            req.on('data', function (chunk) {
                body += chunk;

                const post = qs.parse(body);

                if (post['message'].length <= 500 && post['message'].trim() != "")
                {
                    const post_user = post['user'];
                    var post_message = entities.encode(post['message']).replace(/\n/g, "<br>");

                    var emojiarray = new Array(post_message.match(/:[^:\s]*(?:::[^:\s])*:/g));

                    if (emojiarray[0] != null)
                    {
                        for (i = 0; i < emojiarray[0].length; i++) {
                            post_message = post_message.replace(emojiarray[0][i], findEmoji(emojiarray[0][i]));
                        }
                    }

                    console.log("\"" + post_user + "\": \"" + post_message + "\"");

                    res.writeHead(200, {
                        "Access-Control-Allow-Origin": "http://localhost",
                        "Access-Control-Allow-Methods": "POST, GET",
                        "Access-Control-Max-Age": 2592000,
                        "Content-Type": getMIMEType(".json") + "; charset=UTF-8",
                    });
                    res.write("{\"user\": " + post_user + ", \"message\": \"" + post_message + "\"}");
                    res.end();
                }
            });
        }
    }
});

server.listen(port);
console.log("Server started at http://localhost:" + port);

// Get MIME type
function getMIMEType(ext) {
    var array = fs.readFileSync('server/mime.dat').toString().split("\n");
    
    if (array.filter(option => option.startsWith(ext + "\t")).length == 0) {
        return "text/plain";
    }
    else {
        var result = (array.filter(option => option.startsWith(ext + "\t")))[0].split("\t")[1].trim();
        return result;
    }
}
