function pool(arrPromised, count = 50) {
    return new Promise((resolve, reject) => {
        const length = arrPromised.length;
        if (length === 0) {
            resolve([]);
            return;
        }

        let current = 0;
        let active = 0;
        let error = null;
        let result = [];
        if (count > length) {
            count = length;
        }

        function done() {
            if (active <= 0) {
                return;
            }

            active--;
            if (active > 0) {
                return;
            }

            if (error) {
                reject(error);
                return;
            }

            if (current >= arrPromised.length) {
                resolve(result);
            }
        }

        function onReject(err) {
            if (!error) {
                error = err;
            }
            done();
        }

        function createHandler(index) {
            return (value) => {
                if (error) {
                    done();
                    return;
                }

                result[index] = value;
                done();
                runNext();
            };
        }

        function runNext() {
            if (current >= arrPromised.length) {
                return;
            }

            arrPromised[current]().then(createHandler(current), onReject);
            active++;
            current++;
        }

        while (current < count) {
            runNext();
        }
    });
}

function fin(promise, fn) {
    return promise.then(fn, err => {
        fn();
        throw err;
    });
}

function promisify(fn) {
    return (...args) => Promise.resolve().then(() => fn(...args));
}

module.exports = { pool, fin, promisify }