function customErrorHandler(err: any, req: any, res: any) {
  return res.status(err.output.statusCode || 500).send({
    error: err.output.payload,
    stack: err.stack,
  });
}

export default customErrorHandler;
