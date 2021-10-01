"use strict";

const postHandler = require("./posts-handler");
const util = require("./handler-util");
const postsHandler = require("./posts-handler");

function route(req, res) {
  switch (req.url) {
    case "/posts":
      postHandler.handle(req, res);
      break;
    case "/posts?delete=1":
      postHandler.handleDelete(req, res);
      break;
    case "/logout":
      util.handleLogout(req, res);
      break;
    case "/favicon.ico":
      util.handleFavicon(req, res);
      break;
    default:
      util.handleNotFound(req, res);
      break;
  }
}

module.exports = {
  route: route,
};
