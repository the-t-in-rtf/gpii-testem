/* eslint-env node */
"use strict";
var fluid = require("infusion");
var gpii  = fluid.registerNamespace("gpii");

var path = require("path");

fluid.registerNamespace("gpii.testem");

// If we call path.resolve directly from an expansion definition, we can't cleanly handle errors.  So, we use this
// convenience function.  It's important to trap errors which might prevent Testem callbacks from being triggered.
gpii.testem.resolvePathSafely = function (pathToResolve, filename) {
    try {
        var resolvedPath = path.resolve(pathToResolve, filename);
        return resolvedPath;
    }
    catch (error) {
        console.error(error);
    }
};

/**
 *
 * Another wrapper to ensure that invalid or missing paths do not break the overall lifecycle of a testem component.
 *
 * @param path
 * @return {*}
 */
gpii.testem.resolveFluidModulePathSafely = function (path) {
    try {
        var resolvedPath = fluid.module.resolvePath(path);
        return resolvedPath;
    }
    catch (error) {
        console.error(error);
    }
};
