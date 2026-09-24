// Express 4 doesn't catch rejected promises from async route handlers on its
// own — without this, a thrown error in an async controller would hang the
// request instead of returning a response.
function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

module.exports = asyncHandler;
