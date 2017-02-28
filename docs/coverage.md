# Code Coverage

[Istanbul](https://github.com/gotwarlost/istanbul) is a library that instruments your
code so that you can prepare code coverage reports.  As outlined in
[the Testem examples](https://github.com/testem/testem/tree/master/examples/coverage_istanbul), the basic approach for
collecting code coverage in your tests is to:

1. Instrument your code.
2. Load the instrumentSource code in place of your uninstrumented code, for example, using a "route" directive.
3. Set up an HTTP server that listens for code coverage reports and saves them to individual files.
4. Proxy the server to the /coverage endpoint.
5. Before your test scripts load, [hook into the global Testem object](https://github.com/testem/testem/blob/master/examples/coverage_istanbul/tests.html#L11
) and ensure that the results are forwarded when the tests complete.
6. Run your tests.
7. (Once all tests are complete) Compile an overall coverage report.

By default, the `gpii.testem` grade does everything but step 5 for you.  Step 5 requires loading a piece of code in your
browser, using a line like the following:

```
<script type="text/javascript" src="/coverage/client/coverageSender.js"></script>
```

This needs to be loaded after testem, but before your tests.

The last step (preparing coverage reports) is optional, but enabled by default.  Read on for details.

# Configuring Instrumentation and Code Coverage Reporting

By default, `gpii.testem` will instrument source code, collect code coverage data, prepare a coverage report, and remove
the remove the raw coverage data once it has finished its run.  If you are running multiple test suites (for example,
one for code that runs in node, one for code that runs in a browser), you can use the `gpii.testem.coverageDataOnly`
grade ([see the docs](./testem-component.md#gpiitestemcoverageDataOnly)), which does not generate a coverage report, and which leaves the raw coverage data so that you can collate it
using an Istanbul command.

If you need more control, you can toggle the instrumentation and cleanup behavior using individual options.  See
[the component docs](testem-component.md) for details.

