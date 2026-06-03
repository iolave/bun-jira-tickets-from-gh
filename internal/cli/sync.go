package cli

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"reflect"
	"regexp"
	"slices"
	"strings"
	"sync"
	"time"

	jira "github.com/ctreminiom/go-atlassian/v2/jira/v3"
	jiramodels "github.com/ctreminiom/go-atlassian/v2/pkg/infra/models"
	"github.com/iolave/jira-tickets-from-gh/internal/github"
	"github.com/iolave/jira-tickets-from-gh/internal/helpers"
	"github.com/iolave/jira-tickets-from-gh/internal/models"
	"github.com/sirupsen/logrus"
	"gopkg.in/yaml.v3"
)

// SyncCmdAction syncs GitHub projects with Jira cloud boards.
func SyncCmdAction(args Cmd) {
	level := logrus.InfoLevel
	if args.Debug != nil && *args.Debug == true {
		level = logrus.DebugLevel
	}
	log := newLogger(level)
	log.Debugln("initializing db models")
	m, err := models.Initialize()

	if err != nil {
		log.WithFields(logrus.Fields{"err": err}).Errorln("db models initialization failed")
		exitFromErr(err)
	}

	if args.Sync == nil {
		log.WithFields(logrus.Fields{"err": err}).Errorln("call to sync action args.Sync property is nil")
		exitOnInvalidCall("sync")
	}

	log.WithFields(logrus.Fields{"config": args.Sync.Config}).Debugln("reading config file from location")
	b, err := os.ReadFile(args.Sync.Config)

	if err != nil {
		log.WithFields(logrus.Fields{"config": args.Sync.Config, "err": err}).Errorln("reading config file from location failed")
		exitFromErr(err)
	}

	log.Debugln("parsing config content")
	var config Config
	err = yaml.Unmarshal(b, &config)
	if err != nil {
		log.WithFields(logrus.Fields{"err": err}).Errorln("parsing config content failed")
		exitFromErr(err)
	}

	log.Debugln("validating config properties")
	err = config.validate()
	if err != nil {
		log.WithFields(logrus.Fields{"err": err}).Errorln("config properties validation failed")
		exitFromErr(err)
	}

	if args.GithubToken == nil {
		err := errors.New(`please set the "GITHUB_TOKEN" env variable`)
		log.WithFields(logrus.Fields{"err": err}).Errorln("GithubToken property is nil")
		exitFromErr(err)
	}
	gh := github.New(*args.GithubToken)

	var wg sync.WaitGroup
	for i := 0; i < len(config.Projects); i++ {
		// Increment the wait group counter
		wg.Add(1)
		go func() {
			// Decrement the counter when the go routine completes
			defer wg.Done()
			syncProject(args, config, i, m, gh, log)
		}()
	}
	wg.Wait()
}

