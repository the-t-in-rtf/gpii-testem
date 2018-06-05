/*

    A static function to "instrument" a source repository.  Uses the same instrumentation library as `nyc`, but
    avoids common problems with including "node_modules" content as we do in our larger projects.

 */
/* eslint-env node */
"use strict";
var fluid     = require("infusion");
var gpii      = fluid.registerNamespace("gpii");
var fs        = require("fs");
var path      = require("path");
var mkdirp    = require("mkdirp");
var glob      = require("glob");

var istanbul = require("istanbul-lib-instrument");

require("./lib/resolveSafely");

fluid.registerNamespace("gpii.testem.instrumenter");

// The default options.  See the instrumenter docs for details.
gpii.testem.instrumenter.defaultOptions = {
    sources:    ["./**/*.js"],
    excludes:   ["./node_modules/**/*", "./.git/**/*", "./reports/**/*", "./coverage/**/*", "./.idea/**/*", "./.vagrant/**/*", "tests/**/*", "./instrumented/**/*"],
    nonSources: ["./**/*.!(js)", "./Gruntfile.js"],
    istanbulOptions: {
        produceSourceMap: true,
        autoWrap: true
    }
};

/**
 *
 * Instrument the code found at `inputPath` and save the results to `outputPath`.
 *
 * @param {String} inputPath - The full or package-relative path to a directory containing code to instrument.
 * @param {String} outputPath - The full or package-relative path to the directory where you want to save the instrumented output.
 * @param {Object} instrumentationOptions - Configuration options to control what is instrumented.  See the instrumenter docs for details.
 * @return {Promise} - A `fluid.promise` that will be resolved when the full instrumentation is complete or rejected if there is an error at any point.
 *
 */
gpii.testem.instrumenter.instrument = function (inputPath, outputPath, instrumentationOptions) {
    var promises = [];

    var resolvedInputPath  = gpii.testem.resolveFluidModulePathSafely(inputPath);
    var resolvedOutputPath = gpii.testem.resolveFluidModulePathSafely(outputPath);

    // User-supplied patterns should completely replace the originals.
    var mergePolicy = {
        sources: "replace",
        excludes: "replace",
        nonSources: "replace"
    };

    var combinedInstrumentationOptions = fluid.merge(mergePolicy, gpii.testem.instrumenter.defaultOptions, instrumentationOptions || {});

    // Instrument files that are part of our "sources" pattern, but which are not defined as excluded or non-sources.
    var sourceFileWrappedPromise = fluid.promise();
    promises.push(sourceFileWrappedPromise);
    var sourcesToExclude = combinedInstrumentationOptions.excludes.concat(combinedInstrumentationOptions.nonSources);
    var sourceFilePromise = gpii.testem.instrumenter.findFilesMatchingFilter(resolvedInputPath, combinedInstrumentationOptions.sources, sourcesToExclude);
    sourceFilePromise.then(
        function (filesToInstrument) {
            var instrumentationPromise = gpii.testem.instrumenter.instrumentAllFiles(filesToInstrument, inputPath, resolvedOutputPath, combinedInstrumentationOptions);
            instrumentationPromise.then(sourceFileWrappedPromise.resolve, sourceFileWrappedPromise.reject);
        },
        sourceFileWrappedPromise.reject
    );

    // Copy "non source" files which are not excluded.
    var nonSourceWrappedPromise = fluid.promise();
    promises.push(nonSourceWrappedPromise);
    var nonSourcePromise = gpii.testem.instrumenter.findFilesMatchingFilter(resolvedInputPath, combinedInstrumentationOptions.nonSources, combinedInstrumentationOptions.excludes);
    nonSourcePromise.then(
        function (filesToCopy) {
            var fileCopyPromise = gpii.testem.instrumenter.copyAllFiles(filesToCopy, inputPath, resolvedOutputPath);
            fileCopyPromise.then(nonSourceWrappedPromise.resolve, nonSourceWrappedPromise.reject);
        },
        nonSourceWrappedPromise.reject
    );

    var sequence = fluid.promise.sequence(promises);
    return sequence;
};

/**
 *
 * The library we use for matching (node-glob) does not support "negated" patterns.  This function standardises
 * "negative" patterns so that we can use them with node-glob and perform a single comparison pass. It combines the
 * non-negated patterns from `patterns` with "negative" patterns from `inversePatterns`, minus their leading exclamation
 * point.  So:
 *
 * gpii.testem.instrumenter.combinePositivePatterns(["onePos", "!oneNeg"], ["twoPos", "!twoNeg"]);
 *
 * Outputs: `["onePos", "twoPos"]`
 *
 * @param {Array} patterns - An array of minimatch patterns representing one state (inclusion, for example).
 * @param {Array} inversePatterns - An array of minimatch patterns representing the opposite state (exclusion, for example).
 * @return {Array} - An array representing all "positive" matches (see above).
 *
 */
