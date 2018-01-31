/* eslint-env node */
"use strict";
var fluid = require("infusion");
var gpii  = fluid.registerNamespace("gpii");

fluid.require("%gpii-launcher");
fluid.require("%gpii-testem");

fluid.defaults("gpii.testem.instrumenter.launcher", {
    gradeNames: ["gpii.launcher"],
    optionsFile: "%gpii-testem/configs/instrumenter.json",
    yargsOptions: {
        options: {
            inputPath:  {
                describe:     "The source directory to instrument.",
                demandOption: true
            },
            outputPath: {
                describe:     "The directory to save our output in.",
                demandOption: true
            },
            includes:   {
                describe: "One or more minimatch patterns to use to determine which files are included, i.e. instrumented or copied to the output directory.  All patterns are relative to `inputPath`.",
                type:     "array"
            },
            excludes:   {
                describe: "One or more minimatch patterns to use to determine which files are excluded, i.e. not instrumented or copied to the output directory.  All patterns are relative to `inputPath`.",
                type:     "array"
            },
            sources: {
                describe: "One or more minimatch patterns to use to determine which files should be instrumented rather than simply copied.  All patterns are relative to `inputPath`.",
                type:     "array"
            },
            nonSources: {
                describe: "One or more minimatch patterns to use to determine which files should be copied rather than instrumented.  All patterns are relative to `inputPath`.",
                type:     "array"
            },
            logLevel: {
                default: "fluid.logLevel.IMPORTANT"
            },
            optionsFile: {
                default: "{that}.options.optionsFile"
            }
        }
    }
});

gpii.testem.instrumenter.launcher();
