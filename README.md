# Sync Jira and GitHub projects
I was forced by my job to use Jira to keep track of tasks, but I kept forgetting to update status within Jira. Most of time im in GitHub and it's just easier to have issues and close them via PR's.

...so i built this tool for myself and hopefully, it will help you too.

> [!WARNING]
> All versions released prior to `v1.0.0` are to be considered [breaking changes](https://semver.org/#how-do-i-know-when-to-release-100) (I'll try my best to not push breaking changes btw).

## Installation
```bash
# Latest
go install github.com/iolave/jira-tickets-from-gh/cmd/jira-tickets-from-gh@latest

# Beta
go install github.com/iolave/jira-tickets-from-gh/cmd/jira-tickets-from-gh@beta

# From source
git clone https://github.com/iolave/jira-tickets-from-gh
cd jira-tickets-from-gh
go install cmd/jira-tickets-from-gh/jira-tickets-from-gh.go
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
- `Epic`: choice field with something (options will be replaced with project ones).

### Get a Jira cloud token
To get a jira api token from your jira cloud account please refer to the [docs](https://support.atlassian.com/atlassian-account/docs/manage-api-tokens-for-your-atlassian-account/).

### Environment variables
- `GITHUB_TOKEN`: Your GitHub token. If the project you're trying to sync is in an organization, make sure the token have access to it.
- `JIRA_TOKEN`: Jira api token used for auth (use `JIRA_TOKEN_{{CONFIG_PROJECT_NAME}}` for project specific credentials).
- `JIRA_EMAIL`: Jira email used for auth (use `JIRA_EMAIL_{{CONFIG_PROJECT_NAME}}` for project specific credentials).

### Get the id of your github project
The cli is shipped with a utility that's going to help you to search a GitHub project id.

#### List organization projects
```bash
jira-tickets-from-gh --gh-token=GH_TOKEN github list-projects --org=<ORG>
# or with envs
# export GITHUB_TOKEN=token
# jira-tickets-from-gh github list-projects --org=<ORG>
```

#### List user projects
```bash
jira-tickets-from-gh --gh-token=GH_TOKEN github list-projects --user=<GH_USER>
# or with envs
# export GITHUB_TOKEN=token
# jira-tickets-from-gh github list-projects --user=<GH_USER>
```

## Using the CLI to sync projects
Use `jira-tickets-from-gh sync` command to sync a GitHub project with a Jira cloud project.

### Config YAML Schema definition

| Property                                    | Required | Description |
|---------------------------------------------|:--------:|-------------|
| `sleepTime`                                 |`false`	 | sleep time between executions (if not specified the program will run once) |
| `enableApi`                                 |`false`	 | serves an api to interact with the projects storage and manage tasks manually (like moving a task to done, not implemented yet) |
| `sync[].name`                               |`true`	 | tag to identify a sync project (characters allowed are `[a-zA-Z0-9_]`) |
| `sync[].assignees[]`                        |`false`	 | map of GitHub users to Jira ones (email)  |
| `sync[].assignees[].jiraEmail`	      |`true`	 | Jira email |
| `sync[].assignees[].ghUser`    	      |`true`	 | GitHub user |
| `sync[].github.projectId`		      |`true`	 | Github project ID |
| `sync[].jira.subdomain`		      |`true`	 | Jira subdomain |
| `sync[].jira.projectKey`		      |`true`	 | Jira project key (usually a the short name) |
| `sync[].jira.estimateField`		      |`false`	 | Jira field name within the api response that stores story points (estimate) |
| `sync[].jira.issuePrefix`		      |`false`	 | Prefix to be added to Jira issues |
| `sync[].jira.issues`    		      |`true`	 | Jira issues type definition |
| `sync[].jira.issues.type`    		      |`true`	 | Jira issue name (ie. Task) |
| `sync[].jira.issues.transitionsToWip[]`     |`false`	 | Jira issue transitions to get to a WIP status (in the future a jira utility will be added to retrieve this transitions) |
| `sync[].jira.issues.transitionsToDone[]`    |`false`	 | Jira issue transitions to get to a DONE status (in the future a jira utility will be added to retrieve this transitions) |

### Example
*Using environment variables*
```bash
export GITHUB_TOKEN=token
export JIRA_TOKEN=token
export JIRA_EMAIL=email@org.com
jira-tickets-from-gh sync --config ./config.yml
```

*Passing tokens via the cli (might not work with multiple jira subdomain projects)*
```bash
jira-tickets-from-gh --gh-token=TOKEN --jira-token=TOKEN sync --config ./config.yml
```

*Execution example*
```
[2024-08-01 10:45:46][INFO]	syncCmd.action                          	creating jira issue                                         	{"title":"TEST: jira-tickets-from-gh"}
[2024-08-01 10:45:47][INFO]	syncCmd.action                          	created issue                                               	{"url":"https://mfhnet.atlassian.net/browse/TEST3-112"}
```

## Running using Docker
### Environment variables
<!-- TODO: Update this part of the docs -->
| Env		                | Info          |
|-------------------------------|---------------|
| `GITHUB_TOKEN`		| |
| `JIRA_EMAIL`			| |
| `JIRA_EMAIL_{{project_name}}` | optional, requires to add the secret to the docker compose file. |
| `JIRA_TOKEN`			| |
| `JIRA_TOKEN_{{project_name}}` | optional, requires to add the secret to the docker compose file. |
| `VERBOSE`			| if value is set to `true` then `-v` option is mapped. |

### Example env file
<!-- TODO: Update this part of the docs -->
```
GITHUB_TOKEN=TOKEN
JIRA_EMAIL=mail@example.com
JIRA_TOKEN=TOKEN
JIRA_EMAIL_my_project=mail@example.com
JIRA_TOKEN_my_project=TOKEN
VERBOSE=false
```

### Build
```bash
go mod vendor
docker compose build
```

### Run
```bash
docker compose --env-file=path/to/env up -d
```

