var http = require('http');
var fs = require('fs');
var path = require('path');

// Server
var server = http.createServer(function (req, resp) {
    console.log("." + req.url);
    console.log("." + req.method);
    if (req.method == "GET")
    {
        fs.readFile("." + req.url, 'utf-8', function (error, pgResp) {
            if (error) {
                resp.writeHead(404);
                resp.write("Contents you are looking are Not Found\n" + req.url);
            } else {
                resp.writeHead(200, { 
                    'Content-Type': getMIMEType(path.extname(req.url))
                });
                resp.write(pgResp);
            }
            
            resp.end();
        });
    }
    else if (req.method == "POST")
    {
        if (req.url == "./sendmessage")
        {
            
        }
    }
});

// POST message
//server.post("/sendmessage", function(request, response) {
//    var user, message;
//    user = request.body.user;
//    message = request.body.message;
//    return response.json({}, 200);
//});

server.listen(80);

// Get MIME type
function getMIMEType(ext) {
    var array = fs.readFileSync('server/mime.dat').toString().split("\n");
    
    if (array.filter(option => option.startsWith(ext + "\t")).length == 0) {
        return "text/plain";
    }
    else {
        var result = (array.filter(option => option.startsWith(ext + "\t")))[0].split("\t")[1].trim();
        console.log("Content-Type: " + result);
        return result;
    }
}
