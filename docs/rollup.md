# Creating a "safe rollup"

In our work we commonly create "rollup" pages using [qunit-composite](https://github.com/JamesMGreene/qunit-composite),
so that we can easily view all test results and rerun individual tests interactively.  We use these with Testem, but
also when running "locally hosted" tests.

By "locally hosted", I mean that the test content is hosted using python, MAMP, or some other simple web server.  This
sidesteps the `file://` URL sandboxing in Chrome and other browsers, which otherwise would not allow us to do things
like retrieve static JSON content using AJAX calls.

The paths used in these two use cases are different.  "Locally hosted" paths are relative to the test fixture itself.
Testem paths should be relative to the root of the Testem Express instance.  Although it's possible to load the "locally
hosted" path in Testem, this can easily result in loading the source to be tested directly rather than loading the copy
that Testem has instrumented.  This results in empty or incomplete coverage reports.

This package provides a static function to allow test authors to write rollups for both use cases.  See below for full
details and a working example.

## `fluid.testem.safeRollup(rawTestSuitePaths, nonTestemPrefix, testemPrefix)`

* `rawTestSuitePaths` - An array of "raw" paths (lacking either prefix).
* `nonTestemPrefix` - The prefix to prepend to all paths when Testem is not available.
* `[testemPrefix]` - The (optional) prefix to prepend to all paths when Testem is available.  Defaults to `""` (empty string).

Each path in `rawTestSuitePaths` is combined with the appropriate prefix and passed to QUnit composite's
`QUnit.testSuites` function, which ensures that it will be run as part of the test suite.

Say for example that you have a test fixture in `tests/all-tests.html` relative to your package root, which refers to
two other tests in monorepo-style sub-modules.  Your HTML might look something like:

```html
<html>
    <head>
        <title>Sample Test "Rollup"</title>

        <!-- QUnit and other includes -->
        <link rel="stylesheet" href="../node_modules/infusion/tests/lib/qunit/css/qunit.css" />
        <script src="../node_modules/infusion/tests/lib/qunit/js/qunit.js"></script>
        <link rel="stylesheet" href="../node_modules/infusion/tests/lib/qunit/addons/composite/qunit-composite.css">
        <script src="/testem.js"></script>
        <script src="../node_modules/infusion/tests/lib/qunit/addons/composite/qunit-composite.js"></script>

        <!-- The static "safe rollup" function provided by fluid-testem -->
        <script src="../node_modules/fluid-testem/src/js/client/safeRollup.js"></script>
    </head>
    <body>
        <!-- Your QUnit HTML fixtures -->
        <div id="qunit"></div>
        <div id="qunit-fixture">
        </div>

        <!-- This could easily be in a separate JS file, but is inline here for purposes of illustration -->
        <script type="text/javascript">
            fluid.testem.safeRollup(
                [
                    "/gpii/node_modules/submodule1/tests/test1.html",
                    "/gpii/node_modules/submodule2/tests/test2.html"
                ],
                ".."
            );
        </script>
    </body>
</html>
```

In this example, we can omit the Testem path and express the "generalised" path in the form that Testem needs.  We only
need to provide a prefix that can be used to locate the test content relative to the "rollup".
