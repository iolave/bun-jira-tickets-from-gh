FROM oven/bun:alpine

ADD ./package.json ./bun.lockb .

RUN bun install

ADD ./entrypoint.sh .
ENTRYPOINT sh ./entrypoint.sh

ADD ./tsconfig.json ./index.ts .
ADD ./helpers helpers
ADD ./services services
ADD ./business-logic business-logic
ADD ./commander commander
ADD ./models models

