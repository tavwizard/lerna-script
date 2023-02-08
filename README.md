# lerna-script [![Build Status](https://img.shields.io/travis/wix/lerna-script/master.svg?label=build%20status)](https://travis-ci.org/wix/lerna-script) [![lerna](https://img.shields.io/badge/maintained%20with-lerna-cc00ff.svg)](https://lernajs.io/) [![code style: prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg?style=flat-square)](https://github.com/prettier/prettier)

The package is a fork of the [wix/lerna-script](https://github.com/wix/lerna-script) with canged version of the lerna to 5.5

[Lerna](https://lernajs.io/) is a nice tool to manage JavaScript projects with multiple packages, but sometimes you need
more than it provides. [lerna-script](https://www.npmjs.com/package/lerna-script) might be just the thing you need. It allows
you to add custom tasks/scripts to automate multiple package management routine tasks.

# Install

```bash
npm install --save-dev @tav/lerna-script
```

# Usage

- [Basic usage example](#basic-usage-example)
- [Incremental builds](#incremental-builds)
- [External presets](#external-presets)

## Basic usage example

Add `lerna-script` launcher to `package.json` scripts:

```json
{
  "scripts": {
    "ls": "lerna-script"
  }
}
```

To start using, add `lerna.js` to root of your mono-repo and add initial task:

```js
const {loadPackages, iter, exec} = require('lerna-script'),
  {join} = require('path');

async function syncNvmRc(log) {
  log.info('syncNvmRc', 'syncing .nvmrc to all modules from root');
  const packages = await loadPackages();

  return iter.parallel(packages)(lernaPackage => {
    exec.command(lernaPackage)(`cp ${join(process.cwd(), '.nvmrc')} .`);
  });
}

module.exports.syncNvmRc = syncNvmRc;
```

And then you can run it:

```bash
npm run ls syncNvmRc
```

What happened here:

- you created `lerna.js` where each export is a task referenced by export name you can execute via `lerna-script [export]`;
- you used functions from `lerna-script` which are just thin wrappers around [lerna api](https://github.com/lerna/lerna/tree/master/src);
- you created task to sync root `.nvmrc` to all modules so that all of them have same node version defined.

You could also fallback to [lerna api](https://github.com/lerna/lerna/tree/master/src) and write same task as:

```js
const Repository = require('lerna/lib/Repository'),
  PackageUtilities = require('lerna/lib/PackageUtilities'),
  {join} = require('path'),
  {execSync} = require('child_process');

module.exports.syncNvmRc = () => {
  const rootNvmRcPath = join(process.cwd(), '.nvmrc');

  return PackageUtilities.getPackages(new Repository()).forEach(lernaPackage => {
    execSync(`cp ${rootNvmRcPath}`, {cwd: lernaPackage.location});
  });
};
```

## Incremental builds

[Lerna](https://lernajs.io/) provides a way to run commands (bootstrap, npm scripts, exec) either for all modules or a sub-tree based on git
diff from a ref (master, tag, commit), but does not provide a way to run actions incrementally. One use case would be to
run tests for all modules, once one of the modules fail, fix it an continue, so you don't have to rerun tests for modules
that already passed. Or do a change and run tests for a subtree that might be impacted by a change given module dependency
graph.

For this lerna-script provides means to both mark modules as built and filter-out already built modules:

```js
const {loadPackages, iter, exec, changes, filters} = require('lerna-script');

module.exports.test = log => {
  return iter.forEach(changedPackages, {log, build: 'test'})(lernaPackage => {
    return exec.script(lernaPackage)('test');
  });
};
```

where property `build` on `forEach` marks processed package as built with label `test`. For different tasks you can have separate labels so they do not clash.


## External presets

You can also use presets or otherwise tasks exprted by external modules. `lerna-script` by default reads tasks from `lerna.js`,
but you can actually write tasks in any other file(module) and define it in your `lerna.json` like:

```json
{
  "lerna-script-tasks": "./tasks.js"
}
```


# API

### loadPackages({[log], [packageConfigs]}): Promise[LernaPackages[]]

Returns list of packages/modules in repo - forward to lerna;

Parameters:

- log, optional - `npmlog` logger;

### loadRootPackage({[log]}): Promise[LernaPackage[]]

Returns [Package](https://github.com/lerna/lerna/blob/master/src/Package.js) of root module.

Parameters:

- log, optional - `npmlog` logger;

### iter.forEach(lernaPackages, {[log], [build]})(task): Promise

Executed provided command for all `lernaPackages` in a serial fashion. `taskFn` can be either sync task or return a `Promise`.

Parameters:

- lernaPackages - list of lerna packages to iterate on;
- log - logger to be used for progress and pass-on to nested tasks;
- build - should a module be built as in `changes.build`;
- task - function to execute with signature `(lernaPackage, log) => Promise`.

Returns promise with task results.

### iter.parallel(lernaPackages, {[log], [build], [concurrency]})(task): Promise

Executed provided command for all `lernaPackages` in a parallel fashion(`Promise.all`). `taskFn` can be either sync task
or return a `Promise`.

Parameters:

- lernaPackages - list of lerna packages to iterate on;
- log - logger to be used for progress and pass-on to nested tasks;
- build - should a module be built as in `changes.build`;
- task - function to execute with signature `(lernaPackage, log) => Promise`.
- concurrency - number, defaults to `Infinity`. See [bluebird#map API](http://bluebirdjs.com/docs/api/promise.map.html#map-option-concurrency)

Returns promise with task results.

### iter.batched(lernaPackages, {[log], [build]})(task): Promise

Executed provided command for all `lernaPackages` in a batched fashion respecting dependency graph. `taskFn` can be either
sync task or return a `Promise`.

Parameters:

- lernaPackages - list of lerna packages to iterate on;
- log - logger to be used for progress and pass-on to nested tasks;
- build - should a module be built as in `changes.build`;
- task - function to execute with signature `(lernaPackage, log) => Promise`.

Returns promise without results (undefined).

### exec.command(lernaPackage, {silent = true})(command): Promise(stdout)

Executes given command for a package and returns collected `stdout`.

Note that `command` is a single command, meaning `rm -f zzz` and not ex. `rm -f zzz && mkdir zzz`. It's just for convenience
you can provide command and args as a single string.

Argument list #1:

- command - command to execute;

Argument list #2:

- lernaPackage - package returned either by `rootPackage()` or `packages()`;
- silent - should command output be streamed to stdout/stderr or suppressed. Defaults to `true`;

Returns:

- stdout - collected output;

### exec.script(lernaPackage, {silent = true})(script): Promise(stdout)

Executes given npm script for a package and returns collected `stdout`.

Argument list #1:

- script - npm script to execute;

Argument list #2:

- lernaPackage - package returned either by `rootPackage()` or `packages()`;
- silent - should script output be streamed to stdout/stderr or suppressed. Defaults to `true`;

Returns:

- stdout - collected output;

### changes.build(lernaPackage, {[log]})([label]): undefined

Marks package as built.

Parameters:

- lernaPackage - package to build;
- log, optional - `npmlog` logger;
- label, optional - given you have several exports scripts, you can separate them in different build/unbuild groups by label.

### changes.unbuild(lernaPackage, {[log]})([label]): undefined

Marks package as unbuilt.

Parameters:

- lernaPackage - package to unbuild;
- log, optional - `npmlog` logger;
- label, optional - given you have several exports scripts, you can separate them in different build/unbuild groups by label

### changes.isBuilt(lernaPackage)([label]): boolean

Returns true if package is build and false otherwise.

Parameters:

- lernaPackage - package to unbuild;
- label, optional - given you have several exports scripts, you can separate them in different build/unbuild groups by label

### filters.removeBuilt(lernaPackages: [], {[log]})([label]: String): []

Filters-out packages that have been marked as built `changes.build` and were not changed since. Note that it filters-out also dependent packages, so if:

- a, did not change, depends on b;
- b, changed;
- c, not changed, no inter-project dependencies.

Then it will return only `c` as `b` has changed and `a` depends on `b`, so it needs to be rebuilt/retested/re...

Parameters:

- lernaPackages - packages to filter;
- log, optional - `npmlog` logger;
- label, optional - given you have several exports scripts, you can separate them in different build/unbuild groups by label

**Note:** this filter mutates built/unbuild state, meaning that it unbuilds dependents to get reproducible runs.

### filters.gitSince(lernaPackages: [], {[log]})(refspec: String, {ignoreChanges: string[]}?): []

Filters-out packages that have did not change since `refspec` - ex. master, brach, tag.

Parameters:

- lernaPackages - packages to filter;
- log, optional - `npmlog` logger;
- refspec - git `refspec` = master, branchname, tag...
- opts.ignoreChanges - optional array of glob expressions. files matching those globs will be ignored in the diff calculation.

### filters.removeByGlob(lernaPackages: [], {[log]})(glob: String): []

Filters-out packages by provided glob pattern.

Parameters:

- lernaPackages - packages to filter;
- log, optional - `npmlog` logger;
- glob - glob pattern.

### filters.includeFilteredDeps(lernaPackages: [], {[log]})(filteredPackages: []): []

Returns a list of packages tgat includes dependencies of `filteredPackages` that are in `lernaPackages`.

Parameters:

- lernaPackages - all packages;
- log, optional - `npmlog` logger;
- filteredPackages - subset of `lernaPackages`.

### fs.readFile(lernaPackage)(relativePath, converter: buffer => ?): Promise[?]

Reads a file as string by default or accepts a custom converter.

Parameters:

- lernaPackage - a lerna package for cwd of reading;
- relativePath - file path relative to `lernaPackage` root.
- converter - a function to convert content, ex. `JSON.parse`

### fs.writeFile(lernaPackage)(relativePath, content, converter: type => string): Promise[String]

Writes string/buffer to file, accepts custom formatter.

Automatically detects and formats object.

Parameters:

- lernaPackage - a lerna package for cwd of reading;
- relativePath - file path relative to `lernaPackage` root.
- content - content of file.
- converter - function to convert provided type to string/buffer.
