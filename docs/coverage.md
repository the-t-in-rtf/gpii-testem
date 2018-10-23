# Code Coverage

[Istanbul](https://github.com/gotwarlost/istanbul) is a library that instruments your
code so that you can prepare code coverage reports.  As outlined in
[the Testem examples](https://github.com/testem/testem/tree/master/examples/coverage_istanbul), the basic approach for
collecting code coverage in your tests is to:

1. Instrument your code.
2. Load the instrumentSource code in place of your uninstrumented code, for example, using a "route" directive.
3. Set up an HTTP server that listens for code coverage reports and saves them to individual files.
4. Proxy the server to the /coverage endpoint.
5. Before your test scripts load, [hook into the global Testem
   object](https://github.com/testem/testem/blob/master/examples/coverage_istanbul/tests.html#L11) and ensure that the
   results are forwarded when the tests complete.
6. Run your tests.
7. (Once all tests are complete) Compile an overall coverage report.

By default, the `gpii.testem` grade does everything but step 5 for you.  Step 5 requires you to load the client-side
coverage sender using markup like the following:

```html
<script type="text/javascript" src="../../../lib/qunit/js/qunit.js"></script>
<script type="text/javascript" src="../../../test-core/jqUnit/js/jqUnit.js"></script>

<!-- These are required for the coverage client -->
<script type="text/javascript" src="../../../../src/lib/jquery/core/js/jquery.js"></script>
<script type="text/javascript" src="../../../../src/framework/core/js/Fluid.js"></script>

<script type="text/javascript" src="/coverage/client/coverageSender.js"></script>

<script type="text/javascript" src="path/to/myTests.js"></script>
```

Please note, as shown in the above example:

1. The "coverage sender" must be loaded after QUnit.
2. The "coverage sender" needs to be loaded after jQuery, and its Fluid dependencies.
3. The "coverage sender" needs to be loaded before your tests.

The middleware that receives the coverage data is built into Testem component grades found in this package.  See
[the Testem component docs](./testem-component.md) for more details.

## Coverage Sender Advanced Options

The middleware that serves up the coverage sender accepts three options, which are used to generate the client-side code
that your browser loads.

| Option           | Type        | Description                           |
| ---------------- | ----------- | ------------------------------------- |
| `exposeCallback` | `{Boolean}` | Whether to expose the callback that sends coverage data as the global named variable `window.gpii.testem.coverage.afterTestsCallback` so that it can be called directly in situations where Testem and QUnit are not available. |
| `hookTestem`     | `{Boolean}` | Whether to hook the callback that sends coverage data into the Testem lifecycle, so that test results are sent when Testem detects that the tests on a page have completed.  Defaults to `true`. |
| `hookQunit`      | `{Boolean}` | Whether to hook the callback that sends coverage data into the QUnit lifecycle, so that test results are sent when QUnit detects that the tests on a page have completed. Defaults to `false`. |

The `hookTestem` option is enabled by default, and if you are only using Testem, you should not need to supply custom
options. See [the rollup tests in this package](../tests/js/rollup-non-testem-tests.js) for an example of using QUnit
without using Testem.  See [the callback tests in this package](../tests/js/callback-tests.js) for an example of using
the coverage sender without either Testem or QUnit.
