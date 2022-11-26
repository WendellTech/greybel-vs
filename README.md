# greybel-vs

GreyScript toolkit for [Grey Hack](https://greyhackgame.com). Includes highlighting, code execution, bundling and minifying among other features. Checkout the [changelog](https://github.com/ayecue/greybel-vs/blob/main/CHANGELOG.md) to get information on the latest changes.

Based on [greybel-js](https://github.com/ayecue/greybel-js).

If you need some GreyScript API information you can also checkout [greyscript-meta](https://greyscript-meta.netlify.app/).

## Usage

Automatically detects `.gs` and `.src` files.

Commands available (`CTRL+SHIFT+P`):
- `Greybel: Build` - [info](#build)
- `Greybel: Goto Error` - [info](#goto-error)
- `Greybel: Transform` - [info](#transform)
- `Greybel: Minify` - Shortcut for [info](#transform). Will use minifiy as build type.
- `Greybel: Beautify` - Shortcut for [info](#transform). Will use beautify as build type.
- `Greybel: Refresh` - [info](#refresh)
- `Greybel: API` - [info](#api-browser)
- `Greybel: Snippets` - [info](#snippets)

Do not forget to setup your plugin to your needs. Following settings are available:

- Activate/Deactivate
    - Autocomplete
    - Hoverdocs
    - Installer
- Transpiler specific
    - Build type
    - Disable literals optimization
    - Disable namespaces optimization
    - Environment variables
    - Excluded namespaces when optimizing
    - Obfuscation
- Installer specific
    - Define max characters per file

## Features

- Syntax Highlighting
- [Transform](#transform)
- [Build](#build)
- [Interpreter](#interpreter)
- [Debugger](#debugger)
- [Autocompletion](#autocompletion)
- [Hover Tooltips](#hover-tooltips)
- [Diagnostics](#diagnostics)
- [API Browser](#api-browser)
- [Snippets](#snippets)
- [Goto Error](#goto-error)

### Transform

Transforms selected file into one of three possible output types:
- Default (active by default): Minor optimizations
- Uglify: Minified
- Beautify: Beautified

It will also fill environment values with it's value which you are able to define in the configuration of this extension.

More details [here](https://github.com/ayecue/greybel-js#transpiler).

### Build

Transforms and bundles your files which makes it easier to import them into GreyHack. As described in the [transform section](#transform) it has three possible transformation types and supports environment variables as well.

Keep in mind to activate the installer to enable bundling in case you are using `import_code` in your code.

More details [here](https://github.com/ayecue/greybel-js#transpiler).

### Interpreter

Executes GreyScript code. Almost all intrinsics are fully supported. To get more information which intrinsics are supported [click here](https://github.com/ayecue/greybel-js#greyscript-api-support).

It also features a [mock environment](https://github.com/ayecue/greybel-js#local-environment) and [debugger](#debugger).

More details [here](https://github.com/ayecue/greybel-js#interpreter).

### Debugger

Enables you to set breakpoints, run code in a breakpoint context, jump to the next line of execution etc. Generally helpful if you want to debug your code. More details [here](https://github.com/ayecue/greybel-js#debugger).

### Autocompletion

Figures out the current context and tries to give suggestions accordingly.

### Hover Tooltips

Gives you informations about functions/types.

### Diagnostics

Gives you information about syntax errors in your code.

### API Browser

API Browser for GreyScript. Version of [greyscript-meta](https://greyscript-meta.netlify.app/) in Visual Studio Code.

### Refresh

Will refresh the AST Cache which is used for diagnostics, hover tooltips and autocompletion.

### Goto Error

Jumps to the next existing syntax error.

## Copyright

[Sloth icons created by Freepik - Flaticon](https://www.flaticon.com/free-icons/sloth)