func syncProject(args Cmd, config Config, projPos int, m *models.Models, gh *github.GitHubClient, log *logrus.Logger) {
	epics := []epic{}
	projectCfg := config.Projects[projPos]
	log.WithFields(logrus.Fields{"project": projectCfg.Name}).Debugln("syncing project")

	// creates new jira client
	log.WithFields(logrus.Fields{"project": projectCfg.Name}).Debugln("creating new jira client")
	url := fmt.Sprintf("https://%s.atlassian.net", projectCfg.Jira.Subdomain)
	jc, err := jira.New(nil, url)
	if err != nil {
		log.WithFields(logrus.Fields{"err": err, "project": projectCfg.Name}).Errorln("failed creating jira client")
		exitFromErr(err)
	}
	log.WithFields(logrus.Fields{"project": projectCfg.Name}).Debugln("getting jira creds")
	token, email, err := getProjectJiraCreds(args, projectCfg.Name)
	if err != nil {
		log.WithFields(logrus.Fields{"err": err, "project": projectCfg.Name}).Errorln("failed to retrieve jira creds")
		exitFromErr(err)
	}
	jc.Auth.SetBasicAuth(email, token)

	// get and set required github project fields into the model
	log.WithFields(logrus.Fields{"project": projectCfg.Name}).Debugln("retrieving github project fields")
	fieldsResult, _, err := gh.GetProjectFields(projectCfg.Github.ProjectID)
	if err != nil {
		log.WithFields(logrus.Fields{"err": err, "project": projectCfg.Name}).Errorln("failed retrieving github project fields")
		exitFromErr(err)
	}
	fieldsIds := struct{ JiraUrl, JiraIssueType, Title, Estimate, Status, Repo, Assignees, Epic string }{}
	for _, v := range fieldsResult.Data.Node.Fields.Nodes {
		switch v.Name {
		case models.FIELD_NAME_JIRA_URL:
			fieldsIds.JiraUrl = v.ID
		case models.FIELD_NAME_JIRA_ISSUE_TYPE:
			fieldsIds.JiraIssueType = v.ID
		case models.FIELD_NAME_TITLE:
			fieldsIds.Title = v.ID
		case models.FIELD_NAME_ESTIMATE:
			fieldsIds.Estimate = v.ID
		case models.FIELD_NAME_STATUS:
			fieldsIds.Status = v.ID
		case models.FIELD_NAME_ASSIGNEES:
			fieldsIds.Assignees = v.ID
		case models.FIELD_NAME_REPO:
			fieldsIds.Repo = v.ID
		case models.FIELD_NAME_EPIC:
			var response *jiramodels.ResponseScheme
			epics, response, err = getProjectEpics(jc, projectCfg.Jira.ProjectKey)
			fmt.Println("[RESPONSE]", response.Bytes.String())

			if err != nil {
				log.WithFields(logrus.Fields{
					"error":    err,
					"project":  projectCfg.Name,
					"response": response.Bytes.String(),
				}).Errorln("failed to retrieve epics")
			} else {
				log.WithFields(logrus.Fields{
					"epics":   epics,
					"project": projectCfg.Name,
				}).Debugln("got epics")
				// TODO: update github field options
			}
			fieldsIds.Epic = v.ID

			if v.Options == nil {
				err = errors.New("Epic field is not of type select")
				log.WithFields(logrus.Fields{
					"error":   err.Error(),
					"project": projectCfg.Name,
				}).Errorln("invalid field type")
				exitFromErr(err)
			}

			shouldUpdateOptions := false
			opts := []string{}
			for _, epic := range epics {
				opts = append(opts, epic.Title)
				found := false
				for _, opt := range *v.Options {
					if strings.TrimSpace(epic.Title) == strings.TrimSpace(opt.Name) {
						found = true
						break
					}
				}

				if !found {
					shouldUpdateOptions = true
				}
			}
			if shouldUpdateOptions {
				// TODO: Update github options
				if _, err = gh.UpdateProjectFieldOptions(v.ID, opts); err != nil {
					log.WithFields(logrus.Fields{
						"error":   err.Error(),
						"project": projectCfg.Name,
					}).Errorln("unable to update Epic field")
					exitFromErr(err)
				}
			}
		}
	}
	v := reflect.ValueOf(fieldsIds)
	for i := 0; i < v.NumField(); i++ {
		if v.Field(i).String() == "" {
			err := fmt.Errorf(`error: missing field in project "%s", make sure it have the following fields [%s, %s, %s, %s, %s, %s, %s, %s]`,
				projectCfg.Name,
				models.FIELD_NAME_JIRA_URL,
				models.FIELD_NAME_JIRA_ISSUE_TYPE,
				models.FIELD_NAME_TITLE,
				models.FIELD_NAME_ESTIMATE,
				models.FIELD_NAME_STATUS,
				models.FIELD_NAME_ASSIGNEES,
				models.FIELD_NAME_REPO,
				models.FIELD_NAME_EPIC,
			)
			log.WithFields(logrus.Fields{"err": err, "project": projectCfg.Name}).Errorln("some fields are not present in github project")
			exitFromErr(err)
		}
	}
	// TODO: maybe is not necesesary to store the project fields id as they can be accessed from variables
	log.WithFields(logrus.Fields{"project": projectCfg.Name, "fields": fieldsIds}).Debugln("upserting project fields ids")
	p, err := m.Projects.Upsert(projectCfg.Github.ProjectID, fieldsIds.JiraUrl, fieldsIds.JiraIssueType, fieldsIds.Title, fieldsIds.Estimate, fieldsIds.Status, fieldsIds.Assignees, fieldsIds.Repo)
	if err != nil {
		log.WithFields(logrus.Fields{"err": err, "project": projectCfg.Name, "fields": fieldsIds}).Errorln("upserting project fields ids failed")
		exitFromErr(err)
	}

	// translates github users to jira account ids
	log.WithFields(logrus.Fields{"project": projectCfg.Name, "assignees": projectCfg.Assignees}).Debugln("translating jira emails to github users")
	assigneesMap := map[string]string{}

	for i := 0; i < len(projectCfg.Assignees); i++ {
		email := projectCfg.Assignees[i].JiraEmail
		// FIXME: response returns a 404 when credentials are invalid, fix this
		users, _, err := jc.User.Search.Do(context.Background(), "", email, 0, 2)

		if err != nil {
			log.WithFields(logrus.Fields{"err": err, "project": projectCfg.Name, "assignee": projectCfg.Assignees[i].JiraEmail}).Errorln("translating jira emails to github user failed")
			exitFromErr(err)
		}

		if len(users) != 1 {
			log.WithFields(logrus.Fields{"project": projectCfg.Name, "assignee": projectCfg.Assignees[i].JiraEmail}).Warnln("found more than one match while translating jira email to github user")
			continue
		}
		assigneesMap[projectCfg.Assignees[i].GHUser] = users[0].AccountID
	}

	log.WithFields(logrus.Fields{"project": projectCfg.Name}).Debugln("querying local issues")
	issues, err := p.GetAllIssues()
	if err != nil {
		log.WithFields(logrus.Fields{"err": err, "project": projectCfg.Name}).Errorln("querying local issues failed")
		exitFromErr(err)
	}
	if len(issues) == 0 {
		var remoteIssues []models.RemoteIssue
		log.WithFields(logrus.Fields{"project": projectCfg.Name}).Debugln("querying gh remote issues")
		remoteIssuesResult, _, err := gh.GetProjectItems(p.ID, getGHFields())
		if err != nil {
			log.WithFields(logrus.Fields{"err": err, "project": projectCfg.Name}).Errorln("querying gh remote issues failed")
			exitFromErr(err)
		}

		log.WithFields(logrus.Fields{"project": projectCfg.Name}).Debugln("upserting remote issues")
		remoteIssuesResult.UnmarshallItems(&remoteIssues)
		remoteIssues = helpers.FilterSlice(remoteIssues, func(ri models.RemoteIssue) bool {
			return ri.Status != nil && ri.JiraIssueType != nil
		})
		remoteIssues = helpers.MapSlice(remoteIssues, func(ri models.RemoteIssue) models.RemoteIssue {
			if ri.JiraUrl.Text != nil {
				match, _ := regexp.MatchString(`^https\:\/\/[a-zA-Z0-9]*\.atlassian\.net\/browse\/.*`, *ri.JiraUrl.Text)
				if !match {
					ri.JiraUrl.Text = nil
				}
			}
			return ri
		})
		_, err = p.UpsertManyIssues(remoteIssues)
		if err != nil {
			log.WithFields(logrus.Fields{"err": err, "project": projectCfg.Name}).Errorln("upserting remote issues failed")
			exitFromErr(err)
		}

		log.WithFields(logrus.Fields{"project": projectCfg.Name}).Debugln("querying local issues with jira url")
		issues, err := p.GetIssuesWithUrl()
		if err != nil {
			log.WithFields(logrus.Fields{"err": err, "project": projectCfg.Name}).Errorln("querying local issues with jira url failed")
			exitFromErr(err)
		}
		for _, is := range issues {
			updateJiraIssueFromGhIssueWithUrl(config, projPos, jc, *is)
		}

		log.WithFields(logrus.Fields{"project": projectCfg.Name}).Debugln("querying local issues without jira url")
		issues, err = p.GetIssuesWithoutUrl()
		if err != nil {
			log.WithFields(logrus.Fields{"err": err, "project": projectCfg.Name}).Errorln("querying local issues without jira url failed")
			exitFromErr(err)
		}
		for _, is := range issues {
			if err = createJiraIssueFromGhIssueWithoutUrl(
				config,
				projPos,
				jc,
				gh,
				*p,
				*is,
				assigneesMap,
				epics,
			); err != nil {
				exitFromErr(err)
			}

		}
	}

	for config.SleepTime != nil && *config.SleepTime >= 0 {
		log.WithFields(logrus.Fields{"sleepTime": *config.SleepTime, "project": projectCfg.Name}).Infoln("sleeping")
		time.Sleep(time.Duration(*config.SleepTime) * time.Millisecond)

		// Checking for epics diff and update remote if necessary
		log.WithFields(logrus.Fields{"project": projectCfg.Name}).Debugln("retrieving github project fields")
		fieldsResult, _, err := gh.GetProjectFields(projectCfg.Github.ProjectID)
		if err != nil {
			log.WithFields(logrus.Fields{"err": err, "project": projectCfg.Name}).Errorln("failed retrieving github project fields")
			exitFromErr(err)
		}

		for _, v := range fieldsResult.Data.Node.Fields.Nodes {
			switch v.Name {
			case models.FIELD_NAME_EPIC:
				var response *jiramodels.ResponseScheme
				epics, response, err = getProjectEpics(jc, projectCfg.Jira.ProjectKey)
				if err != nil {
					log.WithFields(logrus.Fields{
						"error":    err,
						"project":  projectCfg.Name,
						"response": response.Bytes.String(),
					}).Errorln("failed to retrieve epics")
				} else {
					log.WithFields(logrus.Fields{
						"epics":   epics,
						"project": projectCfg.Name,
					}).Debugln("got epics")
				}

				if v.Options == nil {
					err = errors.New("Epic field is not of type select")
					log.WithFields(logrus.Fields{
						"error":   err.Error(),
						"project": projectCfg.Name,
					}).Errorln("invalid field type")
					exitFromErr(err)
				}

				shouldUpdateOptions := false
				opts := []string{}
				for _, epic := range epics {
					opts = append(opts, epic.Title)
					found := false
					for _, opt := range *v.Options {
						if strings.TrimSpace(epic.Title) == strings.TrimSpace(opt.Name) {
							found = true
							break
						}
					}

					if !found {
						shouldUpdateOptions = true
					}
				}
				if shouldUpdateOptions {
					if _, err = gh.UpdateProjectFieldOptions(v.ID, opts); err != nil {
						log.WithFields(logrus.Fields{
							"error":   err.Error(),
							"project": projectCfg.Name,
						}).Errorln("unable to update Epic field")
						exitFromErr(err)
					}
				}
			}
		}

		log.WithFields(logrus.Fields{"project": projectCfg.Name}).Infoln("refreshing remote github issues")
		remoteIssuesResult, _, err := gh.GetProjectItems(p.ID, getGHFields())
		if err != nil {
			log.WithFields(logrus.Fields{"err": err, "project": projectCfg.Name}).Errorln("refreshing remote github issues fields")
			continue
		}
		log.WithFields(logrus.Fields{"issues": remoteIssuesResult}).Debugln("got issues from gh")

		var remoteIssues []models.RemoteIssue
		remoteIssuesResult.UnmarshallItems(&remoteIssues)
		remoteIssues = helpers.FilterSlice(remoteIssues, func(ri models.RemoteIssue) bool {
			if ri.Status != nil && ri.JiraIssueType != nil {
				return true
			}

			status := ""
			if ri.Status != nil {
				status = ri.Status.Name
			}

			log.WithFields(logrus.Fields{
				"project": projectCfg.Name,
				"status":  status,
				"issue":   ri.JiraIssueType,
			}).Infoln("github issue skipped cuz is not ready")
			return false
		})
		remoteIssues = helpers.MapSlice(remoteIssues, func(ri models.RemoteIssue) models.RemoteIssue {
			if ri.JiraUrl.Text != nil {
				match, _ := regexp.MatchString(`^https\:\/\/[a-zA-Z0-9]*\.atlassian\.net\/browse\/.*`, *ri.JiraUrl.Text)
				if !match {
					ri.JiraUrl.Text = nil
				}
			}
			return ri
		})

		riWithoutUrl := helpers.FilterSlice(remoteIssues, func(ri models.RemoteIssue) bool {
			if ri.JiraUrl.Text == nil {
				log.WithFields(logrus.Fields{
					"project": projectCfg.Name,
					"title":   ri.Title.Text,
				}).Debugln("github issue does not have url")
			}

			return ri.JiraUrl.Text == nil
		})
		for _, ri := range riWithoutUrl {
			err := createJiraIssueFromGhIssueWithoutUrl(
				config,
				projPos,
				jc,
				gh,
				*p,
				*ri.ToIssue(p.ID),
				assigneesMap,
				epics,
			)
			if err != nil {
				log.WithFields(logrus.Fields{
					"error": err,
					"title": ri.Title.Text,
				}).Errorln("failed to create jira issue from gh issue without url")
			}
		}

		log.WithFields(logrus.Fields{"project": projectCfg.Name}).Debugln("obtaining local issues diff")
		riWithUrl := helpers.FilterSlice(remoteIssues, func(ri models.RemoteIssue) bool {
			if ri.JiraUrl.Text != nil {
				log.WithFields(logrus.Fields{
					"project": projectCfg.Name,
					"title":   ri.Title.Text,
					"url":     ri.JiraUrl.Text,
				}).Debugln("github issue have url")
			}

			return ri.JiraUrl.Text != nil
		})
		diffs, err := p.GetIssuesDiff(riWithUrl)
		if err != nil {
			log.WithFields(logrus.Fields{"err": err, "project": projectCfg.Name}).Errorln("obtaining local issues diff failed")
			exitFromErr(err)
		}

		for _, issueDiff := range diffs {
			if issueDiff.Issue.JiraURL == nil {
				createJiraIssueFromGhIssueWithoutUrl(
					config,
					projPos,
					jc,
					gh,
					*p,
					*issueDiff.Issue,
					assigneesMap,
					epics,
				)
				continue
			}
			urlSplitted := strings.Split(*issueDiff.Issue.JiraURL, "/")
			if len(urlSplitted) == 0 {
				createJiraIssueFromGhIssueWithoutUrl(
					config,
					projPos,
					jc,
					gh,
					*p,
					*issueDiff.Issue,
					assigneesMap,
					epics,
				)
				continue
			}
			issueKey := urlSplitted[len(urlSplitted)-1]

			switch *issueDiff.PrevStatus {
			case models.STATUS_TODO:
				switch issueDiff.NewStatus {
				case models.STATUS_WIP:
					// TODO: this should return an error
					transitionToWip(jc, issueKey, projPos, config, *issueDiff.Issue)

					if _, err := p.UpsertIssue(
						issueDiff.Issue.GitHubID,
						issueDiff.Issue.Title,
						issueDiff.Issue.Status,
						issueDiff.Issue.JiraURL,
						issueDiff.Issue.JiraIssueType,
						issueDiff.Issue.Repository,
						issueDiff.Issue.Epic,
						issueDiff.Issue.Estimate,
						&issueDiff.Issue.Assignees,
					); err != nil {
						log.WithFields(logrus.Fields{"err": err, "projectId": p.ID}).Errorln("failed to upsert issue")
					}
				case models.STATUS_DONE:
					// TODO: this should return an error
					transitionToWip(jc, issueKey, projPos, config, *issueDiff.Issue)
					// TODO: this should return an error
					transitionToDone(jc, issueKey, projPos, config, *issueDiff.Issue)

					if _, err := p.UpsertIssue(
						issueDiff.Issue.GitHubID,
						issueDiff.Issue.Title,
						issueDiff.Issue.Status,
						issueDiff.Issue.JiraURL,
						issueDiff.Issue.JiraIssueType,
						issueDiff.Issue.Repository,
						issueDiff.Issue.Epic,
						issueDiff.Issue.Estimate,
						&issueDiff.Issue.Assignees,
					); err != nil {
						log.WithFields(logrus.Fields{"err": err, "projectId": p.ID}).Errorln("failed to upsert issue")
					}
				}
			case models.STATUS_WIP:
				switch issueDiff.NewStatus {
				case models.STATUS_DONE:
					// TODO: this should return an error
					transitionToDone(jc, issueKey, projPos, config, *issueDiff.Issue)

					if _, err := p.UpsertIssue(
						issueDiff.Issue.GitHubID,
						issueDiff.Issue.Title,
						issueDiff.Issue.Status,
						issueDiff.Issue.JiraURL,
						issueDiff.Issue.JiraIssueType,
						issueDiff.Issue.Repository,
						issueDiff.Issue.Epic,
						issueDiff.Issue.Estimate,
						&issueDiff.Issue.Assignees,
					); err != nil {
						log.WithFields(logrus.Fields{"err": err, "projectId": p.ID}).Errorln("failed to upsert issue")
					}
				}
			}
		}

		log.WithFields(logrus.Fields{"project": projectCfg.Name}).Debugln("obtaining new issues")
		ids := []string{}
		for _, v := range remoteIssues {
			ids = append(ids, v.ID)
		}
		idsThatdoesntExist, err := p.FindIssuesThatDoesntExist(ids)
		if err != nil {
			log.WithFields(logrus.Fields{"err": err, "project": projectCfg.Name}).Errorln("obtaining new issues failed")
			exitFromErr(err)
		}
		newIssues := helpers.FilterSlice(remoteIssues, func(i models.RemoteIssue) bool {
			idx := slices.IndexFunc(idsThatdoesntExist, func(id string) bool { return id == i.ID })
			if idx == -1 {
				return false
			}
			return true
		})
		for _, newIssue := range newIssues {
			var err error = nil
			log.WithFields(logrus.Fields{"issue": newIssue}).Debugln("new issue to be created")

			if newIssue.JiraUrl.Text == nil {
				err = createJiraIssueFromGhIssueWithoutUrl(
					config,
					projPos,
					jc,
					gh,
					*p,
					*newIssue.ToIssue(p.ID),
					assigneesMap,
					epics,
				)
			} else {
				err = updateJiraIssueFromGhIssueWithUrl(
					config,
					projPos,
					jc,
					*newIssue.ToIssue(p.ID),
				)
			}
			if err != nil {
				log.WithFields(logrus.Fields{"error": err, "issue": newIssue}).Errorln("failed to create/update jira issue")
			}
		}
	}
}

