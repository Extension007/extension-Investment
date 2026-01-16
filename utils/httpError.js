function httpError(status, message, code = 'ERR') {
  const err = new Error(message);
  err.status = status;
  err.statusCode = status;
  err.code = code;
  err.expose = true;
  return err;
}
module.exports = { httpError };
