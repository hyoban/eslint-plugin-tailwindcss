'use strict';

const fs = require('fs');
const path = require('path');
const resolveConfig = require('tailwindcss/resolveConfig');
let twLoadConfig;

try {
  twLoadConfig = require('tailwindcss/lib/lib/load-config');
} catch (err) {
  twLoadConfig = null;
}

// for nativewind preset
process.env.TAILWIND_MODE = 'build';

const CHECK_REFRESH_RATE = 1_000;
let lastCheck = null;
let mergedConfig = new Map();
let lastModifiedDate = new Map();

/**
 * @see https://stackoverflow.com/questions/9210542/node-js-require-cache-possible-to-invalidate
 * @param {string} module The path to the module
 * @returns the module's export
 */
function requireUncached(module) {
  delete require.cache[require.resolve(module)];
  if (twLoadConfig === null) {
    // Using native loading
    return require(module);
  } else {
    // Using Tailwind CSS's loadConfig utility
    return twLoadConfig.loadConfig(module);
  }
}

/**
 * Load the config from a path string or parsed from an object
 * @param {string|Object} config
 * @returns `null` when unchanged, `{}` when not found
 */
function loadConfig(config) {
  let loadedConfig = null;
  if (typeof config === 'string') {
    const resolvedPath = path.isAbsolute(config) ? config : path.join(path.resolve(), config);
    try {
      const stats = fs.statSync(resolvedPath);
      const mtime = `${stats.mtime || ''}`;
      if (stats === null) {
        // Default to no config
        loadedConfig = {};
      } else if (lastModifiedDate.get(resolvedPath) !== mtime) {
        // Load the config based on path
        lastModifiedDate.set(resolvedPath, mtime);
        loadedConfig = requireUncached(resolvedPath);
      } else {
        // Unchanged config
        loadedConfig = null;
      }
    } catch (err) {
      // Default to no config
      loadedConfig = {};
    } finally {
      return loadedConfig;
    }
  } else {
    if (typeof config === 'object' && config !== null) {
      return config;
    }
    return {};
  }
}

function resolve(twConfig) {
  const newConfig = mergedConfig.get(twConfig) === undefined;
  const now = Date.now();
  const expired = now - lastCheck > CHECK_REFRESH_RATE;
  if (newConfig || expired) {
    lastCheck = now;
    const userConfig = loadConfig(twConfig);
    // userConfig is null when config file was not modified
    if (userConfig !== null) {
      mergedConfig.set(twConfig, resolveConfig(userConfig));
    }
  }
  return mergedConfig.get(twConfig);
}

module.exports = {
  resolve,
};
