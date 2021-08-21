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

const userListButton = `<a href="@USERNAME" id="userUID" class="users">
    <div class="listUser">
        <p id="listUserNameUID" class="listUserName">USERNAME</p>
    </div>
</a>`;
const headerBackButton = `<a href="@me" class="headerBack buttonRound"><div style="background-image: url(img/BackArrow.svg);background-position: center;background-size: contain;width: 100%;height: 100%;"></div></a>`;
const headerMenuButton = `<a onclick="openSideMenu();" class="headerBack buttonRound"><div style="background-image: url(img/MenuLines.svg);background-position: center;background-size: contain;width: 100%;height: 100%;"></div></a>`;
const theyBubble = "<div class=\"bubble bubbleLeft\">_</div>";
const meBubble = "<div class=\"bubble bubbleRight\">_</div>";

var server;

var token = "";

// Parse user cookies
function parseCookies (request) {
    var list = {},
        rc = request.headers.cookie;

    rc && rc.split(';').forEach(function( cookie ) {
        var parts = cookie.split('=');
        list[parts.shift().trim()] = decodeURI(parts.join('='));
    });

    return list;
}

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

// Get MIME type
function getPost(posturl) {
    var array = fs.readFileSync('server/data/posts.dat').toString().split("\r\n");
    
    if (array.filter(option => option == posturl).length > 0) {
        return true;
    }
    
    return false;
}

// Hash a string
function hash(stringtohash) {
    var hash = crypto.createHash('sha512');
    data = hash.update(stringtohash + "Yc7vFy3WtaOP9a8YOlRi", 'utf-8');
    gen_hash= data.digest('hex');
    return gen_hash;
}

// Server

var url = "";

var ownusername = "";
var userId = 0;

var chatUser = "@me";

var pending = {};

function checkIfTokenValid(validatetoken, callbackFunction) {
    if (validatetoken == "") {
        callbackFunction(null, false);
    }
    else {
        r.connect({ host: dbAddress, port: dbPort }, function(err, conn) {
            if(err) {
                callbackFunction(null, false);
            }
        
            r.db('chatapp').table('users').filter(r.row('token').match(validatetoken)).run(conn, function(err, dbres) {
                if(err) {
                    callbackFunction(null, false);
                }
                
                dbres.toArray(function(err, result) {
                    if (err) {
                        callbackFunction(null, false);
                    }

                    if (result.length == 0 || result[0] == undefined || result[0]['id'] == undefined || result[0]['id'] == null || result[0]['id'] == 0) {
                        callbackFunction(null, false);
                    }
                    else {
                        callbackFunction(null, true);
                    }
                });
            });
        });
    }
}

