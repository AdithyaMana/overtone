/* A static server for the end-to-end tests, and nothing else.
 *
 * The specs used to load the game straight off disk, over file://, which is
 * true to how the single file is built and false to how anybody plays it.
 * Chromium gives a file:// document its own odd corner of localStorage, and
 * under load a reload there can come up with the whole area empty: measured,
 * five to eight runs in thirty lost every key they had just written, which is
 * what made "the choice survives a reload" flake. The same measurement over
 * http came back thirty for thirty. The game ships to Firebase over https, so
 * http is both the honest environment and the quiet one.
 *
 *   node tools/test-server.js [port]
 */
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const PORT = Number(process.argv[2]) || 8787;

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js":   "text/javascript; charset=utf-8",
  ".css":  "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg":  "image/svg+xml",
  ".png":  "image/png",
  ".jpg":  "image/jpeg",
  ".webp": "image/webp",
  ".mp3":  "audio/mpeg",
  ".woff2":"font/woff2",
  ".ttf":  "font/ttf"
};

http.createServer(function(req, res){
  let rel;
  try { rel = decodeURIComponent(req.url.split("?")[0]); }
  catch (e) { res.writeHead(400); return res.end("bad url"); }
  if (rel === "/") rel = "/index.html";

  /* Nothing above the repo, whatever the request says. */
  const file = path.resolve(ROOT, "." + rel);
  if (file !== ROOT && !file.startsWith(ROOT + path.sep)) {
    res.writeHead(403); return res.end("no");
  }

  fs.stat(file, function(err, st){
    if (err || !st.isFile()) { res.writeHead(404); return res.end("not found"); }
    const type = TYPES[path.extname(file).toLowerCase()] || "application/octet-stream";

    /* <audio> asks for a range, and answering 200 to a range request makes
       some builds refuse to play the theme at all. */
    const range = req.headers.range && /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
    if (range) {
      const start = range[1] ? parseInt(range[1], 10) : 0;
      const end = range[2] ? parseInt(range[2], 10) : st.size - 1;
      if (start >= st.size || end >= st.size || start > end) {
        res.writeHead(416, { "Content-Range": "bytes */" + st.size });
        return res.end();
      }
      res.writeHead(206, {
        "Content-Type": type,
        "Content-Length": end - start + 1,
        "Content-Range": "bytes " + start + "-" + end + "/" + st.size,
        "Accept-Ranges": "bytes"
      });
      return fs.createReadStream(file, { start: start, end: end }).pipe(res);
    }

    res.writeHead(200, {
      "Content-Type": type,
      "Content-Length": st.size,
      "Accept-Ranges": "bytes",
      /* a spec must never read a stale build */
      "Cache-Control": "no-store"
    });
    fs.createReadStream(file).pipe(res);
  });
}).listen(PORT, "127.0.0.1", function(){
  console.log("test server on http://127.0.0.1:" + PORT + "/");
});