type SyncCmd struct {
	Config string `arg:"required,--config,-c" help:"path to config file" placeholder:"<PATH>"`
}

type Config struct {
	SleepTime *int  `yaml:"sleepTime"`
	EnableAPI *bool `yaml:"enableApi"`
	Projects  []struct {
		Name      string `yaml:"name"`
		Assignees []struct {
			JiraEmail string `yaml:"jiraEmail"`
			GHUser    string `yaml:"ghUser"`
		} `yaml:"assignees"`
		Github struct {
			ProjectID string `yaml:"projectId"`
		}
		Jira struct {
			Subdomain     string  `yaml:"subdomain"`
			ProjectKey    string  `yaml:"projectKey"`
			EstimateField *string `yaml:"estimateField"`
			IssuePrefix   *string `yaml:"issuePrefix"`
			Issues        []struct {
				Type              string `yaml:"type"`
				TransitionsToWIP  []int  `yaml:"transitionsToWip"`
				TransitionsToDone []int  `yaml:"transitionsToDone"`
			} `yaml:"issues"`
		} `yaml:"jira"`
	} `yaml:"sync"`
}

func (c Config) validate() error {
	for i := 0; i < len(c.Projects); i++ {
		proj := c.Projects[i]

		if proj.Name == "" {
			return fmt.Errorf(`"sync[%d].name" property is missing`, i)
		}

		validNamePattern := "^[a-zA-Z0-9_]*$"
		validName, _ := regexp.MatchString(validNamePattern, proj.Name)

		if !validName {
			return fmt.Errorf(`"sync[%d].name" property should match the expression "%s"`, i, validNamePattern)
		}

		for j := 0; j < len(proj.Assignees); j++ {
			assignee := proj.Assignees[j]

			if assignee.GHUser == "" {
				return fmt.Errorf(`"sync[%d].assignees[%d].ghUser" property is missing`, i, j)
			}
			if assignee.JiraEmail == "" {
				return fmt.Errorf(`"sync[%d].assignees[%d].jiraEmail" property is missing`, i, j)
			}

		}

		if proj.Github.ProjectID == "" {
			return fmt.Errorf(`"sync[%d].github.projectId" property is missing`, i)
		}

		// checking if project id is duped
		for j := 0; j < len(c.Projects); j++ {
			if j == i {
				continue
			}

			if proj.Github.ProjectID == c.Projects[j].Github.ProjectID {
				return fmt.Errorf(`"sync[%d].github.projectId" property is duplicated at "sync[%d].github.projectId"`, i, j)
			}

		}

		if proj.Jira.Subdomain == "" {
			return fmt.Errorf(`"sync[%d].jira.subdomain" property is missing`, i)
		}
		if proj.Jira.ProjectKey == "" {
			return fmt.Errorf(`"sync[%d].jira.projectKey" property is missing`, i)
		}

		for j := 0; j < len(proj.Jira.Issues); j++ {
			issue := proj.Jira.Issues[j]

			if issue.Type == "" {
				return fmt.Errorf(`"sync[%d].jira.issues[%d].type" property is missing`, i, j)
			}
		}

	}

	return nil
}

