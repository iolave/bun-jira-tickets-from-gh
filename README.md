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
```
Usage: jira-tickets-from-gh [options] [command]

Generate Jira tickets from github project

Options:
  -V, --version                       output the version number
  --gh-token <TOKEN>                  GitHub token
  -h, --help                          display help for command

Commands:
  listOrganizationProjects [options]  List GitHub projects for a given organization
  help [command]                      display help for command
```

## Environment variables
- `GITHUB_TOKEN`


This project was created using `bun init` in bun v1.1.24. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.
