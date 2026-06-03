package models

import (
	"errors"
	"fmt"
	"regexp"
	"slices"
	"strings"
)

type RemoteIssue struct {
	ID       string `json:"id"`
	Estimate struct {
		Num *int `json:"number"`
	} `json:"estimate"`
	JiraIssueType *struct {
		Name     string `json:"name"`
		OptionID string `json:"optionId"`
	} `json:"jiraIssueType"`
	JiraUrl struct {
		Text *string `json:"text"`
	} `json:"jiraUrl"`
	Repository struct {
		Repository struct {
			Text *string `json:"nameWithOwner"`
		} `json:"repository"`
	} `json:"repository"`
	Status *struct {
		Name     string `json:"name"`
		OptionID string `json:"optionId"`
	} `json:"status"`
	Title struct {
		Text string `json:"text"`
	} `json:"title"`
	Assignees struct {
		Users struct {
			Nodes []struct {
				Login string `json:"login"`
			} `json:"nodes"`
		} `json:"users"`
	} `json:"assignees"`
	Epic *struct {
		Name     string `json:"name"`
		OptionID string `json:"optionId"`
	} `json:"epic"`
}

func (ri RemoteIssue) ToIssue(projectId string) *Issue {
	assinees := []string{}
	for _, v := range ri.Assignees.Users.Nodes {
		assinees = append(assinees, v.Login)
	}
	issue := new(Issue)
	issue.GitHubProjectID = projectId
	issue.GitHubID = ri.ID
	issue.Title = ri.Title.Text
	issue.JiraURL = ri.JiraUrl.Text
	if ri.JiraIssueType != nil {
		issue.JiraIssueType = &ri.JiraIssueType.Name
	}
	issue.Estimate = ri.Estimate.Num
	if ri.Status != nil {
		issue.Status = (*IssueStatus)(&ri.Status.Name)
	}
	issue.Repository = ri.Repository.Repository.Text
	issue.Assignees = assinees
	if ri.Epic != nil {
		issue.Epic = &ri.Epic.Name
	}

	return issue
}

type Issues struct {
	models *Models
}

