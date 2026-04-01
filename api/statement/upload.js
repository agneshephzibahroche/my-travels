const readBody = require("../_readBody");
const { parseStatementBuffer } = require("../../src/statementParser");

module.exports = async function handler(request, response) {
  if (request.method !== "POST") {
    response.statusCode = 405;
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }

  try {
    const buffer = await readBody(request);
    const fileName = decodeURIComponent(String(request.headers["x-file-name"] || "statement.txt"));
    const data = parseStatementBuffer(buffer, fileName);

    response.statusCode = 200;
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.end(
      JSON.stringify({
        source: fileName,
        ...data,
      })
    );
  } catch (error) {
    const isPdfError =
      String(request.headers["x-file-name"] || "").toLowerCase().endsWith(".pdf") &&
      /pdftotext|extract text|locate/i.test(error.message);

    response.statusCode = 500;
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.end(
      JSON.stringify({
        error: isPdfError
          ? "Hosted PDF parsing needs a bundled JavaScript PDF parser. This deployment can still load the sample statement and plain-text statement exports."
          : error.message,
      })
    );
  }
};
