# `gpii.testem`

The `gpii.testem` component is designed to:

1. Instrument the code under test
2. start test fixtures
3. Run Testem tests
4. Prepare a coverage report
5. Clean up temporary files (instrumented source, browser data, coverage data)

For basic usage instructions and requirements, see the [README file](../README.md).  For detailed configuration options,
see below.

# Component Options

| Option                    | Type        | Description                           |
| ------------------------- | ----------- | ------------------------------------- |
| `cwd`                     | `{String}`  | Defaults to `process.cwd()`, i.e. the directory from which the script was called. |
| `packageRoot`             | `{String}`  | The package root we use to access our own copies of testem and istanbul when running tests. |
| `istanbulCmd`             | `{String}`  | The istanbul command to use when instrumenting code and generating code coverage reports. |
| `testemDir`               | `{String}`  | The directory in which testem's browser settings and temporary files should be stored. |
| `wrappedEventTimeout`     | `{Number}`  | How long to wait (in milliseconds) before triggering a timeout when waiting for key startup/shutdown events. |
| `coveragePort` (required) | `{Number}`  | The port gpii-express should listen on to record coverage data. Defaults to `7000`.|
| `coverageUrl`             | `{String}`  | The URL on which the coverage listener should be run.  Set based on `coveragePort` by default. |
| `coverageDir` (required)  | `{String}`  | The full or package-relative path where coverage data should be saved. By default, a unique subdirectory is created in `os.tmpdir()`. |
| `reportsDir` (required)   | `{String}`  | The full or package-relative path where coverage reports and test results should be saved. By default, a unique subdirectory is created in `os.tmpdir()`. |
| `instrumentSource`        | `{Boolean}` | Whether to instrument the source in `options.SourceFiles` (see below).  Defaults to `true`. |
| `instrumentedSourceDir`   | `{String}`  | The location in which to store instrumented code.  Defaults to the "instrumented" subdirectory in the directory from which the script is run.|
| `generateCoverageReport`  | `{Boolean}` | Whether to generate coverage reports at the end of the test suite run.  Defaults to `true`. |
| `sourceDirs`              | `{Array}`   | One or more source directories to load, relative to the directory in which your configuration file is stored (see "paths" below).  Note that although Testem itself supports globbing and file patterns, you are expected to supply only directory paths here. |
| `testPages`               | `{Array}`   | One or more test pages to load in the browser, relative to the directory in which your configuration file is stored (see "paths" below). |
| `serveDirs`               | `{Array}`   | One or more directories to host within the Testem environment. |
| `testemOptions`           | `{Object}`  | The raw configuration options to pass to Testem.  See [the Testem docs](https://github.com/testem/testem/blob/master/docs/config_file.md) for supported options. |
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

## Paths

By default, Testem resolves paths to source code, files to be served, and test pages relative to the directory from
which you run the command.  To avoid problems, it's best to store your testem configuration javascript file in a
directory higher up than all of the code and test pages you need, and to use relative paths for `sourceDirs`,
`testPages`, and `serveDirs`.  For, example, a `testem.js` file in the root of your repository will be able to reference
all of your tests and code using relative paths.

## Cleanup

By default, Testem generates browser content in the directory [`os.tmpdir()`](https://nodejs.org/api/os.html#os_os_tmpdir),
which it does not clean up when the test run is complete.  The `gpii.testem` component automatically cleans this up by
default.  It also cleans up instrumented code and raw coverage data.

# `gpii.testem.coverageDataOnly`

If your work involves a mixture of node and browser tests, you may want to collect coverage data across a range of test
runs and then collate it yourself.   The `gpii.testem.coverageDataOnly` is provided for this purpose.  This grade
disables coverage reporting and the cleanup of the raw coverage data.  It does so by overriding
`options.dirsToCleanOnShutdown` and  `options.generateCoverageReport` (see above).

