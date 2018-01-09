/*

    A static function to "instrument" a source repository.  Uses the same instrumentation library as `nyc`, but
    avoids common problems with including "node_modules" content as we do in our larger projects.

 */
/* eslint-env node */
"use strict";
var fluid     = require("infusion");
fluid.setLogging(true);
var gpii      = fluid.registerNamespace("gpii");
var fs        = require("fs");
var mkdirp    = require("mkdirp");
var minimatch = require("minimatch");

var istanbul = require("istanbul-lib-instrument");

require("./lib/resolveSafely");

fluid.registerNamespace("gpii.testem.instrumenter");

// The default options.  See the instrumenter docs for details.
gpii.testem.instrumenter.defaultOptions = {
    includes:        ["./**"],
    excludes:        ["./node_modules/**/*", "./.git/**/*", "./reports/**/*", "./coverage/**/*", "./.idea/**/*", "./.vagrant/**/*", "tests/**/*", "./instrumented/**/*"],
    sources:         ["./*.js", "./**/*.js"],
    nonSources:      ["!./**/*.js", "./Gruntfile.js"],
    istanbulOptions: {
        produceSourceMap: true
    }
};

/**
 *
 * Instrument the code found at `inputPath` and save the results to `outputPath`.
 *
 * @param `inputPath` `{String}` - The full or package-relative path to a directory containing code to instrument.
 * @param `outputPath` `{String}` - The full or package-relative path to the directory where you want to save the instrumented output.
 * @param `instrumentationOptions` `{Object}` - Configuration options to control what is instrumented.  See the instrumenter docs for details.
 * @returns `{Promise}` - A `fluid.promise` that will be resolved when the full instrumentation is complete or rejected if there is an error at any point.
 *
 */
gpii.testem.instrumenter.instrument = function (inputPath, outputPath, instrumentationOptions) {
    var combinedInstrumentationOptions = fluid.merge({}, gpii.testem.instrumenter.defaultOptions, instrumentationOptions || {});

    var resolvedInputPath  = gpii.testem.resolveFluidModulePathSafely(inputPath);
    var resolvedOutputPath = gpii.testem.resolveFluidModulePathSafely(outputPath);

    var instrumenter = istanbul.createInstrumenter(combinedInstrumentationOptions.istanbulOptions);

    return gpii.testem.instrumenter.processSingleDirectory(resolvedInputPath, resolvedInputPath, resolvedOutputPath, instrumenter, combinedInstrumentationOptions);
};

/**
 *
 * Convert a relative pattern to an absolute pattern relative to `basePath`.
 *
 * @param basePath
 * @param pattern
 * @returns {string}
 */
gpii.testem.instrumenter.resolveRelativePattern = function (basePath, pattern) {
    if (pattern.indexOf("!") === 0) {
        return "!" + gpii.testem.resolvePathSafely(basePath, pattern.substring(1));
    }
    else {
        return gpii.testem.resolvePathSafely(basePath, pattern);
    }
};

/**
 *
 * The library we use for matching (minimatch) supports "negated" patterns.  If we allow these in our arrays, to confirm
 * a match, we must ensure that there is at least one "positive" (non-negated) match for a given pattern, and also that
 * the pattern does not match any negated patterns.
 *
 * This function standardises "negative" patterns so that we can perform a single comparison pass. It combines the
 * non-negated patterns from `patterns` with "negative" patterns from `inversePatterns`, minus their leading exclamation
 * point.  So:
 *
 * gpii.testem.instrumenter.combinePositivePatterns(["onePos", "!oneNeg"], ["twoPos", "!twoNeg"]);
 *
 * Outputs: `["onePos", "twoPos"]`
 *
 * Used by `gpii.testem.instrumenter.allowedByTwoWayFilter`.
 *
 * @param `patterns` `{Array}` - An array of minimatch patterns representing one state (inclusion, for example).
 * @param `inversePatterns` `{Array}` - An array of minimatch patterns representing the opposite state (exclusion, for example).
 * @returns `{Array}` - An array representing all "positive" matches (see above).
 *
 */
gpii.testem.instrumenter.combinePositivePatterns = function (patterns, inversePatterns) {
    var positivePatterns = fluid.makeArray(patterns).filter(function (pattern)  { return pattern.indexOf("!") === -1; });
    var negativeInversePatterns = fluid.makeArray(inversePatterns).filter(function (inversePattern) { return inversePattern.indexOf("!") === 0; });
    var positiveInversePatterns = negativeInversePatterns.map(function (inverseWithExclamation) { return inverseWithExclamation.substring(1); });
    return positivePatterns.concat(positiveInversePatterns);
};

/**
 *
 * Test a given file path against two sets of rules, one "positive" (material that should be included), and one
 * "negative" (material that should be excluded).  Used to determine whether to include a file in our instrumented
 * output, and also to determine whether it should be instrumented or copied.
 *
 * @param `baseInputPath` {String} - The full path to the base "input" directory that `filePath` is relative to.
 * @param `filePath` {String} - The full path to the file we are evaluating for inclusion/exclusion.
 * @param `positiveRules` {Array} - A list of minimatch patterns to include, relative to `baseInputPath`.
 * @param `negativeRules` {Array} - A list of minimatch patterns to exclude, relative to `baseInputPath`.
 * @returns `{Boolean}` - `true` if the file matches, `false` otherwise.
 *
 */