func getProjectJiraCreds(args Cmd, projectName string) (token string, email string, err error) {
	envEmail := fmt.Sprintf("JIRA_EMAIL_%s", projectName)
	envToken := fmt.Sprintf("JIRA_TOKEN_%s", projectName)

	email = os.Getenv(envEmail)
	token = os.Getenv(envToken)

	if email != "" && token != "" {
		return token, email, nil
	}

	if args.JiraEmail == nil {
		err := errors.New(`please set the "JIRA_EMAIL" env variable`)
		return "", "", err
	}

	if args.JiraToken == nil {
		err := errors.New(`please set the "JIRA_TOKEN" env variable`)
		return "", "", err
	}

	return *args.JiraToken, *args.JiraEmail, nil
}

func getGHFields() []github.ProjectField {
	return []github.ProjectField{
		{Type: github.PROJECT_FIELD_TEXT, FieldAlias: "title", FieldName: "Title"},
		{Type: github.PROJECT_FIELD_SINGLE_SELECT, FieldAlias: "status", FieldName: "Status"},
		{Type: github.PROJECT_FIELD_USER, FieldAlias: "assignees", FieldName: "Assignees"},
		{Type: github.PROJECT_FIELD_NUMBER, FieldAlias: "estimate", FieldName: "Estimate"},
		{Type: github.PROJECT_FIELD_SINGLE_SELECT, FieldAlias: "jiraIssueType", FieldName: "Jira issue type"},
		{Type: github.PROJECT_FIELD_TEXT, FieldAlias: "jiraUrl", FieldName: "Jira URL"},
		{Type: github.PROJECT_FIELD_REPO, FieldAlias: "repository", FieldName: "Repository"},
		{Type: github.PROJECT_FIELD_SINGLE_SELECT, FieldAlias: "epic", FieldName: "Epic"},
	}
}

