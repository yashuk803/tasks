const errorHandler = (err, req, res, next) => {
  console.error(err);

  if (err.name === 'ValidationError') {
    return res.status(400).json({ error: err.message });
  }

  if (err.name === 'UnauthorizedError' || err.message === 'Unauthorized') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (err.message === 'Forbidden') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  if (err.message === 'Not found') {
    return res.status(404).json({ error: 'Not found' });
  }

  res.status(500).json({ error: 'Internal server error' });
};

module.exports = { errorHandler };
