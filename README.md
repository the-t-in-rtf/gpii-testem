# `gpii.testem`

This library provides a [Fluid component](http://docs.fluidproject.org/infusion/development/UnderstandingInfusionComponents.html)
and static functions that assist in using [Testem](https://github.com/testem/testem).

# Key Features

1. Provides a mechanism to collect client-side code coverage data and combine that with browser coverage.
2. Provides the ability to launch and wait for server-side components to start up before each test run.
3. Provides the ability to safely shut down server-side test fixtures after each test run.
4. Provides cleanup mechanisms to remove temporary browser content after each test run.

# Usage instructions

To use this grade from Testem, install this package as a development dependency using a command like
`npm install --save-dev gpii-testem`.  Note:  There is currently
[a bug in newer versions of Testem](https://github.com/testem/testem/issues/1075), if you use anything higher than
version 1.13.0, you may experience hangs when attempting to quit Testem from the console.

Once you have Testem installed, you will need to create a javascript configuration file, which will allow you to make use of the
[dynamic configuration options available via the `testem.js` file](https://github.com/testem/testem/blob/master/examples/dynamic_config/testem.js).

The most basic example of a file might look something like:

```
var fluid = require("infusion");
fluid.require("%gpii-testem");

var my  = fluid.registerNamespace("my");
fluid.defaults("my.testem.grade", {
    gradeNames: ["gpii.testem"],
    testPages:  ["tests/my-awesome-test.html"]
});

module.exports = my.testem.grade().getTestemOptions();
```

To make use of the code coverage support provided by gpii.testem, you must load the "coverage sender" in your HTML
fixtures.  See [the coverage docs](docs/coverage.md) for details.

Once you have created your configuration javascript file, you can launch Testem with your configuration.
 
## Browser Coverage Only

If you only want to check the coverage of browser code, you can run your tests using a command like the following:

`node node_modules/testem/testem.js ci --file path/to/your-testem-config.js`

If you save your configuration to the file name `testem.js` in your package root, you can launch Testem using a command
like `node node_modules/testem/testem.js` or `node node_modules/testem/testem.js ci`.

## Browser and Node Coverage

If you are testing browser code in combination with node fixtures, and wish to collect coverage data for your node
fixtures, you will need to run Testem using [nyc](https://github.com/istanbuljs/nyc), the next-generation command-line
interface for [Istanbul](https://github.com/gotwarlost/istanbul).  Here is a sample command:

    node_modules/.bin/nyc --temp-directory==./coverage -r none node_modules/testem/testem.js ci --file tests/testem.js

This assumes that you are saving the browser coverage data to `./coverage`.  The `temp-directory` option saves the node
fixture coverage data collected by nyc to a JSON file in `./coverage` as well.  The `-r none` option in the previous
command prevents nyc from outputting a report about just the node fixtures, as we want a combined report for both the
node fixtures and browser code under test.  To create a combined report and output a text summary, you can use a command
like the following:

    node node_modules/nyc/bin/nyc.js report --reports_dir coverage/report -r lcov -r text-summary


# More Information

For more information, check out the documentation links below:

* [The `gpii.testem` Component](docs/testem-component.md)
* [The Testem Lifecycle](docs/testem-lifecycle.md)
* [Code Coverage](docs/coverage.md)

# Running the Tests in this Package

You can run the tests using the command `npm test`.  You are not required to have Testem installed
globally to run the tests.

# A Warning about Internet Explorer 11

There is currently [a bug in Testem](https://github.com/testem/testem/issues/1184) that results in IE11 windows opened
by Testem not being closed when the tests finish.  Until that bug is resolved, if you are running tests from Windows, 
you will need to close any open IE11 windows before launching the tests.