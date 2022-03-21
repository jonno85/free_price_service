import express from "express";

const healthRouter = express.Router();

healthRouter.get("/", (req, res) => {
  res.send({ service_name: "Emma Claim service", health: "OK" });
});

export default healthRouter;
