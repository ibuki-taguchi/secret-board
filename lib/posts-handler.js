"use strict";
//// const fs = require("fs");
const pug = require("pug");
const Post = require("./post");
const util = require("./handler-util");

function handle(req, res) {
  switch (req.method) {
    case "GET":
      res.writeHead(200, {
        "Content-Type": "text/html;charset=utf-8",
      });
      Post.findAll({ order: [["id", "DESC"]] }).then((posts) => {
        res.end(pug.renderFile("./views/posts.pug", { posts }));
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
          console.info("=> 保存されました\n");
          Post.create({
            content,
            trackingCookie: null,
            postedBy: req.user,
          }).then(() => {
            handleRedirectPosts(req, res);
          });
        });
      break;
    default:
      util.handleBadRequest(req, res);
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
