var http = require('http');
var fs = require('fs');
var path = require('path');
var qs = require('qs');
var entities = require('html-entities');
var r = require('rethinkdb');
var emojis = require('./emojis.js');
var crypto = require('crypto');

var port;
var webFolder;
var dbAddress;
var dbPort;

var theyBubble = `<div class="bubble bubbleLeft">_</div>`;
var meBubble = `<div class="bubble bubbleRight">_</div>`;

var server;

// Get MIME type
function getMIMEType(ext) {
    var array = fs.readFileSync('server/data/mimes.dat').toString().split("\n");
    
    if (array.filter(option => option.startsWith(ext + "\t")).length == 0) {
        return "text/plain";
    }
    else {
        var result = (array.filter(option => option.startsWith(ext + "\t")))[0].split("\t")[1].trim();
        return result;
    }
}

// Hash a string
function hash(stringtohash) {
    var hash = crypto.createHash('sha512');
    data = hash.update(stringtohash + "Yc7vFy3WtaOP9a8YOlRi", 'utf-8');
    gen_hash= data.digest('hex');
    console.log("Hash : " + gen_hash);
    return gen_hash;
}

// Server
function serverFunction(req, res) {
    var url = req.url;

    if (url == "/") {
        url = "/l.html";
    }

    var headers = {
        "Access-Control-Allow-Origin": "http://localhost",
        "Access-Control-Allow-Methods": "POST, GET",
        "Access-Control-Max-Age": 2592000,
        "Content-Type": getMIMEType(path.extname(url)) + "; charset=UTF-8",
    };
    
    console.log(webFolder + url + ": " + req.method + " (" + req.socket.remoteAddress + ")");

    // Request is a GET request
    if (req.method == "GET") {
        fs.readFile(webFolder + url, "utf-8", function (error, pgres) {
            if (error) {
                res.writeHead(404);
                res.write("Contents you are looking are Not Found\n" + url);
            } else {
                res.writeHead(200, headers);
    
                // If page opened is chat load messages
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
                                    msghistory = msghistory.replace(emojiarray[0][i], emojis.findEmoji(emojiarray[0][i]));
                                }
                            }
    
                            res.write(pgres.replace("MESSAGEHISTORYSTARTSHERE", msghistory));
                            res.end();
                        }
                    });
                }
                else {
                    // Return the page to client
                    res.write(pgres);
                    res.end();
                }
            }
        });
    }
    // Request is a POST request
    else if (req.method == "POST") {
        // Client sent a message
        if (url == "/sendmessage") {
            var body = "";
    
            req.on('data', function (chunk) {
                body += chunk;
    
                const post = qs.parse(body);
    
                if (post['message'].length <= 500 && post['message'].trim() != "") {
                    const post_user = post['user'];
                    var post_message = entities.encode(post['message']).replace(/\n/g, "<br>");
    
                    var emojiarray = new Array(post_message.match(/:[^:\s]*(?:::[^:\s])*:/g));
    
                    if (emojiarray[0] != null) {
                        for (i = 0; i < emojiarray[0].length; i++) {
                            post_message = post_message.replace(emojiarray[0][i], emojis.findEmoji(emojiarray[0][i]));
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
        // Client wants to register an account
        else if (url == "/register") {
            var body = "";
    
            req.on('data', function (chunk) {
                body += chunk;
    
                const post = qs.parse(body);
    
                var new_username = "";
                var new_email = "";
                var new_password = "";
    
                var new_username = post['username'];
                var new_email = post['email'];
                var new_password = post['password'];
                var new_password2 = post['password2'];
    
                if (new_username == null) new_username = "";
                if (new_email == null) new_email = "";
                if (new_password == null) new_password = "";
                if (new_password2 == null) new_password2 = "";
                
                console.log("\"" + new_username + "\", \"" + new_email + "\", \"" + new_password + "\", \"" + new_password2 + "\"");
                
                const usernameLengthCheck = (new_username.length <= 20 && new_username.length >= 3);
                const emailLengthCheck = (new_email.length <= 200 && new_email.length >= 5);
                const passwordLengthCheck = (new_password.length <= 50 && new_password.length >= 8);
                const usernameMatch = (new_username.match(/[^a-zA-Z0-9_]/g) == null);
                const emailMatch = (new_email.match(/^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/g) !== null);
    
                const new_hash = hash(new_password);

                // Database connect test
                r.connect({ host: dbAddress, port: dbPort }, function(err, conn) {
                    if(err) {
                        res.writeHead(200, {
                            "Access-Control-Allow-Origin": "http://localhost",
                            "Access-Control-Allow-Methods": "POST, GET",
                            "Access-Control-Max-Age": 2592000,
                            "Content-Type": getMIMEType(".json") + "; charset=UTF-8",
                        });
                        res.write(`{"registerstatus": 1, "message": "Database connection failed"}`);
                        res.end();
                        throw "\u001b[31m" + err.message + "\n\n===========================\nDatabase connection failed!\n===========================\u001b[37m";
                    }

                    if (usernameLengthCheck && usernameMatch) {
                        if (emailLengthCheck && emailMatch) {
                            if (passwordLengthCheck) {
                                if (new_password == new_password2)
                                {
                                    // Create a new user
                                    r.db('chatapp').table('users').run(conn, function(err, dbres) {
                                        if(err) throw err;

                                        r.db('chatapp').table('users').filter(r.row('username').match("(?i)^" + new_username.toLowerCase() + "$")).run(conn, function(err, cursor) {
                                            if (err) throw err;

                                            cursor.toArray(function(err, result) {
                                                if (err) throw err;

                                                if (result.length == 0) {
                                                    r.db('chatapp').table('users').filter(r.row('email').match("(?i)^" + new_email.toLowerCase() + "$")).run(conn, function(err, cursor) {
                                                        if (err) throw err;
            
                                                        cursor.toArray(function(err, result) {
                                                            if (err) throw err;
            
                                                            if (result.length == 0) {
                                                                r.db('chatapp').table('users').insert({ username: new_username, email: new_email, hash: new_hash }).run(conn, function(err, dbres) {
                                                                    if(err) throw err;
                                                                    
                                                                    res.writeHead(200, {
                                                                        "Access-Control-Allow-Origin": "http://localhost",
                                                                        "Access-Control-Allow-Methods": "POST, GET",
                                                                        "Access-Control-Max-Age": 2592000,
                                                                        "Content-Type": getMIMEType(".json") + "; charset=UTF-8",
                                                                    });
                                                                    res.write(`{"registerstatus": 0, "message": "Account created successfully"}`);
                                                                    res.end();
                                                                });
                                                            }
                                                            else {
                                                                console.log("Email \"" + new_email + "\" is already in use");
            
                                                                res.writeHead(200, {
                                                                    "Access-Control-Allow-Origin": "http://localhost",
                                                                    "Access-Control-Allow-Methods": "POST, GET",
                                                                    "Access-Control-Max-Age": 2592000,
                                                                    "Content-Type": getMIMEType(".json") + "; charset=UTF-8",
                                                                });
                                                                res.write(`{"registerstatus": 1, "message": "Email is already in use"}`);
                                                                res.end();
                                                            }
                                                        });
                                                    });
                                                }
                                                else {
                                                    console.log("Username \"" + new_username + "\" is not available");

                                                    res.writeHead(200, {
                                                        "Access-Control-Allow-Origin": "http://localhost",
                                                        "Access-Control-Allow-Methods": "POST, GET",
                                                        "Access-Control-Max-Age": 2592000,
                                                        "Content-Type": getMIMEType(".json") + "; charset=UTF-8",
                                                    });
                                                    res.write(`{"registerstatus": 1, "message": "Username is not available"}`);
                                                    res.end();
                                                }
                                            });
                                        });
                                    });
                                }
                                else {
                                    console.log("Passwords must match");
                
                                    res.writeHead(200, {
                                        "Access-Control-Allow-Origin": "http://localhost",
                                        "Access-Control-Allow-Methods": "POST, GET",
                                        "Access-Control-Max-Age": 2592000,
                                        "Content-Type": getMIMEType(".json") + "; charset=UTF-8",
                                    });
                                    res.write(`{"registerstatus": 1, "message": "Passwords must match"}`);
                                    res.end();
                                }
                            }
                            else {
                                console.log("Password contains invalid amount of characters (8-50)");
            
                                res.writeHead(200, {
                                    "Access-Control-Allow-Origin": "http://localhost",
                                    "Access-Control-Allow-Methods": "POST, GET",
                                    "Access-Control-Max-Age": 2592000,
                                    "Content-Type": getMIMEType(".json") + "; charset=UTF-8",
                                });
                                res.write(`{"registerstatus": 1, "message": "Password contains invalid amount of characters (8-50)"}`);
                                res.end();
                            }
                        }
                        else {
                            if (emailLengthCheck) {
                                console.log("Email is invalid");
            
                                res.writeHead(200, {
                                    "Access-Control-Allow-Origin": "http://localhost",
                                    "Access-Control-Allow-Methods": "POST, GET",
                                    "Access-Control-Max-Age": 2592000,
                                    "Content-Type": getMIMEType(".json") + "; charset=UTF-8",
                                });
                                res.write(`{"registerstatus": 1, "message": "Email is invalid"}`);
                                res.end();
                            }
                            else {
                                console.log("Email contains invalid amount of characters (5-200)");
            
                                res.writeHead(200, {
                                    "Access-Control-Allow-Origin": "http://localhost",
                                    "Access-Control-Allow-Methods": "POST, GET",
                                    "Access-Control-Max-Age": 2592000,
                                    "Content-Type": getMIMEType(".json") + "; charset=UTF-8",
                                });
                                res.write(`{"registerstatus": 1, "message": "Email contains invalid amount of characters (5-200)"}`);
                                res.end();
                            }
                        }
                    }
                    else {
                        if (usernameLengthCheck) {
                            console.log("Username contains invalid characters");
        
                            res.writeHead(200, {
                                "Access-Control-Allow-Origin": "http://localhost",
                                "Access-Control-Allow-Methods": "POST, GET",
                                "Access-Control-Max-Age": 2592000,
                                "Content-Type": getMIMEType(".json") + "; charset=UTF-8",
                            });
                            res.write(`{"registerstatus": 1, "message": "Username contains invalid characters (Letters, numbers and _ only allowed)"}`);
                            res.end();
                        }
                        else {
                            console.log("Username contains invalid amount of characters (3-20)");
        
                            res.writeHead(200, {
                                "Access-Control-Allow-Origin": "http://localhost",
                                "Access-Control-Allow-Methods": "POST, GET",
                                "Access-Control-Max-Age": 2592000,
                                "Content-Type": getMIMEType(".json") + "; charset=UTF-8",
                            });
                            res.write(`{"registerstatus": 1, "message": "Username contains invalid amount of characters (3-20)"}`);
                            res.end();
                        }
                    }
                });
            });
        }
        // Client wants to login to an account
        else if (url == "/login") {
            var body = "";
    
            req.on('data', function (chunk) {
                body += chunk;
    
                const post = qs.parse(body);
    
                var new_username = "";
                var new_email = "";
                var new_password = "";
    
                var new_username = post['username'];
                var new_email = post['email'];
                var new_password = post['password'];
                var new_password2 = post['password2'];
    
                if (new_username == null) new_username = "";
                if (new_email == null) new_email = "";
                if (new_password == null) new_password = "";
                if (new_password2 == null) new_password2 = "";
                
                console.log("\"" + new_username + "\", \"" + new_email + "\", \"" + new_password + "\", \"" + new_password2 + "\"");
                
                const usernameLengthCheck = (new_username.length <= 20 && new_username.length >= 3);
                const emailLengthCheck = (new_email.length <= 200 && new_email.length >= 5);
                const passwordLengthCheck = (new_password.length <= 50 && new_password.length >= 8);
                const usernameMatch = (new_username.match(/[^a-zA-Z0-9_]/g) == null);
                const emailMatch = (new_email.match(/^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/g) !== null);
    
                const new_hash = hash(new_password);

                // Database connect test
                r.connect({ host: dbAddress, port: dbPort }, function(err, conn) {
                    if(err) {
                        res.writeHead(200, {
                            "Access-Control-Allow-Origin": "http://localhost",
                            "Access-Control-Allow-Methods": "POST, GET",
                            "Access-Control-Max-Age": 2592000,
                            "Content-Type": getMIMEType(".json") + "; charset=UTF-8",
                        });
                        res.write(`{"registerstatus": 1, "message": "Database connection failed"}`);
                        res.end();
                        throw "\u001b[31m" + err.message + "\n\n===========================\nDatabase connection failed!\n===========================\u001b[37m";
                    }

                    if (usernameLengthCheck && usernameMatch) {
                        if (emailLengthCheck && emailMatch) {
                            if (passwordLengthCheck) {
                                if (new_password == new_password2)
                                {
                                    // Create a new user
                                    r.db('chatapp').table('users').run(conn, function(err, dbres) {
                                        if(err) throw err;

                                        r.db('chatapp').table('users').filter(r.row('username').match("(?i)^" + new_username.toLowerCase() + "$")).run(conn, function(err, cursor) {
                                            if (err) throw err;

                                            cursor.toArray(function(err, result) {
                                                if (err) throw err;

                                                if (result.length == 0) {
                                                    r.db('chatapp').table('users').filter(r.row('email').match("(?i)^" + new_email.toLowerCase() + "$")).run(conn, function(err, cursor) {
                                                        if (err) throw err;
            
                                                        cursor.toArray(function(err, result) {
                                                            if (err) throw err;
            
                                                            if (result.length == 0) {
                                                                r.db('chatapp').table('users').insert({ username: new_username, email: new_email, hash: new_hash }).run(conn, function(err, dbres) {
                                                                    if(err) throw err;
                                                                    
                                                                    res.writeHead(200, {
                                                                        "Access-Control-Allow-Origin": "http://localhost",
                                                                        "Access-Control-Allow-Methods": "POST, GET",
                                                                        "Access-Control-Max-Age": 2592000,
                                                                        "Content-Type": getMIMEType(".json") + "; charset=UTF-8",
                                                                    });
                                                                    res.write(`{"registerstatus": 0, "message": "Account created successfully"}`);
                                                                    res.end();
                                                                });
                                                            }
                                                            else {
                                                                console.log("Email \"" + new_email + "\" is already in use");
            
                                                                res.writeHead(200, {
                                                                    "Access-Control-Allow-Origin": "http://localhost",
                                                                    "Access-Control-Allow-Methods": "POST, GET",
                                                                    "Access-Control-Max-Age": 2592000,
                                                                    "Content-Type": getMIMEType(".json") + "; charset=UTF-8",
                                                                });
                                                                res.write(`{"registerstatus": 1, "message": "Email is already in use"}`);
                                                                res.end();
                                                            }
                                                        });
                                                    });
                                                }
                                                else {
                                                    console.log("Username \"" + new_username + "\" is not available");

                                                    res.writeHead(200, {
                                                        "Access-Control-Allow-Origin": "http://localhost",
                                                        "Access-Control-Allow-Methods": "POST, GET",
                                                        "Access-Control-Max-Age": 2592000,
                                                        "Content-Type": getMIMEType(".json") + "; charset=UTF-8",
                                                    });
                                                    res.write(`{"registerstatus": 1, "message": "Username is not available"}`);
                                                    res.end();
                                                }
                                            });
                                        });
                                    });
                                }
                                else {
                                    console.log("Passwords must match");
                
                                    res.writeHead(200, {
                                        "Access-Control-Allow-Origin": "http://localhost",
                                        "Access-Control-Allow-Methods": "POST, GET",
                                        "Access-Control-Max-Age": 2592000,
                                        "Content-Type": getMIMEType(".json") + "; charset=UTF-8",
                                    });
                                    res.write(`{"registerstatus": 1, "message": "Passwords must match"}`);
                                    res.end();
                                }
                            }
                            else {
                                console.log("Password contains invalid amount of characters (8-50)");
            
                                res.writeHead(200, {
                                    "Access-Control-Allow-Origin": "http://localhost",
                                    "Access-Control-Allow-Methods": "POST, GET",
                                    "Access-Control-Max-Age": 2592000,
                                    "Content-Type": getMIMEType(".json") + "; charset=UTF-8",
                                });
                                res.write(`{"registerstatus": 1, "message": "Password contains invalid amount of characters (8-50)"}`);
                                res.end();
                            }
                        }
                        else {
                            if (emailLengthCheck) {
                                console.log("Email is invalid");
            
                                res.writeHead(200, {
                                    "Access-Control-Allow-Origin": "http://localhost",
                                    "Access-Control-Allow-Methods": "POST, GET",
                                    "Access-Control-Max-Age": 2592000,
                                    "Content-Type": getMIMEType(".json") + "; charset=UTF-8",
                                });
                                res.write(`{"registerstatus": 1, "message": "Email is invalid"}`);
                                res.end();
                            }
                            else {
                                console.log("Email contains invalid amount of characters (5-200)");
            
                                res.writeHead(200, {
                                    "Access-Control-Allow-Origin": "http://localhost",
                                    "Access-Control-Allow-Methods": "POST, GET",
                                    "Access-Control-Max-Age": 2592000,
                                    "Content-Type": getMIMEType(".json") + "; charset=UTF-8",
                                });
                                res.write(`{"registerstatus": 1, "message": "Email contains invalid amount of characters (5-200)"}`);
                                res.end();
                            }
                        }
                    }
                    else {
                        if (usernameLengthCheck) {
                            console.log("Username contains invalid characters");
        
                            res.writeHead(200, {
                                "Access-Control-Allow-Origin": "http://localhost",
                                "Access-Control-Allow-Methods": "POST, GET",
                                "Access-Control-Max-Age": 2592000,
                                "Content-Type": getMIMEType(".json") + "; charset=UTF-8",
                            });
                            res.write(`{"registerstatus": 1, "message": "Username contains invalid characters (Letters, numbers and _ only allowed)"}`);
                            res.end();
                        }
                        else {
                            console.log("Username contains invalid amount of characters (3-20)");
        
                            res.writeHead(200, {
                                "Access-Control-Allow-Origin": "http://localhost",
                                "Access-Control-Allow-Methods": "POST, GET",
                                "Access-Control-Max-Age": 2592000,
                                "Content-Type": getMIMEType(".json") + "; charset=UTF-8",
                            });
                            res.write(`{"registerstatus": 1, "message": "Username contains invalid amount of characters (3-20)"}`);
                            res.end();
                        }
                    }
                });
            });
        }
    }
}

// App server class
module.exports = class AppServer {
    constructor(config) {
        console.log("Server instantiated");

        // Apply config values
        port = config['port'];
        webFolder = config['web-folder'];
        dbAddress = config['rethinkdb'];
        dbPort = config['rethinkdb-port'];
        
        // Database connect test
        r.connect({ host: dbAddress, port: dbPort }, function(err, conn) {
            if(err) {
                throw "\u001b[31m" + err.message + "\n\n===========================\nDatabase connection failed!\nServer could not be started\n===========================\u001b[37m";
            }
            /*r.db('chatapp').table('users').run(conn, function(err, res) {
            if(err) throw err;
            console.log(res);
            r.table('tv_shows').insert({ name: 'Star Trek TNG' }).run(conn, function(err, res)
            {
                if(err) throw err;
                console.log(res);
            });
            });*/
        });
    
        emojis.loadEmojis();

        // Start server
        server = http.createServer(serverFunction);
        server.listen(port);

        if (server.listening == true) {
            console.log("Server started at http://localhost:" + port);
        }
    }
}
