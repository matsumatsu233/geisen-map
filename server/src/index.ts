import express from "express";
import gameCenterApi from "./apis/gameCenter";
import mongoose from "mongoose";

mongoose.connect("mongodb://localhost/geisenmap", { useNewUrlParser: true });
const db = mongoose.connection;
db.on("error", console.error.bind(console, "connection error:"));

const app = express();
const port = 4000; // default port to listen

app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "http://localhost:3000");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
})

gameCenterApi(app);

// start the express server
app.listen(port, () => {
  // tslint:disable-next-line:no-console
  console.log(`server started at http://localhost:${port}`);
});
