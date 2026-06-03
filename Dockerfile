FROM golang:1.25-bookworm

WORKDIR /home/app

ADD ./entrypoint.sh ./entrypoint.sh
ENTRYPOINT sh ./entrypoint.sh

ADD . .
RUN CGO_ENABLED=1 go install ./cmd/jira-tickets-from-gh/jira-tickets-from-gh.go
