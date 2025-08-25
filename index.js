const { execSync } = require("child_process");
const { existsSync } = require("fs");
const { join } = require("path");

/**
 * Logs to the console
 */
const log = (msg) => console.log(`\n${msg}`); // eslint-disable-line no-console

const exit = (msg) => {
  console.error(msg);
  process.exit(1);
};

/**
 * Executes the provided shell command and redirects stdout/stderr to the console
 */
const run = (cmd, cwd) => execSync(cmd, { encoding: "utf8", stdio: "inherit", cwd });

/**
 * Determines the current operating system (one of ["mac", "windows", "linux"])
 */
const getPlatform = () => {
  switch (process.platform) {
    case "darwin":
      return "mac";
    case "win32":
      return "windows";
    default:
      return "linux";
  }
};

/**
 * Returns the value for an environment variable (or null if it's not defined)
 */
const getEnv = (name) => process.env[name.toUpperCase()] || null;

/**
 * Sets the specified env variable if the value isn't empty
 */
const setEnv = (name, value) => {
  if (value) {
    process.env[name.toUpperCase()] = value.toString();
  }
};

/**
 * Returns the value for an input variable (or null if it's not defined). If the variable is
 * required and doesn't have a value, abort the action
 */
const getInput = (name, required) => {
  const value = getEnv(`INPUT_${name}`);
  if (required && !value) {
    exit(`"${name}" input variable is not defined`);
  }
  return value;
};

/**
 * Installs NPM dependencies and builds/releases the Electron app using Electron Forge
 */
const runAction = () => {
  const platform = getPlatform();
  const release = getInput("release", true) === "true";
  const pkgRoot = getInput("package_root", true);
  const buildScriptName = getInput("build_script_name") || "build";
  const skipBuild = getInput("skip_build") === "true";

  const pkgJsonPath = join(pkgRoot, "package.json");

  // Make sure package.json file exists
  if (!existsSync(pkgJsonPath)) {
    exit(`"package.json" file not found at path "${pkgJsonPath}"`);
  }

  log(`Will run NPM commands in directory "${pkgRoot}"`);

  // Copy "github_token" input variable to "GITHUB_TOKEN" env variable (required by @electron-forge/publisher-github)
  setEnv("GITHUB_TOKEN", getInput("github_token", true));

  // Set up code signing for macOS
  if (platform === "mac") {
    setEnv("APPLE_ID", getInput("apple_id"));
    setEnv("APPLE_PASSWORD", getInput("apple_password"));
    setEnv("APPLE_TEAM_ID", getInput("apple_team_id"));
    setEnv("CSC_LINK", getInput("mac_certs"));
    setEnv("CSC_KEY_PASSWORD", getInput("mac_certs_password"));
  } else if (platform === "windows") {
    setEnv("CSC_LINK", getInput("windows_certs"));
    setEnv("CSC_KEY_PASSWORD", getInput("windows_certs_password"));
  }

  // Disable console advertisements during install phase
  setEnv("ADBLOCK", true);

  log("Installing dependencies using NPM…");
  run("npm ci", pkgRoot);

  // Run build script if it exists and skip_build is not set
  if (skipBuild) {
    log("Skipping build script because skip_build option is set");
  } else {
    log("Running the build script…");
    run(`npm run ${buildScriptName} --if-present`, pkgRoot);
  }

  try {
    if (release) {
      log("Publishing the Electron app using Electron Forge…");
      run("npx electron-forge publish", pkgRoot);
    } else {
      log("Building the Electron app using Electron Forge…");
      run("npx electron-forge make", pkgRoot);
    }
  } catch (err) {
    log("Build/publish failed with error:");
    log(err.message);
    process.exit(1);
  }
};

runAction();