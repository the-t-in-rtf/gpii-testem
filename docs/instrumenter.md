# `gpii.testem.instrumenter.instrument(inputPath, outputPath, instrumentationOptions)`

* `inputPath` `{String}` - The full or package-relative path to a directory containing code to instrument.
* `outputPath` `{String}` - The full or package-relative path to the directory where you want to save the instrumented
  output.
* `instrumentationOptions` `{Object}` - Configuration options to control what is instrumented.  See the instrumenter
  docs for details.
* Returns: `{Promise}` - A `fluid.promise` that will be resolved when the full instrumentation is complete or rejected
  if there is an error at any point.


This static function can be used to "instrument" a source repository.  Uses the same instrumentation library as `nyc`,
but avoids common problems with including "node_modules" content as we do in our larger projects.  It also defaults to
including all content, and not just javascript files, so that configuration files stored as JSON, templates, etc. are
all available in the instrumented output.

## `instrumentationOptions`

| Option       | Type       | Description                           |
| ------------ | ---------- | ------------------------------------- |
| `excludes`   | `{Array}`  | An array of [minimatch](https://github.com/isaacs/minimatch) patterns representing files and directories to exclude from the output.  All paths are relative to `inputPath`. Defaults to `["./node_modules/**]`. |
| `includes`   | `{Array}`  | An array of [minimatch](https://github.com/isaacs/minimatch) patterns representing files and directories to include in the output.  Relative to `inputPath`. Defaults to `["src/**/*.js"]`.|
| `nonSources` | `{Array}`  | An array of [minimatch](https://github.com/isaacs/minimatch) patterns representing files that should not be instrumented.  Defaults to `["!./**/*.js"]` (all non-javascript files). |
| `sources`    | `{Array}`  | An array of [minimatch](https://github.com/isaacs/minimatch) patterns representing files that should be instrumented.  Defaults to `["./**/*.js"]` (all javascript files). |
| `istanbulOptions`        | `{Object}` | Configuration options to pass to [istanbul-lib-instrument](https://github.com/istanbuljs/istanbuljs/tree/master/packages/istanbul-lib-instrument), the library we use to instrument all code. |

## Examples

### Example 1: Including Multiple Directories


### Example 2: Avoiding Instrumenting Particular Directories