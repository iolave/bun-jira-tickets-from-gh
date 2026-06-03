package github

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"

	"github.com/google/uuid"
)

type ProjectFieldType int

const (
	PROJECT_FIELD_TEXT ProjectFieldType = iota
	PROJECT_FIELD_SINGLE_SELECT
	PROJECT_FIELD_USER
	PROJECT_FIELD_NUMBER
	PROJECT_FIELD_REPO
)

type ListUserProjectsResult struct {
	Errors *[]Error `json:"errors"`
	Data   struct {
		User struct {
			Projects struct {
				Nodes []struct {
					ID    string `json:"id"`
					Title string `json:"title"`
				} `json:"nodes"`
			} `json:"projectsV2"`
		} `json:"user"`
	} `json:"data"`
}

func (c *GitHubClient) ListUserProjects(user string) (ListUserProjectsResult, *http.Response, error) {
	query := fmt.Sprintf(`query{
		user(login:"%s") {
			projectsV2(first:100){ nodes { id title } }
		}
	}`, user)

	var result ListUserProjectsResult

	res, err := c.request(query, &result)
	if err != nil {
		return result, res, err
	}
	err = getErrorFromErrors(result.Errors)

	return result, res, err
}

type ListOrganizationProjectsResult struct {
	Errors *[]Error `json:"errors"`
	Data   struct {
		Organization struct {
			Projects struct {
				Nodes []struct {
					ID    string `json:"id"`
					Title string `json:"title"`
				} `json:"nodes"`
			} `json:"projectsV2"`
		} `json:"organization"`
	} `json:"data"`
}

func (c *GitHubClient) ListOrganizationProjects(org string) (ListOrganizationProjectsResult, *http.Response, error) {
	query := fmt.Sprintf(`query{
		organization(login:"%s") {
			projectsV2(first:100){ nodes { id title } }
		}
	}`, org)

	var result ListOrganizationProjectsResult

	res, err := c.request(query, &result)
	if err != nil {
		return result, res, err
	}
	err = getErrorFromErrors(result.Errors)

	return result, res, err
}

type GetProjectFieldsResult struct {
	Errors *[]Error `json:"errors"`
	Data   struct {
		Node struct {
			Fields struct {
				Nodes []struct {
					ID      string `json:"id"`
					Name    string `json:"name"`
					Options *[]struct {
						ID   string `json:"id"`
						Name string `json:"name"`
					}
				} `json:"nodes"`
			} `json:"fields"`
		} `json:"node"`
	} `json:"data"`
}

func (r GetProjectFieldsResult) GetOptionId(fieldName, name string) (id string, err error) {
	if r.Errors != nil {
		err = getErrorFromErrors(r.Errors)
		return "", err
	}

	name = strings.TrimSpace(name)
	for _, v := range r.Data.Node.Fields.Nodes {
		if v.Name == fieldName {
			if v.Options == nil {
				return "", errors.New("field is not of type single select")
			}

			for _, opt := range *v.Options {
				if strings.TrimSpace(opt.Name) == name {
					return opt.ID, nil
				}
			}
		}

	}
	return "", errors.New("option not found")
}

func (c *GitHubClient) GetProjectFields(id string) (GetProjectFieldsResult, *http.Response, error) {
	query := fmt.Sprintf(`query{ node(id: "%s") {
		... on ProjectV2 {
			fields(first: 100) {nodes {
				... on ProjectV2Field { id name } 
				... on ProjectV2IterationField { id name }
				... on ProjectV2SingleSelectField { id name options { id name }}
			}}
		}
	}}`, id)

	var result GetProjectFieldsResult

	res, err := c.request(query, &result)
	if err != nil {
		return result, res, err
	}
	err = getErrorFromErrors(result.Errors)

	return result, res, err
}

type ProjectField struct {
	Type       ProjectFieldType
	FieldName  string
	FieldAlias string
}

func (f ProjectField) ToQuery() string {
	switch f.Type {
	case PROJECT_FIELD_TEXT:
		return fmt.Sprintf(`
			%s: fieldValueByName(name: "%s") {
				__typename
				... on ProjectV2ItemFieldTextValue {text}
			}
		`, f.FieldAlias, f.FieldName)
	case PROJECT_FIELD_REPO:
		return fmt.Sprintf(`
			%s: fieldValueByName(name: "%s") {
				__typename
				... on ProjectV2ItemFieldRepositoryValue {repository{nameWithOwner}}
			}
		`, f.FieldAlias, f.FieldName)
	case PROJECT_FIELD_SINGLE_SELECT:
		return fmt.Sprintf(`
			%s: fieldValueByName(name: "%s") {
				__typename
				... on ProjectV2ItemFieldSingleSelectValue {name optionId}
			}
		`, f.FieldAlias, f.FieldName)
	case PROJECT_FIELD_NUMBER:
		return fmt.Sprintf(`
			%s: fieldValueByName(name: "%s") {
				__typename
				... on ProjectV2ItemFieldNumberValue {number}
			}
		`, f.FieldAlias, f.FieldName)
	case PROJECT_FIELD_USER:
		return fmt.Sprintf(`
			%s: fieldValueByName(name: "%s") {
				__typename
				... on ProjectV2ItemFieldUserValue {users(first:100){nodes {login}}}
			}
		`, f.FieldAlias, f.FieldName)
	default:
		return ""
	}
}

