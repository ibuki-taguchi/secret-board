"use strict";
//// const fs = require("fs");
const pug = require("pug");
const Post = require("./post");
const util = require("./handler-util");
const Cookies = require("cookies");
const crypto = require("crypto");

const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");
const { handleBadRequest } = require("./handler-util");
dayjs.extend(utc);
dayjs.extend(timezone);

const trackIdKey = "tracking_id";
const csrfTokenMap = new Map();

function handle(req, res) {
  const cookies = new Cookies(req, res);
  const trackId = addTrackCookie(cookies, req.user);

  switch (req.method) {
    case "GET":
      res.writeHead(200, {
        "Content-Type": "text/html;charset=utf-8",
        //! XSSはCSPによってブロックすることも可能（今回はエスケープによって実装）
        // "Content-Security-Policy":
        //   "default-src 'self'; script-src https://*; style-src https://*",
      });
      Post.findAll({ order: [["id", "DESC"]] }).then((posts) => {
        posts.forEach((post) => {
          post.formatCreatedAt = dayjs(post.createdAt)
            .tz("Asia/Tokyo")
            .format("YYYY年MM月DD日 HH時mm分ss秒");
        });
        const csrfToken = crypto.randomBytes(8).toString("hex");
        csrfTokenMap.set(req.user, csrfToken);
        res.end(
          pug.renderFile("./views/posts.pug", {
            posts: posts,
            user: req.user,
            trackId: trackId,
            csrfToken: csrfToken,
          })
        );
      });
      console.info(
        `閲覧されました: user: ${req.user}, ` +
          `trackingId: ${trackId},` +
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
          body = Buffer.concat(body).toString(); //todo 要確認
          const params = new URLSearchParams(body); //todo 要確認
          const content = params.get("content");
          const requestedCsrfToken = params.get("csrfToken");
          if (!(content && requestedCsrfToken)) {
            util.handleBadRequest(req, res);
          } else {
            if (csrfTokenMap.get(req.user) === requestedCsrfToken) {
              console.info(
                "----\nRequested by " +
                  req.socket.remoteAddress +
                  " " +
                  "\nURI : " +
                  req.url +
                  "\nuser-agent : " +
                  req.headers["user-agent"] +
                  `\nuser: ${req.user}` +
                  `\ntrackingId: ${trackId},` +
                  `\ncsrfToken: ${requestedCsrfToken}`
              );
              console.info("投稿されました: " + content);
              Post.create({
                content: content,
                trackingCookie: trackId,
                postedBy: req.user,
              }).then(() => {
                csrfTokenMap.delete(req.user);
                handleRedirectPosts(req, res);
              });
            } else {
              util.handleBadRequest(req, res);
            }
          }
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
  const trackId = cookies.get(trackIdKey);
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
          const requestedCsrfToken = params.get("csrfToken");
          if (!(id && requestedCsrfToken)) {
            util.handleBadRequest;
          } else {
            if (csrfTokenMap.get(req.user) === requestedCsrfToken) {
              Post.findByPk(id).then((post) => {
                if (req.user === post.postedBy || req.user === "admin") {
                  post.destroy().then(() => {
                    handleRedirectPosts(req, res);
                    console.info(
                      `削除されました: user: ${req.user}, ` +
                        `trackingId: ${trackId},` +
                        `remoteAddress: ${req.socket.remoteAddress} ` +
                        `user-agent: ${req.headers["user-agent"]}\n` +
                        `id：${post.id} ` +
                        `user：${post.postedBy}\n` +
                        `投稿：${post.content}`
                    );
                  });
                }
              });
              csrfTokenMap.delete(req.user);
              handleRedirectPosts(req, res);
            } else {
              util.handleBadRequest(req, res);
            }
          }
        });

      break;
    default:
      util.handleBadRequest(req, res);
      break;
  }
}

/**
 * Cookieに含まれているトラッキングIDに異常がなければその値を返し、
 * 存在しない場合や異常なものである場合には、再度作成しCookieに付与してその値を返す
 * @param {Cookies} cookies
 * @param {String} userName
 * @return {String} トラッキングID
 */
function addTrackCookie(cookies, userName) {
  const requestedTrackId = cookies.get(trackIdKey);
  if (isValidTrackId(requestedTrackId, userName)) {
    return requestedTrackId;
  } else {
    const originalId = parseInt(crypto.randomBytes(8).toString("hex"), 16);
    const tomorrow = new Date(Date.now() + 1000 * 60 * 60 * 24);
    const trackId = originalId + "_" + createValidHash(originalId, userName);
    cookies.set(trackIdKey, trackId, {
      expires: tomorrow,
      HttpOnly: true,
    });
    return trackId;
  }
}

// trackIdの検証
function isValidTrackId(trackId, userName) {
  if (!trackId) {
    return false;
  }
  const splitted = trackId.split("_");
  const originalId = splitted[0];
  const requestedHash = splitted[1];
  return createValidHash(originalId, userName) === requestedHash;
}

const secretKey =
  "5a69bb55532235125986a0df24aca759f69bae045c7a66d6e2bc4652e3efb43da4" +
  "d1256ca5ac705b9cf0eb2c6abb4adb78cba82f20596985c5216647ec218e84905a" +
  "9f668a6d3090653b3be84d46a7a4578194764d8306541c0411cb23fbdbd611b5e0" +
  "cd8fca86980a91d68dc05a3ac5fb52f16b33a6f3260c5a5eb88ffaee07774fe2c0" +
  "825c42fbba7c909e937a9f947d90ded280bb18f5b43659d6fa0521dbc72ecc9b4b" +
  "a7d958360c810dbd94bbfcfd80d0966e90906df302a870cdbffe655145cc4155a2" +
  "0d0d019b67899a912e0892630c0386829aa2c1f1237bf4f63d73711117410c2fc5" +
  "0c1472e87ecd6844d0805cd97c0ea8bbfbda507293beebc5d9";

// ハッシュの生成
function createValidHash(originalId, userName) {
  const sha1sum = crypto.createHash("sha1");
  sha1sum.update(originalId + userName + secretKey);
  return sha1sum.digest("hex");
}

function handleRedirectPosts(req, res) {
  res.writeHead(303, {
    Location: "/posts",
  });
  res.end();
}

module.exports = { handle: handle, handleDelete: handleDelete };
