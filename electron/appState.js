let isQuitting = false;
module.exports = {
  setQuitting(val) { isQuitting = val; },
  getQuitting() { return isQuitting; }
};