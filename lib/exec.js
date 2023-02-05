const { npmRunScript } = require('@lerna/npm-run-script'),
  { exec, spawnStreaming } = require('@lerna/child-process'),
  npmlog = require('npmlog')

function dirtyMaxListenersErrorHack() {
  process.stdout.on('close', () => {})
  process.stdout.on('close', () => {})
  process.stdout.on('close', () => {})
}

function runCommand(lernaPackage, {silent = true, log = npmlog} = {silent: true, log: npmlog}) {
  return command => {
    log.silly('runCommand', command, {cwd: lernaPackage.location, silent})
    const commandAndArgs = command.split(' ')
    const actualCommand = commandAndArgs.shift()
    const actualCommandArgs = commandAndArgs
    // return new Promise((resolve, reject) => {
    //   const callback = (err, stdout) => (err ? reject(err) : resolve(stdout))
    if (silent) {
      return Promise.resolve()
        .then(() => exec(actualCommand, [...actualCommandArgs], {cwd: lernaPackage.location}))
        .then(res => res.stdout)
    } else {
      dirtyMaxListenersErrorHack()

      return spawnStreaming(
        actualCommand,
        [...actualCommandArgs],
        {cwd: lernaPackage.location},
        lernaPackage.name
      ).then(res => res.stdout)
    }
  }
}

function runScript(lernaPackage, { silent = true, log = npmlog, npmClient = 'npm' } = { silent: true, log: npmlog, npmClient: 'npm' }) {
  return (script, args = []) => {
    if (lernaPackage.scripts && lernaPackage.scripts[script]) {
      if (silent) {
        return npmRunScript(script, { args, pkg: lernaPackage, npmClient }).then(
            res => res.stdout,
            err => {
              throw err.message;
            }
        );
      } else {
        dirtyMaxListenersErrorHack();

        return npmRunScript.stream(script, { args, pkg: lernaPackage, npmClient }).then(
            res => res.stdout,
            err => {
              throw err.message;
            }
        );
      }
    } else {
      return Promise.resolve('');
    }
  };
}

module.exports = {
  runCommand,
  runScript
}
