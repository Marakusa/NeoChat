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
        if (req.url == "/sendmessage")
        {
            var body = '';
    
            console.log(resp);

            req.on('data', function (data) {
                body += data;
    
                console.log(data);

                // Too much POST data, kill the connection!
                // 1e6 === 1 * Math.pow(10, 6) === 1 * 1000000 ~~~ 1MB
                if (body.length > 1e6)
                    req.destroy();
            });
    
            req.on('end', function () {
                var post = qs.parse(body);
                // use post['blah'], etc.
            
                console.log(post['message']);
                console.log(post['user']);
            });
    
            var user = req.body.user;
            var message = req.body.message;
            
            resp.writeHead(200, { 
                'Content-Type': getMIMEType(path.extname(".txt"))
            });
            resp.write(user + "," + message);
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
        console.log("Content-Type: " + result);
        return result;
    }
}
