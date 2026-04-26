let isQuitting = false;

function setQuitting(value) {
    isQuitting = value;
}

function getQuitting() {
    return isQuitting;
}

module.exports = {
    setQuitting,
    getQuitting,
};
