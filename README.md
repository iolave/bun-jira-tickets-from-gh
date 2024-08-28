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
- `Jira issue type`: choice field with available jira issue types.
- `Jira URL`: text field to store jira url.
- `Status`: `Todo`, `In Progress`, `Done` choice field.
- `Estimate`: Number field.
- `Repository`: Default field for repository info.

### Get a jira token
- Get a jira api token from your jira cloud account.
- Form a base64 encoded string (basic auth) out of your jira cloud account and the api token: `base64(EMAIL:API_TOKEN)`.

### Get the id of your github project
#### Organization projects
The cli is shipped with a utility that's going to help us search our GitHub project id.
```bash
jira-tickets-from-gh --gh-token=GH_TOKEN github-projects listOrganizationProjects --org=YOU_ORG
```

#### User projects
NOT YET AVAIALBLE

### Help command
```bash
Usage: jira-tickets-from-gh [options] [command]

generate Jira tickets from github project

Options:
  -V, --version         output the version number
  --gh-token <TOKEN>    GitHub token
  --jira-token <TOKEN>  Jira token
  -v --verbose          verbose mode
  -h, --help            display help for command

Commands:
  github-projects       GitHub projects utilities
  sync [options]        sync GitHub project tickets with Jira
  help [command]        display help for command

## Environment variables
- `GITHUB_TOKEN`
- `JIRA_TOKEN`: Basic authorization token, to form it `base64([JIRA_ACCOUNT_ID]:[JIRA_API_KEY])`
```

### Example sync command
_The `--jira-project-key` is the short name of the jira cloud project._

```bash
jira-tickets-from-gh --gh-token=GH_TOKEN --jira-token=JIRA_TOKEN sync \
  --gh-project-id=PROJECT_ID \
  --jira-project-key=PROJECT_KEY \ 
  --jira-subdomain=MYSUBDOMAIN \
  --gh-assignees-map=iolave:my-private@email.com
```

*execution example*
```bash
[INFO]	syncCmd.action                          	creating jira issue                                         	{"title":"TEST: bun-jira-tickets-from-gh"}
[INFO]	syncCmd.action                          	created issue                                               	{"url":"https://mfhnet.atlassian.net/browse/TEST3-100"}
[INFO]	syncCmd.action                          	updated jira url in github                                  	{"updateId":"0b2f5b21-d3b7-4580-9327-6a57fa1924db"}
```

This project was created using `bun init` in bun v1.1.24. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.