func updateJiraIssueFromGhIssueWithUrl(
	config Config,
	projPos int,
	jc *jira.Client,
	is models.Issue,
) error {
	urlSplitted := strings.Split(*is.JiraURL, "/")
	if len(urlSplitted) == 0 {
		return errors.New("issue url is nil")
	}
	key := urlSplitted[len(urlSplitted)-1]

	switch *is.Status {
	case models.STATUS_WIP:
		transitionToWip(jc, key, projPos, config, is)
	case models.STATUS_DONE:
		transitionToWip(jc, key, projPos, config, is)
		transitionToDone(jc, key, projPos, config, is)
	}

	return nil

}

func createJiraIssueFromGhIssueWithoutUrl(
	config Config,
	projPos int,
	jc *jira.Client,
	gh *github.GitHubClient,
	p models.Project,
	is models.Issue,
	assignees map[string]string,
	epics []epic,
) error {
	if is.Status == nil {
		return errors.New("item does not have any status, assuming it is not ok and skipping creation")
	}

	var assignee *string
	if len(is.Assignees) > 0 {
		login := assignees[is.Assignees[0]]
		assignee = &login
	}

	var summary string
	if prefix := config.Projects[projPos].Jira.IssuePrefix; prefix != nil && *prefix != "" {
		summary = fmt.Sprintf("%s %s", *prefix, is.Title)
	} else {
		summary = is.Title
	}

	b, err := json.Marshal(is)
	fmt.Println("issue", string(b), err)

	epicKey := ""
	if is.Epic != nil {
		for _, epic := range epics {
			fmt.Printf("[DEBUG] (INTERNAL EPIC: %s) (ISSUE EPIC: %s)\n", epic.Title, *is.Epic)
			if strings.Trim(epic.Title, " ") == *is.Epic {
				epicKey = epic.Key
				break
			}

		}
	}

	jiraIssue := &jiramodels.IssueScheme{Fields: &jiramodels.IssueFieldsScheme{
		IssueType: &jiramodels.IssueTypeScheme{Name: *is.JiraIssueType},
		Parent: &jiramodels.ParentScheme{
			Key: epicKey,
		},
		Project: &jiramodels.ProjectScheme{Key: config.Projects[projPos].Jira.ProjectKey},
		Summary: summary,
	}}
	b, err = json.Marshal(jiraIssue)
	fmt.Println(string(b), err)

	fmt.Printf("INFO: issue: NONE,\t parent_epic: %s,\t issue_name: %s\n", jiraIssue.Fields.Parent.Key, jiraIssue.Fields.Summary)
	jiraIssueCustomFields := &jiramodels.CustomFields{}
	if estimateField := config.Projects[projPos].Jira.EstimateField; estimateField != nil && is.Estimate != nil {
		estimate := *is.Estimate
		jiraIssueCustomFields.Number(*estimateField, float64(estimate))
	}
	if assignee != nil {
		jiraIssue.Fields.Assignee = &jiramodels.UserScheme{AccountID: *assignee}
	}
	result, response, err := jc.Issue.Create(context.Background(), jiraIssue, jiraIssueCustomFields)
	if err != nil {
		b, _ := json.Marshal(jiraIssue)
		fmt.Printf("[DEBUG] FAILED TO CREATE JIRA ISSUE (STATUS: %d) (ERROR: %s) (BODY: %s) (REQ %s)\n", response.StatusCode, err.Error(), response.Bytes.String(), string(b))
		return err
	}

	url := fmt.Sprintf("https://%s.atlassian.net/browse/%s", config.Projects[projPos].Jira.Subdomain, result.Key)

	_, _, err = gh.UpdateProjectItemField(is.GitHubProjectID, is.GitHubID, p.Fields.JiraURL, github.PROJECT_FIELD_TEXT, url)
	if err != nil {
		return err
	}

	if _, err := p.UpsertIssue(
		is.GitHubID,
		is.Title,
		is.Status,
		&url,
		is.JiraIssueType,
		is.Repository,
		is.Epic,
		is.Estimate,
		&is.Assignees,
	); err != nil {
		return err
	}

	switch *is.Status {
	case models.STATUS_WIP:
		transitionToWip(jc, result.Key, projPos, config, is)
	case models.STATUS_DONE:
		transitionToWip(jc, result.Key, projPos, config, is)
		transitionToDone(jc, result.Key, projPos, config, is)
	}
	return nil
}