gpii.testem.instrumenter.allowedByTwoWayFilter = function (baseInputPath, filePath, positiveRules, negativeRules) {
    var positivePatterns = gpii.testem.instrumenter.combinePositivePatterns(positiveRules, negativeRules);
    var negativePatterns = gpii.testem.instrumenter.combinePositivePatterns(negativeRules, positiveRules);

    var matchesPositive = fluid.find(positivePatterns, function (filePattern) {
        if (minimatch(filePath, filePattern)) { return filePattern; }
        else {
            var baseDirRelativePattern = gpii.testem.instrumenter.resolveRelativePattern(baseInputPath, filePattern);
            if (minimatch(filePath, baseDirRelativePattern)) { return baseDirRelativePattern; }
        }
    });
    if (matchesPositive) {
        var matchesNegative = fluid.find(negativePatterns, function (filePattern) {
            if (minimatch(filePath, filePattern)) { return filePattern; }
            else {
                var baseDirRelativeNegativePattern = gpii.testem.instrumenter.resolveRelativePattern(baseInputPath, filePattern);
                if (minimatch(filePath, baseDirRelativeNegativePattern)) { return baseDirRelativeNegativePattern; }
            }
        });
        return matchesNegative === undefined;
    }
    else {
        return false;
    }
};

/**
 *
 * Read through the contents of a single directory.  Recurses to examine any subdirectories.  Instruments matching
 * source files, copies matching non-source files.  Matching is controlled by supplying minimatch patterns in
 * `instrumentationOptions.includes` and `instrumentationOptions.excludes`.  See the documentation for details.
 *
 * @param `baseInputPath` `{String}` - The full path to the "base" directory for the overall run.
 * @param `levelInputPath` `{String}` - The full or package-relative path to the input directory used for this level of the recursive instrumentation process.
 * @param `levelOutputPath` `{String}` - The full or package-relative path to output directory used for this level of the recursive instrumentation process.
 * @param `instrumenter` {Object} - An Istanbul.js "instrumenter", see https://github.com/istanbuljs/istanbuljs/tree/master/packages/istanbul-lib-instrument
 * @param `instrumentationOptions` `{Object}` - The configurations options that control this instrumentation pass. See our instrumenter docs for details.
 * @returns `{Promise}` - A `fluid.promise` that will be resolved when this level of the instrumentation is complete or rejected if there is an error.
 *
 */
gpii.testem.instrumenter.processSingleDirectory = function (baseInputPath, levelInputPath, levelOutputPath, instrumenter, instrumentationOptions) {
    var promises = [];
    var filesInPath = fs.readdirSync(levelInputPath);
    fluid.each(filesInPath, function (filename) {
        var levelEntryInputPath = gpii.testem.resolvePathSafely(levelInputPath, filename);
        var levelEntryOutputPath = gpii.testem.resolvePathSafely(levelOutputPath, filename);
        var levelEntryFileStats = fs.statSync(levelEntryInputPath);
        if (levelEntryFileStats.isDirectory()) {
            promises.push(function () { return gpii.testem.instrumenter.processSingleDirectory(baseInputPath, levelEntryInputPath, levelEntryOutputPath, instrumenter, instrumentationOptions); });
        }
        else {
            if (gpii.testem.instrumenter.allowedByTwoWayFilter(baseInputPath, levelEntryInputPath, instrumentationOptions.includes, instrumentationOptions.excludes)) {
                mkdirp.sync(levelOutputPath);
                // Instrument the file.
                if (gpii.testem.instrumenter.allowedByTwoWayFilter(baseInputPath, levelEntryInputPath, instrumentationOptions.sources, instrumentationOptions.nonSources) ) {
                    try {
                        var source = fs.readFileSync(levelEntryInputPath, "utf8");
                        var instrumentedSource = instrumenter.instrumentSync(source, levelEntryInputPath);
                        var instrumentedFileWritePromise = fluid.promise();
                        promises.push(instrumentedFileWritePromise);
                        fs.writeFile(levelEntryOutputPath, instrumentedSource, function (error) {
                            if (error) {
                                instrumentedFileWritePromise.reject(error);
                            }
                            else {
                                instrumentedFileWritePromise.resolve();
                            }
                        });

                        if (instrumentationOptions.istanbulOptions.produceSourceMap) {
                            var sourceMap = instrumenter.lastSourceMap();
                            var sourceMapPath = levelEntryOutputPath + ".map";
                            var sourceMapWritePromise = fluid.promise();
                            promises.push(sourceMapWritePromise);
                            fs.writeFile(sourceMapPath, JSON.stringify(sourceMap, null, 2), function (error) {
                                if (error) {
                                    sourceMapWritePromise.reject(error);
                                }
                                else {
                                    sourceMapWritePromise.resolve();
                                }
                            });
                        }
                    }
                    catch (error) {
                        fluid.log("Error instrumenting file '", levelEntryInputPath, "'.");
                        fluid.fail(error);
                    }
                }
                // Copy the file.
                else {
                    var fileCopyPromise = fluid.promise();
                    promises.push(fileCopyPromise);
                    try {
                        var readStream = fs.createReadStream(levelEntryInputPath);
                        var writeStream = fs.createWriteStream(levelEntryOutputPath);
                        writeStream.on("finish", function () {
                            fileCopyPromise.resolve();
                        });
                        readStream.pipe(writeStream);
                    }
                    catch (err) {
                        fileCopyPromise.reject(err);
                    }
                }
            }
        }
    });

    var levelPromise = fluid.promise.sequence(promises);
    return levelPromise;
};
