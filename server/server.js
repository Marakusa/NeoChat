var http = require('http');
var fs = require('fs');
var path = require('path');
var qs = require('qs');

// Server
var server = http.createServer(function (req, resp) {
    console.log("." + req.url + ": " + req.method);

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
        if (req.url == "/sendmessage")
        {
            var body = "";

            req.on('data', function (chunk) {
                body += chunk;
            });

            req.on('end', function () {
                var post = qs.parse(body);

                console.log(post['user'] + ": " + post['message']);
        
                resp.writeHead(200, { 
                    'Content-Type': getMIMEType(path.extname(".json"))
                });
                resp.write("{user: " + post['user'] + ", message: \"" + post['message'] + "\"}");
            });
        }
    }
});

server.listen(80);

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
