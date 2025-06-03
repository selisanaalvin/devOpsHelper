const express = require("express");
const fs = require("fs").promises;
const path = require("path");
const bodyParser = require("body-parser");
const {
  S3Client,
  CreateBucketCommand,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} = require("@aws-sdk/client-s3");
const {
  LambdaClient,
  CreateFunctionCommand,
  UpdateFunctionCodeCommand,
  GetFunctionCommand,
} = require("@aws-sdk/client-lambda");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const archiver = require("archiver");

const app = express();
app.use(bodyParser.json());

// Generate Dockerfile
app.post("/generate-dockerfile", async (req, res) => {
  const {
    baseImage = "node:latest",
    workDir = "/app",
    copy = "package*.json ./",
    exposedPort = 3000,
    volume,
    cmd = ["node", "app.js"],
    extra,
    projectLocation,
  } = req.body;

  if (!projectLocation) {
    return res.status(400).json({
      error: "Missing required field: projectLocation",
    });
  }

  const dockerfileContent = `
# Base Image
FROM ${baseImage}

# Set Working Directory
WORKDIR ${workDir}

# Copy Files
COPY ${copy}

# Install Dependencies (if node is used)
${baseImage.startsWith("node") ? "RUN npm install" : ""}

# Extra Commands
${extra || ""}

# Volumes
${volume ? `VOLUME ${JSON.stringify(volume)}` : ""}

# Expose Port
EXPOSE ${exposedPort}

# Default Command
CMD ${JSON.stringify(cmd)}
  `.trim();

  try {
    const filePath = path.join(projectLocation, "Dockerfile");
    await fs.writeFile(filePath, dockerfileContent);
    res.json({
      message: "Dockerfile created successfully.",
      filePath,
    });
  } catch (error) {
    console.error("Error writing Dockerfile:", error);
    res.status(500).json({ error: "Failed to write Dockerfile." });
  }
});

// Generate .gitlab-ci.yml
app.post("/generate-gitlab-ci", async (req, res) => {
  const {
    image = "node:latest",
    stages = [],
    buildScript,
    testScript,
    deployScript,
    artifactsPath = "build/",
    environment = "production",
    projectLocation,
    targetBranches = [],
    variables,
  } = req.body;

  if (!projectLocation || stages.length === 0 || targetBranches.length === 0) {
    return res.status(400).json({
      error:
        "Missing required fields: projectLocation, stages, or targetBranches",
    });
  }

  const variablesSection = variables
    ? `variables:\n${Object.entries(variables)
        .map(([key, value]) => `  ${key}: "${value}"`)
        .join("\n")}`
    : "";

  const gitlabCIContent = `
image: ${image}

${variablesSection}

stages:
${stages.map((stage) => `  - ${stage}`).join("\n")}

${stages
  .map((stage) => {
    let script = "";
    if (stage === "build") {
      script = buildScript
        ? buildScript.map((cmd) => `    - ${cmd}`).join("\n")
        : `    - echo "No build commands provided."`;
    } else if (stage === "test") {
      script = testScript
        ? testScript.map((cmd) => `    - ${cmd}`).join("\n")
        : `    - echo "No test commands provided."`;
    } else if (stage === "deploy") {
      script = deployScript
        ? deployScript.map((cmd) => `    - ${cmd}`).join("\n")
        : `    - echo "No deploy commands provided."`;
    }

    const stageName = stage.charAt(0).toUpperCase() + stage.slice(1);
    return `
${stage}:
  stage: ${stage}
  script:
${script}
  ${stage === "build" ? `artifacts:\n    paths:\n      - ${artifactsPath}` : ""}
  ${stage === "deploy" ? `environment:\n    name: ${environment}` : ""}
  rules:
    - if: '$CI_PIPELINE_SOURCE == "push" || $CI_PIPELINE_SOURCE == "merge_request_event"'
      when: always
      only:
${targetBranches.map((branch) => `        - ${branch}`).join("\n")}`;
  })
  .join("\n")}
  `.trim();

  try {
    const filePath = path.join(projectLocation, ".gitlab-ci.yml");
    await fs.writeFile(filePath, gitlabCIContent);
    res.json({
      message: ".gitlab-ci.yml created successfully.",
      filePath,
    });
  } catch (error) {
    console.error("Error writing .gitlab-ci.yml:", error);
    res.status(500).json({ error: "Failed to write .gitlab-ci.yml." });
  }
});

