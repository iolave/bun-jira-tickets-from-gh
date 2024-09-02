# Replace docker secretes for it's real value
egrep_res=$(egrep  -v '^#'  /run/secrets/* | xargs)
for to_change in $egrep_res; do
	secret_key=$(echo "${to_change}" | awk -F: '{print $1}')
	secret=$(echo "${to_change}" | awk -F: '{print $2}')
	env_res=$(env | grep -Eo "[A-Za-z_]+\=${secret_key}")
	env_key=$(echo "${env_res}" | awk -F= '{print $1}')

	eval "export ${env_key}=${secret}"
done

bun run index.ts sync \
	--gh-token=${GH_TOKEN} \
	--gh-project-id=${GH_PROJECT_ID} \
	--gh-assignees-map=${GH_USERS_MAP} \
	--jira-token=${JIRA_TOKEN} \
	--jira-subdomain=${JIRA_SUBDOMAIN} \
	--jira-project-key=${JIRA_PROJECT_KEY} \
	--transitions-to-wip=${JIRA_WIP_TRANSITIONS} \
	--transitions-to-done=${JIRA_DONE_TRANSITIONS} \
	--sleep-time=${SLEEP_TIME}