func transitionToWip(jc *jira.Client, key string, pos int, config Config, is models.Issue) {
	issueTypes := helpers.FilterSlice(
		config.Projects[pos].Jira.Issues,
		func(it struct {
			Type              string `yaml:"type"`
			TransitionsToWIP  []int  `yaml:"transitionsToWip"`
			TransitionsToDone []int  `yaml:"transitionsToDone"`
		}) bool {
			if is.JiraIssueType == nil {
				return false
			}
			return it.Type == *is.JiraIssueType
		})
	if len(issueTypes) == 0 {
		return
	}
	transitions := issueTypes[len(issueTypes)-1].TransitionsToWIP
	for _, t := range transitions {
		_, err := jc.Issue.Move(context.Background(), key, fmt.Sprintf("%d", t), nil)
		// TODO: log the error
		fmt.Println(err)
	}
}

func transitionToDone(jc *jira.Client, key string, pos int, config Config, is models.Issue) {
	issueTypes := helpers.FilterSlice(
		config.Projects[pos].Jira.Issues,
		func(it struct {
			Type              string `yaml:"type"`
			TransitionsToWIP  []int  `yaml:"transitionsToWip"`
			TransitionsToDone []int  `yaml:"transitionsToDone"`
		}) bool {
			if is.JiraIssueType == nil {
				return false
			}
			return it.Type == *is.JiraIssueType
		})
	if len(issueTypes) == 0 {
		return
	}
	transitions := issueTypes[len(issueTypes)-1].TransitionsToDone
	for _, t := range transitions {
		_, err := jc.Issue.Move(context.Background(), key, fmt.Sprintf("%d", t), nil)
		// TODO: log the error
		fmt.Println(err)
	}
}

type epic struct {
	Key   string `json:"key"`
	Title string `json:"title"`
}

func getProjectEpics(jc *jira.Client, key string) (epics []epic, response *jiramodels.ResponseScheme, err error) {
	ctx := context.TODO()
	query := fmt.Sprintf(`project = %s AND issuetype = "Epic"`, key)
	res, response, err := jc.Issue.Search.SearchJQL(ctx, query, []string{"*all"}, nil, 5000, "")
	if err != nil {
		return nil, response, err
	}

	for _, v := range res.Issues {
		epics = append(epics, epic{
			Key:   v.Key,
			Title: v.Fields.Summary,
		})
	}

	return epics, response, nil
}