gpii.testem.instrumenter.combinePositivePatterns = function (patterns, inversePatterns) {
    var positivePatterns = fluid.makeArray(patterns).filter(function (pattern)  { return pattern.indexOf("!") !== 0; });
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
 * @param {String} baseInputPath - The full path to the base "input" directory that `filePath` is relative to.
 * @param {Array} positiveRules - A list of minimatch patterns to include, relative to `baseInputPath`.
 * @param {Array} negativeRules - A list of minimatch patterns to exclude, relative to `baseInputPath`.
 * @return {Promise} - A `fluid.promise` that will be resolved with a list of matching paths, relative to `baseInputPath`, or rejected if there is an error.
 *
 */
gpii.testem.instrumenter.findFilesMatchingFilter = function (baseInputPath, positiveRules, negativeRules) {
    var promise = fluid.promise();
    var positivePatterns = gpii.testem.instrumenter.combinePositivePatterns(positiveRules, negativeRules);
    var negativePatterns = gpii.testem.instrumenter.combinePositivePatterns(negativeRules, positiveRules);

    // See https://github.com/isaacs/node-glob#options
    var options = {
        cwd: baseInputPath,
        ignore: negativePatterns,
        // Our approach very much depends on only having files, and NOT directories.  Remove this at your peril.
        nodir: true
    };
    var promises = [];
    fluid.each(positivePatterns, function (singlePositivePattern) {
        var singlePatternPromise = fluid.promise();
        promises.push(singlePatternPromise);
        glob(singlePositivePattern, options, function (error, files) {
            if (error) {
                singlePatternPromise.reject(error);
            }
            else {
                singlePatternPromise.resolve(files);
            }
        });
    });
    var sequence = fluid.promise.sequence(promises);
    sequence.then(
        function (results) {
            promise.resolve(fluid.flatten(results));
        },
        promise.reject
    );
    return promise;
};

/**
 *
 * Instrument a list of files.
 *
 * @param {Array} filesToInstrument - An array of paths to files that should be instrumented, relative to `baseInputPath`.
 * @param {String} baseInputPath - The full path to the base "input" directory.
 * @param {String} baseOutputPath - The full path to the base "output" directory.
 * @param {Object} instrumentationOptions - Configuration options to control what is instrumented.  See the instrumenter docs for details.
 * @return {Promise} - A `fluid.promise` that will be resolved when all files are instrumented, or rejected if there is an error.
 *
 */
gpii.testem.instrumenter.instrumentAllFiles = function (filesToInstrument, baseInputPath, baseOutputPath, instrumentationOptions) {
    var resolvedBaseInputPath = fluid.module.resolvePath(baseInputPath);
    var resolvedBaseOutputPath = fluid.module.resolvePath(baseOutputPath);
    var instrumenter = istanbul.createInstrumenter(instrumentationOptions.istanbulOptions);

    var promises = [];
    fluid.each(filesToInstrument, function (relativePath) {
        promises.push(function () {
            var instrumentationOuterPromise = fluid.promise();

            var singleFilePromises = [];
            var inputPath = path.resolve(resolvedBaseInputPath, relativePath);
            var outputPath = path.resolve(resolvedBaseOutputPath, relativePath);
            var outputDir = path.dirname(outputPath);
            try {
                if (!fs.existsSync(outputDir)) {
                    mkdirp.sync(outputDir);
                }
                var source = fs.readFileSync(inputPath, "utf8");
                var instrumentedSource = instrumenter.instrumentSync(source, inputPath);
                var instrumentedFileWritePromise = fluid.promise();
                singleFilePromises.push(instrumentedFileWritePromise);
                fs.writeFile(outputPath, instrumentedSource, function (error) {
                    if (error) {
                        instrumentedFileWritePromise.reject(error);
                    }
                    else {
                        instrumentedFileWritePromise.resolve();
                    }
                });

                if (instrumentationOptions.istanbulOptions.produceSourceMap) {
                    var sourceMap = instrumenter.lastSourceMap();
                    var sourceMapPath = outputPath + ".map";
                    var sourceMapWritePromise = fluid.promise();
                    singleFilePromises.push(sourceMapWritePromise);
                    fs.writeFile(sourceMapPath, JSON.stringify(sourceMap, null, 2), function (error) {
                        if (error) {
                            sourceMapWritePromise.reject(error);
                        }
                        else {
                            sourceMapWritePromise.resolve();
                        }
                    });
                }
                var singleFileSequence = fluid.promise.sequence(singleFilePromises);
                singleFileSequence.then(instrumentationOuterPromise.resolve, instrumentationOuterPromise.reject);
            }
            catch (error) {
                fluid.log("Error instrumenting file '", inputPath, "':", error);
                instrumentationOuterPromise.reject(error);
            }

            return instrumentationOuterPromise;
        });
    });
    var sequence = fluid.promise.sequence(promises);
    return sequence;
};

/**
 *
 * Copy a list of files to the combined "instrumented" output directory.  Used to interleave JSON data, uninstrumented
 * bundled third-party libraries, etc. with our instrumented source.
 *
 * @param {Array} filesToCopy - An array of paths to files to copy, relative to `baseInputPath`.
 * @param {String} baseInputPath - The base directory containing the original file (used to resolve the relative path).
 * @param {String} baseOutputPath - The base output path.
 * @return {Promise} - A `fluid.promise` that will be resolved when all files are copied or rejected if there is an error.
 *
 */
gpii.testem.instrumenter.copyAllFiles = function (filesToCopy, baseInputPath, baseOutputPath) {
    var resolvedBaseInputPath = fluid.module.resolvePath(baseInputPath);
    var resolvedBaseOutputPath = fluid.module.resolvePath(baseOutputPath);
    var promises = [];
    fluid.each(filesToCopy, function (relativePath) {
        promises.push(function () {
            var fileCopyPromise = fluid.promise();
            try {
                var fullInputPath = path.resolve(resolvedBaseInputPath, relativePath);
                var readStream = fs.createReadStream(fullInputPath);
                var outputPath = path.resolve(resolvedBaseOutputPath, relativePath);
                var outputDir = path.dirname(outputPath);
                if (!fs.existsSync(outputDir)) {
                    mkdirp.sync(outputDir);
                };
                var writeStream = fs.createWriteStream(outputPath);
                writeStream.on("finish", function () {
                    fileCopyPromise.resolve();
                });
                readStream.pipe(writeStream);
            }
            catch (err) {
                fileCopyPromise.reject(err);
            }
            return fileCopyPromise;
        });
    });
    var sequence = fluid.promise.sequence(promises);
    return sequence;
};
