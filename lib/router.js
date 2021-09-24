"use strict";

const postHandler = require("./posts-handler");

function route(req, res) {
  switch (req.url) {
    case "/posts":
      postHandler.handle(req, res);
      break;
    case "/logout":
      // todo ログアウト処理
      break;
    default:
      break;
  }
}

module.exports = {
  route: route,
};
