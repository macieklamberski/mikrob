# Changelog

## v2.1.1

### Added
- Simplify loading Markdown files by using import() with type 'text'.
- Simplify type definition of serveStatic option.

## v2.1.0

### Added
- Add support for Markdown files.

## v2.0.1

### Fixed
- Update publish action.
- Include locale file into the published package.

## v2.0.0

### Added
- Rewrite the package in TypeScript.
- Add a collection of unit tests to cover all functionalities.
- Include Biome for code formatting and linting.
- Create new documentation for the rewritten codebase.

## v1.4.3

### Added
- Bring back previous version of get_value with working warning supression when undefined.

## v1.4.2

### Added
- Rename package prefix to use new username.

## v1.4.1

### Added
- Replace usage of Error with Exception as this is more semantically correct class.
- Remove wrongly duplicated fragment of code.

## v1.4.0

### Added
- New format of JSON front matter in Markdown files, now it's only "---" instead old "---json".

## v1.3.0

### Added
- Add ability to read named parameters from current path.

## v1.2.1

### Added
- The logic for regular expression paths has been adjusted to better support nested pages.
- The roadmap section has been removed from the _README.md_ file.

## v1.2.0

### Added
- Ability to use regular expressions in `path` to create wildcard pages.
- Ability specify HTTP response code for given page via the new `status` property.
- Improved logic of cleaning up page path.
- Simplified logic inside functions.

## v1.1.0

### Added
- `Mikrob` namespace for all the functions to avoid conflicts with other packages.
- _.gitignore_ file and ignored vendor Composer's directory.

### Fixed
- Typo in the _CHANGELOG.md_ file.

## v1.0.2

### Fixed
- Type hinting in `redirect_to()` to accept objects or arrays.

## v1.0.1

### Added
- Error message if *.md file cannot be read.
- Redirection functionality.

## v1.0.0

### Added
- Support for JSON and Markdown pages.
- Ability to customize page path used to open pages.
- Page index containing all pages and their data.
- Integration of views and `load_view()` helper.

## v0.9.0

### Added
- Basic version with a simple router and support only for PHP pages.
