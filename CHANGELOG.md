# Changelog

## Unreleased
#### Added
- Support for Buffer and Stream parameters and results
- Validates exposed API metadata such as `validate`, `validateResponse` or `responseSchema`
- Usage of Yarn 

#### Changed
- Reformat CHANGELOG to follow [Keep a Changelog](https://keepachangelog.com) recommandations
- New documentation with latest docma v2.0.0
- Dependencies update

## 4.1.0 - 2018-03-03
#### Added
- Support of destructured parameters and rest parameters (previously was throwing errors)

#### Fixed
- Parsing error on exposed API written as `async a => {}` (usage of mini-service-utils v3.0.0)


## 4.0.0 - 2018-02-11
#### Changed
- **Breaking**: `startServer()` used to throw synchronous errors while validating configuration.

  Now all errors are thrown asynchronously
- **Breaking**: Uses async/await instead of promise-based code. Requires node@8+
- Dependencies update, including Hapi 17

#### Fixed
- Exposed API with single parameter and default value exposed as `GET` (are proper `POST` now)


## 3.3.1 - 2018-02-11
#### Added
- Expose customizable OpenAPI descriptor (disabled by default)
- Allow documentation and validation of API result (disabled by default)

#### Changed
- Dependencies update

#### Fixed
- Max request payload limit by configuring it to 1 GB.
- Allow default values for API parameters


## 3.2.1 - 2017-12-04
#### Fixed
- Disabled low-level socket timeout


## 3.2.0 - 2017-10-02
#### Changed
- Support synchronous `init()` and API functions
- Dependencies update


## 3.1.0 - 2017-10-01
#### Changed
- Don't wrap Boom errors to keep http status codes
- Use [standard.js](https://standardjs.com/) lint configuration


## 3.0.0 - 2017-09-24
#### Changed
- **Breaking**: uses mini-client@3.0.0 that uses sub-objects for exposed groups.
- Returns CRC32 checksum of exposed API during every call, to allow mini-client checking compatibility
- Dependency update (except Joi 11 that introduced a regression in Hapi)


## 2.0.0 - 2017-04-09
#### Added
- Allow to declare API without groups
- Allow to declare API validation in group options
- Better documentation and code examples


#### Changed
- Externalized client using [mini-client][mini-client-url], to decouple clients and service code
- **Breaking**: Introduce new terminology, with service descriptor and API groups
- **Breaking**: When parsing exposed APIs, expect 'group' property instead of 'name'
- **Breaking**: Force name+version on local client
- More understandable error messages


## 1.3.0 - 2019-08-29
#### Changed
- Add NSP checks, and upgrade vulnerable dependency


## 1.2.2 - 2016-07-26
#### Fixed
- Parameter detection
- Proxies that are detected as a Thenable object


## 1.2.1 - 2016-07-22
#### Fixed
- Issue related to parameter name extraction when using arrow functions


## 1.2.0 - 2016-07-19
#### Added
- Use proxy to delay remotely exposed Apis retrieval to the first effective usage
- Activate Travis CI and coveralls reports

#### Changed
- Dependencies update


## 1.1.3 - 2016-07-14
#### Fixed
- Client functions always returns a real promise (request-promise return a mixed stream + promise object that prevent direct usage in Hapi)
- Checks exposed services interface to avoid mistakes


## 1.1.2 - 2016-07-13
#### Changed
- Dependencies update
- Use lab configuration file


## 1.1.1 - 2016-07-05
#### Fixed
- Bug preventing to specify version when creating the service


## 1.1.0 - 2016-07-05
#### Changed
- Allows to use general logger object within exposed services


## 1.0.0 - 2016-07-04
#### Added
- Initial release
