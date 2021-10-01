"use strict";
//// const fs = require("fs");
const pug = require("pug");
const Post = require("./post");
const util = require("./handler-util");
const Cookies = require("cookies");

const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");
dayjs.extend(utc);
dayjs.extend(timezone);

const trackIdKey = "tracking_id";

function handle(req, res) {
  const cookies = new Cookies(req, res);
  const track_id = cookies.get(trackIdKey);
  addTrackingCookie(cookies);

  switch (req.method) {
    case "GET":
      res.writeHead(200, {
        "Content-Type": "text/html;charset=utf-8",
      });
      Post.findAll({ order: [["id", "DESC"]] }).then((posts) => {
        posts.forEach((post) => {
          post.content = post.content.replace(/\n/g, "<br>"); // 改行置換
          post.formatCreatedAt = dayjs(post.createdAt)
            .tz("Asia/Tokyo")
            .format("YYYY年MM月DD日 HH時mm分ss秒");
          console.log(post);
        });
        res.end(
          pug.renderFile("./views/posts.pug", {
            posts: posts,
            user: req.user,
            track_id: track_id,
          })
        );
      });
      console.info(
        `閲覧されました: user: ${req.user}, ` +
          `trackingId: ${track_id},` +
          `remoteAddress: ${req.socket.remoteAddress} ` +
          `user-agent: ${req.headers["user-agent"]}`
      );
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
          // ログ
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
          // DB書き込み
          Post.create({
            content,
            trackingCookie: cookies.get(trackIdKey),
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

// 投稿削除機能
function handleDelete(req, res) {
  const cookies = new Cookies(req, res);
  const track_id = cookies.get(trackIdKey);
  switch (req.method) {
    case "POST":
      let body = [];
      req
        .on("data", (chunk) => {
          body.push(chunk);
        })
        .on("end", () => {
          body = Buffer.concat(body).toString();
          const params = new URLSearchParams(body);
          const id = params.get("id");
          Post.findByPk(id).then((post) => {
            if (
              (req.user === post.postedBy &&
                track_id === post.trackingCookie) ||
              req.user === "admin"
            ) {
              post.destroy().then(() => {
                handleRedirectPosts(req, res);
                console.info(
                  `削除されました: user: ${req.user}, ` +
                    `trackingId: ${track_id},` +
                    `remoteAddress: ${req.socket.remoteAddress} ` +
                    `user-agent: ${req.headers["user-agent"]}\n` +
                    `id：${post.id} ` +
                    `user：${post.postedBy}\n` +
                    `投稿：${post.content}`
                );
              });
            }
          });
        });

      break;
    default:
      util.handleBadRequest(req, res);
      break;
  }
}

function addTrackingCookie(cookies) {
  if (!cookies.get(trackIdKey)) {
    const trackId = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
    const tomorrow = new Date(Date.now() + 1000 * 60 * 60 * 24);
    cookies.set(trackIdKey, trackId, { expires: tomorrow });
  }
}

function handleRedirectPosts(req, res) {
  res.writeHead(303, {
    Location: "/posts",
  });
  res.end();
}

module.exports = { handle: handle, handleDelete: handleDelete };
