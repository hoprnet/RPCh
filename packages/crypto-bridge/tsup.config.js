const path = require("path");
const fs = require("fs");
const baseConfig = require("@rpch/configs-tsup");

/** @type {import('tsup').Options} */
module.exports = {
  ...baseConfig,
  target: "es5",
  // custom plugin to create no-modules build folder
  onSuccess: function buildNoModules() {
    const noModulesInputDir = path.join(
      require.resolve("@rpch/crypto/no-modules/rpch_crypto"),
      ".."
    );
    const noModulesOutputDir = path.join(__dirname, "build", "no-modules");
    console.log("Creating no-modules build", {
      noModulesInputDir,
      noModulesOutputDir,
    });

    // make directory
    fs.mkdirSync(noModulesOutputDir, { recursive: true });

    // copy all
    for (const file of fs
      .readdirSync(noModulesInputDir)
      .filter((file) => file.endsWith(".ts") || file.endsWith(".wasm"))) {
      console.log(file);
      fs.copyFileSync(
        path.join(noModulesInputDir, file),
        path.join(noModulesOutputDir, path.basename(file))
      );
    }

    // read, patch and replace JS file
    const contents = fs.readFileSync(
      path.join(noModulesInputDir, "rpch_crypto.js"),
      "utf-8"
    );
    fs.writeFileSync(
      path.join(noModulesOutputDir, "rpch_crypto.js"),
      contents + "module.exports = wasm_bindgen;"
    );
  },
};
