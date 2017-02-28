# `gpii.testem`

This library provides a [Fluid component](http://docs.fluidproject.org/infusion/development/UnderstandingInfusionComponents.html)
and static functions that assist in using [Testem](https://github.com/testem/testem).

# Key Features

1. Provides a mechanism to collect client-side code coverage data and combine that with browser coverage.
2. Provides the ability to launch and wait for server-side components to start up before each test run.
3. Provides the ability to safely shut down server-side test fixtures after each test run.
4. Provides cleanup mechanisms to remove temporary browser content after each test run.

# Requirements

In order to use the code coverage features of this grade, you'll need to have
[Istanbul](https://github.com/gotwarlost/istanbul) installed and available in your path.

# Usage instructions

To use this grade from Testem, install this package as a development dependency using a command like
`npm install --save-dev gpii-testem` or `yarn add --dev gpii-testem`.

Once you've done that, you will need to create a javascript configuration file, which will allow you to make use of the
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
fixtures, for example, using the markup below:

```
<script type="text/javascript" src="/coverage/client/coverageSender.js"></script>
```

The "coverage sender" needs to be loaded after Testem, but before your tests.  See [the coverage docs](docs/coverage.md)
for details.   Like Infusion itself, the "coverage sender" requires jQuery.

Once you have created your configuration javascript file, you can launch Testem with your configuration using a command
like the following:

`testem --file path/to/your-testem-config.js`

If you save your configuration to the file name `testem.js` in your package root, you can launch testem using a command
like `testem` or `testem ci`.

# More Information

For more information, check out the documentation links below:

* [The `gpii.testem` Component](docs/testem-component.md)
* [The Testem Lifecycle](docs/testem-lifecycle.md)
* [Code Coverage](docs/coverage.md)

# Running the Tests in this Package

Although you are not required to do to so in your own package, to run the tests in this package, you must have Testem
installed globally.  Once you have that, run the tests using a command like `npm test` or `yarn test`.