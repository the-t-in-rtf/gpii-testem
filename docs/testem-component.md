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

|| Option                  || Type       || Description                          ||
|| ----------------------- || ---------- || ------------------------------------ ||
| `coveragePort` (required) | `{Number}`  | The port gpii-express should listen on to record coverage data. Defaults to `7000`.|
| `coverageDir` (required)  | `{String}`  | The full or package-relative path where coverage data should be saved. By default, a unique subdirectory is created in `os.tmpdir()`. |
| `reportsDir` (required)   | `{String}`  | The full or package-relative path where coverage reports and test results should be saved. By default, a unique subdirectory is created in `os.tmpdir()`. |
| `instrumentSource`        | `{Boolean}` | Whether to instrument the source in `options.SourceFiles` (see below).  Defaults to `true`. |
| `generateCoverageReport`  | `{Boolean}` | Whether to generate coverage reports at the end of the test suite run.  Defaults to `true`. |
| `sourceDirs`              | `{Array}`   | One or more source directories to load, relative to the directory in which your configuration file is stored (see "paths" below).  Note that although Testem itself supports globbing and file patterns, you are expected to supply only directory paths here. |
| `testPages`               | `{Array}`   | One or more test pages to load in the browser, relative to the directory in which your configuration file is stored (see "paths" below). |
| `serveDirs`               | `{Array}`   | One or more directories to host within the Testem environment. |
| `testemOptions`           | `{Object}`  | The raw configuration options to pass to Testem.  See [the Testem docs](https://github.com/testem/testem/blob/master/docs/config_file.md) for supported options. |

# Component Invokers

## `{gpii.testem}.handleTestemStart(config, data, callback)`

An invoker which is called before testem begins its test run.  Used to start test fixtures, instrument code, and perform
other preparatory work.  See ["The Testem Event Lifecycle"](testem-lifecycle.md) for more details.

## `{gpii.testem}.handleTestemExit(config, data, callback)`

An invoker which is called when Testem has completed all tests.  Used to stop test fixtures, prepare reports, and remove
temporary content.  See ["The Testem Event Lifecycle"](testem-lifecycle.md) for more details.

## `{gpii.testem}.getTestemOptions()`

An invoker which exposes the final Testem options in a way that Testem can read from a configuration file.  See
[the README file](../README.md) for a usage example.

# Paths

By default, Testem resolves paths to source code, files to be served, and test pages relative to the directory from
which you run the command.  The `gpii.testem` component makes this more consistent by setting the effective working
directory (`options.testemOptions.cwd`) to the directory in which the configuration file is stored, so that tests will
not fail simply because you have run them from another directory.  Testem also has safeguards to avoid serving up
content outside of the current working directory.

To avoid problems with both, it's best to store your testem configuration javascript file in a directory higher up than
all of the code and test pages you need, and to use relative paths for `sourceDirs`, `testPages`, and `serveDirs`.

# Cleanup

By default, Testem generates browser content in the directory [`os.tmpdir()`](https://nodejs.org/api/os.html#os_os_tmpdir),
which it does not clean up when the test run is complete.  The `gpii.testem` component automatically cleans this up by
default.

You can also make use of the underlying static cleanup function, `gpii.testem.cleanupTestemContent(path, callback)`,
which will remove any directories that match `testem-*` from `path`.  If `callback` is supplied, it will be called when
the cleanup process completes.
