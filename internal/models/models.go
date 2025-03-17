package models

import (
	"database/sql"
	"os"

	_ "github.com/mattn/go-sqlite3"
)

type Models struct {
	db       *sql.DB
	Projects Projects
	Issues   Issues
}

func (m *Models) Close() error {
	return m.db.Close()
}

func Initialize() (*Models, error) {
	models := new(Models)

	if err := os.MkdirAll("./data", os.ModePerm); err != nil {
		return nil, err
	}

	db, err := sql.Open("sqlite3", "./data/storage.db")
	if err != nil {
		return nil, err
	}

	_, err = db.Exec(`CREATE TABLE IF NOT EXISTS projects (
		id string not null,
		FID_jiraUrl string not null,
		FID_jiraIssueType string not null,
		FID_title string not null,
		FID_estimate string not null,
		FID_status string not null,
		FID_assignees string not null,
		FID_repository string not null,
		primary key (id)
	)`)
	if err != nil {
		return nil, err
	}

	_, err = db.Exec(`CREATE TABLE IF NOT EXISTS issues (
		projectId	string not null,
		id		string not null,
		title		string not null,
		jiraUrl		string,
		jiraIssueType	string,
		estimate	int,
		status		string,
		assignees	string,
		repository	string,
		epic		string,
		primary key (projectId, id)
	)`)
	if err != nil {
		return nil, err
	}

	models.db = db
	models.Projects = Projects{models: models}
	models.Issues = Issues{models: models}
	return models, nil
}
