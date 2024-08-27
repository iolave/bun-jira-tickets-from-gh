# jtfgh

> [!WARNING]
> All versions released prior to `v1.0.0` are to be considered [breaking changes](https://semver.org/#how-do-i-know-when-to-release-100) (I'll try my best to not push breaking changes btw).
To install dependencies:

```bash
bun install -g https://github.com/iolave/bun-jira-tickets-from-gh
```

To run:

```bash
jira-tickets-from-gh --help
```

## Usage
For the cli to work properly, you will need a GitHub project with the following fields:

- `Title`: Title for the task.
- `Jira`: `YES` or `NO` choice field.
- `Jira URL`: text field to store jira url.
- `Status`: `Todo`, `In Progress`, `Done` choice field.
- `Estimate`: Number field.
- `Repository`: Default field for repository info.

```
Usage: jira-tickets-from-gh [options] [command]

generate Jira tickets from github project

Options:
  -V, --version                       output the version number
  --gh-token <TOKEN>                  GitHub token
  -v --verbose                        verbose mode
  -h, --help                          display help for command

Commands:
  listOrganizationProjects [options]  list GitHub projects for a given organization
  sync [options]                      sync GitHub project tickets with Jira
  help [command]                      display help for command
```

## Environment variables
- `GITHUB_TOKEN`


This project was created using `bun init` in bun v1.1.24. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.
