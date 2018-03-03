
# Changelog

## 4.1.0
- Fix parsing error on exposed API written as `async a => {}` (usage of mini-serivce-utils@3.0.0)
- Added support of destructured parameters and rest parameters (previously was throwing errors)

## 4.0.0
- Use async/await instead of promise-based code. Requires node@8+
- **[Breaking change]**: `startServer()` used to throw synrchonous errors while validating configuration.
   Now all errors are thrown asynchronously
- Fix exposed API with single parameter and default value exposed as `GET` (are proper `POST` now)
- Dependencies update, including Hapi 17

## 3.3.1
- Fix max request payload limit by configuring it to a GB.
- Dependencies update

## 3.3.0
- Expose customizable OpenAPI descriptor (disabled by default)
- Allow default values for API parameters
- Allow documentation and validation of API result (disabled by default)

## 3.2.1
- Disabled low-level socket timeout

## 3.2.0
- Support synchronous `init()` and API functions
- Dependencies update

## 3.1.0
- Don't wrap Boom errors to keep http status codes
- Use [standard.js](https://standardjs.com/) lint configuration

## 3.0.0
- **[Breaking change]** Use mini-client@3.0.0 that uses sub-objects for exposed groups.
- Returns CRC32 checksum of exposed API during every call, to allow mini-client checking compatibility
- Dependency update (except Joi 11 that introduced a regression in Hapi)

## 2.1.0

## 2.0.0
- Externalized client using [mini-client][mini-client-url], to decouple clients and service code
- **[Breaking change]** Introduce new terminology, with service descriptor and API groups
- **[Breaking change]** When parsing exposed APIs, expect 'group' property instead of 'name'
- Allow to declare API without groups
- Allow to declare API validation in group options
- **[Breaking change]** Force name+version on local client
- Better documentation and code examples
- More understandable error messages

## 1.3.0
- Add NSP checks, and upgrade vulnerable dependency

## 1.2.2
- fix parameter detection
- fix Proxy that is detected as a Thenable object

## 1.2.1
- fix issue related to parameter name extraction when using arrow functions

## 1.2.0
- use proxy to delay remotely exposed Apis retrieval to the first effective usage
- activate Travis CI and coveralls reports
- update dependencies

## 1.1.3
- client functions always returns a real promise (request-promise return a mixed stream + promise object that prevent direct usage in Hapi)
- checks exposed services interface to avoid mistakes

## 1.1.2
- update dependencies
- use lab configuration file

## 1.1.1
- fix bug that prevent to specify version when creating the service

## 1.1.0
- allows to use general logger object within exposed services

## 1.0.0
- initial release