// Generate Lambda Function
app.post("/generate-lambda-function", async (req, res) => {
  const { functionName, runtime = "nodejs18.x", projectLocation } = req.body;

  if (!functionName || !projectLocation) {
    return res.status(400).json({
      error: "Missing required fields: functionName or projectLocation",
    });
  }

  const lambdaFileContent = `
exports.handler = async (event, context) => {
  return {
    statusCode: 200,
    body: JSON.stringify({ message: "Hello from Lambda!" }),
  };
};
  `.trim();

  const lambdaDirectory = path.join(projectLocation, functionName);

  try {
    // Create Lambda folder and write function code
    await fs.mkdir(lambdaDirectory, { recursive: true });
    const filePath = path.join(lambdaDirectory, "index.js");
    await fs.writeFile(filePath, lambdaFileContent);

    // Generate metadata for deployment
    const metadata = `
FunctionName: ${functionName}
Runtime: ${runtime}
Handler: index.handler
    `.trim();
    const metadataPath = path.join(lambdaDirectory, "metadata.txt");
    await fs.writeFile(metadataPath, metadata);

    res.json({
      message: "Lambda function created successfully.",
      directory: lambdaDirectory,
      functionFile: filePath,
    });
  } catch (error) {
    console.error("Error creating Lambda function:", error);
    res.status(500).json({ error: "Failed to create Lambda function." });
  }
});

app.post("/deploy-lambda", async (req, res) => {
  const { projectLocation, region, functionName, roleArn } = req.body;

  if (!projectLocation || !region || !functionName || !roleArn) {
    return res.status(400).json({
      error:
        "Missing required fields: projectLocation, functionName, and roleArn are required.",
    });
  }

  const lambdaClient = new LambdaClient({ region });
  const lambdaFolder = path.join(projectLocation, functionName);
  const metadataPath = path.join(lambdaFolder, "metadata.txt");

  try {
    // Read metadata.txt
    const metadataRaw = await fs.readFile(metadataPath, "utf8");
    const metadataLines = metadataRaw.split("\n");
    const meta = {};
    metadataLines.forEach((line) => {
      const [key, value] = line.split(":").map((s) => s.trim());
      if (key && value) {
        meta[key] = value;
      }
    });

    if (!meta.FunctionName || !meta.Runtime || !meta.Handler) {
      return res
        .status(400)
        .json({ error: "metadata.txt is missing required fields." });
    }

    // Zip the lambda folder
    const zipPath = path.join(projectLocation, `${functionName}.zip`);
    await new Promise((resolve, reject) => {
      const output = fs.createWriteStream(zipPath);
      const archive = archiver("zip", { zlib: { level: 9 } });

      output.on("close", () => resolve());
      archive.on("error", (err) => reject(err));

      archive.pipe(output);
      archive.directory(lambdaFolder, false);
      archive.finalize();
    });

    // Check if function exists
    let lambdaFunctionExists = false;
    try {
      await lambdaClient.send(
        new GetFunctionCommand({ FunctionName: meta.FunctionName })
      );
      lambdaFunctionExists = true;
    } catch (e) {
      if (e.name !== "ResourceNotFoundException") throw e;
    }

    const zipBuffer = await fs.readFile(zipPath);

    if (lambdaFunctionExists) {
      // Update function code
      const updateRes = await lambdaClient.send(
        new UpdateFunctionCodeCommand({
          FunctionName: meta.FunctionName,
          ZipFile: zipBuffer,
        })
      );
      res.json({
        message: "Lambda function code updated successfully.",
        data: updateRes,
      });
    } else {
      // Create function
      const createParams = {
        FunctionName: meta.FunctionName,
        Runtime: meta.Runtime,
        Role: roleArn,
        Handler: meta.Handler,
        Code: { ZipFile: zipBuffer },
        Publish: true,
      };
      const createRes = await lambdaClient.send(
        new CreateFunctionCommand(createParams)
      );
      res.json({
        message: "Lambda function created successfully.",
        data: createRes,
      });
    }
  } catch (error) {
    console.error("Error deploying Lambda:", error);
    res.status(500).json({ error: "Failed to deploy Lambda function." });
  }
});

