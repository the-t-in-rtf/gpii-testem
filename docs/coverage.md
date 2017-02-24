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

By default, the `gpii.testem` grade does everything but step 5 for you.

will take care of steps 1, 2, 3, and 4 for you.  The last step, compiling the
reports, will take place if `options.compileCoverageReport` is set to true.  This option is provided so that you can
(for example) prepare a combined coverage report for node and browser fixtures in a "posttest" npm script.

Step 5 requires loading a piece of code in your browser, using a line like the following:

```
<script type="text/javascript" src="/coverage/coverageSender.js"></script>
```

This needs to be loaded after testem, but before your tests.

# Disabling Instrumentation and Code Coverage Reporting

The instrumentation and code coverage reports built into the `gpii.testem` grade can be disabled using
configuration options.  For example, if you want to disable the coverage reporting so that you can collate
coverage reports for browser and node fixtures yourself, you can set `options.generateCoverageReport` to `false`.

Similarly, set `options.instrumentSource` to `false` if you do not wish to instrument your code.  If you want to avoid
generating an empty coverage report, you should also set `options.generateCoverageReport` to `false`.