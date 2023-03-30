/**

Options for configuring tsup module bundler
@typedef {Object} Options
@property {string} format - Specifies the format of the generated bundle. (eg: "cjs", "esm", "iife")
@property {boolean} clean - Controls whether the output directory should be deleted before building.
@property {boolean} dts - Controls whether the bundled package should include a .d.ts file.
@property {boolean} bundle - Controls whether the modules should be bundled. Set to false if you want tsup to create an entry point file without bundling the dependencies.
@property {(string|string[])} entry - Specifies the entry file(s) to bundle. You can specify multiple entry files by passing an array.
@property {string} outDir - Specifies the output directory where the bundled files will be written.
*/
/**

Configurations for tsup module bundler
@type {Options}
*/
module.exports = {
  format: "cjs",
  clean: true,
  dts: true,
  bundle: false,
  entry: ["src", "!src/**/*.spec.*"],
  outDir: "build",
};


