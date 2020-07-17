/* eslint-env node */
"use strict";
var fluid = require("infusion");

var path = require("path");

fluid.registerNamespace("fluid.testem");

// If we call path.resolve directly from an expansion definition, we can't cleanly handle errors.  So, we use this
// convenience function.  It's important to trap errors which might prevent Testem callbacks from being triggered.
fluid.testem.resolvePathSafely = function (basePath, subPath) {
    try {
        var resolvedPath = path.resolve(fluid.module.resolvePath(basePath), subPath);
        return resolvedPath;
    }
    catch (error) {
        fluid.log(fluid.logLevel.FAIL, error);
    }
};

/**
 *
 * Another wrapper to ensure that invalid or missing paths do not break the overall lifecycle of a testem component.
 *
 * @param {String} path - The path to resolve.
 * @return {String} - The resolved path.
 */
fluid.testem.resolveFluidModulePathSafely = function (path) {
    try {
        var resolvedPath = fluid.module.resolvePath(path);
        return resolvedPath;
    }
    catch (error) {
        fluid.log(fluid.logLevel.FAIL, error);
    }
};
