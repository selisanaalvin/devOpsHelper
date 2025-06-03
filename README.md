# Generate Dockerfile and GitLab CI

This project provides APIs to generate a `Dockerfile` and a `.gitlab-ci.yml` configuration for a Node.js project using specific payloads.

## Features

- API to generate a `Dockerfile` for a Node.js application.
- API to generate a `.gitlab-ci.yml` file with build, test, and deploy stages.

## Usage

### Dockerfile Generation

#### Endpoint
`POST /generate-dockerfile`

#### Payload
```json
{
  "projectLocation": "C:/ProjectLocation",
  "image": "node:18",
  "stages": ["build", "test", "deploy"],
  "buildScript": ["npm install", "npm run build"],
  "testScript": ["npm test"],
  "deployScript": ["echo 'Deploying...'"] ,
  "artifactsPath": "dist/",
  "environment": "production",
  "targetBranches": ["dev"],
  "variables": {
    "NODE_ENV": "production",
    "API_KEY": "123456"
  }
}
```

### GitLab CI/CD Configuration Generation

#### Endpoint
`POST /generate-gitlab-ci`

#### Payload
```json
{
  "projectLocation": "C:/ProjectLocation",
  "image": "node:18",
  "stages": ["build", "test", "deploy"],
  "buildScript": ["npm install", "npm run build"],
  "testScript": ["npm test"],
  "deployScript": ["echo 'Deploying...'"] ,
  "artifactsPath": "dist/",
  "environment": "production",
  "targetBranches": ["dev"],
  "variables": {
    "NODE_ENV": "production",
    "API_KEY": "123456"
  }
}
```

### Example cURL Commands

#### Generate Dockerfile
```bash
curl -X POST http://localhost:3000/generate-dockerfile \
-H "Content-Type: application/json" \
-d '{
  "projectLocation": "C:/ProjectLocation",
  "image": "node:18",
  "stages": ["build", "test", "deploy"],
  "buildScript": ["npm install", "npm run build"],
  "testScript": ["npm test"],
  "deployScript": ["echo 'Deploying...'"] ,
  "artifactsPath": "dist/",
  "environment": "production",
  "targetBranches": ["dev"],
  "variables": {
    "NODE_ENV": "production",
    "API_KEY": "123456"
  }
}'
```

#### Generate GitLab CI/CD
```bash
curl -X POST http://localhost:3000/generate-gitlab-ci \
-H "Content-Type: application/json" \
-d '{
  "projectLocation": "C:/ProjectLocation",
  "image": "node:18",
  "stages": ["build", "test", "deploy"],
  "buildScript": ["npm install", "npm run build"],
  "testScript": ["npm test"],
  "deployScript": ["echo 'Deploying...'"] ,
  "artifactsPath": "dist/",
  "environment": "production",
  "targetBranches": ["dev"],
  "variables": {
    "NODE_ENV": "production",
    "API_KEY": "123456"
  }
}'
```
