# Generate Dockerfile and GitLab CI

This project provides APIs to generate a `Dockerfile` and a `.gitlab-ci.yml` configuration for a Node.js project using specific payloads.

## Features

- API to generate a `Dockerfile` for a Node.js application.
- API to generate a `.gitlab-ci.yml` file with build, test, and deploy stages.
- API to generate a `Lambda Function` file
- API to deploy the `Lambda Function` you created

## Usage

- Install AWS CLI to your machine and configure
  - `aws configure`
- To Run the Helper
  - `npm install`
  - `npm install aws-sdk`
  - `npm run start`

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
  "deployScript": ["echo 'Deploying...'"],
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
  "deployScript": ["echo 'Deploying...'"],
  "artifactsPath": "dist/",
  "environment": "production",
  "targetBranches": ["dev"],
  "variables": {
    "NODE_ENV": "production",
    "API_KEY": "123456"
  }
}
```

### Lambda Function Generation

#### Endpoint

`POST /generate-lambda-function`

#### Payload

```json
{
  "projectLocation": "C:/ProjectLocation",
  "functionName": "myLambdaFunction",
  "runtime": "nodejs18.x"
}
```

### Lambda Function Generation

#### Endpoint

`POST /deploy-lambda`

#### Payload

```json
{
  "projectLocation": "C:/ProjectLocation",
  "region": "us-east-1",
  "functionName": "myLambdaFunction",
  "roleArn": "arn:aws:iam::123456789012:role/YourLambdaExecutionRole"
}
```

### Create S3 Bucket

#### Endpoint

`POST /create-s3-bucket`

#### Payload

```json
{
  "bucketName": "TestS3Bucket",
  "region": "us-east-1"
}
```

### Generate Lambda With CRUD Function to S3 Bucket

#### Endpoint

`POST /generate-s3-crud-lambda`

#### Payload

```json
{
  "projectLocation": "C:/ProjectLocation",
  "functionName": "CrudS3Bucket",
  "runtime": "nodejs18.x",
  "bucketName": "TestS3Bucket",
  "region": "us-east-1"
}
```
