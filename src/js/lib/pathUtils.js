/* eslint-env node */
"use strict";
var fluid = require("infusion");
var gpii  = fluid.registerNamespace("gpii");

var path = require("path");

fluid.registerNamespace("gpii.testem");

/**
 *
 * Resolve a package-relative path and return the last segment, optionally prefixed by a `leader`.
 *
 * @param {String} rawPath - A full or package-relative path to filesystem content.
 * @param {String} leader - A string to prepend to the last segment.  Defaults to `/`.  Set this to an empty string to disable.
 * @return {String} - The last segment of the resolved path, prefixed by `leader`.
 *
 */
gpii.testem.extractLastPathSegment = function (rawPath, leader) {
    var resolvedPath = fluid.module.resolvePath(rawPath);
    return gpii.testem.forceLeadingSlash(path.basename(resolvedPath), leader);
};

/**
 *
 * Ensure that the path segment is preceded by a leader (defaults to a leading slash).
 *
 * @param {String} rawPath - A path to be prefixed if needed.
 * @param {String} leader - The leader to prefix the path with.
 * @return {String} - The path, updated as needed to ensure that it begins with `leader`.
 *
 */
gpii.testem.forceLeadingSlash = function (rawPath, leader) {
    leader = (leader || leader === "") ? leader : "/";
    if (typeof rawPath === "string") {
        return rawPath.indexOf(leader) === 0 ? rawPath : leader + rawPath;
    }
    else {
        fluid.fail("Cannot handle non-string path.");
    }
};


/**
 *
 * Derive the filesystem path that should be used to host a given content definition.  Accepts a string representing a
 * package-relative path ("short" notation) or a full directory definition ("long" notation).  See the docs in this
 * package for details.
 *
 * @param {String} cwd - The path to the currrent working directory.
 * @param {String|Object} pathDef - A string representing a single package-relative path, or an object with the definition broken out more granularly.
 * @return {String} - The router path, typically something like `/src`.
 *
 */
gpii.testem.extractContentPath = function (cwd, pathDef) {
    var expandedPathDef = gpii.testem.expandPath(pathDef);
    var rawPath = fluid.get(expandedPathDef, "filePath");
    return gpii.testem.resolvePackageOrCwdRelativePath(cwd, rawPath);
};

/**
 *
 * Extract the last part of the "content" path (so that we can, for example, create the same relative directory structure in the "instrumented" directory).
 *
 * @param {String|Object} pathDef - A path definition in either short (string) or long (object) notation.
 * @param {String} leader - An optional replacement "leader".  Set to "/" by default.  Set this to "" to disable.
 * @return {String} - The last segment of the content path.
 *
 */
gpii.testem.extractLastContentSegment = function (pathDef, leader) {
    var expandedPathDef = gpii.testem.expandPath(pathDef);
    return gpii.testem.extractLastPathSegment(fluid.get(expandedPathDef, "filePath"), leader);
};

/**
 *
 * Derive the router path that should be used to host a given content definition.  Accepts a string representing a
 * package-relative path ("short" notation) or a full directory definition ("long" notation).  See the docs in this
 * package for details.
 *
 * @param {String|Object} pathDef - A string representing a single package-relative path, or an object with the definition broken out more granularly.
 * @return {String} - The router path, typically something like `/src`.
 *
 */
gpii.testem.extractRoutePath = function (pathDef) {
    var expandedPathDef = gpii.testem.expandPath(pathDef);
    return fluid.get(expandedPathDef, "routePath") || gpii.testem.extractLastContentSegment(expandedPathDef);
};


/**
 *
 * Derive the proxy path that should be used to host a given content definition.  Accepts a string representing a
 * package-relative path ("short" notation) or a full directory definition ("long" notation).  See the docs in this
 * package for details.
 *
 * @param {String|Object} pathDef - A string representing a single package-relative path, or an object with the definition broken out more granularly.
 * @return {String} - The proxy path, typically something like `/src`.
 *
 */
gpii.testem.extractProxyPath = function (pathDef) {
    var expandedPathDef = gpii.testem.expandPath(pathDef);
    return fluid.get(expandedPathDef, "proxyPath") || gpii.testem.extractLastContentSegment(expandedPathDef);
};

/**
 *
 * Resolve either a package-relative or cwd-relative path safely.  If `pathToResolve` is package relative or full,
 * it will be preserved.  If `pathToResolve` is a simple relative path (i.e. `src` or `./src`) it will be resolved
 * relative to `cwd`.
 *
 * @param {String} cwd - The full path to the current working directory.
 * @param {String} pathToResolve - A relative, full, or package-relative path to resolve.
 * @return {String} - The resolved full path.
 *
 */
gpii.testem.resolvePackageOrCwdRelativePath = function (cwd, pathToResolve) {
    return path.resolve(cwd, fluid.module.resolvePath(pathToResolve));
};

/**
 *
 * Helper function that expands a single "short" notation path definition (a string representing the path to a
 * directory) to "long notation" (an object with a `filePath` element).
 *
 * @param {String|Object} singlePathDef - A single path definition, either in "short" form (a string) or "long" form (an object).
 * @return {Object} - The "long" notation for this path definition.
 *
 */
gpii.testem.expandPath = function (singlePathDef) {
    return typeof singlePathDef === "string" ? { filePath: singlePathDef } : singlePathDef;
};