app.post("/create-s3-bucket", async (req, res) => {
  const { bucketName, region = "us-east-1" } = req.body;

  if (!bucketName) {
    return res
      .status(400)
      .json({ error: "Missing required field: bucketName" });
  }

  const s3Client = new S3Client({ region });

  try {
    const params = { Bucket: bucketName };
    if (region !== "us-east-1") {
      params.CreateBucketConfiguration = { LocationConstraint: region };
    }
    await s3Client.send(new CreateBucketCommand(params));

    res.json({ message: `Bucket '${bucketName}' created successfully.` });
  } catch (error) {
    console.error("Error creating S3 bucket:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/generate-s3-crud-lambda", async (req, res) => {
  const {
    functionName,
    runtime = "nodejs18.x",
    projectLocation,
    bucketName,
    region = "us-east-1",
  } = req.body;

  if (!functionName || !projectLocation || !bucketName) {
    return res.status(400).json({
      error:
        "Missing required fields: functionName, projectLocation, or bucketName",
    });
  }

  const lambdaCode = `
const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

const REGION = "${region}";
const BUCKET_NAME = "${bucketName}";

const s3Client = new S3Client({ region: REGION });

exports.handler = async (event) => {
  const { httpMethod, pathParameters, body } = event;
  const key = pathParameters?.key;

  if (!key) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Missing object key in path parameters." }),
    };
  }

  try {
    switch (httpMethod) {
      case "PUT":
        if (!body) {
          return { statusCode: 400, body: JSON.stringify({ error: "Missing request body." }) };
        }
        await s3Client.send(new PutObjectCommand({
          Bucket: BUCKET_NAME,
          Key: key,
          Body: body,
        }));
        return {
          statusCode: 200,
          body: JSON.stringify({ message: \`Object '\${key}' created/updated.\` }),
        };

      case "GET":
        const getUrl = await getSignedUrl(s3Client, new GetObjectCommand({
          Bucket: BUCKET_NAME,
          Key: key,
        }), { expiresIn: 3600 });
        return {
          statusCode: 200,
          body: JSON.stringify({ downloadUrl: getUrl }),
        };

      case "DELETE":
        await s3Client.send(new DeleteObjectCommand({
          Bucket: BUCKET_NAME,
          Key: key,
        }));
        return {
          statusCode: 200,
          body: JSON.stringify({ message: \`Object '\${key}' deleted.\` }),
        };

      default:
        return {
          statusCode: 405,
          body: JSON.stringify({ error: "Method Not Allowed" }),
        };
    }
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
  `.trim();

  const lambdaDir = path.join(projectLocation, functionName);
  try {
    await fs.mkdir(lambdaDir, { recursive: true });
    const filePath = path.join(lambdaDir, "index.js");
    await fs.writeFile(filePath, lambdaCode);

    // Write metadata for deployment
    const metadata = `
FunctionName: ${functionName}
Runtime: ${runtime}
Handler: index.handler
    `.trim();
    const metadataPath = path.join(lambdaDir, "metadata.txt");
    await fs.writeFile(metadataPath, metadata);

    res.json({
      message: "S3 CRUD Lambda function generated successfully.",
      directory: lambdaDir,
      functionFile: filePath,
    });
  } catch (error) {
    console.error("Error generating S3 CRUD Lambda function:", error);
    res
      .status(500)
      .json({ error: "Failed to generate S3 CRUD Lambda function." });
  }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
