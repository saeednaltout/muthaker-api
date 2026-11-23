// commit-and-tag-version updater for src/version.ts
const RE = /APP_VERSION = '([^']+)'/;

module.exports.readVersion = (contents) => {
  const match = RE.exec(contents);
  if (!match) throw new Error('APP_VERSION not found in src/version.ts');
  return match[1];
};

module.exports.writeVersion = (contents, version) =>
  contents.replace(RE, `APP_VERSION = '${version}'`);
