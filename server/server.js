const http = require("https");
const fs = require("fs");
const path = require("path");
const qs = require("qs");
const entities = require("html-entities");
const r = require("rethinkdb");
const crypto = require("crypto");
const emojis = require("./emojis.js");
const { Server } = require("socket.io");
const client = require("./client.js");
const usermessage = require("./message.js");

// HTTP server variables
var server;
var conn = null;

// Socket.io
var io;

// Config settings
var port;
var webFolder;
var dbAddress;
var dbPort;

// Template code snippets
const userListButton = "<a href=\"@&USERNAMELINK\" id=\"user&UID\" name=\"user&UID\" class=\"users\"><div class=\"listUser\"><p id=\"listUserName&USERNAMELINK\" class=\"listUserName\"><span class=\"userStatus&ONLINESTATUS\"></span>&USERNAME</p></div></a>";
//const headerBackButton = "<a href=\"@me\" class=\"headerBack buttonRound\"><div style=\"background-image: url(../img/back-arrow.svg);background-position: center;background-size: contain;width: 100%;height: 100%;\"></div></a>";
const headerMenuButton = "<a onclick=\"openSideMenu();\" class=\"headerBack buttonRound\"><div style=\"background-image: url(../img/menu-lines.svg);background-position: center;background-size: contain;width: 100%;height: 100%;\"></div></a>";
const messageTemplate = "<div id=\"message&ID\" class=\"message\"><img src=\"../&AVATAR\" width=\"64\" height=\"64\" draggable=\"false\" class=\"messageAvatar\"><div class=\"messageContent\"><p class=\"messageUsername\">&USERNAME</p><div class=\"messageText\">&MESSAGE</div></div></div>";
//const theyBubble = "<div class=\"bubble bubbleLeft\">&MESSAGE</div>";
//const theyBubbleWName = "<div><img src=\"../&AVATAR\" width=\"32\" height=\"32\" style=\"float: left;display: block;top: 30px;position: relative;\"><p style=\"margin: 0;font-size: 18px;margin-left: 5px;float: left;left: -38px;bottom: -3px;position: relative;\">&USERNAME</p><div class=\"bubble bubbleLeft\" style=\"float: left;margin-right: 100%;margin-left: 36px;margin-top: -7px;\">&MESSAGE</div></div>";
//const meBubble = "<div class=\"bubble bubbleRight\">&MESSAGE</div>";
const indexContent = "<h2 id=\"welcomeText\" style=\"color: white;text-align: center;display: none;\">Welcome @&YOURUSERNAME</h2><p class=\"messageHistoryTitle\">&HISTORY</p><hr>&MESSAGEHISTORYSTARTSHERE<div id=\"chatUsersList\">&USERSLIST</div><p id=\"sendStatus\" class=\"bubbleSent\" style=\"display: none;\">Sent</p>";
const chatHistoryText = "Your message history with @&TITLEUSERNAME begins here.";
const meHistoryText = "Here is your friends list.";

var token = "";

// Parse user cookies
function parseCookies (request) {
    var list = {},
        rc = request.headers.cookie;

    rc && rc.split(";").forEach(function( cookie ) {
        var parts = cookie.split("=");
        list[parts.shift().trim()] = decodeURI(parts.join("="));
    });

    return list;
}
// Get MIME type
function getMIMEType(ext) {

    if (ext.startsWith(".") == false)
        ext = path.extname(ext);

    var array = fs.readFileSync("server/data/mimes.dat").toString().split("\n");
    
    if (array.filter(option => option.startsWith(ext + "\t")).length == 0) {
        return "text/plain";
    }
    else {
        var result = (array.filter(option => option.startsWith(ext + "\t")))[0].split("\t")[1].trim();
        return result;
    }
}
// Convert string to hash
function hash(stringtohash) {
    var hash = crypto.createHash("sha512");
    var data = hash.update(stringtohash + "Yc7vFy3WtaOP9a8YOlRi", "utf-8");
    var gen_hash = data.digest("hex");
    return gen_hash;
}

// Server

var url = "";
var mainpageTemplate = "";

function checkIfTokenValid(validatetoken, callbackFunction) {
    if (validatetoken == "") {
        callbackFunction(null, false);
    }
    else {
        r.db("chatapp").table("users").filter(r.row("token").match(validatetoken)).run(conn, function(err, dbres) {
            if(err) {
                callbackFunction(err, false);
            }
            
            dbres.toArray(function(err, result) {
                if (err) {
                    callbackFunction(err, false);
                }

                if (result.length == 0 || result[0] == undefined || result[0]["id"] == undefined || result[0]["id"] == null || result[0]["id"] == 0) {
                    callbackFunction(null, false);
                }
                else {
                    callbackFunction(null, true);
                }
            });
        });
    }
}
function getUserData(usertoken, callbackFunction) {
    r.db("chatapp").table("users").filter(r.row("token").match(usertoken)).run(conn, function(err, dbres) {
        if(err) {
            callbackFunction(err, null);
        }
        
        dbres.toArray(function(err, result) {
            if (err) {
                callbackFunction(err, null);
            }

            if (result.length == 0 || result[0] == undefined || result[0]["id"] == undefined || result[0]["id"] == null || result[0]["id"] == 0) {
                callbackFunction("User not found", null);
            }
            else {
                callbackFunction(null, result[0]);
            }
        });
    });
}
function getUserDataById(userid, callbackFunction) {
    r.db("chatapp").table("users").filter(r.row("id").match(userid)).run(conn, function(err, dbres) {
        if(err) {
            callbackFunction(err, null);
        }
        
        dbres.toArray(function(err, result) {
            if (err) {
                callbackFunction(err, null);
            }

            if (result.length == 0 || result[0] == undefined || result[0]["id"] == undefined || result[0]["id"] == null || result[0]["id"] == 0) {
                callbackFunction("User not found", null);
            }
            else {
                callbackFunction(null, result[0]);
            }
        });
    });
}
function preparePageTemplate(callbackFunction) {
    fs.readFile("./server/templates/mainpage.html", "utf-8", function (error, results) {
        if (error) {
            throw error;
        } else {
            mainpageTemplate = results;
            callbackFunction();
        }
    });
}
function getTemplate(templateFile, callback) {
    fs.readFile("./server/templates/" + templateFile, "utf-8", function (error, results) {
        if (error) {
            console.log(error.message);
            callback(error, null);
        } else {
            callback(null, results);
        }
    });
}
function getWebpage(callbackFunction) {
    fs.readFile(webFolder + url, "utf-8", function (error, results) {
        if (error) {
            console.log("File not found");
            callbackFunction(error, null);
        } else {
            callbackFunction(null, results);
        }
    });
}
function isUrlWebpage(url, req) {
    return (path.extname(url) == "" || path.extname(url) == ".html") && req.method == "GET";
}
function redirect(url, res) {
    res.writeHead(301,
        {Location: url}
    );
    res.end();
}
function getHeader(file) {
    var mime = getMIMEType(path.extname(file));
    var headers = {"Access-Control-Allow-Origin": "http://localhost",
        "Access-Control-Allow-Methods": "POST, GET",
        "Access-Control-Max-Age": 2592000,
        "Content-Type": mime + "; charset=UTF-8",
    };

    if (mime == "text/html") {
        headers["Cache-Control"] = "max-age=0";
    }
    else {
        headers["Cache-Control"] = "max-age=86400";
    }

    return headers;
}
function sendLoginStatus(res, status, message) {
    res.writeHead(200, getHeader(".json"));
    res.write("{\"loginstatus\": " + status + ", \"message\": \"" + message + "\"}");
    res.end();
}
function sendRegisterStatus(res, status, message) {
    console.log("Error: " + message);
    res.writeHead(200, getHeader(".json"));
    res.write("{\"registerstatus\": " + status + ", \"message\": \"" + message + "\"}");
    res.end();
}
function registerUser(res, new_username, new_email, new_hash) {
    // Duplicate username check
    r.db("chatapp").table("users").filter(r.row("username").match("(?i)^" + new_username.toLowerCase() + "$")).run(conn, function(err, cursor) {
        if (err) {
            res.writeHead(500, err.message);
            res.end();
        }
        else {
            cursor.toArray(function(err, result) {
                if (err) {
                    res.writeHead(500, err.message);
                    res.end();
                }
                else {
                    if (result.length == 0) {
                        // Duplicate email check
                        r.db("chatapp").table("users").filter(r.row("email").match("(?i)^" + new_email.toLowerCase() + "$")).run(conn, function(err, cursor) {
                            if (err) {
                                res.writeHead(500, err.message);
                                res.end();
                            }
                            else {
                                cursor.toArray(function(err, result) {
                                    if (err) {
                                        res.writeHead(500, err.message);
                                        res.end();
                                    }
                                    else {
                                        if (result.length == 0) {
                                            r.db("chatapp").table("users").insert({ username: new_username, email: new_email, hash: new_hash }).run(conn, function(err) {
                                                if(err) {
                                                    res.writeHead(500, err.message);
                                                    res.end();
                                                }
                                                else {
                                                    res.writeHead(200, getHeader(".json"));

                                                    var token = generateToken();
                                                    r.db("chatapp").table("users").filter(r.row("username").match("(?i)^" + new_username.toLowerCase() + "$")).update({token: token}).run(conn, function(err) {
                                                        if(err) {
                                                            res.writeHead(500, err.message);
                                                            res.end();
                                                        }
                                                        else {
                                                            res.write("{\"registerstatus\": 0, \"message\": \"Account created successfully\"}");
                                                            res.end();
                                                        }
                                                    });
                                                }
                                            });
                                        }
                                        else {
                                            sendRegisterStatus(res, 1, "Email is already in use");
                                        }
                                    }
                                });
                            }
                        });
                    }
                    else {
                        sendRegisterStatus(res, 1, "Username is not available");
                    }
                }
            });
        }
    });
}

