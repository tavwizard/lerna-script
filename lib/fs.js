const { EOL } = require('os'),
    { promisify } = require('util'),
    fs = require('fs'),
    { join } = require('path'),
    readFileAsync = promisify(fs.readFile),
    writeFileAsync = promisify(fs.writeFile);

function readFile(lernaPackage) {
  return (relativePath, convert = content => content.toString()) => {
    return readFileAsync(join(lernaPackage.location, relativePath)).then(convert)
  }
}

function writeFile(lernaPackage) {
  return (relativePath, content, converter) => {
    let toWrite = content
    if (converter) {
      toWrite = converter(content)
    } else if (content === Object(content)) {
      toWrite = JSON.stringify(content, null, 2) + EOL
    }
    return writeFileAsync(join(lernaPackage.location, relativePath), toWrite)
  }
}

module.exports = {
  readFile,
  writeFile
}
