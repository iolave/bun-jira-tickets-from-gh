# Sync Jira and GitHub projects
I was forced by my job to use Jira to keep track of tasks, but I kept forgetting to update status within Jira. Most of time im in GitHub and it's just easier to have issues and close them via PR's.

...so i built this tool for myself and hopefully, it will help you too.

> [!WARNING]
> All versions released prior to `v1.0.0` are to be considered [breaking changes](https://semver.org/#how-do-i-know-when-to-release-100) (I'll try my best to not push breaking changes btw).

## Installation
```bash
bun install -g jira-tickets-from-gh
```

## Pre-requisites for running the CLI
### A GitHub project with required fields
Make sure you have a GitHub project with the following fields:

- `Title`: Title for the task.
- `Jira issue type`: choice field with available jira issue types.
- `Jira URL`: text field to store jira url.
- `Status`: `Todo`, `In Progress`, `Done` choice field.
- `Estimate`: Number field.
- `Repository`: Default field for repository info.

### Get the id of your github project
The cli is shipped with a utility that's going to help you to search a GitHub project id.

#### List organization projects
```bash
jira-tickets-from-gh --gh-token=GH_TOKEN github-project list --org=<ORG>
```

#### List user projects
```bash
jira-tickets-from-gh --gh-token=GH_TOKEN github-project list --user=<GH_USER>
```

### Get a Jira cloud token
- Get a jira api token from your jira cloud account.
- Form a base64 encoded string (basic auth) out of your jira cloud account and the api token: `base64(EMAIL:API_TOKEN)`.

### Environment variables
- `GITHUB_TOKEN`: Your GitHub token. If the project you're trying to sync is in an organization, make sure the token have access to it.
- `JIRA_TOKEN`: Basic authorization token, to form it `base64([JIRA_CLOUD_ACCOUNT]:[JIRA_API_KEY])`

## Using the CLI to sync projects
Use `jira-tickets-from-gh sync [options]` command to sync a GitHub project with a Jira cloud project.

| Option                                      | Required | Description |
|---------------------------------------------|----------|-------------|
|`--transitions-to-wip <number,...>`          | `false`  | list of jira issue transitions in order to have a wip task |
|`--transitions-to-done <number,...>`         | `false`  | list of jira issue transitions in order to have a done task |
|`--gh-assignees-map <gh_user:jira_user,...>` | `false`  | map of GitHub users to Jira ones (email) |
|`--sleep-time <ms>`			      | `false`  | sleep time between executions. If not specified the program will run once |
|`--gh-project-id <string>`                   | `true`   | Github project ID |
|`--jira-project-key <string>`                | `true`   | Jira project KEY |
|`--jira-subdomain <string>`		      | `true`   | Jira subdomain |
|`--jira-estimate-field <string>`	      | `false`  | Jira field name within it's api response that stores story points (estimate) |
|`--help`				      | `false`  | display help for command |

### Example
*Using environment variables*
```bash
export GITHUB_TOKEN=token
export JIRA_TOKEN=token
jira-tickets-from-gh sync \
  --gh-project-id=PROJECT_ID \
  --jira-project-key=PROJECT_KEY \ 
  --jira-subdomain=MYSUBDOMAIN \
  --gh-assignees-map=iolave:abc@abc.com
```

*Passing tokens via the cli*
```bash
export GITHUB_TOKEN=token
export JIRA_TOKEN=token
jira-tickets-from-gh --gh-token=TOKEN --jira-token=TOKEN sync \
  --gh-project-id=PROJECT_ID \
  --jira-project-key=PROJECT_KEY \ 
  --jira-subdomain=MYSUBDOMAIN \
  --gh-assignees-map=iolave:abc@abc.com
```

*Execution example*
```
[2024-08-01 10:45:46][INFO]	syncCmd.action                          	creating jira issue                                         	{"title":"TEST: bun-jira-tickets-from-gh"}
[2024-08-01 10:45:47][INFO]	syncCmd.action                          	created issue                                               	{"url":"https://mfhnet.atlassian.net/browse/TEST3-112"}
```

## Running using Docker
### Environment variables
| Env                   | Maps to option          |
|-----------------------|-------------------------|
| GITHUB_TOKEN          | `--gh-token` |
| GH_PROJECT_ID         | `--gh-project-id` |
| GH_USERS_MAP          | `--gh-assignees-map` |
| JIRA_TOKEN            | `--jira-token` |
| JIRA_SUBDOMAIN        | `--jira-subdomain` |
| JIRA_PROJECT_KEY      | `--jira-project-key` |
| JIRA_WIP_TRANSITIONS  | `--transitions-to-wip` |
| JIRA_DONE_TRANSITIONS | `--transitions-to-done` |
| JIRA_ISSUE_PREFIX	| `--jira-issue-prefix` |
| JIRA_ESTIMATE_FIELD	| `--jira-estimate-field` |
| SLEEP_TIME            | `--sleep-time` |
| VERBOSE               | if value is set to `true` then `-v` option is mapped |

### Example env file
```
GITHUB_TOKEN=TOKEN
GH_PROJECT_ID=PROJECT_ID
GH_USERS_MAP=GH_USER:JIRA_EMAIL
JIRA_TOKEN=TOKEN
JIRA_SUBDOMAIN=SUBDOMAIN
JIRA_PROJECT_KEY=TEST
JIRA_WIP_TRANSITIONS=2
JIRA_DONE_TRANSITIONS=3
JIRA_ISSUE_PREFIX=[BACKEND]
JIRA_ESTIMATE_FIELD=customfield_10016
SLEEP_TIME=600000
VERBOSE=false
```

### Build
```bash
docker compose build
```

### Run
```bash
docker compose --env-file=path/to/env up -d
```