type GetProjectItemsResult struct {
	Errors *[]Error `json:"errors"`
	Data   struct {
		Node struct {
			Items struct {
				Nodes    []map[string]any `json:"nodes"` // TODO: Add better way to access items
				PageInfo struct {
					StartCursor string `json:"startCursor"`
					EndCursor   string `json:"endCursor"`
					HasNextPage bool   `json:"hasNextPage"`
					HasPrevPage bool   `json:"hasPreviousPage"`
				} `json:"pageInfo"`
			} `json:"items"`
		} `json:"node"`
	} `json:"data"`
}

func (r GetProjectItemsResult) UnmarshallItems(v any) {
	nodes := r.Data.Node.Items.Nodes

	b, _ := json.Marshal(nodes)
	_ = json.Unmarshal(b, v)
}

// TODO: Add better way to access items
func (c *GitHubClient) GetProjectItems(id string, fields []ProjectField) (GetProjectItemsResult, *http.Response, error) {
	queryFields := ""
	for i := 0; i < len(fields); i++ {
		queryFields = fmt.Sprintf("%s %s", queryFields, fields[i].ToQuery())
	}

	query := fmt.Sprintf(`query{ node(id: "%s") { ... on ProjectV2 {
		items(first: 100) {
			pageInfo{startCursor endCursor hasNextPage hasPreviousPage} 
			nodes{
				id
				content{
					__typename
					... on Issue {comments(first:100) {nodes{body}}}
				}
				%s
			}
		}
	}}}`, id, queryFields)

	fmt.Println(query)

	var result GetProjectItemsResult

	res, err := c.request(query, &result)
	if err != nil {
		return result, res, err
	}
	// err = getErrorFromErrors(result.Errors)

	return result, res, err

}

type UpdateProjectItemFieldResult struct {
	Errors *[]Error `json:"errors"`
	Data   struct {
		Update struct {
			ClientMutId string `json:"clientMutationId"`
		} `json:"updateProjectV2ItemFieldValue"`
	} `json:"data"`
}

func (c *GitHubClient) UpdateProjectItemField(projectId, itemId, fieldId string, fieldType ProjectFieldType, value any) (UpdateProjectItemFieldResult, *http.Response, error) {
	var result UpdateProjectItemFieldResult
	var valueQuery = ""
	switch fieldType {
	case PROJECT_FIELD_TEXT:
		valueQuery = fmt.Sprintf(`{ text: "%s"}`, value.(string))
	case PROJECT_FIELD_NUMBER:
		valueQuery = fmt.Sprintf(`{ text: %d}`, value.(int))
	default:
		return result, nil, errors.New("project field type not supported on update (TODO)")
	}

	query := fmt.Sprintf(`mutation UpdateProjectV2ItemFieldValue {
		updateProjectV2ItemFieldValue(input: {
			fieldId: "%s"
			itemId: "%s"
			projectId: "%s"
			clientMutationId: "%s"
			value: %s
		}) {
			clientMutationId
		}
	}`, fieldId, itemId, projectId, uuid.NewString(), valueQuery)

	res, err := c.request(query, &result)
	if err != nil {
		return result, res, err
	}
	err = getErrorFromErrors(result.Errors)

	return result, res, err
}

type UpdateProjectFieldOptionsResult struct {
	Errors *[]Error `json:"errors"`
}

func (c *GitHubClient) UpdateProjectFieldOptions(fieldId string, options []string) (res *http.Response, err error) {
	var valueQuery = ""
	for _, v := range options {
		valueQuery = fmt.Sprintf(`%s, {name: "%s" description:"" color:GRAY}`, valueQuery, v)
	}

	query := fmt.Sprintf(`mutation UpdateProjectV2Field {
		updateProjectV2Field(input: {
			fieldId: "%s"
			clientMutationId: "%s"
			singleSelectOptions: [%s]
		}) {
			clientMutationId
		}
	}`, fieldId, uuid.NewString(), valueQuery)

	result := UpdateProjectFieldOptionsResult{}
	res, err = c.request(query, &result)
	if err != nil {
		return res, err
	}
	if result.Errors != nil {
		err = getErrorFromErrors(result.Errors)
	}

	return res, err
}
