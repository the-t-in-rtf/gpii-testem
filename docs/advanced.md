# Advanced Use Cases

## Combining `gpii-testem` with Non-Testem Tests.

The general process for preparing code coverage reports is as follows:

* Any material from previous coverage runs is removed.
* Code to be tested is instrumented.
* Tests are run and coverage data is collected.
* A code coverage report is produced based on the coverage data.
* Any temporary material related to the test run is cleaned up.

If your package only contains tests that are run using `gpii-testem`, all of this is taken
care of by creating a `testem.js` file as outlined in [the README file in this package](../README.md).  As outlined in
the [component documentation](testem-component.md), you can configure the cleanup and instrumentation independently.

A key use case for these features is to enable the creation of a combined code coverage report when all code cannot be
tested in a single run, for example, when some code in a package is intended to be used with Node.js, and some code is
intended to be used within a browser.  In these scenarios, you must configure your Testem component to avoid cleaning up
instrumented code and coverage data that may have been produced elsewhere.  In most cases, it's assumed that you will
also want to avoid generating a partial coverage report that only reflects the material tested by Testem.

There are a number of strategies to accomplish this, but we will discuss an approach that uses as many shared steps as
possible:

1. The initial cleanup is common to all test runs.
2. The instrumentation is common to all test runs.
3. Tests are run individually in a way that is aware of the code instrumented previously.  Individual tests save
   coverage data, but do not produce individual reports.
4. A combined report is prepared based on all coverage data available.
5. Shared post-test cleanup (of instrumented code and coverage data) is conducted after all test runs are complete and
   the coverage report has been prepared.

### Initial Cleanup

Although tests should clean up after themselves, it may be possible that instrumented code or coverage data is left
behind from a previous run (for example, when there is an error or a test run is interrupted).  It is recommended that
you install a package like `rimraf` using a command like `npm install --save-dev rimraf`, and use that in your pretest
(and posttest steps). You will also need to ensure that the `gpii-testem` component does not perform its initial
cleanup.  See the sample `testem.js` file and `package.json` "scripts" block below for an example.

### Instrumentation

As mentioned above, you must use `nyc` to instrument your code if you wish to collect coverage data using the standard
gpii-testem component.  This is typically accomplished using a command like `./node_modules/.bin/nyc instrument .
instrumented`. You must also ensure that the `gpii-testem` component itself does not instrument the code a second time.
This is accomplished by setting its `instrumentSource` option to `false`.  See the sample  `testem.js` file and
`package.json` "scripts" block below for an example.

### Test Runs

For the purposes of this example, we will talk about combining `gpii-testem` code coverage reporting with reporting on
`Node.js` tests.

#### Testem

For this strategy to work, you must ensure that the `gpii-testem` component does not attempt to do anything that is
intended to be handled across all test runs. See the sample `testem.js` file and `package.json` "scripts" block below
for an example.

#### Node

For this strategy to work, you must launch your tests in a way that ensures that they are aware of the instrumented
code, and that coverage data is saved to a known location.  You must also ensure that your test run does not attempt to
do anything that is intended to be handled in a shared step.  If you are exercising Node.js fixtures from within 
browser tests (for example, when making AJAX requests against a REST API), you will need to launch the testem run
itself using `nyc`.  See the sample `package.json` "scripts" block below for an example.

### Combined Report

Assuming our coverage output has been saved appropriately in all previous steps, generating a combined coverage report
should simply be a matter of calling `nyc`, as in this example, which generates an HTML report and outputs a text
summary to the console:

`./node_modules/.bin/nyc report -r lcov -r text-summary`

By default, your reports will be saved to the `reports` subdirectory. See the sample `package.json` "scripts" block
below for an example.

### Shared Cleanup

For this example, we'll assume that you want to retain the final report, but not any instrumented source or partial code
coverage data from individual runs.  The basic approach is to add a `posttest` script to your `package.json` file that
uses `rimraf` to remove the content.  See the sample `package.json` "scripts" block below for an example.

### Sample `testem.js` File

```javascript
var fluid = require("infusion");
fluid.require("%gpii-testem");

var my  = fluid.registerNamespace("my");
fluid.defaults("my.testem.grade", {
    gradeNames:       ["gpii.testem.coverageDataOnly"],
    instrumentSource: false,
    testPages:        ["tests/all-tests.html"]
});

module.exports = my.testem.grade().getTestemOptions();
```

The "coverage data only" grade handles most of the configuration we need, see the [component docs](testem-component.md)
for details.

### Sample `package.json` "scripts" block

```json5
{
    // Obviously you would have extra stuff related to your package before and/or after this block.
    "scripts": {
        "pretest": "npm run pretest:cleanup && npm run pretest:instrumentSource",
        "pretest:cleanup": "./node_modules/.bin/rimraf coverage/* instrumented/* reports/*",
        "pretest:instrumentSource": "./node_modules/.bin/nyc instrument",
        "test": "npm run test:browser && npm run test:node",
        "test:browser": "./node_modules/.bin/testem --file tests/testem.js",
        // To collect test fixture coverage as well:
        // "test:browserAndFixtures": "./node_modules/.bin/nyc ./node_modules/.bin/testem --file tests/testem.js",
        "test:node": "./node_modules/.bin/nyc node tests/all-node-tests.js --instrument false --reporter none",
        "posttest": "npm run posttest:coverageReport && npm run posttest:cleanup",
        "posttest:coverageReport": "./node_modules/.bin/nyc report -r lcov -r text-summary",
        "posttest:cleanup": "./node_modules/.bin/rimraf coverage/* instrumented/*"
    }
}

```

## Standardising the Options Used by `nyc`

Especially if you have a complex configuration similar to that used with various GPII probjects, you may find it helpful
to use a common `nyc` configuration.  For this purpose, the micro-module
[`fluid-nyc-config`](https://github.com/fluid-project/fluid-nyc-config) is available via npm.  To use this package:

1. Add the `fluid-nyc-config` package to your project using a command like: `npm install --save-dev fluid-nyc-config`
2. Create an `.nycrc` file in the root of your package that looks like the following:
   ```json
   {
     "nyc": {
       "extends": "fluid-nyc-config"
      }
   }
   ```

If you don't modify the configuration, by default `nyc` will:

1. Exclude all content in `./node_modules`, `./tests`, `./instrumented`, `./coverage`, or `./reports`.
2. Instrument all javascript files excluding the above and save the output to `instrumented`.
3. Copy all non-javascript files not in the above to `instrumented`, so that required data, templates, and other
   non-javascript content are available from the same relative path as javascript content.

For more information, see [the `fluid-nyc-config` documentation](https://github.com/fluid-project/fluid-nyc-config).