function requestListener(req, res) {
    var cookies = parseCookies(req);

    if (cookies['token']) {
        token = cookies['token'];
    }
    else {
        token = "";
    }

    // Try to check if tokein is valid
    checkIfTokenValid(token.toString(), function(validateError, validtoken) {
        r.connect({ host: dbAddress, port: dbPort }, function(err, conn) {
            if(err) {
                res.writeHead(500, err.message);
                res.end();
                return;
            }

            if (validtoken == false) {
                token = "";
            }
            
            url = req.url;
        
            if ((url == "/l.html" || url == "/l")) {
                res.writeHead(301,
                    {Location: '/signin'}
                );
                res.end();
                return;
            }

            if (url == "/signin") {
                url = "/l.html";
            }

            ownusername = "";
            userId = 0;
        
            chatUser = "@me";
            var chatUserId = "";
            
            if (url.startsWith("/channel/") && path.extname(url) != "") {
                url = url.slice(("/channel").length);
            }

            var isposturl = getPost(url);

            if (isposturl == false && req.url == "/index.html") {
                res.writeHead(301,
                    {Location: '/'}
                );
                res.end();
                return;
            }

            if (isposturl == false && (url == "/")) {
                if (validtoken == false) {
                    url = "/l.html";
                }
                else if (url.startsWith("/channel/@") == false) {
                    res.writeHead(301,
                        {Location: '/channel/@me'}
                    );
                    res.end();
                    return;
                }
            }

            if (isposturl == false && (url == "/l.html" || ((url.startsWith("/channel/@") == false || url == "/channel/@") && path.extname(url) == ""))) {
                if (validtoken == true) {
                    res.writeHead(301,
                        {Location: '/channel/@me'}
                    );
                    res.end();
                    return;
                }
                else {
                    url = "/l.html";
                }
            }
            
            // Check if logged in
            if (validtoken == false && req.method == "GET" && url !== "/l.html" && path.extname(url) == "") {
                res.writeHead(301,
                    {Location: '../signin'}
                );
                res.end();
                return;
            }
        
            if (validtoken) {
                //console.log(token);
                // Get client user id
                r.db('chatapp').table('users').filter(r.row('token').match(token)).orderBy('id').run(conn, function(err, dbres) {
                    if(err) {
                        res.writeHead(500, err.message);
                        res.end();
                        return;
                    }
                    
                    dbres.toArray(function(err, result) {
                        if (err) {
                            res.writeHead(500, err.message);
                            res.end();
                            return;
                        }

                        if (result.length == 0) {
                            userId = 0;
                            ownusername = "";
                        }
                        else {
                            userId = result[0]['id'];
                            ownusername = result[0]['username'];
                        }
                        
                        if (url.startsWith("/channel/@")) {
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

                            r.db('chatapp').table('users').filter(r.row('username').match("(?i)^" + (url.slice(("/channel/@").length)).toLowerCase() + "$")).run(conn, function(err, dbres) {
                                if(err) {
                                    res.writeHead(500, err.message);
                                    res.end();
                                    return;
                                }
                                
                                dbres.toArray(function(err, result) {
                                    if(err) {
                                        res.writeHead(500, err.message);
                                        res.end();
                                        return;
                                    }

                                    // CONSOLELOG
                                    //console.log(req.url + ": " + req.method + ": " + token.substring(0, 10) + "..." + ": \t" + result);

                                    var atme = false;

                                    if (result.length > 0) {
                                        chatUserId = result[0]['id'];
                                        chatUser = result[0]['username'];
                                    }
                                    else {
                                        if (url == '/channel/@me') {
                                            chatUserId = 0;
                                            chatUser = "me";
                                            atme = true;
                                        }
                                        else {
                                            res.writeHead(301,
                                                {Location: '/channel/@me'}
                                            );
                                            res.end();
                                            return;
                                        }
                                    }

                                    url = "/index.html";

                                    serverRequestedMethod(req, res, token, url, chatUserId, userId, atme);
                                });
                            });
                        }
                    });
                });
            }
            
            if (url.startsWith("/channel/@") == false) {
                if (url.startsWith("/channel")) {
                    url = url.slice(("/channel").length);
                }
        
                serverRequestedMethod(req, res, "", url, 0, 0, false);
            }
        });
    });
}