func (service *Issues) Upsert(
	projectId, id, title string,
	status *IssueStatus,
	jiraUrl, jiraIssueType, repo, epic *string,
	estimate *int,
	assignees *[]string,
) (*Issue, error) {
	var assigneesStr *string = nil
	if assignees != nil {
		joined := strings.Join(*assignees, ";")
		assigneesStr = &joined
	}
	stmt := `INSERT OR REPLACE INTO issues(
			projectId,
			id,
			jiraUrl,
			jiraIssueType,
			title,
			estimate,
			status,
			assignees,
			repository,
			epic
		) values(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
	_, err := service.models.db.Exec(
		stmt,
		projectId,
		id,
		jiraUrl,
		jiraIssueType,
		title,
		estimate,
		status,
		assigneesStr,
		repo,
		epic,
	)

	if err != nil {
		return nil, err
	}

	if assignees == nil {
		assignees = &[]string{}
	}

	issue := new(Issue)
	issue.GitHubProjectID = projectId
	issue.GitHubID = id
	issue.Title = title
	issue.JiraIssueType = jiraIssueType
	issue.JiraURL = jiraUrl
	issue.Assignees = *assignees
	issue.Repository = repo
	issue.Estimate = estimate
	issue.Status = status
	issue.Epic = epic

	return issue, nil
}

func (service *Issues) UpsertMany(projectId string, issues []RemoteIssue) ([]*Issue, error) {
	var resultIssues []*Issue
	for _, issue := range issues {
		var assignees []string
		for _, node := range issue.Assignees.Users.Nodes {
			assignees = append(assignees, node.Login)
		}

		resultIssue := new(Issue)
		resultIssue.GitHubProjectID = projectId
		resultIssue.GitHubID = issue.ID
		resultIssue.Title = issue.Title.Text
		if issue.JiraIssueType != nil {
			resultIssue.JiraIssueType = &issue.JiraIssueType.Name
		}
		resultIssue.JiraURL = issue.JiraUrl.Text
		resultIssue.Assignees = assignees
		resultIssue.Repository = issue.Repository.Repository.Text
		resultIssue.Estimate = issue.Estimate.Num
		if issue.Status == nil {
			resultIssue.Status = nil
		} else if issue.Status.Name == string(STATUS_WIP) || issue.Status.Name == string(STATUS_DONE) || issue.Status.Name == string(STATUS_TODO) {
			resultIssue.Status = (*IssueStatus)(&issue.Status.Name)
		} else {
			resultIssue.Status = nil
		}
		resultIssues = append(resultIssues, resultIssue)
	}

	tx, err := service.models.db.Begin()
	if err != nil {
		return nil, err
	}
	stmt := `INSERT OR REPLACE INTO issues (
		projectId,
		id,
		jiraUrl,
		jiraIssueType,
		title,
		estimate,
		status,
		assignees,
		repository,
		epic
	) VALUES (?,?,?,?,?,?,?,?,?,?)`
	for _, v := range resultIssues {
		assigneesStr := strings.Join(v.Assignees, ";")
		_, err := tx.Exec(stmt, v.GitHubProjectID, v.GitHubID, v.JiraURL, v.JiraIssueType, v.Title, v.Estimate, v.Status, assigneesStr, v.Repository, v.Epic)
		if err != nil {
			return nil, err
		}
	}
	err = tx.Commit()
	if err != nil {
		return nil, err
	}

	return resultIssues, nil
}

func (service *Issues) UpdateUrl(projectId, id, jiraUrl string) error {
	stmt := `UPDATE issues SET jiraUrl = ?
		WHERE projectId = ? AND id = ?`
	_, err := service.models.db.Exec(
		stmt,
		jiraUrl,
		projectId,
		id,
	)
	return err
}

// Get retrieves a project issue, if no issue found *Issue will be nil
func (p *Issues) Get(githubProjectId, githubId string) (*Issue, error) {
	if githubProjectId == "" {
		return nil, errors.New(`please provide a value for "githubProjectId"`)
	}
	if githubId == "" {
		return nil, errors.New(`please provide a value for "githubId"`)
	}

	stmt := fmt.Sprintf(`SELECT
		projectId,
		id,
		jiraUrl,
		jiraIssueType,
		title,
		estimate,
		status,
		assignees,
		repository,
		epic
	FROM issues
	WHERE id = "%s"
	AND projectId = "%s"
	`, githubId, githubProjectId)
	rows, err := p.models.db.Query(stmt)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	issue := new(Issue)
	var assigneesStr *string
	if !rows.Next() {
		return nil, nil
	}
	err = rows.Scan(
		&issue.GitHubProjectID,
		&issue.GitHubID,
		&issue.JiraURL,
		&issue.JiraIssueType,
		&issue.Title,
		&issue.Estimate,
		&issue.Status,
		&assigneesStr,
		&issue.Repository,
		&issue.Epic,
	)
	if err != nil {
		return nil, err
	}
	assignees := []string{}
	if assigneesStr != nil {
		assignees = strings.Split(*assigneesStr, ";")
	}
	issue.Assignees = assignees
	// uncomment when models is avaialbe within an issue
	// issue.models = p.models
	return issue, nil
}

// GetAll retrieves all project issues, if no issue found *Issue will be nil.
func (p *Issues) GetAll(githubProjectId string) ([]*Issue, error) {
	if githubProjectId == "" {
		return nil, errors.New(`please provide a value for "githubProjectId"`)
	}

	stmt := fmt.Sprintf(`SELECT
		projectId,
		id,
		jiraUrl,
		jiraIssueType,
		title,
		estimate,
		status,
		assignees,
		repository,
		epic
	FROM issues
	WHERE projectId = "%s"
	`, githubProjectId)
	rows, err := p.models.db.Query(stmt)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	issues := []*Issue{}
	for rows.Next() {
		issue := new(Issue)
		var assigneesStr *string

		err = rows.Scan(
			&issue.GitHubProjectID,
			&issue.GitHubID,
			&issue.JiraURL,
			&issue.JiraIssueType,
			&issue.Title,
			&issue.Estimate,
			&issue.Status,
			&assigneesStr,
			&issue.Repository,
			&issue.Epic,
		)
		if err != nil {
			return nil, err
		}
		assignees := []string{}
		if assigneesStr != nil && *assigneesStr != "" {
			assignees = strings.Split(*assigneesStr, ";")
		}
		issue.Assignees = assignees
		// uncomment when models is avaialbe within an issue
		// issue.models = p.models
		issues = append(issues, issue)
	}

	return issues, nil
}

type Diff struct {
	PrevStatus *IssueStatus
	NewStatus  IssueStatus
	Issue      *Issue
}

func (s *Issues) GetThoseWithDiff(projectId string, issues []RemoteIssue) (diff []Diff, err error) {
	for _, remoteIssue := range issues {
		localIssue, err := s.Get(projectId, remoteIssue.ID)
		if err != nil {
			return nil, err
		}
		if localIssue == nil {
			continue
		}
		if *localIssue.Status == STATUS_DONE {
			continue
		}
		if (*localIssue.Status == STATUS_WIP && remoteIssue.Status.Name == string(STATUS_DONE)) || (*localIssue.Status == STATUS_TODO && (remoteIssue.Status.Name == string(STATUS_DONE) || remoteIssue.Status.Name == string(STATUS_WIP))) {
			var assignees []string
			for _, node := range remoteIssue.Assignees.Users.Nodes {
				assignees = append(assignees, node.Login)
			}
			issue := new(Issue)
			issue.GitHubProjectID = projectId
			issue.GitHubID = remoteIssue.ID
			issue.Title = remoteIssue.Title.Text
			issue.JiraURL = remoteIssue.JiraUrl.Text
			if remoteIssue.JiraIssueType != nil {
				issue.JiraIssueType = &remoteIssue.JiraIssueType.Name
			}
			if remoteIssue.Status != nil {
				issue.Status = (*IssueStatus)(&remoteIssue.Status.Name)
			}
			issue.Estimate = remoteIssue.Estimate.Num
			issue.Repository = remoteIssue.Repository.Repository.Text
			issue.Assignees = assignees
			if remoteIssue.Epic != nil {
				issue.Epic = &remoteIssue.Epic.Name
			}
			diff = append(diff, Diff{
				PrevStatus: localIssue.Status,
				NewStatus:  IssueStatus(remoteIssue.Status.Name),
				Issue:      issue,
			})
			continue
		}
	}
	return diff, nil
}

// GetWithoutUrl retrieves project issues whoose jira url field is nil, if no issues are found []*Issue will be nil.
func (p *Issues) GetWithoutUrl(githubProjectId string) ([]*Issue, error) {
	if githubProjectId == "" {
		return nil, errors.New(`please provide a value for "githubProjectId"`)
	}

	stmt := fmt.Sprintf(`SELECT
		projectId,
		id,
		jiraUrl,
		jiraIssueType,
		title,
		estimate,
		status,
		assignees,
		repository,
		epic
	FROM issues
	WHERE projectId = "%s"
	AND jiraUrl IS NULL
	`, githubProjectId)
	rows, err := p.models.db.Query(stmt)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	issues := []*Issue{}
	for rows.Next() {
		issue := new(Issue)
		var assigneesStr *string

		err = rows.Scan(
			&issue.GitHubProjectID,
			&issue.GitHubID,
			&issue.JiraURL,
			&issue.JiraIssueType,
			&issue.Title,
			&issue.Estimate,
			&issue.Status,
			&assigneesStr,
			&issue.Repository,
			&issue.Epic,
		)
		if err != nil {
			return nil, err
		}
		assignees := []string{}
		if assigneesStr != nil && *assigneesStr != "" {
			assignees = strings.Split(*assigneesStr, ";")
		}
		issue.Assignees = assignees

		if issue.JiraURL != nil {
			match, err := regexp.MatchString(`^https\:\/\/[a-zA-Z0-9]*\.atlassian\.net\/browse\/.*`, *issue.JiraURL)
			if err != nil {
				return nil, err
			}

			if match {
				continue
			}
		}

		// uncomment when models is avaialbe within an issue
		// issue.models = p.models
		issues = append(issues, issue)
	}

	return issues, nil
}

// GetWithoutUrl retrieves project issues whoose jira url field is not nil, if no issues are found []*Issue will be nil.
func (p *Issues) GetWithUrl(githubProjectId string) ([]*Issue, error) {
	if githubProjectId == "" {
		return nil, errors.New(`please provide a value for "githubProjectId"`)
	}

	stmt := fmt.Sprintf(`SELECT
		projectId,
		id,
		jiraUrl,
		jiraIssueType,
		title,
		estimate,
		status,
		assignees,
		repository,
		epic
	FROM issues
	WHERE projectId = "%s"
	AND jiraUrl IS NOT NULL
	`, githubProjectId)
	rows, err := p.models.db.Query(stmt)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	issues := []*Issue{}
	for rows.Next() {
		issue := new(Issue)
		var assigneesStr *string

		err = rows.Scan(
			&issue.GitHubProjectID,
			&issue.GitHubID,
			&issue.JiraURL,
			&issue.JiraIssueType,
			&issue.Title,
			&issue.Estimate,
			&issue.Status,
			&assigneesStr,
			&issue.Repository,
			&issue.Epic,
		)
		if err != nil {
			return nil, err
		}
		assignees := []string{}
		if assigneesStr != nil && *assigneesStr != "" {
			assignees = strings.Split(*assigneesStr, ";")
		}
		issue.Assignees = assignees
		match, err := regexp.MatchString(`^https\:\/\/[a-zA-Z0-9]*\.atlassian\.net\/browse\/.*`, *issue.JiraURL)
		if err != nil {
			return nil, err
		}

		if !match {
			continue
		}
		// uncomment when models is avaialbe within an issue
		// issue.models = p.models
		issues = append(issues, issue)
	}

	return issues, nil
}

// FindThoseThatExist takes a list of issues ids and returns those that does exists.
func (p *Issues) FindThoseThatExist(githubProjectId string, ids []string) ([]string, error) {
	newIds := slices.Clone(ids)
	if githubProjectId == "" {
		return []string{}, errors.New(`please provide a value for "githubProjectId"`)
	}

	for i := 0; i < len(newIds); i++ {
		newIds[i] = fmt.Sprintf(`"%s"`, newIds[i])
	}
	idsQuery := strings.Join(newIds, ",")
	// query to select those ids that exist
	stmt := fmt.Sprintf(`SELECT
		id
	FROM issues
	WHERE projectId = "%s"
	AND id IN (%s)
	`, githubProjectId, idsQuery)
	rows, err := p.models.db.Query(stmt)
	if err != nil {
		return []string{}, err
	}
	defer rows.Close()
	idsThatExist := []string{}
	for rows.Next() {
		id := ""

		err = rows.Scan(
			&id,
		)
		if err != nil {
			return []string{}, err
		}
		idsThatExist = append(idsThatExist, id)
	}

	return idsThatExist, nil
}

// FindThoseThatDoesntExist takes a list of issues ids and returns those that does not exists.
func (p *Issues) FindThoseThatDoesntExist(githubProjectId string, ids []string) ([]string, error) {
	idsThatExist, err := p.FindThoseThatExist(githubProjectId, ids)
	if err != nil {
		return []string{}, err
	}

	idsThatDoesntExist := []string{}

	for i := 0; i < len(ids); i++ {
		found := false
		for j := 0; j < len(idsThatExist); j++ {
			if ids[i] == idsThatExist[j] {
				found = true
			}
		}
		if !found {
			idsThatDoesntExist = append(idsThatDoesntExist, ids[i])
		}
	}

	return idsThatDoesntExist, nil
}

type IssueStatus string

const (
	STATUS_TODO IssueStatus = "Todo"
	STATUS_WIP  IssueStatus = "In Progress"
	STATUS_DONE IssueStatus = "Done"
)

type Issue struct {
	GitHubProjectID string
	GitHubID        string
	Title           string
	JiraURL         *string
	JiraIssueType   *string
	Estimate        *int
	Status          *IssueStatus
	Assignees       []string
	Repository      *string
	Epic            *string
}