// Listen for requests
function requestListener(req, res) {
    console.log(req.connection.remoteAddress + ": \"" + req.url + "\" (" + req.method + ")");

    // Get clients token from clients cookies
    var cookies = parseCookies(req);
    if (cookies["token"]) {
        token = cookies["token"];
    }
    else {
        token = "";
    }

    // Check if clients account token is valid
    checkIfTokenValid(token.toString(), function(validateError, validtoken) {

        if(validateError) {
            res.writeHead(500, { "message": validateError.message });
            res.end();
        }

        else {
            url = req.url;
            
            // If token is invalid and request is webpage return login page
            if (validtoken == false && isUrlWebpage(url, req)) {
                
                // Check if url is correct
                if (url !== "/signin") {
                    // Redirect to correct url
                    redirect("/signin", res);
                }

                // Return login page
                else {
                    url = "/l.html";
                    getWebpage(function (pageerror, pageres) {

                        if (pageerror) {
                            res.writeHead(404, { "message": "Page not found: " + url });
                            res.end();
                        }

                        else {
                            res.writeHead(200, getHeader(url));
                            res.write(mainpageTemplate.replace(/&TEMPLATE_BODY/, pageres));
                            res.end();
                        }

                    });
                }

            }

            // Token is valid or request is not a webpage
            else {

                // Request method is GET
                if (req.method == "GET") {

                    // Get user data and return webpage
                    if (isUrlWebpage(url, req)) {
                        
                        // Check if url is correct (/channel/@...)
                        if (url.startsWith("/channel/@")) {

                            // Get user data
                            getUserData(token.toString(), function(userdataError, userdata) {
                                
                                if (userdataError) {
                                    res.writeHead(500, { "message": "Failed to request user data: " + userdataError });
                                    res.end();
                                }
                                
                                // User data request success
                                else {

                                    // Load page
                                    r.db("chatapp").table("users").filter(r.row("username").match("(?i)^" + (url.slice(("/channel/@").length)).toLowerCase() + "$")).run(conn, function(err, dbres) {
                                        if(err) {
                                            res.writeHead(500, err.message);
                                            res.end();
                                        }
                                        else {
                                            dbres.toArray(function(err, result) {
                                                if(err) {
                                                    res.writeHead(500, err.message);
                                                    res.end();
                                                }
                                                else {
                                                    var chatUserId = 0;
                                                    var chatUser = "";
                    
                                                    // User exists
                                                    if (result.length > 0) {
                                                        chatUserId = result[0]["id"];
                                                        chatUser = result[0]["username"];
                                                    }

                                                    // User doesn't exist redirecting to @me
                                                    else {
                                                        if (url == "/channel/@me") {
                                                            chatUserId = 0;
                                                            chatUser = "me";
                                                        }
                                                        else if (url.startsWith("/channel/@p")) {
                                                            chatUserId = 0;
                                                            chatUser = url.split("@")[1];
                                                        }
                                                        else if (url.startsWith("/channel/@g")) {
                                                            chatUserId = 0;
                                                            chatUser = url.split("@")[1];
                                                        }
                                                        else {
                                                            redirect("/channel/@me", res);
                                                            return;
                                                        }
                                                    }

                                                    url = "/index.html";

                                                    // Load users page
                                                    if (chatUserId == 0) {

                                                        getWebpage(function (pageerror, pageres) {
                                    
                                                            if (pageerror) {
                                                                res.writeHead(404, { "message": "Page not found: " + url });
                                                                res.end();
                                                            }
                                    
                                                            else {
                                                                res.writeHead(200, getHeader(url));
                                                                res.write(mainpageTemplate
                                                                    .replace(/&TEMPLATE_BODY/, pageres)
                                                                    .replace(/&TITLEUSERNAME/g, "NeoChat")
                                                                    .replace(/&YOURUSERNAME/g, userdata["username"])
                                                                    .replace(/&HEADERLEFTBUTTON/g, headerMenuButton)
                                                                );
                                                                res.end();
                                                            }
                                    
                                                        });

                                                    }

                                                    // Load chat
                                                    else {
                                                        
                                                        getWebpage(function (pageerror, pageres) {
                                    
                                                            if (pageerror) {
                                                                res.writeHead(404, { "message": "Page not found: " + url });
                                                                res.end();
                                                            }
                                    
                                                            else {
                                                                
                                                                // Write page for client
                                                                res.writeHead(200, getHeader(url));
                                                                res.write(mainpageTemplate
                                                                    .replace(/&TEMPLATE_BODY/, pageres)
                                                                    .replace(/&TITLEUSERNAME/g, chatUser)
                                                                    .replace(/&YOURUSERNAME/g, userdata["username"])
                                                                    .replace(/&HEADERLEFTBUTTON/g, headerMenuButton)
                                                                );
                                                                res.end();

                                                            }
                                    
                                                        });

                                                    }
                                                }
                                            });
                                        }
                                    });

                                }

                            });

                        }
                        
                        // Url is not correct redirect to "/channel/@me"
                        else {
                            redirect("/channel/@me", res);
                        }

                    }

                    // Return resource/other than webpage file request
                    else {

                        if (getMIMEType(url) == "audio/mpeg" || getMIMEType(url) == "image/gif") {
                            res.writeHead(200, getHeader(url));
                            fs.exists(webFolder + url, function(exists){
                                if(exists)
                                {
                                    var rstream = fs.createReadStream(webFolder + url);
                                    rstream.pipe(res);
                                }
                                else
                                {
                                    res.end("Its a 404");
                                }
                            });

                        }

                        else {

                            fs.readFile(webFolder + url, "utf-8", function (error, results) {
    
                                if (error) {
                                    res.writeHead(404, { "message": "File not found" });
                                    res.end();
                                }
                                
                                // Return the file
                                else {
                                    res.writeHead(200, getHeader(url));
                                    res.write(results);
                                    res.end();
                                }
    
                            });

                        }

                    }

                }

                // Request method is POST
                else {
                    
                    // Get POST data
                    req.on("data", function (chunk) {
                        var body = "";
                        body += chunk;
            
                        const post = qs.parse(body);
            
                        var new_username = "";
                        var new_email = "";
                        var new_password = "";
                        var new_password2 = "";
            
                        // Client log in
                        if (url == "/login") {
                            new_username = post["username"];
                            new_password = post["password"];
                
                            if (new_username == null) new_username = "";
                            if (new_password == null) new_password = "";
                            
                            const usernameLengthCheck = (new_username.length <= 20 && new_username.length >= 3);
                            const passwordLengthCheck = (new_password.length <= 50 && new_password.length >= 8);
                            const usernameMatch = (new_username.match(/[^a-zA-Z0-9_]/g) == null);
                
                            const new_hash = hash(new_password);
        
                            if (usernameLengthCheck && usernameMatch) {
                                if (passwordLengthCheck) {
                                    r.db("chatapp").table("users").filter(r.row("username").match("(?i)^" + new_username.toLowerCase() + "$")).run(conn, function(err, cursor) {
                                        if (err) {
                                            res.writeHead(500, err.message);
                                            res.end();
                                        }
                                        else {
                                            cursor.toArray(function(err, result) {
                                                if (err) {
                                                    res.writeHead(500, err.message);
                                                    res.end();
                                                }
                                                else {
                                                    if (result.length > 0) {
                                                        if (new_hash == result[0]["hash"]) {
                                                            res.writeHead(200, getHeader(".json"));

                                                            var token = generateToken();
                                                            
                                                            r.db("chatapp").table("users").filter(r.row("username").match("(?i)^" + new_username.toLowerCase() + "$")).update({token: token}).run(conn, function() {
                                                                if (err) {
                                                                    res.write("{\"loginstatus\": 1, \"message\": \"Generating a token failed\"}");
                                                                    res.end();
                                                                }
                                                                else {
                                                                    res.write("{\"loginstatus\": 0, \"message\": \"Log in successful\", \"id\": \"" + result[0]["id"] + "\", \"username\": \"" + result[0]["username"] + "\", \"token\": \"" + token + "\"}");
                                                                    res.end();
                                                                }
                                                            });
                                                        }
                                                        else {
                                                            sendLoginStatus(res, 1, "Wrong username or password");
                                                        }
                                                    }
                                                    else {
                                                        sendLoginStatus(res, 1, "Wrong username or password");
                                                    }
                                                }
                                            });
                                        }
                                    });
                                }
                                else {
                                    sendLoginStatus(res, 1, "Password contains invalid amount of characters (8-50)");
                                }
                            }
                            else {
                                if (usernameLengthCheck) {
                                    sendLoginStatus(res, 1, "Username contains invalid characters (Letters, numbers and _ only allowed)");
                                }
                                else {
                                    sendLoginStatus(res, 1, "Username contains invalid amount of characters (3-20)");
                                }
                            }
                        }

                        // Create a new user
                        else if (url == "/register") {
                            new_username = post["username"];
                            new_email = post["email"];
                            new_password = post["password"];
                            new_password2 = post["password2"];
                
                            // Do this so null exception wont occur
                            if (new_username == null) new_username = "";
                            if (new_email == null) new_email = "";
                            if (new_password == null) new_password = "";
                            if (new_password2 == null) new_password2 = "";
                            
                            try {
                                // Credentials checks
                                const usernameLengthCheck = (new_username.length <= 20 && new_username.length >= 3);
                                const emailLengthCheck = (new_email.length <= 200 && new_email.length >= 5);
                                const passwordLengthCheck = (new_password.length <= 50 && new_password.length >= 8);
                                const usernameMatch = (new_username.match(/[^a-zA-Z0-9_]/g) == null);
                                const emailMatch = (new_email.match(/^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/g) !== null);
                    
                                const new_hash = hash(new_password);
            
                                if (usernameLengthCheck && usernameMatch) {
                                    if (emailLengthCheck && emailMatch) {
                                        if (passwordLengthCheck) {
                                            if (new_password == new_password2)
                                            {
                                                registerUser(res, new_username, new_email, new_hash);
                                            }
                                            else {
                                                sendRegisterStatus(res,1, "Passwords must match");
                                            }
                                        }
                                        else {
                                            sendRegisterStatus(res, 1, "Password contains invalid amount of characters (8-50)");
                                        }
                                    }
                                    else {
                                        if (emailLengthCheck) {
                                            sendRegisterStatus(res, 1, "Email is invalid");
                                        }
                                        else {
                                            sendRegisterStatus(res, 1, "Email contains invalid amount of characters (5-200)");
                                        }
                                    }
                                }
                                else {
                                    if (usernameLengthCheck) {
                                        sendRegisterStatus(res, 1, "Username contains invalid characters (Letters, numbers and _ only allowed)");
                                    }
                                    else {
                                        sendRegisterStatus(res, 1, "Username contains invalid amount of characters (3-20)");
                                    }
                                }
                            }
                            catch (ex) {
                                console.log("Error: " + ex.message);
                                sendRegisterStatus(res, 1, "Error: " + ex.message);
                            }
                        }
                        
                    });

                }

            }
        }
    
    });
}

