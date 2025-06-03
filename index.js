const express = require("express");
const fs = require("fs");
const path = require("path");
const bodyParser = require("body-parser");

const app = express();
app.use(bodyParser.json());

app.post("/generate-dockerfile", (req, res) => {
  // POST /generate-dockerfile
  // {
  //   "projectLocation": "C:/ProjectLocation",
  //   "image": "node:18",
  //   "stages": ["build", "test", "deploy"],
  //   "buildScript": ["npm install", "npm run build"],
  //   "testScript": ["npm test"],
  //   "deployScript": ["echo 'Deploying...'"],
  //   "artifactsPath": "dist/",
  //   "environment": "production",
  //   "targetBranches": ["dev"],
  //   "variables": {
  //     "NODE_ENV": "production",
  //     "API_KEY": "123456"
  //   }
  // }

  const {
    baseImage,
    workDir,
    copy,
    exposedPort,
    volume,
    cmd,
    extra,
    projectLocation,
  } = req.body;

  // Validate input
  if (!projectLocation) {
    return res
      .status(400)
      .json({ error: "Missing required fields. (projectLocation)" });
  }

  // Generate Dockerfile content
  const dockerfileContent = `
#Image Version (baseImage)
FROM ${baseImage ? baseImage : `node:latest`}
#Set Directory (workDir)
WORKDIR ${workDir ? workDir : "/app"}
COPY ${copy ? copy : `package*.json ./`}
${baseImage ? `` : `RUN npm install`}
${baseImage ? `` : `COPY . .`}

#Extra Command Like RUN (extra)
${extra ? extra : ``}

#Folders variable (volume)
${volume ? `VOLUME ${JSON.stringify(volume)}` : ``}

#Port Exposed (exposedPort)
EXPOSE ${exposedPort ? exposedPort : `3000`}
#CMD or Command (cmd)
CMD ${cmd ? JSON.stringify(cmd) : `["node","app.js"]`}
    `;

  // Save the Dockerfile to the filesystem
  const filePath = path.join(projectLocation, "Dockerfile");
  fs.writeFile(filePath, dockerfileContent.trim(), (err) => {
    if (err) {
      console.error("Error writing Dockerfile:", err);
      return res.status(500).json({ error: "Failed to write Dockerfile." });
    }

    // Respond with success and Dockerfile content
    res.json({
      message: "Dockerfile created successfully.",
    });
  });
});

app.post("/generate-gitlab-ci", (req, res) => {
  // POST /generate-gitlab-ci
  //   {
  //   "projectLocation": "C:/ProjectLocation",
  //   "image": "node:18",
  //   "stages": ["build", "test", "deploy"],
  //   "buildScript": ["npm install", "npm run build"],
  //   "testScript": ["npm test"],
  //   "deployScript": ["echo 'Deploying...'"],
  //   "artifactsPath": "dist/",
  //   "environment": "production",
  //   "targetBranches": ["dev"],
  //   "variables": {
  //     "NODE_ENV": "production",
  //     "API_KEY": "123456"
  //   }
  // }

  const {
    image,
    stages,
    buildScript,
    testScript,
    deployScript,
    artifactsPath,
    environment,
    projectLocation,
    targetBranches, // Array of branches (e.g., ["main", "develop"])
    variables, // Object containing key-value pairs of variables
  } = req.body;

  // Validate input
  if (!projectLocation || !stages || !stages.length || !targetBranches) {
    return res.status(400).json({
      error:
        "Missing required fields. Ensure stages and targetBranches are provided.",
    });
  }

  // Generate variables section
  const variablesSection = variables
    ? `
variables:
${Object.entries(variables)
  .map(([key, value]) => `  ${key}: "${value}"`)
  .join("\n")}
`
    : "";

  // Generate GitLab CI/CD pipeline configuration
  const gitlabCIContent = `
# Use the specified Docker image
image: ${image ? image : "node:latest"}

# Define variables
${variablesSection}

# Define stages
stages:
${stages.map((stage) => `  - ${stage}`).join("\n")}

# Build Stage
${
  stages.includes("build")
    ? `
build:
  stage: build
  script:
${
  buildScript
    ? buildScript.map((cmd) => `    - ${cmd}`).join("\n")
    : `    - echo "No build commands provided."`
}
  artifacts:
    paths:
${artifactsPath ? `      - ${artifactsPath}` : `      - build/`}
  retry: 2
  rules:
    - if: '$CI_PIPELINE_SOURCE == "push" || $CI_PIPELINE_SOURCE == "merge_request_event"'
      when: always
      only:
        - ${targetBranches.join("\n        - ")}
`
    : ""
}

# Test Stage
${
  stages.includes("test")
    ? `
test:
  stage: test
  script:
${
  testScript
    ? testScript.map((cmd) => `    - ${cmd}`).join("\n")
    : `    - echo "No test commands provided."`
}
  retry: 2
  rules:
    - if: '$CI_PIPELINE_SOURCE == "push" || $CI_PIPELINE_SOURCE == "merge_request_event"'
      when: always
      only:
        - ${targetBranches.join("\n        - ")}
`
    : ""
}

# Deploy Stage
${
  stages.includes("deploy")
    ? `
deploy:
  stage: deploy
  script:
${
  deployScript
    ? deployScript.map((cmd) => `    - ${cmd}`).join("\n")
    : `    - echo "No deploy commands provided."`
}
  environment:
    name: ${environment ? environment : "development"}
  rules:
    - if: '$CI_PIPELINE_SOURCE == "push" || $CI_PIPELINE_SOURCE == "merge_request_event"'
      when: always
      only:
        - ${targetBranches.join("\n        - ")}
`
    : ""
}
  `;

  // Save the GitLab CI file to the filesystem
  const filePath = path.join(projectLocation, ".gitlab-ci.yml");
  fs.writeFile(filePath, gitlabCIContent.trim(), (err) => {
    if (err) {
      console.error("Error writing .gitlab-ci.yml:", err);
      return res.status(500).json({ error: "Failed to write .gitlab-ci.yml." });
    }

    // Respond with success and .gitlab-ci.yml content
    res.json({
      message: ".gitlab-ci.yml created successfully.",
    });
  });
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