function serverRequestedMethod(req, res, token, url, chatUserId, own_userId, atme) {
    r.connect({ host: dbAddress, port: dbPort }, function(err, conn) {
        if(err) {
            res.writeHead(500, err.message);
            res.end();
            return;
        }

        // Check own user id
        if (own_userId == 0 && atme == false) {
            if (path.extname(url) == "" || path.extname(url) == ".html") {
                // Get client user id
                r.db('chatapp').table('users').filter(r.row('token').match(token)).run(conn, function(err, dbres) {
                    if(err) {
                        res.writeHead(200, {
                            "Access-Control-Allow-Origin": "http://localhost",
                            "Access-Control-Allow-Methods": "POST, GET",
                            "Access-Control-Max-Age": 2592000,
                            "Content-Type": getMIMEType(".html") + "; charset=UTF-8",
                        });
                        res.write(err.message);
                        res.end();
                        return;
                    }
                    
                    dbres.toArray(function(err, result) {
                        if (err) {
                            res.writeHead(200, {
                                "Access-Control-Allow-Origin": "http://localhost",
                                "Access-Control-Allow-Methods": "POST, GET",
                                "Access-Control-Max-Age": 2592000,
                                "Content-Type": getMIMEType(".html") + "; charset=UTF-8",
                            });
                            res.write(err.message);
                            res.end();
                            return;
                        }
        
                        if ((result.length == 0 || result[0] == undefined || result[0]['id'] == undefined || result[0]['id'] == null || result[0]['id'] == 0)) {
                            own_userId = 0;
                            return;
                        }
                        else {
                            own_userId = result[0]['id'];
                        }
                    });
                });
            }
        }

        var headers = {
            "Access-Control-Allow-Origin": "http://localhost",
            "Access-Control-Allow-Methods": "POST, GET",
            "Access-Control-Max-Age": 2592000,
            "Content-Type": getMIMEType(path.extname(url)) + "; charset=UTF-8",
        };
        
        // Request is a GET request
        if (req.method == "GET") {
            fs.readFile(webFolder + url, "utf-8", function (error, pgres) {
                if (error) {
                    res.writeHead(404);
                    res.write("Contents you are looking are Not Found\n" + url);
                } else {
                    res.writeHead(200, headers);
        
                    // If page opened is chat load messages
                    if (url == "/index.html" && (chatUser != "@me" || chatUser != "")) {
                        var chatMessages = new Array();
                        
                        r.db('chatapp').table('messages').filter({userfrom: own_userId, userto: chatUserId}).run(conn, function(err, dbres) {
                            if(err) {
                                res.writeHead(500, err.message);
                                res.end();
                                return;
                            }
                            else {
                                dbres.toArray(function(err, result) {
                                    if(err) {
                                        res.writeHead(500, err.message);
                                        res.end();
                                        return;
                                    }
                                    else {
                                        result.forEach(element => {
                                            chatMessages.push(element);
                                        });

                                        r.db('chatapp').table('messages').filter({userto: own_userId, userfrom: chatUserId}).run(conn, function(err, dbres) {
                                            if(err) {
                                                res.writeHead(500, err.message);
                                                res.end();
                                                return;
                                            }
                                            else {
                                                dbres.toArray(function(err, result) {
                                                    if(err) {
                                                        res.writeHead(500, err.message);
                                                        res.end();
                                                        return;
                                                    }
                                                    else {
                                                        result.forEach(element => {
                                                            chatMessages.push(element);
                                                        });
                        
                                                        chatMessages = chatMessages.sort(function (a, b) {
                                                            return a.time - b.time;
                                                        });

                                                        var msghistory = "";
                                        
                                                        chatMessages.forEach(element => {
                                                            var m_userto = element['userto'];
                                                            var m_userfrom = element['userfrom'];
                                                            var m_message = element['message'];
                                                            
                                                            if (m_userfrom == own_userId) {
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
                                                        
                                                        if (chatUserId == 0) {
                                                            r.db('chatapp').table('users').run(conn, function(err, dbres) {
                                                                if(err) {
                                                                    res.writeHead(500, err.message);
                                                                    res.end();
                                                                    return;
                                                                }

                                                                msghistory = "";

                                                                dbres.toArray(function(err, aresult) {
                                                                    if(err) {
                                                                        res.writeHead(500, err.message);
                                                                        res.end();
                                                                        return;
                                                                    }

                                                                    var doneIndex = 0;
                                                                    var doneIndexI = 0;
                                                                    
                                                                    aresult.forEach(user => {
                                                                        doneIndex++;

                                                                        if (user['id'].toString() != own_userId) {
                                                                            if (user['username'] != undefined) {
                                                                                msghistory += userListButton.replace(/USERNAME/g, user['username'].toLowerCase()).replace(/UID/g, doneIndexI);
                                                                                doneIndexI++;
                                                                            }
                                                                        }
                                                                        
                                                                        if (aresult.length == doneIndex) {
                                                                            res.write(pgres
                                                                                .replace(/TITLEUSERNAME/g, "ChatApp")
                                                                                .replace(/YOURUSERNAME/g, ownusername)
                                                                                .replace(/HEADERLEFTBUTTON/g, headerMenuButton)
                                                                                .replace("MESSAGEHISTORYSTARTSHERE", "")
                                                                                .replace("USERSLIST", msghistory)
                                                                                );
                                                                            res.end();
                                                                            return;
                                                                        }
                                                                    });
                                                                });
                                                            });
                                                        }
                                                        else {
                                                            res.write(pgres
                                                                .replace(/TITLEUSERNAME/g, chatUser)
                                                                .replace(/YOURUSERNAME/g, ownusername)
                                                                .replace(/HEADERLEFTBUTTON/g, headerBackButton)
                                                                .replace("MESSAGEHISTORYSTARTSHERE", msghistory)
                                                                .replace("USERSLIST", "")
                                                                );
                                                            res.end();
                                                            return;
                                                        }
                                                    }
                                                });
                                            }
                                        });
                                    }
                                });
                            }
                        });
                    }
                    else {
                        // Return the page to client
                        res.write(pgres);
                        res.end();
                        return;
                    }
                }
            });
        }
        // Request is a POST request
        else if (req.method == "POST") {
            const post_user = chatUserId;

            // Form actions
            if (url == "/l.html" || url == "/index.html") {
                var body = "";
        
                req.on('data', function (chunk) {
                    body += chunk;
        
                    const post = qs.parse(body);
                    const action = post['undefinedaction'];

                    if (action == 'sendmessage') {
                        if (post['message'].length <= 500 && post['message'].trim() != "") {
                            var post_message = entities.encode(post['message']).replace(/\n/g, "<br>");

                            var post_time = Date.now();
            
                            var emojiarray = new Array(post_message.match(/:[^:\s]*(?:::[^:\s])*:/g));
            
                            if (emojiarray[0] != null) {
                                for (i = 0; i < emojiarray[0].length; i++) {
                                    post_message = post_message.replace(emojiarray[0][i], emojis.findEmoji(emojiarray[0][i]));
                                }
                            }
            
                            // Database connect test
                            r.db('chatapp').table('messages').insert({ userfrom: own_userId, userto: post_user, message: post_message, time: post_time }).run(conn, function(err, dbres) {
                                if(err) {
                                    res.writeHead(200, {
                                        "Access-Control-Allow-Origin": "http://localhost",
                                        "Access-Control-Allow-Methods": "POST, GET",
                                        "Access-Control-Max-Age": 2592000,
                                        "Content-Type": getMIMEType(".json") + "; charset=UTF-8",
                                    });
                                    res.write(`{"registerstatus": 1, "message": "Message sending failed"}`);
                                    res.end();
                                    return;
                                }
                                else {
                                    res.writeHead(200, {
                                        "Access-Control-Allow-Origin": "http://localhost",
                                        "Access-Control-Allow-Methods": "POST, GET",
                                        "Access-Control-Max-Age": 2592000,
                                        "Content-Type": getMIMEType(".json") + "; charset=UTF-8",
                                    });

                                    pending[post_user + "," + own_userId] += "\t" + post_message;
                                    //console.log(pending[post_user + "," + own_userId] + " - " + post_user + "," + own_userId);

                                    res.write(`{"user": "` + post_user + `", "message": "` + post_message + `"}`);
                                    res.end();
                                    return;
                                }
                            });
                        }
                    }
                    else if (action == "requestmessages") {
                        var postuser = chatUserId;
                        var body = "";
            
                        //console.log(own_userId + "," + postuser);
                        //console.log(pending[own_userId + "," + postuser]);
                        if (pending[own_userId + "," + postuser] !== undefined && pending[own_userId + "," + postuser] !== null && pending[own_userId + "," + postuser] !== "") {
                            var pendingMessages = (pending[own_userId + "," + postuser]).toString().split("\t");
                            
                            pendingMessages.forEach(msg => {
                                if (msg !== null && msg.trim() != "") {
                                    body += theyBubble.replace("_", (msg)).replace(/"/g, "&QUO;");
                                }
                            });
                
                            pending[own_userId + "," + postuser] = "";
                
                            var emojiarray = new Array(body.match(/:[^:\s]*(?:::[^:\s])*:/g));
                
                            if (emojiarray[0] != null)
                            {
                                for (i = 0; i < emojiarray[0].length; i++) {
                                    body = body.replace(emojiarray[0][i], emojis.findEmoji(emojiarray[0][i]));
                                }
                            }
                    
                            res.writeHead(200, {
                                "Access-Control-Allow-Origin": "http://localhost",
                                "Access-Control-Allow-Methods": "POST, GET",
                                "Access-Control-Max-Age": 2592000,
                                "Content-Type": getMIMEType(".json") + "; charset=UTF-8",
                            });
                            res.write("{\"messages\": \"" + body + "\"}");
                            res.end();
                            return;
                        }
                        else {
                            res.writeHead(200, {
                                "Access-Control-Allow-Origin": "http://localhost",
                                "Access-Control-Allow-Methods": "POST, GET",
                                "Access-Control-Max-Age": 2592000,
                                "Content-Type": getMIMEType(".json") + "; charset=UTF-8",
                            });
                            res.write("{\"messages\": \"" + body + "\"}");
                            res.end();
                            return;
                        }
                    }
                    else if (action == "refreshusers") {
                        var body = "";
            
                        if (chatUserId == 0) {
                            r.db('chatapp').table('users').orderBy('id').run(conn, function(err, dbres) {
                                if(err) {
                                    res.writeHead(500, err.message);
                                    res.end();
                                    return;
                                }

                                var usersjson = {};

                                dbres.toArray(function(err, aresult) {
                                    if(err) {
                                        res.writeHead(500, err.message);
                                        res.end();
                                        return;
                                    }

                                    var userListIndex = 0;
                                    var userListIndexI = 0;
                                    
                                    aresult.forEach(user => {
                                        if (user['id'].toString() != own_userId) {
                                            if (user['username'] != undefined) {
                                                usersjson[userListIndexI] = new Array(user['username'], "0");
                                                userListIndexI = userListIndexI + 1;
                                            }
                                        }

                                        userListIndex = userListIndex + 1;

                                        if (aresult.length == userListIndex) {
                                            res.writeHead(200, {
                                                "Access-Control-Allow-Origin": "http://localhost",
                                                "Access-Control-Allow-Methods": "POST, GET",
                                                "Access-Control-Max-Age": 2592000,
                                                "Content-Type": getMIMEType(".json") + "; charset=UTF-8",
                                            });
                                            console.log(usersjson);
                                            res.write(JSON.stringify(usersjson));
                                            res.end();
                                            return;
                                        }
                                    });
                                });
                            });
                        }
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
                    
                    const usernameLengthCheck = (new_username.length <= 20 && new_username.length >= 3);
                    const emailLengthCheck = (new_email.length <= 200 && new_email.length >= 5);
                    const passwordLengthCheck = (new_password.length <= 50 && new_password.length >= 8);
                    const usernameMatch = (new_username.match(/[^a-zA-Z0-9_]/g) == null);
                    const emailMatch = (new_email.match(/^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/g) !== null);
        
                    const new_hash = hash(new_password);

                    // Database connect test
                    if (usernameLengthCheck && usernameMatch) {
                        if (emailLengthCheck && emailMatch) {
                            if (passwordLengthCheck) {
                                if (new_password == new_password2)
                                {
                                    // Create a new user
                                    r.db('chatapp').table('users').run(conn, function(err, dbres) {
                                        if(err) {
                                            res.writeHead(500, err.message);
                                            res.end();
                                            return;
                                        }

                                        r.db('chatapp').table('users').filter(r.row('username').match("(?i)^" + new_username.toLowerCase() + "$")).run(conn, function(err, cursor) {
                                            if (err) {
                                                res.writeHead(500, err.message);
                                                res.end();
                                                return;
                                            }

                                            cursor.toArray(function(err, result) {
                                                if (err) {
                                                    res.writeHead(500, err.message);
                                                    res.end();
                                                    return;
                                                }

                                                if (result.length == 0) {
                                                    r.db('chatapp').table('users').filter(r.row('email').match("(?i)^" + new_email.toLowerCase() + "$")).run(conn, function(err, cursor) {
                                                        if (err) {
                                                            res.writeHead(500, err.message);
                                                            res.end();
                                                            return;
                                                        }
            
                                                        cursor.toArray(function(err, result) {
                                                            if (err) {
                                                                res.writeHead(500, err.message);
                                                                res.end();
                                                                return;
                                                            }
            
                                                            if (result.length == 0) {
                                                                r.db('chatapp').table('users').insert({ username: new_username, email: new_email, hash: new_hash }).run(conn, function(err, dbres) {
                                                                    if(err) {
                                                                        res.writeHead(500, err.message);
                                                                        res.end();
                                                                        return;
                                                                    }
                                                                    
                                                                    res.writeHead(200, {
                                                                        "Access-Control-Allow-Origin": "http://localhost",
                                                                        "Access-Control-Allow-Methods": "POST, GET",
                                                                        "Access-Control-Max-Age": 2592000,
                                                                        "Content-Type": getMIMEType(".json") + "; charset=UTF-8",
                                                                    });

                                                                    var token = generateToken();
                                                                    r.db('chatapp').table('users').filter(r.row('username').match("(?i)^" + new_username.toLowerCase() + "$")).update({token: token}).run(conn, function(err, dbres) {
                                                                        if(err) {
                                                                            res.writeHead(500, err.message);
                                                                            res.end();
                                                                            return;
                                                                        }

                                                                        res.write(`{"registerstatus": 0, "message": "Account created successfully"}`);
                                                                        res.end();
                                                                        return;
                                                                    });
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
                                                                return;
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
                                                    return;
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
                                    return;
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
                                return;
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
                                return;
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
                                return;
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
                            return;
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
                            return;
                        }
                    }
                });
            }
            // Client wants to login to an account
            else if (url == "/login") {
                var body = "";
        
                req.on('data', function (chunk) {
                    body += chunk;
        
                    const post = qs.parse(body);
        
                    var new_username = "";
                    var new_password = "";
        
                    var new_username = post['username'];
                    var new_password = post['password'];
        
                    if (new_username == null) new_username = "";
                    if (new_password == null) new_password = "";
                    
                    const usernameLengthCheck = (new_username.length <= 20 && new_username.length >= 3);
                    const passwordLengthCheck = (new_password.length <= 50 && new_password.length >= 8);
                    const usernameMatch = (new_username.match(/[^a-zA-Z0-9_]/g) == null);
        
                    const new_hash = hash(new_password);

                    // Database connect test
                    if (usernameLengthCheck && usernameMatch) {
                        if (passwordLengthCheck) {
                            // User log in
                            r.db('chatapp').table('users').run(conn, function(err, dbres) {
                                if(err) {
                                    res.writeHead(500, err.message);
                                    res.end();
                                    return;
                                }

                                r.db('chatapp').table('users').filter(r.row('username').match("(?i)^" + new_username.toLowerCase() + "$")).run(conn, function(err, cursor) {
                                    if (err) {
                                        res.writeHead(500, err.message);
                                        res.end();
                                        return;
                                    }

                                    cursor.toArray(function(err, result) {
                                        if (err) {
                                            res.writeHead(500, err.message);
                                            res.end();
                                            return;
                                        }

                                        if (result.length > 0) {
                                            r.db('chatapp').table('users').filter(r.row('hash').eq(new_hash)).run(conn, function(err, cursor) {
                                                if (err) {
                                                    res.writeHead(500, err.message);
                                                    res.end();
                                                    return;
                                                }

                                                cursor.toArray(function(err, result) {
                                                    if (err) {
                                                        res.writeHead(500, err.message);
                                                        res.end();
                                                        return;
                                                    }

                                                    if (result.length > 0) {
                                                        r.db('chatapp').table('users').filter(r.row('username').match("(?i)^" + new_username.toLowerCase() + "$")).run(conn, function(err, dbres) {
                                                            if(err) {
                                                                res.writeHead(500, err.message);
                                                                res.end();
                                                                return;
                                                            }
                                                            
                                                            dbres.toArray(function(err, result) {
                                                                if (err) {
                                                                    res.writeHead(500, err.message);
                                                                    res.end();
                                                                    return;
                                                                }

                                                                res.writeHead(200, {
                                                                    "Access-Control-Allow-Origin": "http://localhost",
                                                                    "Access-Control-Allow-Methods": "POST, GET",
                                                                    "Access-Control-Max-Age": 2592000,
                                                                    "Content-Type": getMIMEType(".json") + "; charset=UTF-8",
                                                                });

                                                                var token = generateToken();
                                                                
                                                                r.db('chatapp').table('users').filter(r.row('username').match("(?i)^" + new_username.toLowerCase() + "$")).update({token: token}).run(conn, function() {
                                                                    if (err) {
                                                                        res.write(`{"loginstatus": 1, "message": "Generating a token failed"}`);
                                                                        res.end();
                                                                        return;
                                                                    }
                                                                    
                                                                    res.write(`{"loginstatus": 0, "message": "Log in successful", "id": "` + result[0]['id'] + `", "username": "` + result[0]['username'] + `", "token": "` + token + `"}`);
                                                                    res.end();
                                                                    return;
                                                                });
                                                            });
                                                        });
                                                    }
                                                    else {
                                                        console.log("Wrong password");

                                                        res.writeHead(200, {
                                                            "Access-Control-Allow-Origin": "http://localhost",
                                                            "Access-Control-Allow-Methods": "POST, GET",
                                                            "Access-Control-Max-Age": 2592000,
                                                            "Content-Type": getMIMEType(".json") + "; charset=UTF-8",
                                                        });
                                                        res.write(`{"loginstatus": 1, "message": "Wrong password"}`);
                                                        res.end();
                                                        return;
                                                    }
                                                });
                                            });
                                        }
                                        else {
                                            console.log("User named \"" + new_username + "\" not found");

                                            res.writeHead(200, {
                                                "Access-Control-Allow-Origin": "http://localhost",
                                                "Access-Control-Allow-Methods": "POST, GET",
                                                "Access-Control-Max-Age": 2592000,
                                                "Content-Type": getMIMEType(".json") + "; charset=UTF-8",
                                            });
                                            res.write(`{"loginstatus": 1, "message": "User named ` + new_username + ` not found"}`);
                                            res.end();
                                            return;
                                        }
                                    });
                                });
                            });
                        }
                        else {
                            console.log("Password contains invalid amount of characters (8-50)");
        
                            res.writeHead(200, {
                                "Access-Control-Allow-Origin": "http://localhost",
                                "Access-Control-Allow-Methods": "POST, GET",
                                "Access-Control-Max-Age": 2592000,
                                "Content-Type": getMIMEType(".json") + "; charset=UTF-8",
                            });
                            res.write(`{"loginstatus": 1, "message": "Password contains invalid amount of characters (8-50)"}`);
                            res.end();
                            return;
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
                            res.write(`{"loginstatus": 1, "message": "Username contains invalid characters (Letters, numbers and _ only allowed)"}`);
                            res.end();
                            return;
                        }
                        else {
                            console.log("Username contains invalid amount of characters (3-20)");
        
                            res.writeHead(200, {
                                "Access-Control-Allow-Origin": "http://localhost",
                                "Access-Control-Allow-Methods": "POST, GET",
                                "Access-Control-Max-Age": 2592000,
                                "Content-Type": getMIMEType(".json") + "; charset=UTF-8",
                            });
                            res.write(`{"loginstatus": 1, "message": "Username contains invalid amount of characters (3-20)"}`);
                            res.end();
                            return;
                        }
                    }
                });
            }
        }
    });
}

// Generate a user token
function generateToken() {
    var result           = '';
    var characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var charactersLength = characters.length;
    for (var i = 0; i < 100; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
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
        });
    
        emojis.loadEmojis();

        // Start server
        server = http.createServer(requestListener);
        server.listen(port);

        if (server.listening == true) {
            console.log("Server started at http://localhost:" + port);
        }
    }
}
