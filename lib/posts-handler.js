"use strict";
const fs = require("fs");
const contentsMaster = [];

function handle(req, res) {
  switch (req.method) {
    case "GET":
      res.writeHead(200, {
        "Content-Type": "text/html;charset=utf-8",
      });
      fs.readFile("./views/posts.html", "utf8", (err, data) => {
        res.end(data);
      });
      break;
    case "POST":
      let body = [];
      req
        .on("data", (chunk) => {
          body.push(chunk);
        })
        .on("end", () => {
          body = Buffer.concat(body).toString();
          const params = new URLSearchParams(body);
          const content = params.get("content");
          console.info(
            "----\nRequested by " +
              req.socket.remoteAddress +
              " " +
              "\nURI : " +
              req.url +
              "\nuser-agent : " +
              req.headers["user-agent"]
          );
          console.info("投稿されました: " + content);
          contentsMaster.push(content);
          console.info(
            "=> 保存されました\n" + "投稿内容一覧\n" + contentsMaster
          );
          handleRedirectPosts(req, res);
        });
      break;
    default:
      break;
  }
}

function handleRedirectPosts(req, res) {
  res.writeHead(303, {
    Location: "/posts",
  });
  res.end();
}

module.exports = { handle: handle };
