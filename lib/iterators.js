const npmlog = require('npmlog'),
    { markPackageBuilt } = require('./detect-changes'),
    { removeBuilt } = require('./filters'),
    { batchPackages } = require('./batch'),
    { pool, fin, promisify } = require('./utils'),
    runParallelBatches = require('@lerna/run-parallel-batches');

function forEach(lernaPackages, { log = npmlog, build } = { log: npmlog }) {
  return taskFn => {
    const filteredLernaPackages = filterBuilt(lernaPackages, log, build)
    const promisifiedTaskFn = promisify(taskFn);
    const forEachTracker = log.newItem('forEach', lernaPackages.length);
    log.enableProgress();

    return fin(
        pool(
            filteredLernaPackages.map(lernaPackage => {
                return () => {
                    return fin(promisifiedTaskFn(lernaPackage, forEachTracker)
                        .then(res => {
                            build && markPackageBuilt(lernaPackage, {log: forEachTracker})(build)
                            return res
                        }), () => forEachTracker.completeWork(1));
                }
            }),
            1
        ),
        () => forEachTracker.finish()
    );
  }
}

function parallel(
  lernaPackages,
  {log = npmlog, build, concurrency = 50} = {log: npmlog, concurrency: 50}
) {
  return taskFn => {
    const filteredLernaPackages = filterBuilt(lernaPackages, log, build)
    const promisifiedTaskFn = promisify(taskFn)
    const forEachTracker = log.newGroup('parallel', lernaPackages.length)
    npmlog.enableProgress()

    return fin(
        pool(filteredLernaPackages.map(
          lernaPackage => {
            return () => {
                const promiseTracker = forEachTracker.newItem(lernaPackage.name);
                promiseTracker.pause();
                return fin(
                    promisifiedTaskFn(lernaPackage, promiseTracker)
                        .then(res => {
                            build && markPackageBuilt(lernaPackage, {log: forEachTracker})(build)
                            return res
                        }),
                    () => {
                        promiseTracker.resume()
                        promiseTracker.completeWork(1)
                    });
            };
          }),
          concurrency
        ),
        () => forEachTracker.finish()
    );
  }
}

function batched(lernaPackages, { log = npmlog, build, count } = { log: npmlog, count: 4 }) {
  return taskFn => {
    const filteredLernaPackages = filterBuilt(lernaPackages, log, build);
    const promisifiedTaskFn = promisify(taskFn);
    const forEachTracker = log.newGroup('batched', filteredLernaPackages.length);
    log.enableProgress();

    const batchedPackages = batchPackages(filteredLernaPackages, true);
    const lernaTaskFn = lernaPackage => {
      const promiseTracker = forEachTracker.newItem(lernaPackage.name);
      promiseTracker.pause();

      return fin(promisifiedTaskFn(lernaPackage, promiseTracker)
        .then(() => build && markPackageBuilt(lernaPackage, { log: forEachTracker })(build)),
          () => {
              promiseTracker.resume()
              promiseTracker.completeWork(1)
          });
    }

    return runParallelBatches(batchedPackages, count, lernaTaskFn)
  }
}

function filterBuilt(lernaPackages, log, label) {
  if (label) {
    const filteredLernaPackages = removeBuilt(lernaPackages, {log})(label)
    if (filteredLernaPackages.length !== lernaPackages.length) {
      log.info(
        'filter',
        `filtered-out ${lernaPackages.length - filteredLernaPackages.length} of ${
          lernaPackages.length
        } built packages`
      )
    }
    return filteredLernaPackages
  } else {
    return lernaPackages
  }
}

module.exports = {
  forEach,
  parallel,
  batched
}