// Generate a user token
function generateToken() {
    var result           = "";
    var characters       = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    var charactersLength = characters.length;
    for (var i = 0; i < 100; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}

var clients = [];

module.exports = class ChatServer {
    constructor(config) {
        console.log("Server instantiated");

        // Apply config values
        try {
            port = config["port"];
            webFolder = config["web-folder"];
            dbAddress = config["rethinkdb"];
            dbPort = config["rethinkdb-port"];
        }
        catch (ex) {
            throw "Failed to apply config: " + ex.message;
        }
        
        // Database connect test
        r.connect({ host: dbAddress, port: dbPort }, function(err, connection) {
            if(err) {
                throw "\u001b[31m" + err.message + "\n\n===========================\nDatabase connection failed!\nServer could not be started\n===========================\u001b[37m";
            }

            conn = connection;
        });
        
        emojis.loadEmojis();

        preparePageTemplate(function() {
            var httpOptions =  {
                key: fs.readFileSync("server/keys/key.pem"),
                cert: fs.readFileSync("server/keys/certificate.pem")
            };
            // Start server
            server = http.createServer(httpOptions, requestListener);
            server.listen(port);
            io = new Server(server);

            // socket.io connection
            io.on("connection", (socket) =>{
                console.log("User connected");

                // User disconnected
                socket.on("disconnect", () => {
                    console.log("User disconnected");

                    clients.forEach(c => {
                        if (c.socket !== null && c.socket.connected) {
                            clients.forEach(c2 => {
                                if (c2.socket == null || c2.socket.connected == false) {
                                    c.socket.emit("userstatus", { user: c2.username.toLowerCase(), status: 0 });
                                }
                            });
                        }
                    });
                });

                // Chat message handler
                socket.on("message", (username, token, msg) => {

                    if (token == null) {
                        token = "";
                    }

                    if (msg.length <= 500 && msg.trim() != "") {
                        
                        var post_message = entities.encode(msg).replace(/\n/g, "<br>");
                        var post_time = Date.now();
        
                        var emojiarray = new Array(post_message.match(/:[^:\s]*(?:::[^:\s])*:/g));
                        if (emojiarray[0] != null) {
                            for (var i = 0; i < emojiarray[0].length; i++) {
                                post_message = post_message.replace(emojiarray[0][i], emojis.findEmoji(emojiarray[0][i]));
                            }
                        }
                        
                        r.db("chatapp").table("users").filter(r.row("username").match("(?i)^" + username.toLowerCase() + "$")).run(conn, function(err, dbres) {
                        
                            if(err) {
                                console.log("User error " + err.message);
                            }
                            
                            else {
                                
                                dbres.toArray(function(err, result) {
    
                                    if (err) {
                                        console.log("User error " + err.message);
                                    }
    
                                    else {
    
                                        if (result.length == 0 || result[0] == undefined || result[0]["id"] == undefined || result[0]["id"] == null || result[0]["id"] == 0) {
                                            
                                            if (username.toLowerCase() == "p") {
                                                
                                                getUserData(token.toString(), function(userdataError, userdata) {
                                                    
                                                    if (userdataError) {
                                                        console.log(userdataError.message);
                                                    }
                                                    else {
                                                        console.log("Message (to " + userdata["username"] + "'s profile): " + msg);
            
                                                        r.db("chatapp").table("profile_comments").insert({ profileid: userdata["id"], userfrom: userdata["id"], message: post_message, time: post_time }).run(conn, function(err) {
                                                            if(err) {
                                                                console.log("Failed to send message: " + err.message);
                                                            }
                                                        });
                                                    }
                                
                                                });

                                            }
                                            else if (username.toLowerCase() == "g") {
                                                
                                                getUserData(token.toString(), function(userdataError, userdata) {
                                                    
                                                    if (userdataError) {
                                                        console.log(userdataError.message);
                                                    }
                                                    else {
                                                        console.log("Message (to general): " + msg);
            
                                                        r.db("chatapp").table("messages").insert({ userto: "general", userfrom: userdata["id"], message: post_message, time: post_time }).run(conn, function(err, result) {
                                                            if(err) {
                                                                console.log("Failed to send message: " + err.message);
                                                            }
                                                            else {
                                                                clients.forEach(c => {
                                                                    getClientById(c["id"], function (mclient) {
                                                                        if (mclient !== undefined && mclient !== null && mclient.socket !== undefined && mclient.socket !== null && mclient.socket.connected) {
                                                                            if (userdataError) {
                                                                                //console.log("Failed to request user data: " + userdataError);
                                                                            }
                                                                            
                                                                            else {
                                                                                var fromuser = userdata["username"].toLowerCase();
                                                                                
                                                                                console.log(post_message);
                                                                                createMessage(userdata["id"], result["generated_keys"], post_message.replace(/<br>/g, "\n"), post_time, function (mes) {
                                                                                    mclient.socket.emit("message", { from: fromuser, message: post_message.replace(/<br>/g, "\n"), general: true, element: createBubble(mes) });
                                                                                });
                                                                            }
                                                                        }
                                                                    
                                                                    });
                                                                });
                                                            }
                                                        });
                                                    }
                                
                                                });

                                            }
                                            else {
                                                console.log("User result null");
                                            }
                                        
                                        }
                                        else {
                                            var clientid = result[0]["id"];
    
                                            console.log("Message (to " + username + "): " + msg);

                                            getUserData(token.toString(), function(userdataError, userdata) {
                                                
                                                if (userdataError) {
                                                    console.log(userdataError.message);
                                                }
                                                else {
                                                    r.db("chatapp").table("messages").insert({ userfrom: userdata["id"], userto: clientid, message: post_message, time: post_time }).run(conn, function(err, re) {
                                                        if(err) {
                                                            console.log("Failed to send message: " + err.message);
                                                        }
                                                        else {
                                                            
                                                            getClientById(clientid.toString(), function (mclient) {
                                                                if (mclient !== undefined && mclient !== null && mclient.socket !== undefined && mclient.socket !== null && mclient.socket.connected) {
                                                                    if (userdataError) {
                                                                        //console.log("Failed to request user data: " + userdataError);
                                                                    }
                                                                    
                                                                    else {
                                                                        var fromuser = userdata["username"].toLowerCase();
                                                                        
                                                                        createMessage(userdata["id"], re["generated_keys"], post_message, post_time, function (mes) {
                                                                            mclient.socket.emit("message", { from: fromuser, message: post_message, general: true, element: createBubble(mes) });
                                                                            socket.emit("message", { from: fromuser, message: post_message, general: true, element: createBubble(mes) });
                                                                        });
                                                                    }
                                                                }
                                                            
                                                            });

                                                        }
                                                    });
                                                }
                            
                                            });

                                        }
    
                                    }
                                });
    
                            }
    
                        });
                    }
                    
                });

                // Set client token
                socket.on("settoken", (token) => {

                    if (token == null) {
                        token = "";
                    }

                    getUserData(token.toString(), function(userdataError, userdata) {
                                
                        if (userdataError) {
                            //console.log("Failed to request user data: " + userdataError);
                        }
                        
                        // User data request success
                        else {

                            var clientid = userdata["id"];
                            var clientname = userdata["username"];

                            socket.emit("setusername", clientname);
                            
                            setClientSocket(clientid, clientname, socket, function () {

                                clients.forEach(c => {
                                    if (c.id !== clientid && c.socket !== null && c.socket.connected) {
                                        c.socket.emit("userstatus", { user: clientname.toLowerCase(), status: 1 });
                                        socket.emit("userstatus", { user: c.username.toLowerCase(), status: 1 });
                                    }
                                });

                            });

                        }

                    });

                });

                // Get users status
                socket.on("getuserstatus", (username, token) => {

                    if (token == null) {
                        token = "";
                    }

                    // User data request success
                    r.db("chatapp").table("users").filter(r.row("username").match("(?i)^" + username.toLowerCase() + "$")).run(conn, function(err, dbres) {
                    
                        if(err) {
                            console.log("User error " + err.message);
                        }
                        
                        else {
                            
                            dbres.toArray(function(err, result) {

                                if (err) {
                                    console.log("User error " + err.message);
                                }

                                else {

                                    if (result.length == 0 || result[0] == undefined || result[0]["id"] == undefined || result[0]["id"] == null || result[0]["id"] == 0) {
                                        console.log("User result null");
                                    }
                                    else {
                                        var clientid = result[0]["id"];

                                        console.log("Request user status of " + username);

                                        getClientById(clientid, function (c) {
                                            if (c !== null && c.socket !== null && c.socket.connected == true) {
                                                socket.emit("userstatus", { user: username.toLowerCase(), status: 1 });
                                            }
    
                                            else {
                                                socket.emit("userstatus", { user: username.toLowerCase(), status: 0 });
                                            }
                                        });

                                    }

                                }
                            });

                        }

                    });

                });

                // Set users status
                socket.on("setuserstatus", (status, token) => {

                    if (token == null) {
                        token = "";
                    }

                    getUserData(token.toString(), function(userdataError, userdata) {
                                                        
                        if (userdataError) {
                            //console.log("Failed to request user data: " + userdataError);
                        }
                        
                        else {

                            clients.forEach(c => {
                                if (c.socket !== null && c.socket.connected) {
                                    c.socket.emit("userstatus", { user: userdata["username"].toLowerCase(), status: status });
                                }
                            });

                        }
    
                    });

                });

                socket.on("loadmoremsg", (targetId, token, lastMessage) => {
                    if (token === undefined || token === null) {
                        socket.emit("page", 500, "Token invalid...", null);
                    }
                    else {
                        // Get user data
                        getUserData(token.toString(), function(userdataError, userdata) {
                            
                            if (userdataError) {
                                socket.emit("page", 500, "Failed to request user data: " + userdataError, null);
                            }
                            
                            // User data request success
                            else {
    
                                var chatMessages = new Array();
                                var addHistory = "";
    
                                // Get sent messages
                                r.db("chatapp").table("messages").filter({userfrom: userdata["id"], userto: targetId}).run(conn, function(err, dbres) {
                                    
                                    if(err) {
                                        socket.emit("page", 500, err.message, null);
                                    }
                                    
                                    else {
    
                                        dbres.toArray(function(err, result) {
    
                                            if(err) {
                                                socket.emit("page", 500, err.message, null);
                                            }
                                            
                                            else {
    
                                                // Add messages to chat array
                                                result.forEach(element => {
                                                    chatMessages.push(element);
                                                });
                                                
                                                // Get received messages
                                                r.db("chatapp").table("messages").filter({userto: userdata["id"], userfrom: targetId}).run(conn, function(err, dbres) {
                                                    
                                                    if(err) {
                                                        socket.emit("page", 500, err.message, null);
                                                    }
    
                                                    else {
    
                                                        dbres.toArray(function(err, result) {
                                                            
                                                            if(err) {
                                                                socket.emit("page", 500, err.message, null);
                                                            }
    
                                                            else {
                                                                
                                                                // Add messages to chat array
                                                                result.forEach(element => {
                                                                    chatMessages.push(element);
                                                                });
    
                                                                // Sort chat messages by time
                                                                chatMessages = chatMessages.sort(function (a, b) {
                                                                    return b.time - a.time;
                                                                });
    
                                                                var removeFromList = new Array();
                                                                var loopDone = false;
    
                                                                chatMessages.forEach(element => {
                                                                    
                                                                    if (!loopDone) {
                                                                        removeFromList.push(element);
                                                                        
                                                                        if (lastMessage == element["id"]) {
                                                                            loopDone = true;
                                                                        }
                                                                    }
    
                                                                });
    
                                                                chatMessages = chatMessages.filter(function(el) {
                                                                    return removeFromList.indexOf(el) < 0;
                                                                });
                                                                
                                                                chatMessages.splice(10, chatMessages.length - 5);
    
                                                                if (chatMessages.length == 0) {
                                                                    socket.emit("nomorehistory");
                                                                }
                                                                else {
                                                                    var lastId = "";
                                                                    chatMessages.forEach(element => { lastId = element["id"]; });
                                                                    
                                                                    chatMessages.reverse();
    
                                                                    var l = chatMessages.length - 1;
    
                                                                    // Loop through messages and add them to display on webpage
                                                                    chatMessages.forEach(element => {
    
                                                                        var m_userfrom = element["userfrom"];
                                                                        var m_message = element["message"];
                                                                        
                                                                        createMessage(m_userfrom, element["id"], entities.decode(m_message), element["time"], function (mes) {
                                                                            addHistory += createBubble(mes);
    
                                                                            if (l == 0) {
                                                                    
                                                                                // Convert messages emoji tags to emojis
                                                                                var emojiarray = new Array(addHistory.match(/:[^:\s]*(?:::[^:\s])*:/g));
                                                                                if (emojiarray[0] != null)
                                                                                {
                                                                                    for (var i = 0; i < emojiarray[0].length; i++) {
                                                                                        addHistory = addHistory.replace(emojiarray[0][i], emojis.findEmoji(emojiarray[0][i]));
                                                                                    }
                                                                                }
                    
                                                                                socket.emit("addhistory", addHistory, lastId);
    
                                                                            }
    
                                                                            l--;
                                                                        });
                                                                        
                                                                    });
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
    
                        });
                    }
            
                });

                socket.on("getpage", (url, token) => {
                    
                    // Check if url is correct (/channel/@...)
                    if (url.startsWith("/channel/@")) {

                        if (token === undefined || token === null) {
                            socket.emit("redirect", "/signin");
                        }
                        else {
                            // Get user data
                            getUserData(token.toString(), function(userdataError, userdata) {
                                
                                if (userdataError) {
                                    socket.emit("page", 500, "Failed to request user data: " + userdataError, null);
                                }
                                
                                // User data request success
                                else {

                                    var clientid = userdata["id"];
                                    var clientname = userdata["username"];

                                    // Load page
                                    r.db("chatapp").table("users").filter(r.row("username").match("(?i)^" + (url.slice(("/channel/@").length)).toLowerCase() + "$")).run(conn, function(err, dbres) {
                                        if(err) {
                                            socket.emit("page", 500, err.message, null);
                                        }
                                        else {
                                            dbres.toArray(function(err, result) {
                                                if(err) {
                                                    socket.emit("page", 500, err.message, null);
                                                }
                                                else {
                                                    var chatUserId = 0;
                                                    var chatUser = "";
                    
                                                    // User exists
                                                    if (result.length > 0) {
                                                        chatUserId = result[0]["id"];
                                                        chatUser = result[0]["username"];
                                                    }

                                                    // User doesn't exist redirecting to @me
                                                    else {
                                                        chatUserId = 0;
                                                        chatUser = (url.slice(("/channel/@").length)).toLowerCase();
                                                    }

                                                    // Load chat
                                                    var chatMessages = new Array();
                                                    var msghistory = "";
                                                    
                                                    if (chatUser.startsWith("p")) {

                                                        var pusername = (url.slice(("/channel/@p").length).replace("/", "")).toLowerCase();

                                                        r.db("chatapp").table("users").filter(r.row("username").match("(?i)^" + pusername + "$")).run(conn, function(err, dbres) {
                                                            if(err) {
                                                                socket.emit("page", 500, err.message, null);
                                                            }
                                                            else {

                                                                dbres.toArray(function(err, result) {
                                                                    if(err) {
                                                                        socket.emit("page", 500, err.message, null);
                                                                    }
                                                                    else {

                                                                        var id = "";
                                                                        
                                                                        if (result.length > 0) {
                                                                            id = result[0]["id"];
                                                                            pusername = result[0]["username"];
                                                                        }
                                                                        else {
                                                                            id = userdata["id"];
                                                                            pusername = userdata["username"];
                                                                        }
                                                                        
                                                                        // Get sent messages
                                                                        r.db("chatapp").table("profile_comments").filter({profileid: id}).run(conn, function(err, dbres) {
                                                                            
                                                                            if(err) {
                                                                                socket.emit("page", 500, err.message, null);
                                                                            }
                                                                            
                                                                            else {
                        
                                                                                dbres.toArray(function(err, result) {
                            
                                                                                    if(err) {
                                                                                        socket.emit("page", 500, err.message, null);
                                                                                    }
                                                                                    
                                                                                    else {
                            
                                                                                        // Add messages to chat array
                                                                                        result.forEach(element => {
                                                                                            chatMessages.push(element);
                                                                                        });
                                                                                        
                                                                                        // Sort chat messages by time
                                                                                        chatMessages = chatMessages.sort(function (a, b) {
                                                                                            return b.time - a.time;
                                                                                        });
                                                                                        
                                                                                        chatMessages.splice(10, chatMessages.length - 5);

                                                                                        var lastId = "";
                                                                                        chatMessages.forEach(element => { lastId = element["id"]; });
                                                                                        
                                                                                        chatMessages.reverse();

                                                                                        var l = chatMessages.length - 1;

                                                                                        // Loop through messages and add them to display on webpage
                                                                                        chatMessages.forEach(element => {
            
                                                                                            var m_userfrom = element["userfrom"];
                                                                                            var m_message = element["message"];

                                                                                            createMessage(m_userfrom, element["id"], entities.decode(m_message), element["time"], function (mes) {
                                                                                                msghistory += createBubble(mes);
                            
                                                                                                if (l == 0) {

                                                                                                    // Convert messages emoji tags to emojis
                                                                                                    var emojiarray = new Array(msghistory.match(/:[^:\s]*(?:::[^:\s])*:/g));
                                                                                                    if (emojiarray[0] != null)
                                                                                                    {
                                                                                                        for (var i = 0; i < emojiarray[0].length; i++) {
                                                                                                            msghistory = msghistory.replace(emojiarray[0][i], emojis.findEmoji(emojiarray[0][i]));
                                                                                                        }
                                                                                                    }
                        
                                                                                                    var h = "";
                                                                                                    h = "This is your profile.";
                                                                                                    chatUser = pusername;
                                                                                                    
                                                                                                    getTemplate("profile.html", function (err, results) {
                                                                                                        if (!err) {
                                                                                                            // Write page for client
                                                                                                            socket.emit("page", 200, results
                                                                                                                .replace("&MESSAGEHISTORYSTARTSHERE", "<div id=\"messagehistory\">" + msghistory + "</div>")
                                                                                                                .replace(/&YOURUSERNAME/g, chatUser)
                                                                                                                .replace("&USERSLIST", "")
                                                                                                                .replace("&HISTORY", h)
                                                                                                                .replace(/&TITLEUSERNAME/g, chatUser)
                                                                                                                .replace(/&AVATAR/g, getDefaultAvatar(chatUser))
                                                                                                            , chatUserId, chatUser, lastId);
                                                                                                        }
                                                                                                    });
                        
                                                                                                    clients.forEach(c => {
                                                                                                        if (c.id !== clientid && c.socket !== null && c.socket.connected) {
                                                                                                            c.socket.emit("userstatus", { user: clientname.toLowerCase(), status: 1 });
                                                                                                            socket.emit("userstatus", { user: c.username.toLowerCase(), status: 1 });
                                                                                                        }
                                                                                                    });
                            
                                                                                                }
                            
                                                                                                l--;
                                                                                            });
            
                                                                                        });
                            
                                                                                    }
                            
                                                                                });
                            
                                                                            }
                            
                                                                        });
                                                                    }
                                                                });
                    
                                                            }
                
                                                        });
                                                    }
                                                    else if (chatUser.startsWith("g")) {

                                                        // Get sent messages
                                                        r.db("chatapp").table("messages").filter({userto: "general"}).run(conn, function(err, dbres) {
                                                            
                                                            if(err) {
                                                                socket.emit("page", 500, err.message, null);
                                                            }
                                                            
                                                            else {
        
                                                                dbres.toArray(function(err, result) {
            
                                                                    if(err) {
                                                                        socket.emit("page", 500, err.message, null);
                                                                    }
                                                                    
                                                                    else {
            
                                                                        // Add messages to chat array
                                                                        result.forEach(element => {
                                                                            chatMessages.push(element);
                                                                        });
                                                                        
                                                                        // Sort chat messages by time
                                                                        chatMessages = chatMessages.sort(function (a, b) {
                                                                            return b.time - a.time;
                                                                        });

                                                                        chatMessages.splice(10, chatMessages.length - 5);

                                                                        var unknownIds = [];

                                                                        var lastId = "";
                                                                        chatMessages.forEach(element => { lastId = element["id"]; });
                                                                        
                                                                        chatMessages.reverse();
                                                                        
                                                                        var l = chatMessages.length - 1;

                                                                        // Loop through messages and add them to display on webpage
                                                                        chatMessages.forEach(element => {

                                                                            var m_userfrom = element["userfrom"];
                                                                            var m_message = element["message"];
                                                                            
                                                                            // Message is sent by client
                                                                            if (m_userfrom == userdata["id"]) {
                                                                                createMessage(m_userfrom, element["id"], entities.decode(m_message), element["time"], function (mes) {
                                                                                    msghistory += createBubble(mes);
                            
                                                                                    if (l == 0) {
                                                                        
                                                                                        unknownIds.forEach(id => {
                                                                                            getUserDataById(id, function (err, clientres) {
                                                                                                if (!err) {
                                                                                                    msghistory = msghistory.replaceAll("&" + id, clientres["username"]).replaceAll("&AVATAR" + id, getDefaultAvatar(clientres["username"]));
                                                                                                }
                                                                                            });
                                                                                        });
                                                                                            
                                                                                        // Convert messages emoji tags to emojis
                                                                                        var emojiarray = new Array(msghistory.match(/:[^:\s]*(?:::[^:\s])*:/g));
                                                                                        if (emojiarray[0] != null)
                                                                                        {
                                                                                            for (var i = 0; i < emojiarray[0].length; i++) {
                                                                                                msghistory = msghistory.replace(emojiarray[0][i], emojis.findEmoji(emojiarray[0][i]));
                                                                                            }
                                                                                        }
                    
                                                                                        var h = "";
                                                                                        h = "This is your profile.";
                                                                                        chatUser = "general";
                                                                                        
                                                                                        getTemplate("channelheader.html", function (err, results) {
                                                                                            if (!err) {
                                                                                                // Write page for client
                                                                                                socket.emit("page", 200, results
                                                                                                    .replace("&MESSAGEHISTORYSTARTSHERE", "<div id=\"messagehistory\">" + msghistory + "</div>")
                                                                                                    .replace(/&YOURUSERNAME/g, userdata["username"])
                                                                                                    .replace("&USERSLIST", "")
                                                                                                    .replace("&HISTORY", h)
                                                                                                    .replace(/&CHANNEL/g, chatUser)
                                                                                                , chatUserId, chatUser, lastId);
                                                                                            }
                                                                                        });
                    
                                                                                        clients.forEach(c => {
                                                                                            if (c.id !== clientid && c.socket !== null && c.socket.connected) {
                                                                                                c.socket.emit("userstatus", { user: clientname.toLowerCase(), status: 1 });
                                                                                                socket.emit("userstatus", { user: c.username.toLowerCase(), status: 1 });
                                                                                            }
                                                                                        });
                
                                                                                    }
                
                                                                                    l--;
                                                                                });
                                                                            }
                                                                            // Client has received the message
                                                                            else {
                                                                                createMessage(m_userfrom, element["id"], entities.decode(m_message), element["time"], function (mes) {
                                                                                    msghistory += createBubble(mes);
                            
                                                                                    if (l == 0) {
                                                                        
                                                                                        unknownIds.forEach(id => {
                                                                                            getUserDataById(id, function (err, clientres) {
                                                                                                if (!err) {
                                                                                                    msghistory = msghistory.replaceAll("&" + id, clientres["username"]).replaceAll("&AVATAR" + id, getDefaultAvatar(clientres["username"]));
                                                                                                }
                                                                                            });
                                                                                        });
                                                                                            
                                                                                        // Convert messages emoji tags to emojis
                                                                                        var emojiarray = new Array(msghistory.match(/:[^:\s]*(?:::[^:\s])*:/g));
                                                                                        if (emojiarray[0] != null)
                                                                                        {
                                                                                            for (var i = 0; i < emojiarray[0].length; i++) {
                                                                                                msghistory = msghistory.replace(emojiarray[0][i], emojis.findEmoji(emojiarray[0][i]));
                                                                                            }
                                                                                        }
                    
                                                                                        var h = "";
                                                                                        h = "This is your profile.";
                                                                                        chatUser = "general";
                                                                                        
                                                                                        getTemplate("channelheader.html", function (err, results) {
                                                                                            if (!err) {
                                                                                                // Write page for client
                                                                                                socket.emit("page", 200, results
                                                                                                    .replace("&MESSAGEHISTORYSTARTSHERE", "<div id=\"messagehistory\">" + msghistory + "</div>")
                                                                                                    .replace(/&YOURUSERNAME/g, userdata["username"])
                                                                                                    .replace("&USERSLIST", "")
                                                                                                    .replace("&HISTORY", h)
                                                                                                    .replace(/&CHANNEL/g, chatUser)
                                                                                                , chatUserId, chatUser, lastId);
                                                                                            }
                                                                                        });
                    
                                                                                        clients.forEach(c => {
                                                                                            if (c.id !== clientid && c.socket !== null && c.socket.connected) {
                                                                                                c.socket.emit("userstatus", { user: clientname.toLowerCase(), status: 1 });
                                                                                                socket.emit("userstatus", { user: c.username.toLowerCase(), status: 1 });
                                                                                            }
                                                                                        });
                
                                                                                    }
                
                                                                                    l--;
                                                                                });
                                                                        
                                                                                if (!unknownIds.includes(m_userfrom)) {
                                                                                    unknownIds.push(m_userfrom);
                                                                                }
                                                                            }

                                                                        });
            
                                                                    }
            
                                                                });
            
                                                            }
            
                                                        });
                                                        
                                                    }
                                                    else if (chatUser.startsWith("me")) {
                                                        getTemplate("welcome.html", function (err, results) {
                                                            if (!err) {
                                                                // Write page for client
                                                                socket.emit("page", 200, results
                                                                    .replace("&MESSAGEHISTORYSTARTSHERE", "<div id=\"messagehistory\">" + msghistory + "</div>")
                                                                    .replace(/&YOURUSERNAME/g, userdata["username"])
                                                                    .replace("&USERSLIST", "")
                                                                    .replace("&HISTORY", "h")
                                                                    .replace(/&CHANNEL/g, chatUser)
                                                                , chatUserId, chatUser, null);
                                                            }
                                                        });
                                                    }
                                                    else if (chatUser.startsWith("se")) {
                                                        getTemplate("settings.html", function (err, results) {
                                                            if (!err) {
                                                                // Write page for client
                                                                socket.emit("page", 200, results
                                                                    .replace(/&YOURUSERNAME/g, userdata["username"])
                                                                    .replace(/&YOUREMAIL/g, userdata["email"])
                                                                    .replace(/&CHANNEL/g, chatUser)
                                                                , chatUserId, chatUser, null);
                                                            }
                                                        });
                                                    }
                                                    else {
                                                        // Get sent messages
                                                        r.db("chatapp").table("messages").filter({userfrom: userdata["id"], userto: chatUserId}).run(conn, function(err, dbres) {
                                                            
                                                            if(err) {
                                                                socket.emit("page", 500, err.message, null);
                                                            }
                                                            
                                                            else {
        
                                                                dbres.toArray(function(err, result) {
        
                                                                    if(err) {
                                                                        socket.emit("page", 500, err.message, null);
                                                                    }
                                                                    
                                                                    else {
        
                                                                        // Add messages to chat array
                                                                        result.forEach(element => {
                                                                            chatMessages.push(element);
                                                                        });
                                                                        
                                                                        // Get received messages
                                                                        r.db("chatapp").table("messages").filter({userto: userdata["id"], userfrom: chatUserId}).run(conn, function(err, dbres) {
                                                                            
                                                                            if(err) {
                                                                                socket.emit("page", 500, err.message, null);
                                                                            }
        
                                                                            else {
        
                                                                                dbres.toArray(function(err, result) {
                                                                                    
                                                                                    if(err) {
                                                                                        socket.emit("page", 500, err.message, null);
                                                                                    }
        
                                                                                    else {

                                                                                        if (result.length == 0) {
                                                                                            var h = chatHistoryText;
                                                                                            
                                                                                            getTemplate("chatheader.html", function (err, results) {
                                                                                                if (!err) {
                                                                                                    // Write page for client
                                                                                                    socket.emit("page", 200, indexContent
                                                                                                        .replace(/&CONTENTHEADER/g, results)
                                                                                                        .replace("&MESSAGEHISTORYSTARTSHERE", "<div id=\"messagehistory\">" + msghistory + "</div>")
                                                                                                        .replace(/&YOURUSERNAME/g, userdata["username"])
                                                                                                        .replace("&USERSLIST", "")
                                                                                                        .replace("&HISTORY", h)
                                                                                                        .replace(/&TITLEUSERNAME/g, chatUser)
                                                                                                    , chatUserId, chatUser, lastId);
                                                                                                }
                                                                                            });
        
                                                                                            clients.forEach(c => {
                                                                                                if (c.id !== clientid && c.socket !== null && c.socket.connected) {
                                                                                                    c.socket.emit("userstatus", { user: clientname.toLowerCase(), status: 1 });
                                                                                                    socket.emit("userstatus", { user: c.username.toLowerCase(), status: 1 });
                                                                                                }
                                                                                            });
                                                                                        }
                                                                                        else {
                                                                                            // Add messages to chat array
                                                                                            result.forEach(element => {
                                                                                                chatMessages.push(element);
                                                                                            });
            
                                                                                            // Sort chat messages by time
                                                                                            chatMessages = chatMessages.sort(function (a, b) {
                                                                                                return b.time - a.time;
                                                                                            });
                                                                                            
                                                                                            chatMessages.splice(10, chatMessages.length - 5);
        
                                                                                            var lastId = "";
                                                                                            chatMessages.forEach(element => { lastId = element["id"]; });
                                                                                            
                                                                                            chatMessages.reverse();
        
                                                                                            var l = chatMessages.length - 1;
        
                                                                                            // Loop through messages and add them to display on webpage
                                                                                            chatMessages.forEach(element => {
            
                                                                                                var m_userfrom = element["userfrom"];
                                                                                                var m_message = element["message"];
                                                                                                
                                                                                                createMessage(m_userfrom, element["id"], entities.decode(m_message), element["time"], function (mes) {
                                                                                                    msghistory += createBubble(mes);
                                
                                                                                                    if (l == 0) {
                                                                                            
                                                                                                        // Convert messages emoji tags to emojis
                                                                                                        var emojiarray = new Array(msghistory.match(/:[^:\s]*(?:::[^:\s])*:/g));
                                                                                                        if (emojiarray[0] != null)
                                                                                                        {
                                                                                                            for (var i = 0; i < emojiarray[0].length; i++) {
                                                                                                                msghistory = msghistory.replace(emojiarray[0][i], emojis.findEmoji(emojiarray[0][i]));
                                                                                                            }
                                                                                                        }
                        
                                                                                                        var h = "";
                        
                                                                                                        if (chatUser == "me") {
                                                                                                            h = meHistoryText;
                                                                                                        }
                                                                                                        else {
                                                                                                            h = chatHistoryText;
                                                                                                        }
                        
                                                                                                        h = chatHistoryText;
                                                                                            
                                                                                                        if (chatUser == "me") {
                                                                                                            h = meHistoryText;
                    
                                                                                                            getTemplate("welcome.html", function (err, results) {
                                                                                                                if (!err) {
                                                                                                                    // Write page for client
                                                                                                                    socket.emit("page", 200, indexContent
                                                                                                                        .replace(/&CONTENTHEADER/g, results)
                                                                                                                        .replace("&MESSAGEHISTORYSTARTSHERE", "<div id=\"messagehistory\">" + msghistory + "</div>")
                                                                                                                        .replace(/&YOURUSERNAME/g, userdata["username"])
                                                                                                                        .replace("&USERSLIST", "")
                                                                                                                        .replace("&HISTORY", h)
                                                                                                                        .replace(/&TITLEUSERNAME/g, chatUser)
                                                                                                                    , chatUserId, chatUser, lastId);
                                                                                                                }
                                                                                                            });
                                                                                                        }
                                                                                                        else {
                                                                                                            h = chatHistoryText;
                                                                                                            
                                                                                                            getTemplate("chatheader.html", function (err, results) {
                                                                                                                if (!err) {
                                                                                                                    // Write page for client
                                                                                                                    socket.emit("page", 200, indexContent
                                                                                                                        .replace(/&CONTENTHEADER/g, results)
                                                                                                                        .replace("&MESSAGEHISTORYSTARTSHERE", "<div id=\"messagehistory\">" + msghistory + "</div>")
                                                                                                                        .replace(/&YOURUSERNAME/g, userdata["username"])
                                                                                                                        .replace("&USERSLIST", "")
                                                                                                                        .replace("&HISTORY", h)
                                                                                                                        .replace(/&TITLEUSERNAME/g, chatUser)
                                                                                                                    , chatUserId, chatUser, lastId);
                                                                                                                }
                                                                                                            });
                                                                                                        }
                    
                                                                                                        clients.forEach(c => {
                                                                                                            if (c.id !== clientid && c.socket !== null && c.socket.connected) {
                                                                                                                c.socket.emit("userstatus", { user: clientname.toLowerCase(), status: 1 });
                                                                                                                socket.emit("userstatus", { user: c.username.toLowerCase(), status: 1 });
                                                                                                            }
                                                                                                        });
                                
                                                                                                    }
                                
                                                                                                    l--;
                                                                                                });
            
                                                                                            });
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
                                                }
                                            });
                                        }
                                    });

                                }

                            });

                        }

                    }
                });

                // Load user list
                socket.on("getuserlist", (token) => {
                    
                    getUserData(token, function (err, userdata) {

                        if(err) {
                            socket.emit("page", 500, err.message, null);
                        }

                        else {

                            r.db("chatapp").table("users").run(conn, function(err, dbres) {
                                if(err) {
                                    socket.emit("page", 500, err.message, null);
                                }
                                else {
                                    var list = "";

                                    list = "<a href=\"@me\" id=\"userme\" name=\"userme\" class=\"users\"><div class=\"listUser\"><p id=\"listUserNameme\" class=\"listUserName\"><span class=\"friendsIcon\" style=\"line-height: 1.2;\"></span>Friends</p></div></a>";
                                    list += "<a href=\"@p\" id=\"userp\" name=\"userp\" class=\"users\"><div class=\"listUser\"><p id=\"listUserNamep\" class=\"listUserName\"><span class=\"profileIcon\" style=\"line-height: 1.2;\"></span>Profile</p></div></a>";
                                    list += "<a href=\"@g\" id=\"userg\" name=\"userg\" class=\"users\"><div class=\"listUser\"><p id=\"listUserNameg\" class=\"listUserName\"><span class=\"generalIcon\" style=\"line-height: 1.2;\"></span>General</p></div></a>";
                                    list += "<a href=\"@se\" id=\"userse\" name=\"userse\" class=\"users\"><div class=\"listUser\"><p id=\"listUserNameg\" class=\"listUserName\"><span class=\"settingsIcon\" style=\"line-height: 1.2;\"></span>Settings</p></div></a>";

                                    list += "<hr>";
                                    
                                    dbres.toArray(function(err, aresult) {
                                        if(err) {
                                            socket.emit("page", 500, err.message, null);
                                        }
                                        else {
                                            var doneIndex = 0;
                                            
                                            aresult.forEach(user => {
                                                doneIndex++;
        
                                                if (user["id"].toString() != userdata["id"]) {
                                                    if (user["username"] != undefined) {
                                                        list += userListButton
                                                            .replace(/&USERNAMELINK/g, user["username"].toLowerCase())
                                                            .replace(/&UID/g, user["username"].toLowerCase())
                                                            .replace(/&USERNAME/g, user["username"])
                                                            .replace(/&ONLINESTATUS/g, 0)
                                                            .replace(/&HISTORY/g, meHistoryText);
                                                    }
                                                }
                                                
                                                if (aresult.length == doneIndex) {
                                                    socket.emit("userlist", 200, list);
        
                                                    clients.forEach(c => {
                                                        if (c.id !== userdata["id"] && c.socket !== null && c.socket.connected) {
                                                            c.socket.emit("userstatus", { user: userdata["username"].toLowerCase(), status: 1 });
                                                            socket.emit("userstatus", { user: c.username.toLowerCase(), status: 1 });
                                                        }
                                                    });
                                                }
                                            });
                                        }
                                    });
                                }
                            });

                        }

                    });

                });
                
                socket.on("requestqr", (token) => {
                    
                    getUserData(token, function (err, userdata) {

                        if(err) {
                            socket.emit("page", 500, err.message, null);
                        }

                        else {
                            socket.emit("returnqr", userdata["username"]);
                        }
                    });

                });

            });

            if (server.listening == true) {
                console.log("Server started at http://localhost:" + port);
            }
        });
        
        /*function getClientBySocket(socket, callback) {
            clients.forEach(c => {
                if (c.socket == socket) {
                    callback(c);
                    return;
                }
            });
            callback(null);
        }*/
        function getClientById(id, callback) {
            var set = false;

            clients.forEach(c => {
                if (set == false && c.id.toString() == id.toString() && c.socket !== null && c.socket.connected) {
                    set = true;
                    callback(c);
                }
            });

            if (set == false) {
                callback(null);
            }
        }
        /*function getClientExistsById(id) {
            var set = false;

            clients.forEach(c => {
                if (set == false && c.id.toString() == id.toString() && c.socket !== null && c.socket.connected) {
                    set = true;
                    return c;
                }
            });

            if (set == false) {
                return null;
            }
        }*/
        function setClientSocket(id, username, socket, callback) {
            var set = false;

            clients.forEach(c => {
                if (set == false && c.id == id) {
                    c.socket = socket;
                    set = true;
                    callback();
                }
            });

            if (set == false) {
                let cl = client.newClient(id, username, socket, Date.now());
                clients.push(cl);
                callback();
            }
        }

        function createMessage(id, mid, message, time, callback) {
            getUserDataById(id, function (err, res) {
                if (err) {
                    callback(null);
                }
                else {
                    let m = usermessage.newMessage(id, res["username"], getDefaultAvatar(res["username"]), mid, message, time);
                    callback(m);
                }
            });
        }
        function createBubble(message) {
            return messageTemplate.replace(/&AVATAR/g, message.avatar).replace(/&USERNAME/g, message.username).replace(/&MESSAGE/g, message.message).replace(/&ID/g, message.mid) + "<span hidden>" + message.time + "</span>";
        }
    }
};

function getDefaultAvatar(username) {
    var avatar = "../img/avatars/default-{0}.svg";

    var input = username.toLowerCase();
    var output = "";
    var number = 0;

    for (var i = 0; i < input.length; i++) {
        output += input[i].charCodeAt(0).toString(2);
    }

    for (var b = 0; b < output.length; b++) {
        number += parseInt(output[b]);
    }

    number = (parseInt(number.toString()) % 7) + 1;

    return avatar.replace("{0}", number);
}
