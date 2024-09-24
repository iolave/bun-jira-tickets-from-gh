# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [unreleased]
### Added
- Verbose environment variable for docker.
- Docker compose volume to persist executions data.
- Setting up the `--jira-issue-prefix=<STRING>` pre-appends the given prefix to jira issue titles.

## [v0.3.0]
### Added
- Github project state is now stored locally (experimental).

## [v0.2.0]
### Added
- Docker config files.
- Added `--transitions-to-wip` option to specify Jira cloud transitions required in order to transition a task to a "Dev in progress" state.
- Added `--transitions-to-done` option to specify Jira cloud transitions required in order to transition a task to a "Done" state.
- Added `--sleep-time` that enables new executions tiggered when the sleep time passes by.

### Changed
- Log entries now have date and time.

## [v0.1.0]

### Added
- Sync command that creates Jira tickets from GitHub project cards.
- GitHub utility to list organization projects in order to extract a project id.

[unreleased]: https://github.com/iolave/bun-jira-tickets-from-gh/compare/v0.3.0...staging
[v0.3.0]: https://github.com/iolave/bun-jira-tickets-from-gh/releases/tag/v0.3.0
[v0.2.0]: https://github.com/iolave/bun-jira-tickets-from-gh/releases/tag/v0.2.0
[v0.1.0]: https://github.com/iolave/bun-jira-tickets-from-gh/releases/tag/v0.1.0
