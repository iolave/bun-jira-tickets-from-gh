# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [unreleased]
### Added
- Added `--transitions-to-wip` option to specify Jira cloud transitions required in order to transition a task to a "Dev in progress" state.
- Added `--transitions-to-done` option to specify Jira cloud transitions required in order to transition a task to a "Done" state.

### Changed
- Log entries now have date and time.

## [v0.1.0]

### Added
- Sync command that creates Jira tickets from GitHub project cards.
- GitHub utility to list organization projects in order to extract a project id.

[unreleased]: https://github.com/iolave/bun-jira-tickets-from-gh/compare/v0.1.0...HEAD
[v0.1.0]: https://github.com/iolave/bun-jira-tickets-from-gh/releases/tag/v0.1.0
