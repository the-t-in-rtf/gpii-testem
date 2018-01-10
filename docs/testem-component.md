# `gpii.testem`

The `gpii.testem` component is designed to:

1. Instrument the code under test.
2. Start test fixtures.
3. Run Testem tests.
4. Prepare a coverage report.
5. Clean up temporary files (instrumented source, browser data, coverage data).

For basic usage instructions and requirements, see the [README file](../README.md).  For detailed configuration options,
see below.

# Component Options

| Option                    | Type        | Description                           |
| ------------------------- | ----------- | ------------------------------------- |
| `cwd`                     | `{String}`  | Defaults to `process.cwd()`, i.e. the directory from which the script was called. |
| `testemDir`               | `{String}`  | The directory in which testem's browser settings and temporary files should be stored. |
| `wrappedEventTimeout`     | `{Number}`  | How long to wait (in milliseconds) before triggering a timeout when waiting for key startup/shutdown events. |
| `coveragePort` (required) | `{Number}`  | The port gpii-express should listen on to record coverage data. Defaults to `7000`.|
| `coverageUrl`             | `{String}`  | The URL on which the coverage listener should be run.  Set based on `coveragePort` by default. |
| `coverageDir` (required)  | `{String}`  | The full or package-relative path where coverage data should be saved. By default, a unique subdirectory is created in `os.tmpdir()`. |
| `reportsDir` (required)   | `{String}`  | The full or package-relative path where coverage reports and test results should be saved. By default, a unique subdirectory is created in `os.tmpdir()`. |
| `instrumentationOptions`  | `{Object}`  | The options to use when instrumenting source.  See the [instrumenter docs](instrumenter.md) for details. |
| `instrumentedSourceDir`   | `{String}`  | The location in which to store instrumented code.  By default, a unique subdirectory is created in `os.tmpdir()`.|
| `sourceDirs`              | `{Array}`   | One or more source directories to load, relative to the directory in which your configuration file is stored (see "Content and Source Directories" below).  Note that although Testem itself supports globbing and file patterns, you are expected to supply only directory paths here. |
| `testPages`               | `{Array}`   | One or more test pages to load in the browser, relative to the directory in which your configuration file is stored (see "paths" below). |
| `contentDirs`             | `{Array}`   | One or more directories to host and make available in tests. See "Content and Source Directories" below for the supported format. |
| `testemOptions`           | `{Object}`  | The raw configuration options to pass to Testem.  See [the Testem docs](https://github.com/testem/testem/blob/master/docs/config_file.md) for supported options. |
| `browserArgs`             | `{Object}`  | The [browser arguments](https://github.com/testem/testem/blob/master/docs/browser_args.md) that will be passed to Testem by default. |
| `headlessBrowserArgs`     | `{Object}`  | The [browser arguments](https://github.com/testem/testem/blob/master/docs/browser_args.md) that will be passed to Testem if the `HEADLESS` environment variable is set to a non-empty value. If there is no "headless" option for a given browser, the options from `browserArgs` will be used. |
| `cleanup.initial`         | `{Array}`   | An array of cleanup definitions (see below) to be cleaned up before the tests are run. |
| `cleanup.final`           | `{Array}`   | An array of cleanup definitions (see below) to be cleaned up after the tests are run and all reporting is complete. |

Please note, although you can change `options.testemOptions.framework`, `gpii.testem` is only tested with QUnit and is
unlikely to work with other frameworks supported by Testem.

## Cleanup Definitions

The initial and final cleanup options expect to be passed an array of "cleanup definitions", which support the following
attributes:

| Option            | Type         | Description                           |
| ----------------- | ------------ | ------------------------------------- |
| `name` (required) | `{String}`   | A "nickname" to use for this directory in log messages. |
| `path` (required) | `{String}`   | The path to remove. |
| `isTestemContent` | `{Boolean}`  | If this directory contains testem-generated content, we use a different cleanup method. |

# Component Invokers

## `{gpii.testem}.handleTestemStart(config, data, callback)`
* `config`: The configuration information Testem exposes as part of its lifecycle.
* `data`: The data Testem exposes as part of its lifecycle.
* `callback`: A function to be called when it is safe for Testem to run tests.  If you do not call this callback, Testem will hang indefinitely before running tests.
* Returns: Nothing.

An invoker which is called before testem begins its test run.  Starts a chain of events which cleanup before the tests, instrument code, start test fixtures, and perform
other preparatory work.  For details on how this works, see ["The Testem Event Lifecycle"](testem-lifecycle.md).

## `{gpii.testem}.handleTestemExit(config, data, callback)`
* `config`: The configuration information Testem exposes as part of its lifecycle.
* `data`: The data Testem exposes as part of its lifecycle.
* `callback`: A function to be called when it is safe for Testem to exit.  If you do not call this callback, you will not be able to quit Testem without killing the process.
* Returns: Nothing.

An invoker which is called when Testem has completed all tests.  Used to stop test fixtures, prepare reports, and remove
temporary content.  For details on how this works, see ["The Testem Event Lifecycle"](testem-lifecycle.md).

## `{gpii.testem}.getTestemOptions()`

An invoker which retrieves the Testem options, including all "generated" options, such as routes to replace the original 
source with instrumented source.  This invoker is intended to be used with `module.exports` to expose the component
options in the way the Testem expects when working with [javascript Testem configuration files](https://github.com/testem/testem/blob/master/docs/config_file.md#an-example).

See [the README file](../README.md) for an example of using this invoker.

## Content and Source Directories

Both "source" and "content" (non-source) directories can be referred to using a "short" or "long" notation.  Here is an
example of hosting our source and node_modules directories using "short" notation:

```snippet
sourceDirs: {
  src: "src"
},
contentDirs: {
  nm: "node_modules"
}
```

Here's the same in "long" format.

```snippet
sourceDirs: {
  src: {
   filePath: "src"
  }
},
contentDirs: {
  nm: {
    filePath: "node_modules"
  }
}
```
The following sub-options are supported:

| Option      | Type       | Description                           |
| ----------- | ---------- | ------------------------------------- |
| `filePath`  | `{String}` | A full path, relative path, or package-relative path to the content to be hosted. |
| `routePath` | `{String}` | The path at which this content should be mounted within our express instance. Defaults to the last segment of `filePath`. |
| `proxyPath` | `{String}` | The path associated with this content that should be redirected from Testem to our express instance. Defaults to the last segment of `filePath`. |

## Cleanup

By default, Testem generates browser content in the directory [`os.tmpdir()`](https://nodejs.org/api/os.html#os_os_tmpdir),
which it does not clean up when the test run is complete.  The `gpii.testem` component automatically cleans this up by
default.  The component also cleans up instrumented code and raw coverage data.

## Collecting Browser Coverage Data

See [the README](../README.md) for an example of using the components in this package to collect only browser coverage
data.

## Combining Browser Coverage with non-Browser coverage

If your work involves a mixture of node and browser tests, you may want to collect coverage data across a range of test
runs and then collate it yourself.  This package makes use of the same libraries as [Istanbul](https://istanbul.js.org),
so that combined reports can be prepared.

### Components

#### `gpii.testem.instrument`

This grade instruments source itself and collects coverage data, but does not prepare a report at the end or remove the
coverage data during its cleanup phase.

#### `gpii.testem.coverage`

This grade collects coverage data, but does not instrument source.  It is intended for use when you have already
instrumented the code by other means.  Please note, you must set `instrumentedSourceDir` (see above) to the location of
your instrumented code to use this grade.  This grade only removes the temporary content generated by Testem itself, and
not any pre-instrumented code or coverage data.  

### Example: Combining Node Coverage with Browser Coverage.

The key to preparing a combined report is to ensure that:

1. Each stage saves its coverage data to the same location.
2. Each stage avoids creating a misleading interim report.
3. Each stage avoid removing its coverage data at the end of its run.

#### Registering Your Package

In your package's main (node) entry point, you will need code like the following:

```javascript
var fluid = require("infusion");
fluid.module.register("my-package", __dirname, require);
```

#### Setting up your Testem Component

```javascript
var fluid = require("infusion");
fluid.require("%my-package");
var my = registerNamespace("my");
fluid.defaults("my.testem.grade", {
    gradeNames: ["gpii.testem.coverage"],
    reportsDir: "%my-package/reports",
    coverageDir: "%my-package/coverage",
    instrumentedSourceDir: "%my-package/instrumented",
    sourceDirs: {
        src: "%my-package/src"
    },
    contentDirs: {
        nm: "%my-package/node_modules"
    }
});

module.exports = my.testem.grade.getTestemOptions();

```

Save this to `tests/testem.js`.

#### Setting up your `package.json` file.

For this example, you need to install a few modules, using a command like:

`npm install --save-dev nyc rimraf gpii-testem`

Once you've done this, you'll need to update the `scripts` section of your `package.json`:

```snippet
  "scripts": {
    "pretest": "node node_modules/.bin/rimraf reports/* coverage/*",
    "test": "npm run test:node && npm run test:browser",
    "test:browser": "node node_modules/.bin/testem ci --file tests/testem.js",
    "test:node": "node node_modules/.bin/nyc --temp-directory coverage --reporter none tests/node-tests.js",
    "posttest": "node node_modules/.bin/nyc report --temp-directory coverage --reporter text-summary --reporter html"
  }
```
#### Running the Tests and Combined Report

To use this configuration, you would simply call `npm test` from the root of your repository.  Let's go through what
happens step by step.

1. The `pretest` step cleans out any previous coverage data and reports.
2. The `test` step calls the browser and node tests in sequence.
3. The `test:browser` step uses a Testem Component to instrument our source and save coverage data to `./coverage`.
4. The `test:node` step uses `nyc` to instrument our code and save coverage data to the same `./coverage` subdirectory.
5. The `posttest` step uses `nyc` to create a combined report based on all of the coverage data found in `./coverage`.
   A text summary is also displayed.

In this example, I'm assuming that we are only exercising browser-side code in our browser tests.  If you are also
exercising server-side fixtures (for example, by making AJAX requests), you would change `test:browser` to something
like:

```snippet
    "test:browser": "node node_modules/.bin/nyc --temp-directory coverage node_modules/testem/testem.js ci --file tests/testem.js",
```

In this scenario, our Testem component collect coverage data from browsers, and `nyc` itself collects coverage data from
any server-side fixtures used in our tests.