const http = require("http");
const fs = require("fs");
const path = require("path");
const { parseStatementBuffer, parseStatementFile } = require("./src/statementParser");

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, "public");
const DEFAULT_STATEMENT_PATH =
  path.join(__dirname, "data", "simplygo-feb-2026.txt");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];

    request.on("data", (chunk) => {
      chunks.push(chunk);
    });

    request.on("end", () => {
      resolve(Buffer.concat(chunks));
    });

    request.on("error", (error) => {
      reject(error);
    });
  });
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { "Content-Type": MIME_TYPES[".json"] });
  response.end(JSON.stringify(payload, null, 2));
}

function serveStatic(requestPath, response) {
  const safePath = requestPath === "/" ? "index.html" : requestPath.replace(/^\/+/, "");
  const filePath = path.join(PUBLIC_DIR, path.normalize(safePath));

  if (!filePath.startsWith(PUBLIC_DIR)) {
    sendJson(response, 403, { error: "Forbidden" });
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === "ENOENT") {
        sendJson(response, 404, { error: "File not found" });
        return;
      }

      sendJson(response, 500, { error: "Unable to read file" });
      return;
    }

    const extension = path.extname(filePath).toLowerCase();
    response.writeHead(200, {
      "Content-Type": MIME_TYPES[extension] || "application/octet-stream",
    });
    response.end(content);
  });
}

const server = http.createServer((request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);

  if (request.method === "GET" && url.pathname === "/api/statement") {
    const statementPath = url.searchParams.get("path") || DEFAULT_STATEMENT_PATH;

    parseStatementFile(statementPath)
      .then((data) => {
        sendJson(response, 200, data);
      })
      .catch((error) => {
        sendJson(response, 500, {
          error: error.message,
          statementPath,
        });
      });

    return;
  }

  if (request.method === "POST" && url.pathname === "/api/statement/upload") {
    readRequestBody(request)
      .then(async (buffer) => {
        const fileName = request.headers["x-file-name"] || "statement.txt";
        const decodedFileName = decodeURIComponent(String(fileName));
        const data = await parseStatementBuffer(buffer, decodedFileName);
        sendJson(response, 200, {
          source: decodedFileName,
          ...data,
        });
      })
      .catch((error) => {
        sendJson(response, 500, {
          error: error.message,
        });
      });

    return;
  }

  if (request.method === "GET") {
    serveStatic(url.pathname, response);
    return;
  }

  sendJson(response, 405, { error: "Method not allowed" });
});

server.listen(PORT, () => {
  console.log(`Travel dashboard running at http://localhost:${PORT}`);
});
